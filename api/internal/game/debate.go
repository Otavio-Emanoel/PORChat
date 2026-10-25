package game

import (
	"encoding/json"
	"log"
	"math/rand"
	"sync"
	"time"

	"github.com/porchat/api/internal/ws"
)

type DebatePhase string

const (
	PhaseChat             DebatePhase = "CHAT"
	PhaseLobby            DebatePhase = "LOBBY"
	PhaseOpeningArguments DebatePhase = "OPENING_ARGUMENTS"
	PhaseRebuttal         DebatePhase = "REBUTTAL"
	PhaseVoting           DebatePhase = "VOTING"
	PhaseResults          DebatePhase = "RESULTS"
)

type DebateTopic struct {
	Topic      string `json:"topic"`
	Category   string `json:"category"`
	SideALabel string `json:"side_a_label"`
	SideBLabel string `json:"side_b_label"`
}

var curatedTopics = []DebateTopic{
	// Guerra Tecnológica
	{Topic: "Abas vs Espaços para indentação de código", Category: "Tech", SideALabel: "Abas (Tabs)", SideBLabel: "Espaços (Spaces)"},
	{Topic: "TypeScript vs JavaScript puro no Frontend", Category: "Tech", SideALabel: "TypeScript", SideBLabel: "JavaScript Puro"},
	{Topic: "Dark Mode vs Light Mode para trabalhar", Category: "Tech", SideALabel: "Dark Mode", SideBLabel: "Light Mode"},
	{Topic: "Vim vs VS Code para programar", Category: "Tech", SideALabel: "Vim / Neovim", SideBLabel: "VS Code"},
	{Topic: "Monolito bem feito vs Arquitetura de Microsserviços", Category: "Tech", SideALabel: "Monolito Fiel", SideBLabel: "Microsserviços"},

	// Polêmicas Cotidianas
	{Topic: "Biscoito ou Bolacha?", Category: "Cotidiano", SideALabel: "Biscoito", SideBLabel: "Bolacha"},
	{Topic: "Café sem açúcar é psicopatia ou o único jeito certo?", Category: "Cotidiano", SideALabel: "Amargo é Vida", SideBLabel: "Doce & Suave"},
	{Topic: "Áudios de WhatsApp acima de 1 minuto deviam ser banidos?", Category: "Cotidiano", SideALabel: "Banimento Já", SideBLabel: "Podcast de Amigo"},
	{Topic: "Segunda-feira deveria ser feriado mundial obrigatório?", Category: "Cotidiano", SideALabel: "Feriado Eterno", SideBLabel: "Dia Produtivo"},
	{Topic: "Dormir de meia no frio: aconchegante ou bizarro?", Category: "Cotidiano", SideALabel: "Pés Quentinhos", SideBLabel: "Agonia Total"},

	// Alta Gastronomia de Boteco
	{Topic: "Abacaxi na pizza é crime hediondo ou alta gastronomia?", Category: "Gastronomia", SideALabel: "Crime Culinário", SideBLabel: "Alta Gastronomia"},
	{Topic: "Strogonoff se come com batata palha ou purê de batata?", Category: "Gastronomia", SideALabel: "Batata Palha Crocante", SideBLabel: "Purê Cremoso"},
	{Topic: "Coxinha se come pela pontinha ou pela bunda?", Category: "Gastronomia", SideALabel: "Pela Pontinha", SideBLabel: "Pela Bunda Recheada"},
	{Topic: "Cachorro-quente tem que levar purê de batata?", Category: "Gastronomia", SideALabel: "Com Purê (SP)", SideBLabel: "Sem Purê (Raiz)"},
	{Topic: "Pizza fria no café da manhã é banquete dos deuses?", Category: "Gastronomia", SideALabel: "Manjar dos Deuses", SideBLabel: "Desespero Matinal"},

	// Filmes & Cultura Pop
	{Topic: "O final de Game of Thrones estragou toda a série?", Category: "Cultura Pop", SideALabel: "Estragou Tudo", SideBLabel: "Foi Incompreendido"},
	{Topic: "Star Wars vs O Senhor dos Anéis: qual a maior saga?", Category: "Cultura Pop", SideALabel: "Star Wars", SideBLabel: "Senhor dos Anéis"},
	{Topic: "Filme dublado ou legendado no cinema?", Category: "Cultura Pop", SideALabel: "Dublagem BR Lendária", SideBLabel: "Áudio Original Legendado"},
	{Topic: "Severus Snape em Harry Potter: herói ou vilão amargurado?", Category: "Cultura Pop", SideALabel: "Herói Corajoso", SideBLabel: "Tóxico Amargurado"},
	{Topic: "Shrek 2 é o ápice absoluto da animação mundial?", Category: "Cultura Pop", SideALabel: "Obra-Prima Suprema", SideBLabel: "Exagero Nostálgico"},
}

