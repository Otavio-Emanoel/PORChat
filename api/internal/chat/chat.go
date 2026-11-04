package chat

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/porchat/api/internal/auth"
	"github.com/porchat/api/internal/security"
)

type PinnedMessageInfo struct {
	MessageID      string `json:"message_id"`
	Content        string `json:"content"`
	SenderNickname string `json:"sender_nickname"`
	PinnedBy       string `json:"pinned_by"`
	PinnedAt       string `json:"pinned_at"`
}

type ReplyPreview struct {
	ID       string `json:"id"`
	Nickname string `json:"nickname"`
	Content  string `json:"content"`
}

type MessageAttachment struct {
	ID              string   `json:"id"`
	RoomID          string   `json:"room_id"`
	Kind            string   `json:"kind"` // "audio", "image", "document"
	FileName        string   `json:"file_name"`
	MimeType        string   `json:"mime_type"`
	SizeBytes       int      `json:"size_bytes"`
	SHA256          string   `json:"sha256"`
	URL             string   `json:"url"`
	DataURL         string   `json:"data_url,omitempty"`
	DurationSeconds int      `json:"duration_seconds,omitempty"`
	Waveform        []int    `json:"waveform,omitempty"`
	CreatedAt       string   `json:"created_at"`
}

type ChatPollOption struct {
	ID       string   `json:"id"`
	Label    string   `json:"label"`
	VoterIDs []string `json:"voter_ids"`
}

type ChatPoll struct {
	ID          string           `json:"id"`
	Question    string           `json:"question"`
	Options     []ChatPollOption `json:"options"`
	MultiSelect bool             `json:"multi_select,omitempty"`
	IsClosed    bool             `json:"is_closed,omitempty"`
	CreatedBy   string           `json:"created_by"`
	CreatedAt   string           `json:"created_at"`
}

type Room struct {
	ID            string             `json:"id"`
	Name          string             `json:"name"`
	Code          string             `json:"code"`
	Description   string             `json:"description,omitempty"`
	IsGroup       bool               `json:"is_group"`
	Members       []string           `json:"members,omitempty"`
	Admins        []string           `json:"admins,omitempty"`
	CreatedBy     string             `json:"created_by,omitempty"`
	CreatedAt     time.Time          `json:"created_at"`
	LastMessage   string             `json:"last_message,omitempty"`
	LastMessageAt time.Time          `json:"last_message_at,omitempty"`
	PinnedMessage *PinnedMessageInfo `json:"pinned_message,omitempty"`
}

type ChatMessage struct {
	ID           string                 `json:"id"`
	RoomID       string                 `json:"room_id"`
	UserID       string                 `json:"user_id"`
	Nickname     string                 `json:"nickname"`
	Content      string                 `json:"content"`
	Type         string                 `json:"type"` // "text", "game_card", "system", "voice", "file", "poll"
	Reactions    map[string][]string    `json:"reactions,omitempty"`
	CreatedAt    time.Time              `json:"created_at"`
	EditedAt     string                 `json:"edited_at,omitempty"`
	IsEdited     bool                   `json:"is_edited,omitempty"`
	ReplyToID    string                 `json:"reply_to_id,omitempty"`
	ReplyPreview *ReplyPreview          `json:"reply_preview,omitempty"`
	ReadBy       []string               `json:"read_by,omitempty"`
	Attachment   *MessageAttachment     `json:"attachment,omitempty"`
	Poll         *ChatPoll              `json:"poll,omitempty"`
	GameData     map[string]interface{} `json:"game_data,omitempty"`
}

type RoomStore struct {
	mu          sync.RWMutex
	rooms       map[string]*Room
	messages    map[string][]*ChatMessage // roomID -> list of messages
	attachments map[string]*MessageAttachment
}

func NewRoomStore() *RoomStore {
	store := &RoomStore{
		rooms:       make(map[string]*Room),
		messages:    make(map[string][]*ChatMessage),
		attachments: make(map[string]*MessageAttachment),
	}
	if !store.LoadFromDisk("data/chat_store.json") {
		store.seedRooms()
	}
	return store
}

