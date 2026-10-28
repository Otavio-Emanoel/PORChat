package ws

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/porchat/api/internal/chat"
)

func TestNewEnvelope(t *testing.T) {
	before := time.Now().UnixMilli()
	payload := map[string]string{"msg": "hello"}
	env, err := NewEnvelope("chat:test", "room-100", payload)
	if err != nil {
		t.Fatalf("NewEnvelope failed: %v", err)
	}

	if env.Event != "chat:test" {
		t.Errorf("Expected event chat:test, got %s", env.Event)
	}
	if env.RoomID != "room-100" {
		t.Errorf("Expected room-100, got %s", env.RoomID)
	}
	if env.Timestamp < before {
		t.Errorf("Timestamp %d earlier than before %d", env.Timestamp, before)
	}

	var parsed map[string]string
	if err := json.Unmarshal(env.Payload, &parsed); err != nil {
		t.Fatalf("Failed to unmarshal payload: %v", err)
	}
	if parsed["msg"] != "hello" {
		t.Errorf("Expected hello, got %s", parsed["msg"])
	}
}

func TestHub_GetStatsEmpty(t *testing.T) {
	roomStore := &chat.RoomStore{}
	hub := NewHub(roomStore)

	stats := hub.GetStats()
	if stats["active_rooms"].(int) != 0 {
		t.Errorf("Expected 0 active rooms, got %v", stats["active_rooms"])
	}
	if stats["total_connections"].(int) != 0 {
		t.Errorf("Expected 0 total conns, got %v", stats["total_connections"])
	}
	if stats["unique_online"].(int) != 0 {
		t.Errorf("Expected 0 unique online, got %v", stats["unique_online"])
	}
}
