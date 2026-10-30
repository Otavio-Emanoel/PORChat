package chat

import (
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
)

func createIsolatedRoomStore() *RoomStore {
	return &RoomStore{
		rooms:    make(map[string]*Room),
		messages: make(map[string][]*ChatMessage),
	}
}

func TestRoomStore_ConcurrentMessageWrites(t *testing.T) {
	store := createIsolatedRoomStore()
	room := store.CreateRoom("Concurrent Room", "CON-1000", true, []string{"Otavio", "Pedro", "Raul"}, "Otavio")

	var wg sync.WaitGroup
	workers := 25
	messagesPerWorker := 40

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for j := 0; j < messagesPerWorker; j++ {
				msg := &ChatMessage{
					ID:        uuid.New().String(),
					RoomID:    room.ID,
					UserID:    fmt.Sprintf("user-%d", workerID),
					Nickname:  fmt.Sprintf("Worker_%d", workerID),
					Content:   fmt.Sprintf("Message %d from worker %d", j, workerID),
					Type:      "text",
					CreatedAt: time.Now(),
				}
				store.AddMessage(msg)
			}
		}(i)
	}

	wg.Wait()

	// Initial system message + workers * messagesPerWorker
	expectedCount := 1 + (workers * messagesPerWorker)
	allMsgs := store.GetMessages(room.ID, expectedCount+10)
	if len(allMsgs) != expectedCount {
		t.Fatalf("Expected %d messages in store, got %d", expectedCount, len(allMsgs))
	}
}

func TestRoomStore_ConcurrentReactionToggles(t *testing.T) {
	store := createIsolatedRoomStore()
	room := store.CreateRoom("Reaction Room", "RCT-2000", true, []string{"Otavio", "Pedro"}, "Otavio")

	targetMsg := &ChatMessage{
		ID:        "target-reaction-msg",
		RoomID:    room.ID,
		UserID:    "user-otavio",
		Nickname:  "Otavio",
		Content:   "Vote on this!",
		Type:      "text",
		CreatedAt: time.Now(),
	}
	store.AddMessage(targetMsg)

	var wg sync.WaitGroup
	workers := 20
	iterations := 30
	emojis := []string{"🔥", "❤️", "👍", "👏"}

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(wID int) {
			defer wg.Done()
			user := fmt.Sprintf("react-user-%d", wID)
			for j := 0; j < iterations; j++ {
				emoji := emojis[rand.Intn(len(emojis))]
				store.ToggleReaction(room.ID, targetMsg.ID, emoji, user)
			}
		}(i)
	}

	wg.Wait()

	// Message must still exist and reactions map must be valid
	msgs := store.GetMessages(room.ID, 10)
	var found *ChatMessage
	for _, m := range msgs {
		if m.ID == targetMsg.ID {
			found = m
			break
		}
	}

	if found == nil {
		t.Fatalf("Target message disappeared after concurrent reactions")
	}

	// Verify no duplicates in any emoji array
	for emoji, users := range found.Reactions {
		seen := make(map[string]bool)
		for _, u := range users {
			if seen[u] {
				t.Errorf("Duplicate user %s detected in reaction %s", u, emoji)
			}
			seen[u] = true
		}
	}
}

func TestRoomStore_DeleteMessage_AccessAndIsolation(t *testing.T) {
	store := createIsolatedRoomStore()
	roomA := store.CreateRoom("Room A", "RMA-1111", true, []string{"Otavio"}, "Otavio")
	roomB := store.CreateRoom("Room B", "RMB-2222", true, []string{"Pedro"}, "Pedro")

	msgA := &ChatMessage{
		ID:        "msg-in-room-a",
		RoomID:    roomA.ID,
		UserID:    "user-otavio",
		Nickname:  "Otavio",
		Content:   "Secret message A",
		Type:      "text",
		CreatedAt: time.Now(),
	}
	store.AddMessage(msgA)

	// Attempting to delete msgA using RoomB ID must fail
	if store.DeleteMessage(roomB.ID, msgA.ID, "user-otavio") {
		t.Errorf("DeleteMessage should fail when message does not belong to specified room")
	}

	// Deleting non-existent message ID must return false
	if store.DeleteMessage(roomA.ID, "non-existent-msg", "user-otavio") {
		t.Errorf("DeleteMessage should return false for non-existent message")
	}

	// Deleting in RoomA with correct ID must succeed
	if !store.DeleteMessage(roomA.ID, msgA.ID, "user-otavio") {
		t.Errorf("DeleteMessage failed for valid room and message ID")
	}

	// Verify message no longer returned
	msgsAfter := store.GetMessages(roomA.ID, 10)
	for _, m := range msgsAfter {
		if m.ID == msgA.ID {
			t.Errorf("Deleted message still exists in Room A")
		}
	}
}

