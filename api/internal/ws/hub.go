package ws

import (
	"encoding/json"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/porchat/api/internal/chat"
	"github.com/porchat/api/internal/security"
)

type InboundMessage struct {
	Client   *Client
	Envelope *Envelope
}

type OnlineUser struct {
	ID         string `json:"id"`
	Nickname   string `json:"nickname"`
	ClientType string `json:"client_type"`
}

type GameEngine interface {
	HandleAction(client *Client, env *Envelope)
	GetStateSnapshot() interface{}
	IsActive() bool
}

type Hub struct {
	mu           sync.RWMutex
	rooms        map[string]map[*Client]bool
	gameEngines  map[string]GameEngine
	chatStore    *chat.RoomStore
	Register     chan *Client
	Unregister   chan *Client
	Inbound      chan *InboundMessage
	engineGetter func(roomID string) GameEngine
}

func NewHub(chatStore *chat.RoomStore) *Hub {
	return &Hub{
		rooms:       make(map[string]map[*Client]bool),
		gameEngines: make(map[string]GameEngine),
		chatStore:   chatStore,
		Register:    make(chan *Client),
		Unregister:  make(chan *Client),
		Inbound:     make(chan *InboundMessage),
	}
}

func (h *Hub) SetEngineGetter(fn func(roomID string) GameEngine) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.engineGetter = fn
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.handleRegister(client)

		case client := <-h.Unregister:
			h.handleUnregister(client)

		case msg := <-h.Inbound:
			h.handleInbound(msg)
		}
	}
}

func (h *Hub) handleRegister(c *Client) {
	h.mu.Lock()
	if _, ok := h.rooms[c.RoomID]; !ok {
		h.rooms[c.RoomID] = make(map[*Client]bool)
	}

	// Purge existing connections for the same user account across all rooms (Single active session enforcement)
	var staleClients []*Client
	if c.ClientType != "tv" {
		for roomID, roomClients := range h.rooms {
			for cl := range roomClients {
				if cl != c && cl.UserID == c.UserID && cl.ClientType != "tv" {
					delete(roomClients, cl)
					staleClients = append(staleClients, cl)
				}
			}
			if len(roomClients) == 0 && roomID != c.RoomID {
				delete(h.rooms, roomID)
			}
		}
	}

	h.rooms[c.RoomID][c] = true

	onlineList := make([]OnlineUser, 0, len(h.rooms[c.RoomID]))
	seen := make(map[string]bool)
	for cl := range h.rooms[c.RoomID] {
		if !seen[cl.UserID] {
			seen[cl.UserID] = true
			onlineList = append(onlineList, OnlineUser{
				ID:         cl.UserID,
				Nickname:   cl.Nickname,
				ClientType: cl.ClientType,
			})
		}
	}

	var activeGame interface{}
	if h.engineGetter != nil {
		if eng := h.engineGetter(c.RoomID); eng != nil && eng.IsActive() {
			activeGame = eng.GetStateSnapshot()
		}
	}
	h.mu.Unlock()

	// Notify stale sessions that another device logged in and terminate them cleanly
	for _, cl := range staleClients {
		termEnv, _ := NewEnvelope("auth:session_terminated", cl.RoomID, map[string]interface{}{
			"reason":          "Sua conta foi conectada em outro dispositivo. Você foi desconectado.",
			"new_client_type": c.ClientType,
			"user_id":         c.UserID,
		})
		if data, err := json.Marshal(termEnv); err == nil {
			cl.SafeSend(data)
		}
		go func(target *Client) {
			time.Sleep(100 * time.Millisecond)
			target.Close()
		}(cl)
	}

	// 1. Send sys:connected to the newly connected client
	connectedPayload := map[string]interface{}{
		"user": map[string]interface{}{
			"id":       c.UserID,
			"nickname": c.Nickname,
		},
		"client_type":  c.ClientType,
		"online_users": onlineList,
		"active_game":  activeGame,
	}
	if env, err := NewEnvelope("sys:connected", c.RoomID, connectedPayload); err == nil {
		h.sendToClient(c, env)
	}

	// 2. Broadcast sys:user_joined to all other clients in the room
	joinedPayload := map[string]interface{}{
		"user_id":     c.UserID,
		"nickname":    c.Nickname,
		"client_type": c.ClientType,
	}
	if env, err := NewEnvelope("sys:user_joined", c.RoomID, joinedPayload); err == nil {
		h.BroadcastToRoomExcept(c.RoomID, env, c)
	}
}

