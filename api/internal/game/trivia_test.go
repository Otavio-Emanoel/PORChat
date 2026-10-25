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
