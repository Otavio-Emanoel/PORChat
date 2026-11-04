package game

import (
	"encoding/json"
	"log"
	"math"
	"math/rand"
	"sort"
	"strings"
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

type FastestResponderInfo struct {
	UserID         string `json:"user_id"`
	Nickname       string `json:"nickname"`
	ResponseTimeMs int64  `json:"response_time_ms"`
}

type QuizState struct {
	CurrentQuestionIndex int                     `json:"current_question_index"`
	TotalQuestions       int                     `json:"total_questions"`
	Category             string                  `json:"category,omitempty"`
	Difficulty           string                  `json:"difficulty,omitempty"`
	CurrentQuestion      *TriviaQuestion         `json:"current_question,omitempty"`
	AnswersDistribution  map[string]int          `json:"answers_distribution"`
	CorrectOption        string                  `json:"correct_option,omitempty"`
	FastestResponder     *FastestResponderInfo   `json:"fastest_responder,omitempty"`
	AnsweredCount        int                     `json:"answered_count"`
	Leaderboard          []*QuizLeaderboardEntry `json:"leaderboard"`
	IsPaused             bool                    `json:"is_paused,omitempty"`
}

type QuizConfig struct {
	Category        string
	Difficulty      string
	RoundCount      int
	QuestionSeconds int
	IncludeCustom   bool
}

type TriviaEngine struct {
	mu                sync.RWMutex
	roomID            string
	hub               *ws.Hub
	statsStore        *StatsStore
	customBank        *CustomBankStore
	phase             QuizPhase
	phaseEndsAt       time.Time
	remainingSeconds  int
	isPaused          bool
	questions         []TriviaQuestion
	currentQIdx       int
	questionStartedAt time.Time
	state             *QuizState
	userScores        map[string]*QuizLeaderboardEntry // userID -> entry
	roundTrackers     map[string]*QuizPlayerRoundStats // userID -> match stats
	answeredUsers     map[string]bool                  // userID -> true for current question
	stopTicker        chan struct{}
}

func NewTriviaEngine(roomID string, hub *ws.Hub) *TriviaEngine {
	return &TriviaEngine{
		roomID:        roomID,
		hub:           hub,
		phase:         QuizPhaseChat,
		questions:     getExpandedQuestionBank(),
		userScores:    make(map[string]*QuizLeaderboardEntry),
		roundTrackers: make(map[string]*QuizPlayerRoundStats),
		answeredUsers: make(map[string]bool),
		stopTicker:    make(chan struct{}),
	}
}

func (e *TriviaEngine) SetStores(stats *StatsStore, bank *CustomBankStore) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.statsStore = stats
	e.customBank = bank
}

func getQuestionBank() []TriviaQuestion {
	return getExpandedQuestionBank()
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
			Category        string `json:"category"`
			Difficulty      string `json:"difficulty"`
			RoundCount      int    `json:"round_count"`
			QuestionSeconds int    `json:"question_seconds"`
			IncludeCustom   *bool  `json:"include_custom"`
		}
		_ = json.Unmarshal(env.Payload, &p)
		incCustom := true
		if p.IncludeCustom != nil {
			incCustom = *p.IncludeCustom
		}
		e.startQuizWithOptions(QuizConfig{
			Category:        p.Category,
			Difficulty:      p.Difficulty,
			RoundCount:      p.RoundCount,
			QuestionSeconds: p.QuestionSeconds,
			IncludeCustom:   incCustom,
		})

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
		if e.phase != QuizPhaseQuestion || client == nil {
			return
		}
		if e.answeredUsers[client.UserID] {
			return
		}

		var p struct {
			Choice string `json:"choice"`
		}
		if err := json.Unmarshal(env.Payload, &p); err != nil {
			return
		}

		choice := strings.ToUpper(strings.TrimSpace(p.Choice))
		currentQ := e.questions[e.currentQIdx]
		if _, valid := currentQ.Options[choice]; !valid {
			return
		}

		e.answeredUsers[client.UserID] = true
		e.state.AnswersDistribution[choice]++
		e.state.AnsweredCount = len(e.answeredUsers)

		elapsedMs := time.Since(e.questionStartedAt).Milliseconds()
		totalMs := int64(currentQ.TotalTimeSeconds * 1000)
		if elapsedMs < 0 {
			elapsedMs = 0
		}

		roundPoints := 0
		isCorrect := choice == currentQ.CorrectOption

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

		tracker, tExists := e.roundTrackers[client.UserID]
		if !tExists {
			tracker = &QuizPlayerRoundStats{
				UserID:   client.UserID,
				Nickname: client.Nickname,
			}
			e.roundTrackers[client.UserID] = tracker
		}
		tracker.TotalAnswers++

		entry.ResponseTimeMs = elapsedMs
		entry.LastAnswerCorrect = isCorrect

		if isCorrect {
			entry.Streak++
			tracker.CorrectAnswers++
			if entry.Streak > tracker.BestStreak {
				tracker.BestStreak = entry.Streak
			}
			if elapsedMs > 0 && (tracker.FastestAnswerMs == 0 || elapsedMs < tracker.FastestAnswerMs) {
				tracker.FastestAnswerMs = elapsedMs
			}

			if e.state.FastestResponder == nil || elapsedMs < e.state.FastestResponder.ResponseTimeMs {
				e.state.FastestResponder = &FastestResponderInfo{
					UserID:         client.UserID,
					Nickname:       client.Nickname,
					ResponseTimeMs: elapsedMs,
				}
			}

			multiplier := 1.0
			if entry.Streak == 2 {
				multiplier = 1.25
			} else if entry.Streak == 3 {
				multiplier = 1.5
			} else if entry.Streak >= 4 {
				multiplier = 2.0
			}
			entry.StreakMultiplier = multiplier

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
		tracker.TotalScore = entry.TotalScore

		e.updateLeaderboard()
		e.broadcastState()

		// Check if all active non-TV players in the room have answered so we can advance early
		if e.hub != nil {
			online := e.hub.GetOnlineUsers(e.roomID)
			activePlayers := 0
			for _, u := range online {
				if u.ClientType != "tv" {
					activePlayers++
				}
			}
			if activePlayers >= 2 && len(e.answeredUsers) >= activePlayers {
				e.onPhaseTimeout(QuizPhaseQuestion)
			}
		}
	}
}

