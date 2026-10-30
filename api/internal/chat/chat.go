package chat

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/porchat/api/internal/auth"
)

type Room struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Code          string    `json:"code"`
	IsGroup       bool      `json:"is_group"`
	Members       []string  `json:"members,omitempty"`
	CreatedBy     string    `json:"created_by,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	LastMessage   string    `json:"last_message,omitempty"`
	LastMessageAt time.Time `json:"last_message_at,omitempty"`
}

type ChatMessage struct {
	ID        string    `json:"id"`
	RoomID    string    `json:"room_id"`
	UserID    string    `json:"user_id"`
	Nickname  string    `json:"nickname"`
	Content   string                 `json:"content"`
	Type      string                 `json:"type"` // "text", "game_card", "system"
	Reactions map[string][]string    `json:"reactions,omitempty"`
	CreatedAt time.Time              `json:"created_at"`
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
			msg := &ChatMessage{
				ID:        uuid.New().String(),
				RoomID:    r.ID,
				UserID:    "system",
				Nickname:  "PORBot",
				Content:   "Grupo criado! Inicie debates ou quizzes e acompanhe no telão.",
				Type:      "system",
				CreatedAt: time.Now().Add(-10 * time.Minute),
			}
			s.messages[r.ID] = []*ChatMessage{msg}
			r.LastMessage = msg.Content
			r.LastMessageAt = msg.CreatedAt
		} else {
			msg := &ChatMessage{
				ID:        uuid.New().String(),
				RoomID:    r.ID,
				UserID:    r.CreatedBy,
				Nickname:  r.CreatedBy,
				Content:   "Fala aí! Bora puxar um jogo com a galera no grupo?",
				Type:      "text",
				CreatedAt: time.Now().Add(-5 * time.Minute),
			}
			s.messages[r.ID] = []*ChatMessage{msg}
			r.LastMessage = msg.Content
			r.LastMessageAt = msg.CreatedAt
		}
	}
}

func (s *RoomStore) GetAllRooms() []*Room {
	s.mu.RLock()
	defer s.mu.RUnlock()
	list := make([]*Room, 0, len(s.rooms))
	for _, r := range s.rooms {
		if r.LastMessage == "" {
			if msgs := s.messages[r.ID]; len(msgs) > 0 {
				lastMsg := msgs[len(msgs)-1]
				r.LastMessage = lastMsg.Content
				r.LastMessageAt = lastMsg.CreatedAt
			}
		}
		list = append(list, r)
	}

	sort.SliceStable(list, func(i, j int) bool {
		tI := list[i].LastMessageAt
		if tI.IsZero() {
			tI = list[i].CreatedAt
		}
		tJ := list[j].LastMessageAt
		if tJ.IsZero() {
			tJ = list[j].CreatedAt
		}
		if !tI.Equal(tJ) {
			return tI.After(tJ)
		}
		if list[i].Name != list[j].Name {
			return list[i].Name < list[j].Name
		}
		return list[i].ID < list[j].ID
	})

	return list
}

func (s *RoomStore) GetRoomsForUser(userIdentifier string) []*Room {
	s.mu.RLock()
	defer s.mu.RUnlock()

	userClean := strings.ToLower(strings.TrimSpace(userIdentifier))
	list := make([]*Room, 0)
	for _, r := range s.rooms {
		isMember := strings.ToLower(strings.TrimSpace(r.CreatedBy)) == userClean
		if !isMember {
			for _, m := range r.Members {
				if strings.ToLower(strings.TrimSpace(m)) == userClean {
					isMember = true
					break
				}
			}
		}

		if isMember {
			if r.LastMessage == "" {
				if msgs := s.messages[r.ID]; len(msgs) > 0 {
					lastMsg := msgs[len(msgs)-1]
					r.LastMessage = lastMsg.Content
					r.LastMessageAt = lastMsg.CreatedAt
				}
			}
			list = append(list, r)
		}
	}

	sort.SliceStable(list, func(i, j int) bool {
		tI := list[i].LastMessageAt
		if tI.IsZero() {
			tI = list[i].CreatedAt
		}
		tJ := list[j].LastMessageAt
		if tJ.IsZero() {
			tJ = list[j].CreatedAt
		}
		if !tI.Equal(tJ) {
			return tI.After(tJ)
		}
		if list[i].Name != list[j].Name {
			return list[i].Name < list[j].Name
		}
		return list[i].ID < list[j].ID
	})

	return list
}

func (s *RoomStore) JoinRoom(roomIDOrCode, userIdentifier string) (*Room, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var target *Room
	cleanCode := strings.ToUpper(strings.TrimSpace(roomIDOrCode))
	for _, r := range s.rooms {
		if r.ID == roomIDOrCode || strings.ToUpper(strings.TrimSpace(r.Code)) == cleanCode {
			target = r
			break
		}
	}
	if target == nil {
		return nil, false
	}

	userClean := strings.TrimSpace(userIdentifier)
	if userClean != "" {
		alreadyMember := false
		for _, m := range target.Members {
			if strings.EqualFold(m, userClean) {
				alreadyMember = true
				break
			}
		}
		if !alreadyMember {
			target.Members = append(target.Members, userClean)
			go func() { _ = s.SaveToDisk("data/chat_store.json") }()
		}
	}

	return target, true
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

	cleanCreatedBy := strings.TrimSpace(createdBy)
	if cleanCreatedBy != "" {
		hasCreator := false
		for _, m := range members {
			if strings.EqualFold(m, cleanCreatedBy) {
				hasCreator = true
				break
			}
		}
		if !hasCreator {
			members = append(members, cleanCreatedBy)
		}
	}

	// De-duplicate 1-on-1 direct conversations between two users
	if !isGroup && len(members) == 2 {
		for _, r := range s.rooms {
			if !r.IsGroup && len(r.Members) == 2 {
				m0Match := strings.EqualFold(r.Members[0], members[0]) || strings.EqualFold(r.Members[0], members[1])
				m1Match := strings.EqualFold(r.Members[1], members[0]) || strings.EqualFold(r.Members[1], members[1])
				if m0Match && m1Match {
					return r
				}
			}
		}
	}

	welcomeText := "Grupo criado com sucesso! Convide amigos usando o código " + cleanCode + "."
	if !isGroup {
		welcomeText = "Conversa iniciada."
	}

	now := time.Now()
	room := &Room{
		ID:            uuid.New().String(),
		Name:          cleanName,
		Code:          cleanCode,
		IsGroup:       isGroup,
		Members:       members,
		CreatedBy:     cleanCreatedBy,
		CreatedAt:     now,
		LastMessage:   welcomeText,
		LastMessageAt: now,
	}

	s.rooms[room.ID] = room
	s.messages[room.ID] = []*ChatMessage{
		{
			ID:        uuid.New().String(),
			RoomID:    room.ID,
			UserID:    "system",
			Nickname:  "PORBot",
			Content:   welcomeText,
			Type:      "system",
			CreatedAt: now,
		},
	}
	go func() { _ = s.SaveToDisk("data/chat_store.json") }()
	return room
}

func (s *RoomStore) AddMessage(msg *ChatMessage) {
	s.mu.Lock()
	s.messages[msg.RoomID] = append(s.messages[msg.RoomID], msg)
	if r, ok := s.rooms[msg.RoomID]; ok {
		r.LastMessage = msg.Content
		r.LastMessageAt = msg.CreatedAt
	}
	s.mu.Unlock()
	go func() { _ = s.SaveToDisk("data/chat_store.json") }()
}

func (s *RoomStore) ToggleReaction(roomID, messageID, emoji, userID string) (map[string][]string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	msgs := s.messages[roomID]
	for _, m := range msgs {
		if m.ID == messageID {
			if m.Reactions == nil {
				m.Reactions = make(map[string][]string)
			}
			users := m.Reactions[emoji]
			alreadyReacted := false
			newUsers := make([]string, 0, len(users))
			for _, u := range users {
				if u == userID {
					alreadyReacted = true
				} else {
					newUsers = append(newUsers, u)
				}
			}
			if alreadyReacted {
				if len(newUsers) == 0 {
					delete(m.Reactions, emoji)
				} else {
					m.Reactions[emoji] = newUsers
				}
			} else {
				m.Reactions[emoji] = append(users, userID)
			}
			go func() { _ = s.SaveToDisk("data/chat_store.json") }()
			return m.Reactions, true
		}
	}
	return nil, false
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

func (h *ChatHandler) extractUser(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		token := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
		if claims, err := auth.ValidateJWT(token); err == nil && claims.Nickname != "" {
			return claims.Nickname
		}
	}
	if userParam := strings.TrimSpace(r.URL.Query().Get("user")); userParam != "" {
		return userParam
	}
	return ""
}

func (h *ChatHandler) ListRooms(w http.ResponseWriter, r *http.Request) {
	user := h.extractUser(r)
	if user == "" {
		http.Error(w, `{"error":"Acesso privado. Entre com sua conta para acessar suas conversas e grupos."}`, http.StatusUnauthorized)
		return
	}
	rooms := h.Store.GetRoomsForUser(user)
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
	user := h.extractUser(r)
	if user != "" {
		hasAccess := strings.EqualFold(room.CreatedBy, user)
		if !hasAccess {
			for _, m := range room.Members {
				if strings.EqualFold(m, user) {
					hasAccess = true
					break
				}
			}
		}
		if !hasAccess {
			http.Error(w, `{"error":"Acesso negado a esta conversa privada"}`, http.StatusForbidden)
			return
		}
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

type JoinRoomReq struct {
	Code string `json:"code"`
	User string `json:"user,omitempty"`
}

func (h *ChatHandler) JoinRoom(w http.ResponseWriter, r *http.Request) {
	var req JoinRoomReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"payload inválido"}`, http.StatusBadRequest)
		return
	}
	user := strings.TrimSpace(req.User)
	if user == "" {
		user = h.extractUser(r)
	}
	if user == "" {
		http.Error(w, `{"error":"Faça login para entrar no grupo"}`, http.StatusUnauthorized)
		return
	}
	room, ok := h.Store.JoinRoom(req.Code, user)
	if !ok {
		http.Error(w, `{"error":"Grupo não encontrado com este código"}`, http.StatusNotFound)
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

	creator := strings.TrimSpace(req.CreatedBy)
	if creator == "" {
		creator = h.extractUser(r)
	}
	if creator == "" {
		http.Error(w, `{"error":"Faça login para criar conversas ou grupos"}`, http.StatusUnauthorized)
		return
	}

	isGroup := true
	if req.IsGroup != nil {
		isGroup = *req.IsGroup
	}

	room := h.Store.CreateRoom(req.Name, req.Code, isGroup, req.Members, creator)
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