func (h *Hub) handleUnregister(c *Client) {
	h.mu.Lock()
	if clients, ok := h.rooms[c.RoomID]; ok {
		if _, exists := clients[c]; exists {
			delete(clients, c)
			c.Close()
			if len(clients) == 0 {
				delete(h.rooms, c.RoomID)
			}
		}
	}
	h.mu.Unlock()

	leftPayload := map[string]interface{}{
		"user_id":     c.UserID,
		"nickname":    c.Nickname,
		"client_type": c.ClientType,
	}
	if env, err := NewEnvelope("sys:user_left", c.RoomID, leftPayload); err == nil {
		h.BroadcastToRoom(c.RoomID, env)
	}
}

func (h *Hub) handleInbound(msg *InboundMessage) {
	c := msg.Client
	env := msg.Envelope

	switch env.Event {
	case "chat:send":
		var p struct {
			Content   string `json:"content"`
			ReplyToID string `json:"reply_to_id"`
		}
		if err := json.Unmarshal(env.Payload, &p); err == nil && p.Content != "" {
			trimmed := strings.TrimSpace(p.Content)
			if trimmed == "" {
				return
			}

			// Validate and sanitize chat message content, stripping XSS vectors & zero-width bypasses
			sanitizedContent, err := security.ValidateChatMessage(trimmed, 1, 2000)
			if err != nil {
				return
			}

			chatMsg := &chat.ChatMessage{
				ID:        uuid.New().String(),
				RoomID:    c.RoomID,
				UserID:    c.UserID,
				Nickname:  c.Nickname,
				Content:   sanitizedContent,
				Type:      "text",
				ReplyToID: strings.TrimSpace(p.ReplyToID),
				ReadBy:    []string{c.Nickname},
				CreatedAt: time.Now(),
			}
			h.chatStore.AddMessage(chatMsg)

			if outEnv, err := NewEnvelope("chat:new_message", c.RoomID, chatMsg); err == nil {
				h.BroadcastToRoom(c.RoomID, outEnv)
			}
		}

	case "chat:edit_message":
		var p struct {
			MessageID string `json:"message_id"`
			Content   string `json:"content"`
		}
		if err := json.Unmarshal(env.Payload, &p); err == nil && p.MessageID != "" && p.Content != "" {
			actor := c.Nickname
			if actor == "" {
				actor = c.UserID
			}
			if updated, ok := h.chatStore.EditMessage(c.RoomID, p.MessageID, actor, p.Content); ok {
				payload := map[string]interface{}{
					"message_id": updated.ID,
					"room_id":    c.RoomID,
					"content":    updated.Content,
					"edited_at":  updated.EditedAt,
					"is_edited":  updated.IsEdited,
				}
				if outEnv, err := NewEnvelope("chat:message_edited", c.RoomID, payload); err == nil {
					h.BroadcastToRoom(c.RoomID, outEnv)
				}
			}
		}

	case "chat:pin_message":
		var p struct {
			MessageID string `json:"message_id"`
		}
		if err := json.Unmarshal(env.Payload, &p); err == nil && p.MessageID != "" {
			actor := c.Nickname
			if actor == "" {
				actor = c.UserID
			}
			if pinInfo, ok := h.chatStore.PinMessage(c.RoomID, p.MessageID, actor); ok {
				payload := map[string]interface{}{
					"room_id":        c.RoomID,
					"pinned_message": pinInfo,
				}
				if outEnv, err := NewEnvelope("chat:pin_updated", c.RoomID, payload); err == nil {
					h.BroadcastToRoom(c.RoomID, outEnv)
				}
			}
		}

	case "chat:unpin_message":
		if h.chatStore.UnpinMessage(c.RoomID) {
			payload := map[string]interface{}{
				"room_id":        c.RoomID,
				"pinned_message": nil,
			}
			if outEnv, err := NewEnvelope("chat:pin_updated", c.RoomID, payload); err == nil {
				h.BroadcastToRoom(c.RoomID, outEnv)
			}
		}

	case "chat:mark_read":
		var p struct {
			MessageIDs []string `json:"message_ids"`
		}
		_ = json.Unmarshal(env.Payload, &p)
		reader := c.Nickname
		if reader == "" {
			reader = c.UserID
		}
		updatedIDs := h.chatStore.MarkMessagesRead(c.RoomID, reader, p.MessageIDs)
		if len(updatedIDs) > 0 {
			payload := map[string]interface{}{
				"room_id":     c.RoomID,
				"user_id":     c.UserID,
				"nickname":    c.Nickname,
				"message_ids": updatedIDs,
				"read_at":     time.Now().Format(time.RFC3339),
			}
			if outEnv, err := NewEnvelope("chat:read_receipt", c.RoomID, payload); err == nil {
				h.BroadcastToRoom(c.RoomID, outEnv)
			}
		}

	case "chat:create_poll":
		var p struct {
			Question    string   `json:"question"`
			Options     []string `json:"options"`
			MultiSelect bool     `json:"multi_select"`
		}
		if err := json.Unmarshal(env.Payload, &p); err == nil && p.Question != "" {
			if msg, err := h.chatStore.CreatePoll(c.RoomID, c.UserID, c.Nickname, p.Question, p.Options, p.MultiSelect); err == nil {
				if outEnv, err := NewEnvelope("chat:new_message", c.RoomID, msg); err == nil {
					h.BroadcastToRoom(c.RoomID, outEnv)
				}
			}
		}

	case "chat:vote_poll":
		var p struct {
			MessageID string `json:"message_id"`
			OptionID  string `json:"option_id"`
		}
		if err := json.Unmarshal(env.Payload, &p); err == nil && p.MessageID != "" && p.OptionID != "" {
			voter := c.Nickname
			if voter == "" {
				voter = c.UserID
			}
			if poll, err := h.chatStore.VotePoll(c.RoomID, p.MessageID, p.OptionID, voter); err == nil {
				payload := map[string]interface{}{
					"room_id":    c.RoomID,
					"message_id": p.MessageID,
					"poll":       poll,
				}
				if outEnv, err := NewEnvelope("chat:poll_updated", c.RoomID, payload); err == nil {
					h.BroadcastToRoom(c.RoomID, outEnv)
				}
			}
		}

	case "chat:close_poll":
		var p struct {
			MessageID string `json:"message_id"`
		}
		if err := json.Unmarshal(env.Payload, &p); err == nil && p.MessageID != "" {
			actor := c.Nickname
			if actor == "" {
				actor = c.UserID
			}
			if poll, err := h.chatStore.ClosePoll(c.RoomID, p.MessageID, actor); err == nil {
				payload := map[string]interface{}{
					"room_id":    c.RoomID,
					"message_id": p.MessageID,
					"poll":       poll,
				}
				if outEnv, err := NewEnvelope("chat:poll_updated", c.RoomID, payload); err == nil {
					h.BroadcastToRoom(c.RoomID, outEnv)
				}
			}
		}

	case "chat:typing":
		var p struct {
			IsTyping bool `json:"is_typing"`
		}
		if err := json.Unmarshal(env.Payload, &p); err == nil {
			payload := map[string]interface{}{
				"user_id":   c.UserID,
				"nickname":  c.Nickname,
				"is_typing": p.IsTyping,
			}
			if outEnv, err := NewEnvelope("chat:typing", c.RoomID, payload); err == nil {
				h.BroadcastToRoomExcept(c.RoomID, outEnv, c)
			}
		}

	case "chat:reaction":
		var p struct {
			MessageID string `json:"message_id"`
			Emoji     string `json:"emoji"`
		}
		if err := json.Unmarshal(env.Payload, &p); err == nil && p.MessageID != "" && p.Emoji != "" {
			reactions, ok := h.chatStore.ToggleReaction(c.RoomID, p.MessageID, p.Emoji, c.UserID)
			if ok {
				payload := map[string]interface{}{
					"message_id": p.MessageID,
					"emoji":      p.Emoji,
					"user_id":    c.UserID,
					"reactions":  reactions,
				}
				if outEnv, err := NewEnvelope("chat:reaction", c.RoomID, payload); err == nil {
					h.BroadcastToRoom(c.RoomID, outEnv)
				}
			}
		}

	case "chat:delete_message":
		var p struct {
			MessageID string `json:"message_id"`
		}
		if err := json.Unmarshal(env.Payload, &p); err == nil && p.MessageID != "" {
			if h.chatStore.DeleteMessage(c.RoomID, p.MessageID, c.UserID) {
				payload := map[string]interface{}{
					"message_id": p.MessageID,
				}
				if outEnv, err := NewEnvelope("chat:message_deleted", c.RoomID, payload); err == nil {
					h.BroadcastToRoom(c.RoomID, outEnv)
				}
			}
		}

	case "sys:ping":
		var p struct {
			ClientTime int64 `json:"client_time"`
		}
		_ = json.Unmarshal(env.Payload, &p)
		pongPayload := map[string]interface{}{
			"client_time": p.ClientTime,
			"server_time": time.Now().UnixMilli(),
		}
		if outEnv, err := NewEnvelope("sys:pong", c.RoomID, pongPayload); err == nil {
			h.sendToClient(c, outEnv)
		}

	case "game:start", "game:pause", "game:resume", "game:skip_phase", "game:abort",
		"debate:player_ready", "debate:submit_argument", "debate:ask_question",
		"debate:cast_vote", "debate:reaction", "quiz:submit_answer":
		if h.engineGetter != nil {
			if eng := h.engineGetter(c.RoomID); eng != nil {
				eng.HandleAction(c, env)
			}
		}

	default:
		log.Printf("Unhandled inbound event: %s from user: %s", env.Event, c.Nickname)
	}
}