type Debater struct {
	ID       string `json:"id"`
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar,omitempty"`
	Argument string `json:"argument,omitempty"`
	Votes    int    `json:"votes"`
}

type DebateState struct {
	Topic            string         `json:"topic"`
	Category         string         `json:"category,omitempty"`
	SideALabel       string         `json:"side_a_label,omitempty"`
	SideBLabel       string         `json:"side_b_label,omitempty"`
	DebaterA         *Debater       `json:"debater_a"`
	DebaterB         *Debater       `json:"debater_b"`
	JurorIDs         []string       `json:"juror_ids,omitempty"`
	CurrentSpeakerID string         `json:"current_speaker_id,omitempty"`
	VotesCount       map[string]int `json:"votes_count"`
	WinnerSide       string         `json:"winner_side,omitempty"`
	IsPaused         bool           `json:"is_paused"`
}

type DebateEngine struct {
	mu               sync.RWMutex
	roomID           string
	hub              *ws.Hub
	phase            DebatePhase
	phaseEndsAt      time.Time
	remainingSeconds int
	isPaused         bool
	state            *DebateState
	voters           map[string]string // userID -> side
	stopTicker       chan struct{}
	reactionBuffer   map[string]int
	reactionMu       sync.Mutex
}

func NewDebateEngine(roomID string, hub *ws.Hub) *DebateEngine {
	return &DebateEngine{
		roomID:         roomID,
		hub:            hub,
		phase:          PhaseChat,
		voters:         make(map[string]string),
		stopTicker:     make(chan struct{}),
		reactionBuffer: make(map[string]int),
	}
}

func (e *DebateEngine) IsActive() bool {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.phase != PhaseChat
}

func (e *DebateEngine) GetStateSnapshot() interface{} {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return map[string]interface{}{
		"game_type":         "debate",
		"phase":             e.phase,
		"phase_ends_at":     e.phaseEndsAt.UnixMilli(),
		"remaining_seconds": e.remainingSeconds,
		"debate_state":      e.state,
	}
}

