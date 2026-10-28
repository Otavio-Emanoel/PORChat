package chat

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestRoomStore_CreateAndLookup(t *testing.T) {
	store := &RoomStore{
		rooms:    make(map[string]*Room),
		messages: make(map[string][]*ChatMessage),
	}

	room := store.CreateRoom("Sala VIP", "VIP-9999", true, []string{"Otavio", "Pedro"}, "Otavio")
	if room == nil {
		t.Fatalf("CreateRoom returned nil")
	}

	if room.Code != "VIP-9999" {
		t.Errorf("Expected code VIP-9999, got %s", room.Code)
	}

	found, ok := store.GetRoom(room.ID)
	if !ok || found.ID != room.ID {
		t.Errorf("GetRoom failed for ID: %s", room.ID)
	}

	foundByCode, ok := store.GetRoomByCode("vip-9999") // case-insensitive check
	if !ok || foundByCode.ID != room.ID {
		t.Errorf("GetRoomByCode failed for code: VIP-9999")
	}

	all := store.GetAllRooms()
	if len(all) != 1 {
		t.Errorf("Expected 1 room, got %d", len(all))
	}
}

func TestRoomStore_MessagesAndLimit(t *testing.T) {
	store := &RoomStore{
		rooms:    make(map[string]*Room),
		messages: make(map[string][]*ChatMessage),
	}

	room := store.CreateRoom("Test Room", "TST-1111", true, nil, "system")

	for i := 0; i < 10; i++ {
		store.AddMessage(&ChatMessage{
			ID:        uuid.New().String(),
			RoomID:    room.ID,
			UserID:    "user1",
			Nickname:  "User1",
			Content:   "Message",
			Type:      "text",
			CreatedAt: time.Now(),
		})
	}

	// 1 welcome message + 10 added = 11 total
	allMsgs := store.GetMessages(room.ID, 50)
	if len(allMsgs) != 11 {
		t.Errorf("Expected 11 messages, got %d", len(allMsgs))
	}

	// Test limit truncation
	limitedMsgs := store.GetMessages(room.ID, 5)
	if len(limitedMsgs) != 5 {
		t.Errorf("Expected 5 messages, got %d", len(limitedMsgs))
	}
}

func TestRoomStore_DeleteRoom(t *testing.T) {
	store := &RoomStore{
		rooms:    make(map[string]*Room),
		messages: make(map[string][]*ChatMessage),
	}

	room := store.CreateRoom("Deletable Room", "DEL-0000", false, nil, "admin")

	if _, ok := store.GetRoom(room.ID); !ok {
		t.Fatalf("Room was not created")
	}

	deleted := store.DeleteRoom(room.ID)
	if !deleted {
		t.Errorf("DeleteRoom returned false for existing room")
	}

	if _, ok := store.GetRoom(room.ID); ok {
		t.Errorf("Room still exists after deletion")
	}

	// Second delete should return false
	if store.DeleteRoom(room.ID) {
		t.Errorf("DeleteRoom returned true for already deleted room")
	}
}

func TestRoomStore_PersistenceRoundtrip(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "test_chat.json")

	store1 := &RoomStore{
		rooms:    make(map[string]*Room),
		messages: make(map[string][]*ChatMessage),
	}

	r := store1.CreateRoom("Saved Room", "SAV-1234", true, []string{"Alice", "Bob"}, "Alice")
	store1.AddMessage(&ChatMessage{
		ID:        "msg-123",
		RoomID:    r.ID,
		UserID:    "user-1",
		Nickname:  "Alice",
		Content:   "Hello persisted world!",
		Type:      "text",
		CreatedAt: time.Now(),
	})

	if err := store1.SaveToDisk(filePath); err != nil {
		t.Fatalf("SaveToDisk failed: %v", err)
	}

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		t.Fatalf("File does not exist: %s", filePath)
	}

	store2 := &RoomStore{
		rooms:    make(map[string]*Room),
		messages: make(map[string][]*ChatMessage),
	}

	if loaded := store2.LoadFromDisk(filePath); !loaded {
		t.Fatalf("LoadFromDisk failed")
	}

	loadedRoom, ok := store2.GetRoom(r.ID)
	if !ok {
		t.Fatalf("Loaded room not found")
	}
	if loadedRoom.Name != "Saved Room" {
		t.Errorf("Expected Saved Room, got %s", loadedRoom.Name)
	}

	msgs := store2.GetMessages(r.ID, 10)
	if len(msgs) < 2 {
		t.Errorf("Expected at least 2 messages loaded, got %d", len(msgs))
	}
}
