package chat

import (
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/porchat/api/internal/security"
)

// CreatePoll creates an interactive in-chat poll message in the specified room.
func (s *RoomStore) CreatePoll(roomID, userID, nickname, question string, optionLabels []string, multiSelect bool) (*ChatMessage, error) {
	cleanQuestion, err := security.ValidateChatMessage(strings.TrimSpace(question), 2, 240)
	if err != nil {
		return nil, errors.New("poll question must be between 2 and 240 characters")
	}

	validOptions := make([]ChatPollOption, 0, len(optionLabels))
	seen := make(map[string]bool)
	for i, raw := range optionLabels {
		trimmed := strings.TrimSpace(raw)
		if trimmed == "" {
			continue
		}
		cleanOpt, err := security.ValidateChatMessage(trimmed, 1, 120)
		if err != nil {
			continue
		}
		lower := strings.ToLower(cleanOpt)
		if seen[lower] {
			continue
		}
		seen[lower] = true
		validOptions = append(validOptions, ChatPollOption{
			ID:       fmt.Sprintf("opt_%d", i+1),
			Label:    cleanOpt,
			VoterIDs: []string{},
		})
	}

	if len(validOptions) < 2 || len(validOptions) > 8 {
		return nil, errors.New("poll must have between 2 and 8 unique options")
	}

	s.mu.Lock()
	s.ensureMapsLocked()
	room, ok := s.rooms[roomID]
	if !ok {
		s.mu.Unlock()
		return nil, errors.New("room not found")
	}

	now := time.Now()
	poll := &ChatPoll{
		ID:          uuid.New().String(),
		Question:    cleanQuestion,
		Options:     validOptions,
		MultiSelect: multiSelect,
		IsClosed:    false,
		CreatedBy:   nickname,
		CreatedAt:   now.Format(time.RFC3339),
	}

	msg := &ChatMessage{
		ID:        uuid.New().String(),
		RoomID:    roomID,
		UserID:    userID,
		Nickname:  nickname,
		Content:   "Enquete: " + cleanQuestion,
		Type:      "poll",
		ReadBy:    []string{nickname},
		Poll:      poll,
		CreatedAt: now,
	}

	s.messages[roomID] = append(s.messages[roomID], msg)
	room.LastMessage = msg.Content
	room.LastMessageAt = now
	s.mu.Unlock()

	go func() { _ = s.SaveToDisk("data/chat_store.json") }()
	return msg, nil
}

