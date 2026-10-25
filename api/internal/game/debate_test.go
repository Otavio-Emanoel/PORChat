package game

import (
	"encoding/json"
	"testing"

	"github.com/porchat/api/internal/chat"
	"github.com/porchat/api/internal/ws"
)

func setupTestHub() *ws.Hub {
	store := chat.NewRoomStore()
	hub := ws.NewHub(store)
	return hub
}

func TestDebateEngine_InitialState(t *testing.T) {
	hub := setupTestHub()
	engine := NewDebateEngine("test-room", hub)

	if engine.IsActive() {
		t.Errorf("Expected engine to be inactive initially, got active")
	}

	snapshot := engine.GetStateSnapshot().(map[string]interface{})
	if snapshot["phase"] != PhaseChat {
		t.Errorf("Expected initial phase to be CHAT, got %v", snapshot["phase"])
	}
}

func TestDebateEngine_StartAndVote(t *testing.T) {
	hub := setupTestHub()
	engine := NewDebateEngine("test-room", hub)

	// Start debate
	startPayload, _ := json.Marshal(map[string]interface{}{
		"game_type":     "debate",
		"topic":         "Pizza com abacaxi?",
		"debater_a_id":  "user-1",
		"debater_b_id":  "user-2",
	})
	startEnv := &ws.Envelope{
		Event:   "game:start",
		RoomID:  "test-room",
		Payload: startPayload,
	}
	clientA := &ws.Client{UserID: "user-1", Nickname: "DebaterA", RoomID: "test-room"}
	engine.HandleAction(clientA, startEnv)

	if !engine.IsActive() {
		t.Errorf("Expected engine to be active after start, got inactive")
	}
	if engine.phase != PhaseLobby {
		t.Errorf("Expected phase to be LOBBY, got %v", engine.phase)
	}

	// Submit argument
	argPayload, _ := json.Marshal(map[string]interface{}{
		"argument": "Pizza com abacaxi é sensacional!",
	})
	argEnv := &ws.Envelope{
		Event:   "debate:submit_argument",
		RoomID:  "test-room",
		Payload: argPayload,
	}
	engine.HandleAction(clientA, argEnv)

	if engine.state.DebaterA.Argument != "Pizza com abacaxi é sensacional!" {
		t.Errorf("Expected Debater A argument to be recorded, got %v", engine.state.DebaterA.Argument)
	}

	// Manually transition to voting for unit test
	engine.mu.Lock()
	engine.phase = PhaseVoting
	engine.mu.Unlock()

	// Cast vote from Juror
	juror := &ws.Client{UserID: "juror-1", Nickname: "Juror", RoomID: "test-room"}
	votePayload, _ := json.Marshal(map[string]interface{}{
		"choice": "side_a",
	})
	voteEnv := &ws.Envelope{
		Event:   "debate:cast_vote",
		RoomID:  "test-room",
		Payload: votePayload,
	}
	engine.HandleAction(juror, voteEnv)

	if engine.state.VotesCount["side_a"] != 1 {
		t.Errorf("Expected 1 vote for side_a, got %d", engine.state.VotesCount["side_a"])
	}

	// Test moderation controls
	engine.HandleAction(clientA, &ws.Envelope{Event: "game:pause", RoomID: "test-room"})
	if !engine.isPaused {
		t.Errorf("Expected debate to be paused")
	}

	engine.HandleAction(clientA, &ws.Envelope{Event: "game:resume", RoomID: "test-room"})
	if engine.isPaused {
		t.Errorf("Expected debate to be resumed")
	}

	engine.HandleAction(clientA, &ws.Envelope{Event: "game:abort", RoomID: "test-room"})
	if engine.phase != PhaseChat {
		t.Errorf("Expected phase CHAT after abort, got %v", engine.phase)
	}
}

func TestDebateEngine_CuratedTopicBank(t *testing.T) {
	hub := setupTestHub()
	engine := NewDebateEngine("test-room-curated", hub)

	// Start without explicit topic
	startPayload, _ := json.Marshal(map[string]interface{}{
		"game_type": "debate",
		"category":  "Tech",
	})
	engine.HandleAction(&ws.Client{UserID: "u1", Nickname: "User1", RoomID: "test-room-curated"}, &ws.Envelope{
		Event:   "game:start",
		RoomID:  "test-room-curated",
		Payload: startPayload,
	})

	if engine.state.Topic == "" {
		t.Errorf("Expected non-empty topic from curated bank")
	}
	if engine.state.Category != "Tech" {
		t.Errorf("Expected category Tech, got %s", engine.state.Category)
	}
	if engine.state.SideALabel == "" || engine.state.SideBLabel == "" {
		t.Errorf("Expected side labels to be populated")
	}
}
