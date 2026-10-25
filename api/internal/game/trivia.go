package game

import (
	"encoding/json"
	"log"
	"math"
	"math/rand"
	"sort"
	"sync"
	"time"

	"github.com/porchat/api/internal/ws"
)

type QuizPhase string

const (
	QuizPhaseChat         QuizPhase = "CHAT"
	QuizPhaseLobby        QuizPhase = "LOBBY"
	QuizPhaseQuestion     QuizPhase = "QUESTION"
	QuizPhaseReveal       QuizPhase = "REVEAL"
	QuizPhaseLeaderboard  QuizPhase = "LEADERBOARD"
	QuizPhaseFinalResults QuizPhase = "FINAL_RESULTS"
)

type TriviaQuestion struct {
	ID               string            `json:"id"`
	Index            int               `json:"index"`
	Category         string            `json:"category"`
	Difficulty       string            `json:"difficulty"`
	Prompt           string            `json:"prompt"`
	Options          map[string]string `json:"options"`
	CorrectOption    string            `json:"-"`
	TotalTimeSeconds int               `json:"total_time_seconds"`
}

type QuizLeaderboardEntry struct {
	UserID            string  `json:"user_id"`
	Nickname          string  `json:"nickname"`
	RoundScore        int     `json:"round_score"`
	TotalScore        int     `json:"total_score"`
	Streak            int     `json:"streak"`
	StreakMultiplier  float64 `json:"streak_multiplier"`
	ResponseTimeMs    int64   `json:"response_time_ms"`
	LastAnswerCorrect bool    `json:"last_answer_correct"`
	Rank              int     `json:"rank,omitempty"`
}

type QuizState struct {
	CurrentQuestionIndex int                     `json:"current_question_index"`
	TotalQuestions       int                     `json:"total_questions"`
	CurrentQuestion      *TriviaQuestion         `json:"current_question,omitempty"`
	AnswersDistribution  map[string]int          `json:"answers_distribution"`
	CorrectOption        string                  `json:"correct_option,omitempty"`
	Leaderboard          []*QuizLeaderboardEntry `json:"leaderboard"`
	IsPaused             bool                    `json:"is_paused,omitempty"`
}

type TriviaEngine struct {
	mu                sync.RWMutex
	roomID            string
	hub               *ws.Hub
	phase             QuizPhase
	phaseEndsAt       time.Time
	remainingSeconds  int
	isPaused          bool
	questions         []TriviaQuestion
	currentQIdx       int
	questionStartedAt time.Time
	state             *QuizState
	userScores        map[string]*QuizLeaderboardEntry // userID -> entry
	answeredUsers     map[string]bool                  // userID -> true for current question
	stopTicker        chan struct{}
}

func NewTriviaEngine(roomID string, hub *ws.Hub) *TriviaEngine {
	return &TriviaEngine{
		roomID:        roomID,
		hub:           hub,
		phase:         QuizPhaseChat,
		questions:     getQuestionBank(),
		userScores:    make(map[string]*QuizLeaderboardEntry),
		answeredUsers: make(map[string]bool),
		stopTicker:    make(chan struct{}),
	}
}

