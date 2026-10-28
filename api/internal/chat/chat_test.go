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

func TestRoomStore_ToggleReaction(t *testing.T) {
	store := &RoomStore{
		rooms:    make(map[string]*Room),
		messages: make(map[string][]*ChatMessage),
	}

	room := store.CreateRoom("Reaction Room", "RCT-1234", true, nil, "system")
	msg := &ChatMessage{
		ID:        "msg-reaction-1",
		RoomID:    room.ID,
		UserID:    "user-1",
		Nickname:  "Tester",
		Content:   "Awesome game!",
		Type:      "text",
		CreatedAt: time.Now(),
	}
	store.AddMessage(msg)

	// Add reaction
	reactions, ok := store.ToggleReaction(room.ID, "msg-reaction-1", "🔥", "user-1")
	if !ok {
		t.Fatalf("ToggleReaction failed to add reaction")
	}
	if len(reactions["🔥"]) != 1 || reactions["🔥"][0] != "user-1" {
		t.Errorf("Expected 1 reaction from user-1, got %v", reactions["🔥"])
	}

	// Add second user reaction
	reactions, ok = store.ToggleReaction(room.ID, "msg-reaction-1", "🔥", "user-2")
	if !ok || len(reactions["🔥"]) != 2 {
		t.Errorf("Expected 2 reactions for 🔥, got %v", reactions["🔥"])
	}

	// Remove user-1 reaction (toggle off)
	reactions, ok = store.ToggleReaction(room.ID, "msg-reaction-1", "🔥", "user-1")
	if !ok || len(reactions["🔥"]) != 1 || reactions["🔥"][0] != "user-2" {
		t.Errorf("Expected only user-2 left after toggle, got %v", reactions["🔥"])
	}

	// Remove user-2 reaction -> key should be deleted
	reactions, ok = store.ToggleReaction(room.ID, "msg-reaction-1", "🔥", "user-2")
	if !ok || len(reactions["🔥"]) != 0 {
		t.Errorf("Expected empty reactions for 🔥, got %v", reactions["🔥"])
	}
}

func TestRoomStore_DeterministicOrderAndLastMessage(t *testing.T) {
	store := &RoomStore{
		rooms:    make(map[string]*Room),
		messages: make(map[string][]*ChatMessage),
	}

	room1 := store.CreateRoom("Alpha Room", "ALP-1000", true, nil, "system")
	time.Sleep(10 * time.Millisecond)
	room2 := store.CreateRoom("Beta Room", "BET-2000", true, nil, "system")
	time.Sleep(10 * time.Millisecond)
	room3 := store.CreateRoom("Gamma Room", "GAM-3000", true, nil, "system")

	// Initially, newest room is room3, then room2, then room1
	roomsInitial := store.GetAllRooms()
	if len(roomsInitial) != 3 {
		t.Fatalf("Expected 3 rooms, got %d", len(roomsInitial))
	}
	if roomsInitial[0].ID != room3.ID || roomsInitial[1].ID != room2.ID || roomsInitial[2].ID != room1.ID {
		t.Errorf("Expected order [Gamma, Beta, Alpha], got [%s, %s, %s]",
			roomsInitial[0].Name, roomsInitial[1].Name, roomsInitial[2].Name)
	}

	// Verify order is 100% deterministic over 100 iterations (never random like raw map)
	for i := 0; i < 100; i++ {
		list := store.GetAllRooms()
		if list[0].ID != room3.ID || list[1].ID != room2.ID || list[2].ID != room1.ID {
			t.Fatalf("Iteration %d: non-deterministic ordering detected!", i)
		}
	}

	// Now send a new message in Alpha (room1) -> Alpha should immediately jump to the top!
	time.Sleep(10 * time.Millisecond)
	store.AddMessage(&ChatMessage{
		ID:        "msg-alpha-1",
		RoomID:    room1.ID,
		UserID:    "user1",
		Nickname:  "Tester",
		Content:   "New active message in Alpha",
		Type:      "text",
		CreatedAt: time.Now(),
	})

	roomsAfterMsg := store.GetAllRooms()
	if roomsAfterMsg[0].ID != room1.ID {
		t.Errorf("Expected Alpha (room1) to jump to top after new message, got %s", roomsAfterMsg[0].Name)
	}
	if roomsAfterMsg[0].LastMessage != "New active message in Alpha" {
		t.Errorf("Expected LastMessage to be updated, got %s", roomsAfterMsg[0].LastMessage)
	}
}