func TestRoomStore_GetMessages_PaginationBoundaries(t *testing.T) {
	store := createIsolatedRoomStore()
	room := store.CreateRoom("Pagination Room", "PAG-3000", true, []string{"Otavio"}, "Otavio")

	// Add 10 messages
	for i := 1; i <= 10; i++ {
		store.AddMessage(&ChatMessage{
			ID:        fmt.Sprintf("msg-%d", i),
			RoomID:    room.ID,
			UserID:    "user-1",
			Nickname:  "Tester",
			Content:   fmt.Sprintf("Content %d", i),
			Type:      "text",
			CreatedAt: time.Now().Add(time.Duration(i) * time.Second),
		})
	}

	// Limit smaller than total
	msgs5 := store.GetMessages(room.ID, 5)
	if len(msgs5) != 5 {
		t.Errorf("Expected 5 messages, got %d", len(msgs5))
	}
	// Messages should be the latest 5 (indexes 6 to 10)
	if msgs5[len(msgs5)-1].ID != "msg-10" {
		t.Errorf("Expected last message to be msg-10, got %s", msgs5[len(msgs5)-1].ID)
	}

	// Limit larger than total
	msgsAll := store.GetMessages(room.ID, 100)
	// 1 system message + 10 messages = 11
	if len(msgsAll) != 11 {
		t.Errorf("Expected 11 total messages, got %d", len(msgsAll))
	}

	// Non-existent room should return empty
	emptyMsgs := store.GetMessages("ghost-room-id", 10)
	if len(emptyMsgs) != 0 {
		t.Errorf("Expected 0 messages for ghost room, got %d", len(emptyMsgs))
	}
}

func TestRoomStore_CorruptedPersistenceGracefulRecovery(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "porchat_corrupted_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	corruptedFile := filepath.Join(tmpDir, "corrupted_chat.json")
	// Write malformed JSON
	_ = os.WriteFile(corruptedFile, []byte("{ malformed json ... }}}"), 0644)

	store := &RoomStore{
		rooms:    make(map[string]*Room),
		messages: make(map[string][]*ChatMessage),
	}

	// LoadFromDisk must return false without panicking
	loaded := store.LoadFromDisk(corruptedFile)
	if loaded {
		t.Errorf("Expected LoadFromDisk to return false for corrupted file")
	}

	// Store must remain completely functional
	r := store.CreateRoom("Recovery Room", "RCV-9999", true, []string{"Otavio"}, "Otavio")
	if r == nil {
		t.Errorf("CreateRoom failed after recovery from corrupted file")
	}
}

func TestRoomStore_PrivateMembershipIsolation(t *testing.T) {
	store := createIsolatedRoomStore()
	store.CreateRoom("Otavio Private Group", "OTP-1111", true, []string{"Otavio", "Pedro"}, "Otavio")
	store.CreateRoom("Raul Secret Room", "RUL-2222", true, []string{"Raul"}, "Raul")

	// Query rooms for Otavio
	otavioRooms := store.GetRoomsForUser("Otavio")
	if len(otavioRooms) != 1 {
		t.Fatalf("Expected Otavio to have 1 room, got %d", len(otavioRooms))
	}
	if otavioRooms[0].Name != "Otavio Private Group" {
		t.Errorf("Expected Otavio Private Group, got %s", otavioRooms[0].Name)
	}

	// Query rooms for Raul
	raulRooms := store.GetRoomsForUser("Raul")
	if len(raulRooms) != 1 {
		t.Fatalf("Expected Raul to have 1 room, got %d", len(raulRooms))
	}
	if raulRooms[0].Name != "Raul Secret Room" {
		t.Errorf("Expected Raul Secret Room, got %s", raulRooms[0].Name)
	}

	// Join room with code
	joined, ok := store.JoinRoom("RUL-2222", "Otavio")
	if !ok {
		t.Fatalf("Failed to join room RUL-2222")
	}

	// Now Otavio should have 2 rooms
	otavioRoomsAfter := store.GetRoomsForUser("Otavio")
	if len(otavioRoomsAfter) != 2 {
		t.Errorf("Expected Otavio to have 2 rooms after join, got %d", len(otavioRoomsAfter))
	}
	_ = joined
}