func getQuestionBank() []TriviaQuestion {
	all := []TriviaQuestion{
		// Tecnologia & Programação
		{
			ID: "t1", Category: "Tecnologia", Difficulty: "Média",
			Prompt: "Qual linguagem foi criada no Google por Robert Griesemer, Rob Pike e Ken Thompson?",
			Options: map[string]string{
				"A": "Rust", "B": "Go (Golang)", "C": "Kotlin", "D": "TypeScript",
			},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "t2", Category: "Tecnologia", Difficulty: "Fácil",
			Prompt: "Qual porta TCP padrão é utilizada pelo protocolo HTTP não criptografado?",
			Options: map[string]string{
				"A": "21", "B": "443", "C": "80", "D": "8080",
			},
			CorrectOption: "C", TotalTimeSeconds: 15,
		},
		{
			ID: "t3", Category: "Tecnologia", Difficulty: "Média",
			Prompt: "Quantos bits compõem um endereço IPv4 tradicional?",
			Options: map[string]string{
				"A": "16 bits", "B": "32 bits", "C": "64 bits", "D": "128 bits",
			},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "t4", Category: "Tecnologia", Difficulty: "Difícil",
			Prompt: "Qual estrutura de dados opera no princípio LIFO (Last In, First Out)?",
			Options: map[string]string{
				"A": "Fila (Queue)", "B": "Pilha (Stack)", "C": "Grafo", "D": "Árvore B",
			},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "t5", Category: "Tecnologia", Difficulty: "Média",
			Prompt: "Qual comando do Git desfaz o último commit mantendo as alterações nos arquivos?",
			Options: map[string]string{
				"A": "git reset --soft HEAD~1", "B": "git reset --hard", "C": "git revert -f", "D": "git clean -fd",
			},
			CorrectOption: "A", TotalTimeSeconds: 15,
		},

		// Games & Internet
		{
			ID: "g1", Category: "Games", Difficulty: "Fácil",
			Prompt: "Em Minecraft, qual item é indispensável para criar um portal para o Nether?",
			Options: map[string]string{
				"A": "Bedrock", "B": "Obsidiana", "C": "Pedra Luminosa", "D": "Diamante",
			},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "g2", Category: "Games", Difficulty: "Média",
			Prompt: "Qual é o nome do protagonista silencioso da franquia The Legend of Zelda?",
			Options: map[string]string{
				"A": "Zelda", "B": "Link", "C": "Ganon", "D": "Navi",
			},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "g3", Category: "Games", Difficulty: "Média",
			Prompt: "Qual estúdio desenvolveu os jogos The Witcher 3 e Cyberpunk 2077?",
			Options: map[string]string{
				"A": "Bethesda", "B": "CD Projekt RED", "C": "BioWare", "D": "Ubisoft",
			},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "g4", Category: "Games", Difficulty: "Fácil",
			Prompt: "Qual impostor deve ser descoberto no jogo multijogador viral de 2020?",
			Options: map[string]string{
				"A": "Among Us", "B": "Fall Guys", "C": "Roblox", "D": "Phasmophobia",
			},
			CorrectOption: "A", TotalTimeSeconds: 15,
		},

		// Cultura Pop & Cinema
		{
			ID: "c1", Category: "Cultura Pop", Difficulty: "Fácil",
			Prompt: "Qual é o nome da nave estelar pilotada por Han Solo e Chewbacca em Star Wars?",
			Options: map[string]string{
				"A": "Enterprise", "B": "Millennium Falcon", "C": "X-Wing", "D": "Death Star",
			},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "c2", Category: "Cultura Pop", Difficulty: "Média",
			Prompt: "Qual ator interpretou Oppenheimer no filme vencedor do Oscar dirigido por Christopher Nolan?",
			Options: map[string]string{
				"A": "Cillian Murphy", "B": "Christian Bale", "C": "Matt Damon", "D": "Robert Downey Jr.",
			},
			CorrectOption: "A", TotalTimeSeconds: 15,
		},
		{
			ID: "c3", Category: "Cultura Pop", Difficulty: "Fácil",
			Prompt: "Quantos anéis de poder foram dados aos Senhores dos Anões na mitologia de Tolkien?",
			Options: map[string]string{
				"A": "3", "B": "7", "C": "9", "D": "1",
			},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},

		// Conhecimentos Gerais & Brasil
		{
			ID: "b1", Category: "Geral", Difficulty: "Fácil",
			Prompt: "Qual foi a capital do Brasil antes da fundação de Brasília em 1960?",
			Options: map[string]string{
				"A": "Salvador", "B": "São Paulo", "C": "Rio de Janeiro", "D": "Recife",
			},
			CorrectOption: "C", TotalTimeSeconds: 15,
		},
		{
			ID: "b2", Category: "Geral", Difficulty: "Média",
			Prompt: "Qual é o planeta mais quente do Sistema Solar?",
			Options: map[string]string{
				"A": "Mercúrio", "B": "Vênus", "C": "Marte", "D": "Júpiter",
			},
			CorrectOption: "B", TotalTimeSeconds: 15,
		},
		{
			ID: "b3", Category: "Geral", Difficulty: "Difícil",
			Prompt: "Qual elemento químico possui o símbolo 'W' na Tabela Periódica?",
			Options: map[string]string{
				"A": "Tungstênio", "B": "Vanádio", "C": "Criptônio", "D": "Bismuto",
			},
			CorrectOption: "A", TotalTimeSeconds: 15,
		},
	}
	return all
}

