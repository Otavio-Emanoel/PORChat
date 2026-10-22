package game

import (
	"encoding/json"
	"log"
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

type Debater struct {
	ID       string `json:"id"`
	Nickname string `json:"nickname"`
	Argument string `json:"argument,omitempty"`
	Votes    int    `json:"votes"`
}

type DebateState struct {
	Topic            string         `json:"topic"`
	DebaterA         *Debater       `json:"debater_a"`
	DebaterB         *Debater       `json:"debater_b"`
	CurrentSpeakerID string         `json:"current_speaker_id,omitempty"`
	VotesCount       map[string]int `json:"votes_count"`
	WinnerSide       string         `json:"winner_side,omitempty"`
}

type DebateEngine struct {
	mu               sync.RWMutex
	roomID           string
	hub              *ws.Hub
	phase            DebatePhase
	phaseEndsAt      time.Time
	remainingSeconds int
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
			DebaterAID string `json:"debater_a_id"`
			DebaterBID string `json:"debater_b_id"`
		}
		_ = json.Unmarshal(env.Payload, &p)
		if p.Topic == "" {
			p.Topic = "Abacaxi na pizza é crime ou alta gastronomia?"
		}
		e.startDebate(p.Topic, p.DebaterAID, p.DebaterBID)

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

func (e *DebateEngine) startDebate(topic, debaterAID, debaterBID string) {
	// Stop existing ticker if any
	select {
	case e.stopTicker <- struct{}{}:
	default:
	}

	e.voters = make(map[string]string)
	e.state = &DebateState{
		Topic: topic,
		DebaterA: &Debater{
			ID:       debaterAID,
			Nickname: "Defesa A (Coral)",
			Votes:    0,
		},
		DebaterB: &Debater{
			ID:       debaterBID,
			Nickname: "Defesa B (Menta)",
			Votes:    0,
		},
		VotesCount: map[string]int{"side_a": 0, "side_b": 0},
	}

	// Begin LOBBY phase (10s)
	e.transitionTo(PhaseLobby, 10)
}

func (e *DebateEngine) transitionTo(nextPhase DebatePhase, durationSeconds int) {
	e.phase = nextPhase
	e.remainingSeconds = durationSeconds
	e.phaseEndsAt = time.Now().Add(time.Duration(durationSeconds) * time.Second)

	log.Printf("[Room %s] Transitioning to phase %s (%ds)", e.roomID, nextPhase, durationSeconds)
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
