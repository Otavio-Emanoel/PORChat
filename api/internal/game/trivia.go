package game

import (
	"encoding/json"
	"log"
	"math"
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
	Prompt           string            `json:"prompt"`
	Options          map[string]string `json:"options"`
	CorrectOption    string            `json:"-"`
	TotalTimeSeconds int               `json:"total_time_seconds"`
}

type QuizLeaderboardEntry struct {
	UserID     string `json:"user_id"`
	Nickname   string `json:"nickname"`
	RoundScore int    `json:"round_score"`
	TotalScore int    `json:"total_score"`
	Rank       int    `json:"rank,omitempty"`
}

type QuizState struct {
	CurrentQuestionIndex int                     `json:"current_question_index"`
	TotalQuestions       int                     `json:"total_questions"`
	CurrentQuestion      *TriviaQuestion         `json:"current_question,omitempty"`
	AnswersDistribution  map[string]int          `json:"answers_distribution"`
	CorrectOption        string                  `json:"correct_option,omitempty"`
	Leaderboard          []*QuizLeaderboardEntry `json:"leaderboard"`
}

type TriviaEngine struct {
	mu                sync.RWMutex
	roomID            string
	hub               *ws.Hub
	phase             QuizPhase
	phaseEndsAt       time.Time
	remainingSeconds  int
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
		questions:     getSeedQuestions(),
		userScores:    make(map[string]*QuizLeaderboardEntry),
		answeredUsers: make(map[string]bool),
		stopTicker:    make(chan struct{}),
	}
}

func getSeedQuestions() []TriviaQuestion {
	return []TriviaQuestion{
		{
			ID:    "q1",
			Index: 0,
			Prompt: "Qual linguagem foi criada no Google por Robert Griesemer, Rob Pike e Ken Thompson?",
			Options: map[string]string{
				"A": "Rust",
				"B": "Go (Golang)",
				"C": "Kotlin",
				"D": "TypeScript",
			},
			CorrectOption:    "B",
			TotalTimeSeconds: 15,
		},
		{
			ID:    "q2",
			Index: 1,
			Prompt: "Qual foi a capital do Brasil antes de Brasília ser inaugurada em 1960?",
			Options: map[string]string{
				"A": "Salvador",
				"B": "São Paulo",
				"C": "Rio de Janeiro",
				"D": "Belo Horizonte",
			},
			CorrectOption:    "C",
			TotalTimeSeconds: 15,
		},
		{
			ID:    "q3",
			Index: 2,
			Prompt: "Quantos bits tem um endereço de IPv4 padrão?",
			Options: map[string]string{
				"A": "16 bits",
				"B": "32 bits",
				"C": "64 bits",
				"D": "128 bits",
			},
			CorrectOption:    "B",
			TotalTimeSeconds: 15,
		},
	}
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
		e.startQuiz()

	case "quiz:submit_answer":
		if e.phase != QuizPhaseQuestion {
			return
		}
		if e.answeredUsers[client.UserID] {
			return // Already answered this question
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

		// Speed-based scoring calculation
		roundPoints := 0
		if p.Choice == currentQ.CorrectOption {
			elapsed := time.Since(e.questionStartedAt).Seconds()
			totalTime := float64(currentQ.TotalTimeSeconds)
			if elapsed < 0 {
				elapsed = 0
			}
			ratio := 1.0 - (elapsed / totalTime)
			if ratio < 0 {
				ratio = 0
			}
			// clamp between 200 and 1000
			calc := int(math.Round(1000.0 * ratio))
			if calc < 200 {
				calc = 200
			}
			if calc > 1000 {
				calc = 1000
			}
			roundPoints = calc
		}

		entry, exists := e.userScores[client.UserID]
		if !exists {
			entry = &QuizLeaderboardEntry{
				UserID:   client.UserID,
				Nickname: client.Nickname,
			}
			e.userScores[client.UserID] = entry
		}
		entry.RoundScore = roundPoints
		entry.TotalScore += roundPoints

		e.updateLeaderboard()
		e.broadcastState()
	}
}

func (e *TriviaEngine) startQuiz() {
	select {
	case e.stopTicker <- struct{}{}:
	default:
	}

	e.currentQIdx = 0
	e.userScores = make(map[string]*QuizLeaderboardEntry)
	e.answeredUsers = make(map[string]bool)

	e.state = &QuizState{
		CurrentQuestionIndex: 0,
		TotalQuestions:       len(e.questions),
		AnswersDistribution:  map[string]int{"A": 0, "B": 0, "C": 0, "D": 0},
		Leaderboard:          []*QuizLeaderboardEntry{},
	}

	e.transitionTo(QuizPhaseLobby, 5)
}

func (e *TriviaEngine) transitionTo(nextPhase QuizPhase, durationSeconds int) {
	e.phase = nextPhase
	e.remainingSeconds = durationSeconds
	e.phaseEndsAt = time.Now().Add(time.Duration(durationSeconds) * time.Second)

	log.Printf("[Room %s Quiz] Phase -> %s (%ds)", e.roomID, nextPhase, durationSeconds)

	if nextPhase == QuizPhaseQuestion {
		e.questionStartedAt = time.Now()
		e.answeredUsers = make(map[string]bool)
		q := e.questions[e.currentQIdx]
		e.state.CurrentQuestionIndex = e.currentQIdx
		e.state.CurrentQuestion = &TriviaQuestion{
			ID:               q.ID,
			Index:            q.Index,
			Prompt:           q.Prompt,
			Options:          q.Options,
			TotalTimeSeconds: q.TotalTimeSeconds,
		}
		e.state.CorrectOption = ""
		e.state.AnswersDistribution = map[string]int{"A": 0, "B": 0, "C": 0, "D": 0}
	} else if nextPhase == QuizPhaseReveal {
		e.state.CorrectOption = e.questions[e.currentQIdx].CorrectOption
	}

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
		e.transitionTo(QuizPhaseQuestion, 15)

	case QuizPhaseQuestion:
		e.transitionTo(QuizPhaseReveal, 5)

	case QuizPhaseReveal:
		e.transitionTo(QuizPhaseLeaderboard, 5)

	case QuizPhaseLeaderboard:
		e.currentQIdx++
		if e.currentQIdx < len(e.questions) {
			e.transitionTo(QuizPhaseQuestion, 15)
		} else {
			e.transitionTo(QuizPhaseFinalResults, 10)
		}

	case QuizPhaseFinalResults:
		e.phase = QuizPhaseChat
		e.broadcastState()
		log.Printf("[Room %s Quiz] Quiz finished. Returned to CHAT.", e.roomID)
	}
}

func (e *TriviaEngine) updateLeaderboard() {
	list := make([]*QuizLeaderboardEntry, 0, len(e.userScores))
	for _, entry := range e.userScores {
		list = append(list, entry)
	}
	sort.Slice(list, func(i, j int) bool {
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