// VotePoll toggles or switches a user's vote on a poll option inside a room message.
func (s *RoomStore) VotePoll(roomID, messageID, optionID, voterIdentifier string) (*ChatPoll, error) {
	voter := strings.TrimSpace(voterIdentifier)
	if voter == "" {
		return nil, errors.New("voter identifier is required")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	msgs := s.messages[roomID]
	for _, m := range msgs {
		if m.ID == messageID && m.Poll != nil {
			if m.Poll.IsClosed {
				return nil, errors.New("poll is closed")
			}

			targetIdx := -1
			for i := range m.Poll.Options {
				if m.Poll.Options[i].ID == optionID {
					targetIdx = i
					break
				}
			}
			if targetIdx == -1 {
				return nil, errors.New("poll option not found")
			}

			// Check if voter already voted on targetIdx
			alreadyVotedTarget := false
			for _, v := range m.Poll.Options[targetIdx].VoterIDs {
				if strings.EqualFold(v, voter) {
					alreadyVotedTarget = true
					break
				}
			}

			if !m.Poll.MultiSelect {
				// Remove voter from all options first
				for i := range m.Poll.Options {
					filtered := make([]string, 0, len(m.Poll.Options[i].VoterIDs))
					for _, v := range m.Poll.Options[i].VoterIDs {
						if !strings.EqualFold(v, voter) {
							filtered = append(filtered, v)
						}
					}
					m.Poll.Options[i].VoterIDs = filtered
				}
				// If they hadn't already voted on targetIdx, add their vote
				if !alreadyVotedTarget {
					m.Poll.Options[targetIdx].VoterIDs = append(m.Poll.Options[targetIdx].VoterIDs, voter)
				}
			} else {
				// Multi-select toggle on targetIdx only
				if alreadyVotedTarget {
					filtered := make([]string, 0, len(m.Poll.Options[targetIdx].VoterIDs))
					for _, v := range m.Poll.Options[targetIdx].VoterIDs {
						if !strings.EqualFold(v, voter) {
							filtered = append(filtered, v)
						}
					}
					m.Poll.Options[targetIdx].VoterIDs = filtered
				} else {
					m.Poll.Options[targetIdx].VoterIDs = append(m.Poll.Options[targetIdx].VoterIDs, voter)
				}
			}

			go func() { _ = s.SaveToDisk("data/chat_store.json") }()
			return m.Poll, nil
		}
	}
	return nil, errors.New("poll message not found")
}

// ClosePoll marks a poll as closed so no further votes can be cast.
func (s *RoomStore) ClosePoll(roomID, messageID, actorIdentifier string) (*ChatPoll, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	room := s.rooms[roomID]
	for _, m := range s.messages[roomID] {
		if m.ID == messageID && m.Poll != nil {
			isCreator := strings.EqualFold(m.Poll.CreatedBy, actorIdentifier) || strings.EqualFold(m.UserID, actorIdentifier)
			isAdmin := room != nil && s.isRoomAdminLocked(room, actorIdentifier)
			if !isCreator && !isAdmin {
				return nil, errors.New("only poll creator or group admin can close poll")
			}
			m.Poll.IsClosed = true
			go func() { _ = s.SaveToDisk("data/chat_store.json") }()
			return m.Poll, nil
		}
	}
	return nil, errors.New("poll message not found")
}

// LeaveRoom removes a user from the room's member list and promotes a remaining member if needed.
func (s *RoomStore) LeaveRoom(roomID, userIdentifier string) (*Room, bool) {
	cleanUser := strings.TrimSpace(userIdentifier)
	if cleanUser == "" {
		return nil, false
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	room, ok := s.rooms[roomID]
	if !ok {
		return nil, false
	}

	newMembers := make([]string, 0, len(room.Members))
	removed := false
	for _, m := range room.Members {
		if strings.EqualFold(m, cleanUser) {
			removed = true
		} else {
			newMembers = append(newMembers, m)
		}
	}

	if !removed && !strings.EqualFold(room.CreatedBy, cleanUser) {
		return nil, false
	}

	room.Members = newMembers

	// Remove from admins as well
	newAdmins := make([]string, 0, len(room.Admins))
	for _, adm := range room.Admins {
		if !strings.EqualFold(adm, cleanUser) {
			newAdmins = append(newAdmins, adm)
		}
	}
	if len(newAdmins) == 0 && len(room.Members) > 0 {
		newAdmins = append(newAdmins, room.Members[0])
	}
	room.Admins = newAdmins
	if strings.EqualFold(room.CreatedBy, cleanUser) && len(room.Members) > 0 {
		room.CreatedBy = room.Members[0]
	}

	sysMsg := &ChatMessage{
		ID:        uuid.New().String(),
		RoomID:    roomID,
		UserID:    "system",
		Nickname:  "Sistema",
		Content:   cleanUser + " saiu da conversa.",
		Type:      "system",
		CreatedAt: time.Now(),
	}
	s.messages[roomID] = append(s.messages[roomID], sysMsg)
	room.LastMessage = sysMsg.Content
	room.LastMessageAt = sysMsg.CreatedAt

	go func() { _ = s.SaveToDisk("data/chat_store.json") }()
	return room, true
}

// AddGroupMembers adds one or more members to a group room.
func (s *RoomStore) AddGroupMembers(roomID string, newMembers []string, actorIdentifier string) (*Room, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	room, ok := s.rooms[roomID]
	if !ok {
		return nil, errors.New("room not found")
	}
	if !room.IsGroup {
		return nil, errors.New("cannot add members to a direct conversation")
	}

	addedNames := make([]string, 0)
	for _, raw := range newMembers {
		clean := strings.TrimSpace(raw)
		if clean == "" {
			continue
		}
		exists := false
		for _, existing := range room.Members {
			if strings.EqualFold(existing, clean) {
				exists = true
				break
			}
		}
		if !exists {
			room.Members = append(room.Members, clean)
			addedNames = append(addedNames, clean)
		}
	}

	if len(addedNames) > 0 {
		sysMsg := &ChatMessage{
			ID:        uuid.New().String(),
			RoomID:    roomID,
			UserID:    "system",
			Nickname:  "Sistema",
			Content:   strings.Join(addedNames, ", ") + " entrou no grupo.",
			Type:      "system",
			CreatedAt: time.Now(),
		}
		s.messages[roomID] = append(s.messages[roomID], sysMsg)
		room.LastMessage = sysMsg.Content
		room.LastMessageAt = sysMsg.CreatedAt
		go func() { _ = s.SaveToDisk("data/chat_store.json") }()
	}

	return room, nil
}

// RemoveGroupMember allows an admin to remove a member from a group.
func (s *RoomStore) RemoveGroupMember(roomID, targetMember, actorIdentifier string) (*Room, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	room, ok := s.rooms[roomID]
	if !ok {
		return nil, errors.New("room not found")
	}
	if !room.IsGroup {
		return nil, errors.New("cannot remove members from a direct conversation")
	}
	if !s.isRoomAdminLocked(room, actorIdentifier) {
		return nil, errors.New("only group administrators can remove members")
	}

	cleanTarget := strings.TrimSpace(targetMember)
	if cleanTarget == "" {
		return nil, errors.New("invalid member")
	}

	updated := make([]string, 0, len(room.Members))
	found := false
	for _, m := range room.Members {
		if strings.EqualFold(m, cleanTarget) {
			found = true
		} else {
			updated = append(updated, m)
		}
	}
	if !found {
		return nil, errors.New("member not found in room")
	}
	room.Members = updated

	// Also remove from admins if present
	newAdmins := make([]string, 0, len(room.Admins))
	for _, adm := range room.Admins {
		if !strings.EqualFold(adm, cleanTarget) {
			newAdmins = append(newAdmins, adm)
		}
	}
	room.Admins = newAdmins

	go func() { _ = s.SaveToDisk("data/chat_store.json") }()
	return room, nil
}

// ToggleGroupAdmin promotes or demotes a group member as administrator.
func (s *RoomStore) ToggleGroupAdmin(roomID, targetMember, actorIdentifier string) (*Room, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	room, ok := s.rooms[roomID]
	if !ok {
		return nil, errors.New("room not found")
	}
	if !s.isRoomAdminLocked(room, actorIdentifier) {
		return nil, errors.New("only group administrators can manage admin roles")
	}

	cleanTarget := strings.TrimSpace(targetMember)
	if cleanTarget == "" {
		return nil, errors.New("target member is required")
	}

	isMember := false
	for _, m := range room.Members {
		if strings.EqualFold(m, cleanTarget) {
			isMember = true
			cleanTarget = m
			break
		}
	}
	if !isMember {
		return nil, errors.New("target user is not a member of this group")
	}

	alreadyAdmin := false
	newAdmins := make([]string, 0, len(room.Admins))
	for _, adm := range room.Admins {
		if strings.EqualFold(adm, cleanTarget) {
			alreadyAdmin = true
		} else {
			newAdmins = append(newAdmins, adm)
		}
	}

	if alreadyAdmin {
		if len(newAdmins) == 0 {
			return nil, errors.New("group must have at least one administrator")
		}
		room.Admins = newAdmins
	} else {
		room.Admins = append(room.Admins, cleanTarget)
	}

	go func() { _ = s.SaveToDisk("data/chat_store.json") }()
	return room, nil
}

// UpdateGroupSettings updates a room's name and/or description.
func (s *RoomStore) UpdateGroupSettings(roomID, newName, newDescription, actorIdentifier string) (*Room, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	room, ok := s.rooms[roomID]
	if !ok {
		return nil, errors.New("room not found")
	}

	if strings.TrimSpace(newName) != "" {
		cleanName := strings.TrimSpace(newName)
		if len(cleanName) > 80 {
			cleanName = cleanName[:80]
		}
		room.Name = cleanName
	}

	cleanDesc := strings.TrimSpace(newDescription)
	if len(cleanDesc) > 300 {
		cleanDesc = cleanDesc[:300]
	}
	room.Description = cleanDesc

	go func() { _ = s.SaveToDisk("data/chat_store.json") }()
	return room, nil
}

// RegenerateRoomCode generates a fresh unique invite PIN code for the group.
func (s *RoomStore) RegenerateRoomCode(roomID, actorIdentifier string) (*Room, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	room, ok := s.rooms[roomID]
	if !ok {
		return nil, errors.New("room not found")
	}
	if !s.isRoomAdminLocked(room, actorIdentifier) {
		return nil, errors.New("only group administrators can regenerate the invite code")
	}

	for attempt := 0; attempt < 20; attempt++ {
		candidate := fmt.Sprintf("POR-%04d", rand.Intn(9000)+1000)
		collision := false
		for _, r := range s.rooms {
			if strings.EqualFold(r.Code, candidate) {
				collision = true
				break
			}
		}
		if !collision {
			room.Code = candidate
			break
		}
	}

	go func() { _ = s.SaveToDisk("data/chat_store.json") }()
	return room, nil
}

// --- HTTP Handlers for Polls & Group Administration ---

func (h *ChatHandler) CreatePollHTTP(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "id")
	user := h.extractUser(r)
	if user == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req struct {
		Question    string   `json:"question"`
		Options     []string `json:"options"`
		MultiSelect bool     `json:"multi_select"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid payload"}`, http.StatusBadRequest)
		return
	}

	msg, err := h.Store.CreatePoll(roomID, user, user, req.Question, req.Options, req.MultiSelect)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	h.emitRoomEvent(roomID, "chat:new_message", msg)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(msg)
}

