package chat

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type Room struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Code      string    `json:"code"`
	IsGroup   bool      `json:"is_group"`
	CreatedBy string    `json:"created_by,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type ChatMessage struct {
	ID        string    `json:"id"`
	RoomID    string    `json:"room_id"`
	UserID    string    `json:"user_id"`
	Nickname  string    `json:"nickname"`
	Content   string    `json:"content"`
	Type      string    `json:"type"` // "text", "game_card", "system"
	CreatedAt time.Time `json:"created_at"`
}

type RoomStore struct {
	mu       sync.RWMutex
	rooms    map[string]*Room
	messages map[string][]*ChatMessage // roomID -> list of messages
}

func NewRoomStore() *RoomStore {
	store := &RoomStore{
		rooms:    make(map[string]*Room),
		messages: make(map[string][]*ChatMessage),
	}
	store.seedRooms()
	return store
}

func (s *RoomStore) seedRooms() {
	defaultRooms := []*Room{
		{
			ID:        "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
			Name:      "Lobby Principal (PORChat)",
			Code:      "POR-1000",
			IsGroup:   true,
			CreatedAt: time.Now(),
		},
		{
			ID:        "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
			Name:      "Tribunal dos Debates",
			Code:      "DEB-2000",
			IsGroup:   true,
			CreatedAt: time.Now(),
		},
		{
			ID:        "f1e2d3c4-b5a6-9876-5432-10fedcba9876",
			Name:      "Arena Quiz Relâmpago",
			Code:      "QZ-3000",
			IsGroup:   true,
			CreatedAt: time.Now(),
		},
	}
	for _, r := range defaultRooms {
		s.rooms[r.ID] = r
		s.messages[r.ID] = []*ChatMessage{
			{
				ID:        uuid.New().String(),
				RoomID:    r.ID,
				UserID:    "system",
				Nickname:  "PORBot",
				Content:   "Bem-vindos ao " + r.Name + "! Mensagens e jogos sincronizados em tempo real.",
				Type:      "system",
				CreatedAt: time.Now().Add(-10 * time.Minute),
			},
		}
	}
}

func (s *RoomStore) GetAllRooms() []*Room {
	s.mu.RLock()
	defer s.mu.RUnlock()
	list := make([]*Room, 0, len(s.rooms))
	for _, r := range s.rooms {
		list = append(list, r)
	}
	return list
}

func (s *RoomStore) GetRoom(id string) (*Room, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	r, ok := s.rooms[id]
	return r, ok
}

func (s *RoomStore) AddMessage(msg *ChatMessage) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.messages[msg.RoomID] = append(s.messages[msg.RoomID], msg)
}

func (s *RoomStore) GetMessages(roomID string, limit int) []*ChatMessage {
	s.mu.RLock()
	defer s.mu.RUnlock()
	msgs := s.messages[roomID]
	if len(msgs) <= limit {
		return msgs
	}
	return msgs[len(msgs)-limit:]
}

type ChatHandler struct {
	Store *RoomStore
}

func NewChatHandler(store *RoomStore) *ChatHandler {
	return &ChatHandler{Store: store}
}

func (h *ChatHandler) ListRooms(w http.ResponseWriter, r *http.Request) {
	rooms := h.Store.GetAllRooms()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(rooms)
}

func (h *ChatHandler) GetRoom(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "id")
	room, ok := h.Store.GetRoom(roomID)
	if !ok {
		http.Error(w, `{"error":"room not found"}`, http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(room)
}

func (h *ChatHandler) GetMessages(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "id")
	msgs := h.Store.GetMessages(roomID, 50)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(msgs)
}