func (e *TriviaEngine) IsActive() bool {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.phase != QuizPhaseChat
}

func (e *TriviaEngine) GetStateSnapshot() interface{} {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return map[string]interface{}{
		"game_type":         "quiz",
		"phase":             e.phase,
		"phase_ends_at":     e.phaseEndsAt.UnixMilli(),
		"remaining_seconds": e.remainingSeconds,
		"quiz_state":        e.state,
	}
}

func (e *TriviaEngine) HandleAction(client *ws.Client, env *ws.Envelope) {
	e.mu.Lock()
	defer e.mu.Unlock()

	switch env.Event {
	case "game:start":
		var p struct {
			Category   string `json:"category"`
			RoundCount int    `json:"round_count"`
		}
		_ = json.Unmarshal(env.Payload, &p)
		e.startQuizWithConfig(p.Category, p.RoundCount)

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
		e.phase = QuizPhaseChat
		e.broadcastState()
		log.Printf("[Room %s] Quiz cancelled by host.", e.roomID)

	case "quiz:submit_answer":
		if e.phase != QuizPhaseQuestion {
			return
		}
		if e.answeredUsers[client.UserID] {
			return
		}
		e.answeredUsers[client.UserID] = true

		var p struct {
			Choice string `json:"choice"`
		}
		if err := json.Unmarshal(env.Payload, &p); err != nil {
			return
		}

		currentQ := e.questions[e.currentQIdx]
		if _, valid := currentQ.Options[p.Choice]; !valid {
			return
		}

		e.state.AnswersDistribution[p.Choice]++

		// Millisecond precision speed and Kahoot formula calculation
		elapsedMs := time.Since(e.questionStartedAt).Milliseconds()
		totalMs := int64(currentQ.TotalTimeSeconds * 1000)
		if elapsedMs < 0 {
			elapsedMs = 0
		}

		roundPoints := 0
		isCorrect := p.Choice == currentQ.CorrectOption

		entry, exists := e.userScores[client.UserID]
		if !exists {
			entry = &QuizLeaderboardEntry{
				UserID:           client.UserID,
				Nickname:         client.Nickname,
				Streak:           0,
				StreakMultiplier: 1.0,
			}
			e.userScores[client.UserID] = entry
		}

		entry.ResponseTimeMs = elapsedMs
		entry.LastAnswerCorrect = isCorrect

		if isCorrect {
			entry.Streak++
			multiplier := 1.0
			if entry.Streak == 2 {
				multiplier = 1.25
			} else if entry.Streak == 3 {
				multiplier = 1.5
			} else if entry.Streak >= 4 {
				multiplier = 2.0
			}
			entry.StreakMultiplier = multiplier

			// Base score (1000 max) decayed by reaction latency
			ratio := 1.0 - (float64(elapsedMs) / float64(totalMs))
			if ratio < 0.2 {
				ratio = 0.2
			}
			baseScore := 1000.0 * ratio
			roundPoints = int(math.Round(baseScore * multiplier))
		} else {
			entry.Streak = 0
			entry.StreakMultiplier = 1.0
		}

		entry.RoundScore = roundPoints
		entry.TotalScore += roundPoints

		e.updateLeaderboard()
		e.broadcastState()
	}
}