func (h *ChatHandler) VotePollHTTP(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "id")
	msgID := chi.URLParam(r, "msgId")
	user := h.extractUser(r)
	if user == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req struct {
		OptionID string `json:"option_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.OptionID == "" {
		http.Error(w, `{"error":"option_id is required"}`, http.StatusBadRequest)
		return
	}

	poll, err := h.Store.VotePoll(roomID, msgID, req.OptionID, user)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	h.emitRoomEvent(roomID, "chat:poll_updated", map[string]interface{}{
		"room_id":    roomID,
		"message_id": msgID,
		"poll":       poll,
	})
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(poll)
}

func (h *ChatHandler) ClosePollHTTP(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "id")
	msgID := chi.URLParam(r, "msgId")
	user := h.extractUser(r)
	if user == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	poll, err := h.Store.ClosePoll(roomID, msgID, user)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusForbidden)
		return
	}

	h.emitRoomEvent(roomID, "chat:poll_updated", map[string]interface{}{
		"room_id":    roomID,
		"message_id": msgID,
		"poll":       poll,
	})
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(poll)
}

func (h *ChatHandler) LeaveRoomHTTP(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "id")
	user := h.extractUser(r)
	if user == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	room, ok := h.Store.LeaveRoom(roomID, user)
	if !ok {
		http.Error(w, `{"error":"unable to leave room"}`, http.StatusNotFound)
		return
	}

	h.emitRoomEvent(roomID, "room:updated", map[string]interface{}{"room": room})
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(room)
}

func (h *ChatHandler) AddMembersHTTP(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "id")
	user := h.extractUser(r)
	if user == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req struct {
		Members []string `json:"members"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Members) == 0 {
		http.Error(w, `{"error":"members array is required"}`, http.StatusBadRequest)
		return
	}

	room, err := h.Store.AddGroupMembers(roomID, req.Members, user)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	h.emitRoomEvent(roomID, "room:updated", map[string]interface{}{"room": room})
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(room)
}