func (e *DebateEngine) HandleAction(client *ws.Client, env *ws.Envelope) {
	e.mu.Lock()
	defer e.mu.Unlock()

	switch env.Event {
	case "game:start":
		var p struct {
			GameType   string `json:"game_type"`
			Topic      string `json:"topic"`
			Category   string `json:"category"`
			DebaterAID string `json:"debater_a_id"`
			DebaterBID string `json:"debater_b_id"`
		}
		_ = json.Unmarshal(env.Payload, &p)
		e.startDebate(p.Topic, p.Category, p.DebaterAID, p.DebaterBID, client)

	case "game:pause":
		e.isPaused = true
		if e.state != nil {
			e.state.IsPaused = true
		}
		e.broadcastState()

	case "game:resume":
		e.isPaused = false
		if e.state != nil {
			e.state.IsPaused = false
		}
		e.broadcastState()

	case "game:skip_phase":
		e.onPhaseTimeout(e.phase)

	case "game:abort":
		e.phase = PhaseChat
		e.broadcastState()
		log.Printf("[Room %s] Debate aborted by host.", e.roomID)

	case "debate:submit_argument":
		var p struct {
			Argument string `json:"argument"`
		}
		if err := json.Unmarshal(env.Payload, &p); err == nil && p.Argument != "" {
			if e.state != nil {
				if e.state.DebaterA != nil && (client.UserID == e.state.DebaterA.ID || client.Nickname == e.state.DebaterA.Nickname) {
					e.state.DebaterA.Argument = p.Argument
				} else if e.state.DebaterB != nil && (client.UserID == e.state.DebaterB.ID || client.Nickname == e.state.DebaterB.Nickname) {
					e.state.DebaterB.Argument = p.Argument
				} else {
					// Fallback: assign to whichever debater doesn't have an argument yet
					if e.state.DebaterA.Argument == "" {
						e.state.DebaterA.Argument = p.Argument
					} else {
						e.state.DebaterB.Argument = p.Argument
					}
				}
				e.broadcastState()
			}
		}

	case "debate:cast_vote":
		var p struct {
			Choice string `json:"choice"` // "side_a" or "side_b"
		}
		if err := json.Unmarshal(env.Payload, &p); err == nil {
			if e.phase == PhaseVoting && (p.Choice == "side_a" || p.Choice == "side_b") {
				// Prevent duplicate vote change if already voted
				prevChoice, alreadyVoted := e.voters[client.UserID]
				if alreadyVoted {
					e.state.VotesCount[prevChoice]--
				}
				e.voters[client.UserID] = p.Choice
				e.state.VotesCount[p.Choice]++

				if e.state.DebaterA != nil {
					e.state.DebaterA.Votes = e.state.VotesCount["side_a"]
				}
				if e.state.DebaterB != nil {
					e.state.DebaterB.Votes = e.state.VotesCount["side_b"]
				}
				e.broadcastState()
			}
		}

	case "debate:reaction":
		var p struct {
			Emoji string `json:"emoji"`
		}
		if err := json.Unmarshal(env.Payload, &p); err == nil && p.Emoji != "" {
			e.recordReaction(p.Emoji)
		}
	}
}

func (e *DebateEngine) recordReaction(emoji string) {
	e.reactionMu.Lock()
	e.reactionBuffer[emoji]++
	count := e.reactionBuffer[emoji]
	e.reactionMu.Unlock()

	// Broadcast immediately to TV screens
	payload := map[string]interface{}{
		"reactions": []map[string]interface{}{
			{"emoji": emoji, "count": count},
		},
	}
	if out, err := ws.NewEnvelope("tv:reaction_stream", e.roomID, payload); err == nil {
		e.hub.BroadcastToClientType(e.roomID, "tv", out)
	}
}

func (e *DebateEngine) startDebate(topic, category, debaterAID, debaterBID string, client *ws.Client) {
	// Stop existing ticker if any
	select {
	case e.stopTicker <- struct{}{}:
	default:
	}

	sideALabel := "Lado A (Coral)"
	sideBLabel := "Lado B (Menta)"

	if topic == "" {
		// Pick random topic matching category or from all curated topics
		var pool []DebateTopic
		if category != "" {
			for _, t := range curatedTopics {
				if t.Category == category {
					pool = append(pool, t)
				}
			}
		}
		if len(pool) == 0 {
			pool = curatedTopics
		}

		r := rand.New(rand.NewSource(time.Now().UnixNano()))
		selected := pool[r.Intn(len(pool))]
		topic = selected.Topic
		category = selected.Category
		sideALabel = selected.SideALabel
		sideBLabel = selected.SideBLabel
	}

	// Matchmaking: identify online candidates if debaters are not explicitly passed
	onlineUsers := e.hub.GetOnlineUsers(e.roomID)
	var candidates []ws.OnlineUser
	for _, u := range onlineUsers {
		if u.ClientType != "tv" {
			candidates = append(candidates, u)
		}
	}

	nameA := "Defesa Coral"
	nameB := "Defesa Menta"
	var jurorIDs []string

	if debaterAID != "" {
		for _, u := range candidates {
			if u.ID == debaterAID {
				nameA = u.Nickname
				break
			}
		}
	} else if len(candidates) > 0 {
		debaterAID = candidates[0].ID
		nameA = candidates[0].Nickname
	} else if client != nil {
		debaterAID = client.UserID
		nameA = client.Nickname
	} else {
		debaterAID = "debater-a"
	}

	if debaterBID != "" {
		for _, u := range candidates {
			if u.ID == debaterBID {
				nameB = u.Nickname
				break
			}
		}
	} else if len(candidates) > 1 {
		debaterBID = candidates[1].ID
		nameB = candidates[1].Nickname
	} else {
		debaterBID = "debater-b"
	}

	for _, u := range candidates {
		if u.ID != debaterAID && u.ID != debaterBID {
			jurorIDs = append(jurorIDs, u.ID)
		}
	}

	e.voters = make(map[string]string)
	e.isPaused = false
	e.state = &DebateState{
		Topic:      topic,
		Category:   category,
		SideALabel: sideALabel,
		SideBLabel: sideBLabel,
		DebaterA: &Debater{
			ID:       debaterAID,
			Nickname: nameA,
			Votes:    0,
		},
		DebaterB: &Debater{
			ID:       debaterBID,
			Nickname: nameB,
			Votes:    0,
		},
		JurorIDs:   jurorIDs,
		VotesCount: map[string]int{"side_a": 0, "side_b": 0},
	}

	// Begin LOBBY phase (10s)
	e.transitionTo(PhaseLobby, 10)
}