func (e *TriviaEngine) startQuizWithConfig(category string, rounds int) {
	e.startQuizWithOptions(QuizConfig{
		Category:      category,
		RoundCount:    rounds,
		IncludeCustom: true,
	})
}

func (e *TriviaEngine) startQuizWithOptions(cfg QuizConfig) {
	select {
	case e.stopTicker <- struct{}{}:
	default:
	}

	qSeconds := cfg.QuestionSeconds
	if qSeconds < 5 || qSeconds > 60 {
		qSeconds = 15
	}

	category := strings.TrimSpace(cfg.Category)
	difficulty := strings.TrimSpace(cfg.Difficulty)
	if strings.EqualFold(difficulty, "Todas") {
		difficulty = ""
	}

	var pool []TriviaQuestion
	if cfg.IncludeCustom && e.customBank != nil {
		for _, cq := range e.customBank.GetRoomQuestions(e.roomID) {
			catMatch := category == "" || strings.EqualFold(cq.Category, category) || strings.EqualFold(category, "Personalizado")
			diffMatch := difficulty == "" || strings.EqualFold(cq.Difficulty, difficulty)
			if catMatch && diffMatch {
				pool = append(pool, TriviaQuestion{
					ID:               cq.ID,
					Category:         cq.Category,
					Difficulty:       cq.Difficulty,
					Prompt:           cq.Prompt,
					Options:          cq.Options,
					CorrectOption:    cq.CorrectOption,
					TotalTimeSeconds: qSeconds,
				})
			}
		}
	}

	for _, q := range getExpandedQuestionBank() {
		catMatch := category == "" || strings.EqualFold(q.Category, category)
		diffMatch := difficulty == "" || strings.EqualFold(q.Difficulty, difficulty)
		if catMatch && diffMatch {
			qCopy := q
			qCopy.TotalTimeSeconds = qSeconds
			pool = append(pool, qCopy)
		}
	}

	if len(pool) == 0 {
		for _, q := range getExpandedQuestionBank() {
			qCopy := q
			qCopy.TotalTimeSeconds = qSeconds
			pool = append(pool, qCopy)
		}
	}

	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	r.Shuffle(len(pool), func(i, j int) {
		pool[i], pool[j] = pool[j], pool[i]
	})

	rounds := cfg.RoundCount
	if rounds <= 0 || rounds > len(pool) {
		rounds = 5
		if len(pool) < 5 {
			rounds = len(pool)
		}
	}

	e.questions = make([]TriviaQuestion, rounds)
	for i := 0; i < rounds; i++ {
		q := pool[i]
		q.Index = i
		e.questions[i] = q
	}

	e.currentQIdx = 0
	e.userScores = make(map[string]*QuizLeaderboardEntry)
	e.roundTrackers = make(map[string]*QuizPlayerRoundStats)
	e.answeredUsers = make(map[string]bool)

	displayCat := category
	if displayCat == "" {
		displayCat = "Geral"
	}
	displayDiff := difficulty
	if displayDiff == "" {
		displayDiff = "Todas"
	}

	e.state = &QuizState{
		CurrentQuestionIndex: 0,
		TotalQuestions:       rounds,
		Category:             displayCat,
		Difficulty:           displayDiff,
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
		e.state.FastestResponder = nil
		e.state.AnsweredCount = 0

	case QuizPhaseReveal:
		e.state.CorrectOption = e.questions[e.currentQIdx].CorrectOption
		e.updateLeaderboard()

	case QuizPhaseLeaderboard:
		e.updateLeaderboard()

	case QuizPhaseFinalResults:
		e.updateLeaderboard()
		if e.statsStore != nil && len(e.roundTrackers) > 0 {
			players := make([]*QuizPlayerRoundStats, 0, len(e.roundTrackers))
			for _, tr := range e.roundTrackers {
				copyTr := *tr
				players = append(players, &copyTr)
			}
			cat := e.state.Category
			go e.statsStore.RecordQuizMatch(e.roomID, cat, players)
		}
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