func (h *Hub) GetOnlineUsers(roomID string) []OnlineUser {
	h.mu.RLock()
	defer h.mu.RUnlock()

	var list []OnlineUser
	seen := make(map[string]bool)
	if clients, ok := h.rooms[roomID]; ok {
		for cl := range clients {
			if !seen[cl.UserID] {
				seen[cl.UserID] = true
				list = append(list, OnlineUser{
					ID:         cl.UserID,
					Nickname:   cl.Nickname,
					ClientType: cl.ClientType,
				})
			}
		}
	}
	return list
}

func (h *Hub) BroadcastToRoom(roomID string, env *Envelope) {
	bytes, err := json.Marshal(env)
	if err != nil {
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	if clients, ok := h.rooms[roomID]; ok {
		for c := range clients {
			c.SafeSend(bytes)
		}
	}
}

func (h *Hub) BroadcastToRoomExcept(roomID string, env *Envelope, except *Client) {
	bytes, err := json.Marshal(env)
	if err != nil {
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	if clients, ok := h.rooms[roomID]; ok {
		for c := range clients {
			if c == except {
				continue
			}
			c.SafeSend(bytes)
		}
	}
}

func (h *Hub) BroadcastToClientType(roomID string, clientType string, env *Envelope) {
	bytes, err := json.Marshal(env)
	if err != nil {
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	if clients, ok := h.rooms[roomID]; ok {
		for c := range clients {
			if c.ClientType == clientType {
				c.SafeSend(bytes)
			}
		}
	}
}

func (h *Hub) sendToClient(c *Client, env *Envelope) {
	bytes, err := json.Marshal(env)
	if err != nil {
		return
	}
	c.SafeSend(bytes)
}

func (h *Hub) BroadcastRoomDeleted(roomID string) {
	if env, err := NewEnvelope("sys:room_deleted", roomID, map[string]interface{}{"room_id": roomID}); err == nil {
		h.BroadcastToRoom(roomID, env)
	}
}

func (h *Hub) GetStats() map[string]interface{} {
	h.mu.RLock()
	defer h.mu.RUnlock()

	activeRooms := 0
	totalConns := 0
	uniqueUsers := make(map[string]bool)

	for _, clients := range h.rooms {
		if len(clients) > 0 {
			activeRooms++
			for cl := range clients {
				totalConns++
				uniqueUsers[cl.UserID] = true
			}
		}
	}

	return map[string]interface{}{
		"active_rooms":      activeRooms,
		"total_connections": totalConns,
		"unique_online":     len(uniqueUsers),
	}
}

// GetRoomClients returns a slice copy of connected clients in a specific room.
func (h *Hub) GetRoomClients(roomID string) []*Client {
	h.mu.RLock()
	defer h.mu.RUnlock()

	clientsMap, ok := h.rooms[roomID]
	if !ok {
		return nil
	}

	result := make([]*Client, 0, len(clientsMap))
	for c := range clientsMap {
		result = append(result, c)
	}
	return result
}

// Close gracefully terminates all client connections and cleans up rooms.
func (h *Hub) Close() {
	h.mu.Lock()
	defer h.mu.Unlock()

	for _, clients := range h.rooms {
		for c := range clients {
			c.Close()
		}
	}
	h.rooms = make(map[string]map[*Client]bool)
}