func (e *DebateEngine) transitionTo(nextPhase DebatePhase, durationSeconds int) {
	e.phase = nextPhase
	e.remainingSeconds = durationSeconds
	e.phaseEndsAt = time.Now().Add(time.Duration(durationSeconds) * time.Second)

	log.Printf("[Room %s] Debate transitioning to phase %s (%ds)", e.roomID, nextPhase, durationSeconds)
	e.broadcastState()

	go e.runPhaseTicker(nextPhase, durationSeconds)
}

func (e *DebateEngine) runPhaseTicker(currentPhase DebatePhase, seconds int) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-e.stopTicker:
			return
		case <-ticker.C:
			e.mu.Lock()
			if e.phase != currentPhase {
				e.mu.Unlock()
				return
			}
			if e.isPaused {
				e.mu.Unlock()
				continue
			}

			e.remainingSeconds--

			// Emit 1s tick
			tickPayload := map[string]interface{}{
				"remaining_seconds": e.remainingSeconds,
				"phase_ends_at":     e.phaseEndsAt.UnixMilli(),
			}
			if tickEnv, err := ws.NewEnvelope("game:tick", e.roomID, tickPayload); err == nil {
				e.hub.BroadcastToRoom(e.roomID, tickEnv)
			}

			if e.remainingSeconds <= 0 {
				e.onPhaseTimeout(currentPhase)
				e.mu.Unlock()
				return
			}
			e.mu.Unlock()
		}
	}
}

func (e *DebateEngine) onPhaseTimeout(phase DebatePhase) {
	switch phase {
	case PhaseLobby:
		e.transitionTo(PhaseOpeningArguments, 45)

	case PhaseOpeningArguments:
		e.transitionTo(PhaseRebuttal, 30)

	case PhaseRebuttal:
		e.transitionTo(PhaseVoting, 20)

	case PhaseVoting:
		// Tally votes & announce winner
		sideAVotes := e.state.VotesCount["side_a"]
		sideBVotes := e.state.VotesCount["side_b"]

		if sideAVotes > sideBVotes {
			e.state.WinnerSide = "side_a"
		} else if sideBVotes > sideAVotes {
			e.state.WinnerSide = "side_b"
		} else {
			e.state.WinnerSide = "tie"
		}

		e.transitionTo(PhaseResults, 15)

	case PhaseResults:
		// Return room to CHAT mode
		e.phase = PhaseChat
		e.broadcastState()
		log.Printf("[Room %s] Debate finished. Room returned to CHAT.", e.roomID)
	}
}

func (e *DebateEngine) broadcastState() {
	snapshot := map[string]interface{}{
		"game_type":         "debate",
		"phase":             e.phase,
		"phase_ends_at":     e.phaseEndsAt.UnixMilli(),
		"remaining_seconds": e.remainingSeconds,
		"debate_state":      e.state,
	}
	if out, err := ws.NewEnvelope("game:state_update", e.roomID, snapshot); err == nil {
		e.hub.BroadcastToRoom(e.roomID, out)
	}
}