func (h *ChatHandler) RemoveMemberHTTP(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "id")
	targetMember := chi.URLParam(r, "member")
	user := h.extractUser(r)
	if user == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	room, err := h.Store.RemoveGroupMember(roomID, targetMember, user)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusForbidden)
		return
	}

	h.emitRoomEvent(roomID, "room:updated", map[string]interface{}{"room": room})
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(room)
}

func (h *ChatHandler) ToggleAdminHTTP(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "id")
	user := h.extractUser(r)
	if user == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req struct {
		Member string `json:"member"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Member == "" {
		http.Error(w, `{"error":"member is required"}`, http.StatusBadRequest)
		return
	}

	room, err := h.Store.ToggleGroupAdmin(roomID, req.Member, user)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusForbidden)
		return
	}

	h.emitRoomEvent(roomID, "room:updated", map[string]interface{}{"room": room})
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(room)
}

func (h *ChatHandler) UpdateGroupSettingsHTTP(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "id")
	user := h.extractUser(r)
	if user == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid payload"}`, http.StatusBadRequest)
		return
	}

	room, err := h.Store.UpdateGroupSettings(roomID, req.Name, req.Description, user)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	h.emitRoomEvent(roomID, "room:updated", map[string]interface{}{"room": room})
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(room)
}

func (h *ChatHandler) RegenerateCodeHTTP(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "id")
	user := h.extractUser(r)
	if user == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	room, err := h.Store.RegenerateRoomCode(roomID, user)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusForbidden)
		return
	}

	h.emitRoomEvent(roomID, "room:updated", map[string]interface{}{"room": room})
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(room)
}