func (e *TriviaEngine) startQuizWithConfig(category string, rounds int) {
	select {
	case e.stopTicker <- struct{}{}:
	default:
	}

	bank := getQuestionBank()
	var selected []TriviaQuestion

	if category != "" {
		for _, q := range bank {
			if q.Category == category {
				selected = append(selected, q)
			}
		}
	}
	if len(selected) == 0 {
		selected = bank
	}

	// Shuffle questions
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	r.Shuffle(len(selected), func(i, j int) {
		selected[i], selected[j] = selected[j], selected[i]
	})

	if rounds <= 0 || rounds > len(selected) {
		rounds = 5
		if len(selected) < 5 {
			rounds = len(selected)
		}
	}

	e.questions = make([]TriviaQuestion, rounds)
	for i := 0; i < rounds; i++ {
		q := selected[i]
		q.Index = i
		e.questions[i] = q
	}

	e.currentQIdx = 0
	e.userScores = make(map[string]*QuizLeaderboardEntry)
	e.answeredUsers = make(map[string]bool)

	e.state = &QuizState{
		CurrentQuestionIndex: 0,
		TotalQuestions:       rounds,
		AnswersDistribution:  map[string]int{"A": 0, "B": 0, "C": 0, "D": 0},
		Leaderboard:          []*QuizLeaderboardEntry{},
	}

	e.transitionTo(QuizPhaseLobby, 8)
}

func (e *TriviaEngine) transitionTo(nextPhase QuizPhase, durationSeconds int) {
	e.phase = nextPhase
	e.remainingSeconds = durationSeconds
	e.phaseEndsAt = time.Now().Add(time.Duration(durationSeconds) * time.Second)

	switch nextPhase {
	case QuizPhaseQuestion:
		e.questionStartedAt = time.Now()
		e.answeredUsers = make(map[string]bool)
		currentQ := e.questions[e.currentQIdx]
		e.state.CurrentQuestionIndex = e.currentQIdx
		e.state.CurrentQuestion = &currentQ
		e.state.AnswersDistribution = map[string]int{"A": 0, "B": 0, "C": 0, "D": 0}
		e.state.CorrectOption = ""

	case QuizPhaseReveal:
		e.state.CorrectOption = e.questions[e.currentQIdx].CorrectOption
		e.updateLeaderboard()

	case QuizPhaseLeaderboard:
		e.updateLeaderboard()

	case QuizPhaseFinalResults:
		e.updateLeaderboard()
	}

	log.Printf("[Room %s] Quiz transitioning to %s (%ds)", e.roomID, nextPhase, durationSeconds)
	e.broadcastState()

	go e.runPhaseTicker(nextPhase, durationSeconds)
}

func (e *TriviaEngine) runPhaseTicker(currentPhase QuizPhase, seconds int) {
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

func (e *TriviaEngine) onPhaseTimeout(phase QuizPhase) {
	switch phase {
	case QuizPhaseLobby:
		e.transitionTo(QuizPhaseQuestion, e.questions[0].TotalTimeSeconds)

	case QuizPhaseQuestion:
		e.transitionTo(QuizPhaseReveal, 5)

	case QuizPhaseReveal:
		if e.currentQIdx+1 < len(e.questions) {
			e.transitionTo(QuizPhaseLeaderboard, 6)
		} else {
			e.transitionTo(QuizPhaseFinalResults, 15)
		}

	case QuizPhaseLeaderboard:
		e.currentQIdx++
		e.transitionTo(QuizPhaseQuestion, e.questions[e.currentQIdx].TotalTimeSeconds)

	case QuizPhaseFinalResults:
		e.phase = QuizPhaseChat
		e.broadcastState()
		log.Printf("[Room %s] Quiz finished. Returning to chat.", e.roomID)
	}
}

func (e *TriviaEngine) updateLeaderboard() {
	list := make([]*QuizLeaderboardEntry, 0, len(e.userScores))
	for _, entry := range e.userScores {
		list = append(list, entry)
	}

	sort.Slice(list, func(i, j int) bool {
		if list[i].TotalScore == list[j].TotalScore {
			return list[i].ResponseTimeMs < list[j].ResponseTimeMs
		}
		return list[i].TotalScore > list[j].TotalScore
	})

	for i, entry := range list {
		entry.Rank = i + 1
	}
	e.state.Leaderboard = list
}

func (e *TriviaEngine) broadcastState() {
	snapshot := map[string]interface{}{
		"game_type":         "quiz",
		"phase":             e.phase,
		"phase_ends_at":     e.phaseEndsAt.UnixMilli(),
		"remaining_seconds": e.remainingSeconds,
		"quiz_state":        e.state,
	}
	if out, err := ws.NewEnvelope("game:state_update", e.roomID, snapshot); err == nil {
		e.hub.BroadcastToRoom(e.roomID, out)
	}
}