func (s *RoomStore) ensureMapsLocked() {
	if s.rooms == nil {
		s.rooms = make(map[string]*Room)
	}
	if s.messages == nil {
		s.messages = make(map[string][]*ChatMessage)
	}
	if s.attachments == nil {
		s.attachments = make(map[string]*MessageAttachment)
	}
}

func (s *RoomStore) SaveToDisk(filePath string) error {
	s.mu.RLock()
	defer s.mu.RUnlock()

	data := struct {
		Rooms       map[string]*Room              `json:"rooms"`
		Messages    map[string][]*ChatMessage     `json:"messages"`
		Attachments map[string]*MessageAttachment `json:"attachments,omitempty"`
	}{
		Rooms:       s.rooms,
		Messages:    s.messages,
		Attachments: s.attachments,
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
		Rooms       map[string]*Room              `json:"rooms"`
		Messages    map[string][]*ChatMessage     `json:"messages"`
		Attachments map[string]*MessageAttachment `json:"attachments,omitempty"`
	}
	if err := json.Unmarshal(bytes, &data); err != nil {
		return false
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensureMapsLocked()
	if len(data.Rooms) > 0 {
		for _, r := range data.Rooms {
			if len(r.Admins) == 0 && r.CreatedBy != "" {
				r.Admins = []string{r.CreatedBy}
			}
		}
		s.rooms = data.Rooms
	}
	if len(data.Messages) > 0 {
		s.messages = data.Messages
	}
	if len(data.Attachments) > 0 {
		s.attachments = data.Attachments
	}
	return true
}

func (s *RoomStore) seedRooms() {
	s.ensureMapsLocked()
	defaultRooms := []*Room{
		{
			ID:          "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
			Name:        "Trio PORChat (Pedro, Otavio & Raul)",
			Code:        "POR-1000",
			Description: "Grupo principal para coordenação de partidas, enquetes e Modo TV.",
			IsGroup:     true,
			Members:     []string{"Otavio", "Pedro", "Raul"},
			Admins:      []string{"Otavio"},
			CreatedBy:   "Otavio",
			CreatedAt:   time.Now(),
		},
		{
			ID:          "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
			Name:        "Tribunal dos Debates",
			Code:        "DEB-2000",
			Description: "Arena dedicada para sessões do Modo Debate com jurados ao vivo.",
			IsGroup:     true,
			Members:     []string{"Otavio", "Pedro", "Raul"},
			Admins:      []string{"Pedro"},
			CreatedBy:   "Pedro",
			CreatedAt:   time.Now(),
		},
		{
			ID:          "f1e2d3c4-b5a6-9876-5432-10fedcba9876",
			Name:        "Arena Quiz Relâmpago",
			Code:        "QZ-3000",
			Description: "Sala competitiva de perguntas e respostas cronometradas.",
			IsGroup:     true,
			Members:     []string{"Otavio", "Pedro", "Raul"},
			Admins:      []string{"Raul"},
			CreatedBy:   "Raul",
			CreatedAt:   time.Now(),
		},
		{
			ID:        "chat-direct-pedro",
			Name:      "Pedro",
			Code:      "DM-PEDRO",
			IsGroup:   false,
			Members:   []string{"Otavio", "Pedro"},
			Admins:    []string{"Pedro", "Otavio"},
			CreatedBy: "Pedro",
			CreatedAt: time.Now(),
		},
		{
			ID:        "chat-direct-raul",
			Name:      "Raul",
			Code:      "DM-RAUL",
			IsGroup:   false,
			Members:   []string{"Otavio", "Raul"},
			Admins:    []string{"Raul", "Otavio"},
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
				Nickname:  "Sistema",
				Content:   "Grupo criado! Inicie debates ou quizzes e acompanhe no telão.",
				Type:      "system",
				ReadBy:    []string{"Otavio", "Pedro", "Raul"},
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
				ReadBy:    []string{r.CreatedBy},
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
	s.ensureMapsLocked()

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
	admins := make([]string, 0, 1)
	if cleanCreatedBy != "" {
		admins = append(admins, cleanCreatedBy)
	}
	room := &Room{
		ID:            uuid.New().String(),
		Name:          cleanName,
		Code:          cleanCode,
		IsGroup:       isGroup,
		Members:       members,
		Admins:        admins,
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
			Nickname:  "Sistema",
			Content:   welcomeText,
			Type:      "system",
			ReadBy:    admins,
			CreatedAt: now,
		},
	}
	go func() { _ = s.SaveToDisk("data/chat_store.json") }()
	return room
}

func (s *RoomStore) AddMessage(msg *ChatMessage) {
	s.mu.Lock()
	s.ensureMapsLocked()
	if msg.ReplyToID != "" && msg.ReplyPreview == nil {
		for _, existing := range s.messages[msg.RoomID] {
			if existing.ID == msg.ReplyToID {
				previewText := existing.Content
				if len(previewText) > 120 {
					previewText = previewText[:120] + "..."
				}
				msg.ReplyPreview = &ReplyPreview{
					ID:       existing.ID,
					Nickname: existing.Nickname,
					Content:  previewText,
				}
				break
			}
		}
	}
	if len(msg.ReadBy) == 0 && msg.Nickname != "" {
		msg.ReadBy = []string{msg.Nickname}
	}
	s.messages[msg.RoomID] = append(s.messages[msg.RoomID], msg)
	if r, ok := s.rooms[msg.RoomID]; ok {
		r.LastMessage = msg.Content
		r.LastMessageAt = msg.CreatedAt
	}
	s.mu.Unlock()
	go func() { _ = s.SaveToDisk("data/chat_store.json") }()
}

func (s *RoomStore) GetMessage(roomID, messageID string) (*ChatMessage, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, m := range s.messages[roomID] {
		if m.ID == messageID {
			return m, true
		}
	}
	return nil, false
}

func (s *RoomStore) EditMessage(roomID, messageID, actorIdentifier, newContent string) (*ChatMessage, bool) {
	sanitized, err := security.ValidateChatMessage(strings.TrimSpace(newContent), 1, 2000)
	if err != nil {
		return nil, false
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	msgs := s.messages[roomID]
	room := s.rooms[roomID]
	for idx, m := range msgs {
		if m.ID == messageID {
			if m.Type == "system" {
				return nil, false
			}
			isAuthor := strings.EqualFold(m.UserID, actorIdentifier) || strings.EqualFold(m.Nickname, actorIdentifier)
			isAdmin := room != nil && s.isRoomAdminLocked(room, actorIdentifier)
			if !isAuthor && !isAdmin {
				return nil, false
			}
			m.Content = sanitized
			m.IsEdited = true
			m.EditedAt = time.Now().Format(time.RFC3339)

			// Update room last message if this was the latest message
			if room != nil && idx == len(msgs)-1 {
				room.LastMessage = sanitized
			}
			// Update pinned message text if this message is currently pinned
			if room != nil && room.PinnedMessage != nil && room.PinnedMessage.MessageID == messageID {
				room.PinnedMessage.Content = sanitized
			}
			go func() { _ = s.SaveToDisk("data/chat_store.json") }()
			return m, true
		}
	}
	return nil, false
}

func (s *RoomStore) PinMessage(roomID, messageID, pinnedBy string) (*PinnedMessageInfo, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	room, ok := s.rooms[roomID]
	if !ok {
		return nil, false
	}

	var targetMsg *ChatMessage
	for _, m := range s.messages[roomID] {
		if m.ID == messageID {
			targetMsg = m
			break
		}
	}
	if targetMsg == nil {
		return nil, false
	}

	pinInfo := &PinnedMessageInfo{
		MessageID:      targetMsg.ID,
		Content:        targetMsg.Content,
		SenderNickname: targetMsg.Nickname,
		PinnedBy:       strings.TrimSpace(pinnedBy),
		PinnedAt:       time.Now().Format(time.RFC3339),
	}
	room.PinnedMessage = pinInfo
	go func() { _ = s.SaveToDisk("data/chat_store.json") }()
	return pinInfo, true
}

func (s *RoomStore) UnpinMessage(roomID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	room, ok := s.rooms[roomID]
	if !ok {
		return false
	}
	room.PinnedMessage = nil
	go func() { _ = s.SaveToDisk("data/chat_store.json") }()
	return true
}

func (s *RoomStore) MarkMessagesRead(roomID, readerIdentifier string, messageIDs []string) []string {
	cleanReader := strings.TrimSpace(readerIdentifier)
	if cleanReader == "" {
		return nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	msgs := s.messages[roomID]
	if len(msgs) == 0 {
		return nil
	}

	idFilter := make(map[string]bool, len(messageIDs))
	for _, id := range messageIDs {
		idFilter[id] = true
	}

	updatedIDs := make([]string, 0)
	for _, m := range msgs {
		if len(idFilter) > 0 && !idFilter[m.ID] {
			continue
		}
		alreadyRead := false
		for _, r := range m.ReadBy {
			if strings.EqualFold(r, cleanReader) {
				alreadyRead = true
				break
			}
		}
		if !alreadyRead {
			m.ReadBy = append(m.ReadBy, cleanReader)
			updatedIDs = append(updatedIDs, m.ID)
		}
	}

	if len(updatedIDs) > 0 {
		go func() { _ = s.SaveToDisk("data/chat_store.json") }()
	}
	return updatedIDs
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

func (s *RoomStore) DeleteMessage(roomID, messageID, userID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	msgs := s.messages[roomID]
	room := s.rooms[roomID]
	for i, m := range msgs {
		if m.ID == messageID {
			s.messages[roomID] = append(msgs[:i], msgs[i+1:]...)
			if room != nil && room.PinnedMessage != nil && room.PinnedMessage.MessageID == messageID {
				room.PinnedMessage = nil
			}
			if room != nil {
				remaining := s.messages[roomID]
				if len(remaining) > 0 {
					last := remaining[len(remaining)-1]
					room.LastMessage = last.Content
					room.LastMessageAt = last.CreatedAt
				}
			}
			go func() { _ = s.SaveToDisk("data/chat_store.json") }()
			return true
		}
	}
	return false
}

func (s *RoomStore) GetMessages(roomID string, limit int) []*ChatMessage {
	return s.GetMessagesFiltered(roomID, "", "", "", limit)
}

func (s *RoomStore) GetMessagesFiltered(roomID, beforeID, query, msgType string, limit int) []*ChatMessage {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if limit <= 0 {
		limit = 50
	} else if limit > 5000 {
		limit = 5000
	}

	msgs := s.messages[roomID]
	if len(msgs) == 0 {
		return []*ChatMessage{}
	}

	endIndex := len(msgs)
	if beforeID != "" {
		for i, m := range msgs {
			if m.ID == beforeID {
				endIndex = i
				break
			}
		}
	}

	qLower := strings.ToLower(strings.TrimSpace(query))
	typeClean := strings.ToLower(strings.TrimSpace(msgType))

	filtered := make([]*ChatMessage, 0, endIndex)
	for i := 0; i < endIndex; i++ {
		m := msgs[i]
		if typeClean != "" && strings.ToLower(m.Type) != typeClean {
			continue
		}
		if qLower != "" &&
			!strings.Contains(strings.ToLower(m.Content), qLower) &&
			!strings.Contains(strings.ToLower(m.Nickname), qLower) {
			continue
		}
		filtered = append(filtered, m)
	}

	if len(filtered) <= limit {
		return filtered
	}
	return filtered[len(filtered)-limit:]
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

func (s *RoomStore) isRoomAdminLocked(room *Room, identifier string) bool {
	clean := strings.TrimSpace(identifier)
	if clean == "" || room == nil {
		return false
	}
	if strings.EqualFold(room.CreatedBy, clean) {
		return true
	}
	for _, adm := range room.Admins {
		if strings.EqualFold(adm, clean) {
			return true
		}
	}
	return false
}

type ChatHandler struct {
	Store           *RoomStore
	OnRoomBroadcast func(roomID, event string, payload interface{})
}

func NewChatHandler(store *RoomStore) *ChatHandler {
	return &ChatHandler{Store: store}
}

func (h *ChatHandler) emitRoomEvent(roomID, event string, payload interface{}) {
	if h.OnRoomBroadcast != nil {
		h.OnRoomBroadcast(roomID, event, payload)
	}
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
	h.emitRoomEvent(room.ID, "room:updated", map[string]interface{}{"room": room})
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(room)
}

type CreateRoomReq struct {
	Name        string   `json:"name"`
	Code        string   `json:"code,omitempty"`
	Description string   `json:"description,omitempty"`
	IsGroup     *bool    `json:"is_group,omitempty"`
	Members     []string `json:"members,omitempty"`
	CreatedBy   string   `json:"created_by,omitempty"`
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
	if strings.TrimSpace(req.Description) != "" {
		h.Store.mu.Lock()
		room.Description = strings.TrimSpace(req.Description)
		h.Store.mu.Unlock()
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(room)
}

func (h *ChatHandler) GetMessages(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "id")
	beforeID := r.URL.Query().Get("before")
	query := r.URL.Query().Get("q")
	msgType := r.URL.Query().Get("type")
	limit := 80
	if rawLimit := r.URL.Query().Get("limit"); rawLimit != "" {
		if parsed, err := strconv.Atoi(rawLimit); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	msgs := h.Store.GetMessagesFiltered(roomID, beforeID, query, msgType, limit)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(msgs)
}

func (h *ChatHandler) EditMessageHTTP(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "id")
	msgID := chi.URLParam(r, "msgId")
	user := h.extractUser(r)
	if user == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Content) == "" {
		http.Error(w, `{"error":"invalid content"}`, http.StatusBadRequest)
		return
	}

	updated, ok := h.Store.EditMessage(roomID, msgID, user, req.Content)
	if !ok {
		http.Error(w, `{"error":"cannot edit message"}`, http.StatusForbidden)
		return
	}

	payload := map[string]interface{}{
		"message_id": updated.ID,
		"room_id":    roomID,
		"content":    updated.Content,
		"edited_at":  updated.EditedAt,
		"is_edited":  updated.IsEdited,
	}
	h.emitRoomEvent(roomID, "chat:message_edited", payload)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(updated)
}

func (h *ChatHandler) PinMessageHTTP(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "id")
	user := h.extractUser(r)
	if user == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req struct {
		MessageID string `json:"message_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.MessageID) == "" {
		http.Error(w, `{"error":"message_id is required"}`, http.StatusBadRequest)
		return
	}

	pinInfo, ok := h.Store.PinMessage(roomID, req.MessageID, user)
	if !ok {
		http.Error(w, `{"error":"message or room not found"}`, http.StatusNotFound)
		return
	}

	h.emitRoomEvent(roomID, "chat:pin_updated", map[string]interface{}{
		"room_id":        roomID,
		"pinned_message": pinInfo,
	})
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(pinInfo)
}

func (h *ChatHandler) UnpinMessageHTTP(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "id")
	user := h.extractUser(r)
	if user == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	if !h.Store.UnpinMessage(roomID) {
		http.Error(w, `{"error":"room not found"}`, http.StatusNotFound)
		return
	}

	h.emitRoomEvent(roomID, "chat:pin_updated", map[string]interface{}{
		"room_id":        roomID,
		"pinned_message": nil,
	})
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{"unpinned": true})
}

func (h *ChatHandler) MarkReadHTTP(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "id")
	user := h.extractUser(r)
	if user == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req struct {
		MessageIDs []string `json:"message_ids"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	updated := h.Store.MarkMessagesRead(roomID, user, req.MessageIDs)
	if len(updated) > 0 {
		h.emitRoomEvent(roomID, "chat:read_receipt", map[string]interface{}{
			"room_id":     roomID,
			"user_id":     user,
			"nickname":    user,
			"message_ids": updated,
			"read_at":     time.Now().Format(time.RFC3339),
		})
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"updated_count": len(updated),
		"message_ids":   updated,
	})
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
