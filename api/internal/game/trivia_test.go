package game

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/porchat/api/internal/ws"
)

func TestTriviaEngine_StartAndScore(t *testing.T) {
	hub := setupTestHub()
	engine := NewTriviaEngine("test-room", hub)

	if engine.IsActive() {
		t.Errorf("Expected trivia engine to be inactive initially")
	}

	// Start quiz
	startPayload, _ := json.Marshal(map[string]interface{}{
		"game_type": "quiz",
	})
	startEnv := &ws.Envelope{
		Event:   "game:start",
		RoomID:  "test-room",
		Payload: startPayload,
	}
	client := &ws.Client{UserID: "u1", Nickname: "TriviaPro", RoomID: "test-room"}
	engine.HandleAction(client, startEnv)

	if !engine.IsActive() {
		t.Errorf("Expected trivia engine to be active after start")
	}

	// Move directly to question phase for testing
	engine.mu.Lock()
	engine.phase = QuizPhaseQuestion
	engine.questionStartedAt = time.Now()
	engine.state.CurrentQuestion = &engine.questions[0]
	engine.mu.Unlock()

	// Submit correct answer dynamically
	engine.mu.Lock()
	correctChoice := engine.questions[0].CorrectOption
	engine.mu.Unlock()

	answerPayload, _ := json.Marshal(map[string]interface{}{
		"choice": correctChoice,
	})
	answerEnv := &ws.Envelope{
		Event:   "quiz:submit_answer",
		RoomID:  "test-room",
		Payload: answerPayload,
	}
	engine.HandleAction(client, answerEnv)

	entry := engine.userScores["u1"]
	if entry == nil {
		t.Fatalf("Expected score entry for u1, got nil")
	}
	if entry.RoundScore < 200 || entry.RoundScore > 1000 {
		t.Errorf("Expected round score between 200 and 1000, got %d", entry.RoundScore)
	}
	if entry.Streak != 1 {
		t.Errorf("Expected streak to be 1, got %d", entry.Streak)
	}
	if entry.StreakMultiplier != 1.0 {
		t.Errorf("Expected streak multiplier 1.0, got %f", entry.StreakMultiplier)
	}

	// Test moderation pause/resume
	engine.HandleAction(client, &ws.Envelope{
		Event:  "game:pause",
		RoomID: "test-room",
	})
	if !engine.isPaused {
		t.Errorf("Expected engine to be paused")
	}

	engine.HandleAction(client, &ws.Envelope{
		Event:  "game:resume",
		RoomID: "test-room",
	})
	if engine.isPaused {
		t.Errorf("Expected engine to be resumed")
	}
}

func TestTriviaEngine_StreakMultiplierAndReset(t *testing.T) {
	hub := setupTestHub()
	engine := NewTriviaEngine("test-room-streak", hub)
	client := &ws.Client{UserID: "u-streak", Nickname: "StreakMaster", RoomID: "test-room-streak"}

	// Start quiz
	startPayload, _ := json.Marshal(map[string]interface{}{"game_type": "quiz"})
	engine.HandleAction(client, &ws.Envelope{Event: "game:start", RoomID: "test-room-streak", Payload: startPayload})

	engine.mu.Lock()
	engine.phase = QuizPhaseQuestion
	engine.questionStartedAt = time.Now()
	q := engine.questions[0]
	engine.state.CurrentQuestion = &q
	correctOption := q.CorrectOption
	var wrongOption string
	for opt := range q.Options {
		if opt != correctOption {
			wrongOption = opt
			break
		}
	}
	engine.mu.Unlock()

	// 1st Correct Answer -> Streak 1, 1.0x
	ans1, _ := json.Marshal(map[string]interface{}{"choice": correctOption})
	engine.HandleAction(client, &ws.Envelope{Event: "quiz:submit_answer", RoomID: "test-room-streak", Payload: ans1})
	entry := engine.userScores["u-streak"]
	if entry.Streak != 1 || entry.StreakMultiplier != 1.0 {
		t.Errorf("Expected Streak 1, mult 1.0, got %d, %f", entry.Streak, entry.StreakMultiplier)
	}

	// 2nd Correct Answer -> Streak 2, 1.25x
	engine.mu.Lock()
	engine.answeredUsers = make(map[string]bool) // simulate next question
	engine.mu.Unlock()
	engine.HandleAction(client, &ws.Envelope{Event: "quiz:submit_answer", RoomID: "test-room-streak", Payload: ans1})
	if entry.Streak != 2 || entry.StreakMultiplier != 1.25 {
		t.Errorf("Expected Streak 2, mult 1.25, got %d, %f", entry.Streak, entry.StreakMultiplier)
	}

	// 3rd Correct Answer -> Streak 3, 1.5x
	engine.mu.Lock()
	engine.answeredUsers = make(map[string]bool)
	engine.mu.Unlock()
	engine.HandleAction(client, &ws.Envelope{Event: "quiz:submit_answer", RoomID: "test-room-streak", Payload: ans1})
	if entry.Streak != 3 || entry.StreakMultiplier != 1.5 {
		t.Errorf("Expected Streak 3, mult 1.5, got %d, %f", entry.Streak, entry.StreakMultiplier)
	}

	// 4th Correct Answer -> Streak 4, 2.0x (cap)
	engine.mu.Lock()
	engine.answeredUsers = make(map[string]bool)
	engine.mu.Unlock()
	engine.HandleAction(client, &ws.Envelope{Event: "quiz:submit_answer", RoomID: "test-room-streak", Payload: ans1})
	if entry.Streak != 4 || entry.StreakMultiplier != 2.0 {
		t.Errorf("Expected Streak 4, mult 2.0, got %d, %f", entry.Streak, entry.StreakMultiplier)
	}

	// 5th Incorrect Answer -> Streak resets to 0, 1.0x
	engine.mu.Lock()
	engine.answeredUsers = make(map[string]bool)
	engine.mu.Unlock()
	ansWrong, _ := json.Marshal(map[string]interface{}{"choice": wrongOption})
	engine.HandleAction(client, &ws.Envelope{Event: "quiz:submit_answer", RoomID: "test-room-streak", Payload: ansWrong})
	if entry.Streak != 0 || entry.StreakMultiplier != 1.0 {
		t.Errorf("Expected Streak 0, mult 1.0 after wrong answer, got %d, %f", entry.Streak, entry.StreakMultiplier)
	}
}
