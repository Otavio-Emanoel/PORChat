package chat

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"os"
	"path/filepath"
)

type Room struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Code      string    `json:"code"`
	IsGroup   bool      `json:"is_group"`
	Members   []string  `json:"members,omitempty"`
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
	if !store.LoadFromDisk("data/chat_store.json") {
		store.seedRooms()
	}
	return store
}

func (s *RoomStore) SaveToDisk(filePath string) error {
	s.mu.RLock()
	defer s.mu.RUnlock()

	data := struct {
		Rooms    map[string]*Room          `json:"rooms"`
		Messages map[string][]*ChatMessage `json:"messages"`
	}{
		Rooms:    s.rooms,
		Messages: s.messages,
	}

	bytes, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}

	_ = os.MkdirAll(filepath.Dir(filePath), 0755)
	tmpPath := filePath + ".tmp"
	if err := os.WriteFile(tmpPath, bytes, 0644); err != nil {
		return err
	}
	return os.Rename(tmpPath, filePath)
}

func (s *RoomStore) LoadFromDisk(filePath string) bool {
	bytes, err := os.ReadFile(filePath)
	if err != nil {
		return false
	}

	var data struct {
		Rooms    map[string]*Room          `json:"rooms"`
		Messages map[string][]*ChatMessage `json:"messages"`
	}
	if err := json.Unmarshal(bytes, &data); err != nil {
		return false
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if len(data.Rooms) > 0 {
		s.rooms = data.Rooms
	}
	if len(data.Messages) > 0 {
		s.messages = data.Messages
	}
	return true
}

func (s *RoomStore) seedRooms() {
	defaultRooms := []*Room{
		{
			ID:        "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
			Name:      "Trio PORChat (Pedro, Otavio & Raul)",
			Code:      "POR-1000",
			IsGroup:   true,
			Members:   []string{"Otavio", "Pedro", "Raul"},
			CreatedBy: "Otavio",
			CreatedAt: time.Now(),
		},
		{
			ID:        "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
			Name:      "Tribunal dos Debates",
			Code:      "DEB-2000",
			IsGroup:   true,
			Members:   []string{"Otavio", "Pedro", "Raul"},
			CreatedBy: "Pedro",
			CreatedAt: time.Now(),
		},
		{
			ID:        "f1e2d3c4-b5a6-9876-5432-10fedcba9876",
			Name:      "Arena Quiz Relâmpago",
			Code:      "QZ-3000",
			IsGroup:   true,
			Members:   []string{"Otavio", "Pedro", "Raul"},
			CreatedBy: "Raul",
			CreatedAt: time.Now(),
		},
		{
			ID:        "chat-direct-pedro",
			Name:      "Pedro",
			Code:      "DM-PEDRO",
			IsGroup:   false,
			Members:   []string{"Otavio", "Pedro"},
			CreatedBy: "Pedro",
			CreatedAt: time.Now(),
		},
		{
			ID:        "chat-direct-raul",
			Name:      "Raul",
			Code:      "DM-RAUL",
			IsGroup:   false,
			Members:   []string{"Otavio", "Raul"},
			CreatedBy: "Raul",
			CreatedAt: time.Now(),
		},
	}
	for _, r := range defaultRooms {
		s.rooms[r.ID] = r
		if r.IsGroup {
			s.messages[r.ID] = []*ChatMessage{
				{
					ID:        uuid.New().String(),
					RoomID:    r.ID,
					UserID:    "system",
					Nickname:  "PORBot",
					Content:   "Grupo criado! Inicie debates ou quizzes e acompanhe no telão.",
					Type:      "system",
					CreatedAt: time.Now().Add(-10 * time.Minute),
				},
			}
		} else {
			s.messages[r.ID] = []*ChatMessage{
				{
					ID:        uuid.New().String(),
					RoomID:    r.ID,
					UserID:    r.CreatedBy,
					Nickname:  r.CreatedBy,
					Content:   "Fala aí! Bora puxar um jogo com a galera no grupo?",
					Type:      "text",
					CreatedAt: time.Now().Add(-5 * time.Minute),
				},
			}
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

func (s *RoomStore) GetRoomByCode(code string) (*Room, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	codeClean := strings.ToUpper(strings.TrimSpace(code))
	for _, r := range s.rooms {
		if strings.ToUpper(strings.TrimSpace(r.Code)) == codeClean {
			return r, true
		}
	}
	return nil, false
}

func (s *RoomStore) CreateRoom(name, code string, isGroup bool, members []string, createdBy string) *Room {
	s.mu.Lock()
	defer s.mu.Unlock()

	cleanCode := strings.ToUpper(strings.TrimSpace(code))
	if cleanCode == "" {
		cleanCode = fmt.Sprintf("POR-%04d", rand.Intn(9000)+1000)
	}

	cleanName := strings.TrimSpace(name)
	if cleanName == "" {
		if isGroup {
			cleanName = "Grupo " + cleanCode
		} else {
			cleanName = "Conversa " + cleanCode
		}
	}

	room := &Room{
		ID:        uuid.New().String(),
		Name:      cleanName,
		Code:      cleanCode,
		IsGroup:   isGroup,
		Members:   members,
		CreatedBy: createdBy,
		CreatedAt: time.Now(),
	}

	s.rooms[room.ID] = room
	welcomeText := "Grupo criado com sucesso! Convide amigos usando o código " + cleanCode + "."
	if !isGroup {
		welcomeText = "Conversa iniciada."
	}

	s.messages[room.ID] = []*ChatMessage{
		{
			ID:        uuid.New().String(),
			RoomID:    room.ID,
			UserID:    "system",
			Nickname:  "PORBot",
			Content:   welcomeText,
			Type:      "system",
			CreatedAt: time.Now(),
		},
	}
	go func() { _ = s.SaveToDisk("data/chat_store.json") }()
	return room
}

func (s *RoomStore) AddMessage(msg *ChatMessage) {
	s.mu.Lock()
	s.messages[msg.RoomID] = append(s.messages[msg.RoomID], msg)
	s.mu.Unlock()
	go func() { _ = s.SaveToDisk("data/chat_store.json") }()
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

func (s *RoomStore) DeleteRoom(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.rooms[id]; !exists {
		return false
	}
	delete(s.rooms, id)
	delete(s.messages, id)
	go func() { _ = s.SaveToDisk("data/chat_store.json") }()
	return true
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

func (h *ChatHandler) GetRoomByCode(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	room, ok := h.Store.GetRoomByCode(code)
	if !ok {
		http.Error(w, `{"error":"room not found with provided code"}`, http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(room)
}

type CreateRoomReq struct {
	Name      string   `json:"name"`
	Code      string   `json:"code,omitempty"`
	IsGroup   *bool    `json:"is_group,omitempty"`
	Members   []string `json:"members,omitempty"`
	CreatedBy string   `json:"created_by,omitempty"`
}

func (h *ChatHandler) CreateRoom(w http.ResponseWriter, r *http.Request) {
	var req CreateRoomReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err.Error() != "EOF" {
		http.Error(w, `{"error":"invalid payload"}`, http.StatusBadRequest)
		return
	}

	isGroup := true
	if req.IsGroup != nil {
		isGroup = *req.IsGroup
	}

	room := h.Store.CreateRoom(req.Name, req.Code, isGroup, req.Members, req.CreatedBy)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(room)
}

func (h *ChatHandler) GetMessages(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "id")
	msgs := h.Store.GetMessages(roomID, 50)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(msgs)
}

func (h *ChatHandler) DeleteRoom(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "id")
	if ok := h.Store.DeleteRoom(roomID); !ok {
		http.Error(w, `{"error":"room not found"}`, http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "deleted_id": roomID})
}
