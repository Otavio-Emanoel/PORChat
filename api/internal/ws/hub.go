package ws

import (
	"encoding/json"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/porchat/api/internal/chat"
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

	// Purge stale ghost connections for the same user and client_type in this room
	for cl := range h.rooms[c.RoomID] {
		if cl != c && cl.UserID == c.UserID && cl.ClientType == c.ClientType {
			delete(h.rooms[c.RoomID], cl)
			cl.Close()
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
			Content string `json:"content"`
		}
		if err := json.Unmarshal(env.Payload, &p); err == nil && p.Content != "" {
			trimmed := strings.TrimSpace(p.Content)
			if trimmed == "/bots" {
				if h.engineGetter != nil {
					if eng := h.engineGetter(c.RoomID); eng != nil {
						eng.HandleAction(c, &Envelope{Event: "bots:toggle", RoomID: c.RoomID})
					}
				}
				return
			}

			chatMsg := &chat.ChatMessage{
				ID:        uuid.New().String(),
				RoomID:    c.RoomID,
				UserID:    c.UserID,
				Nickname:  c.Nickname,
				Content:   p.Content,
				Type:      "text",
				CreatedAt: time.Now(),
			}
			h.chatStore.AddMessage(chatMsg)

			if outEnv, err := NewEnvelope("chat:new_message", c.RoomID, chatMsg); err == nil {
				h.BroadcastToRoom(c.RoomID, outEnv)
			}
		}

	case "game:start", "debate:submit_argument", "debate:cast_vote", "debate:reaction",
		"quiz:submit_answer", "bots:toggle", "game:bots_spawn":
		if h.engineGetter != nil {
			if eng := h.engineGetter(c.RoomID); eng != nil {
				eng.HandleAction(c, env)
			}
		}

	default:
		log.Printf("Unhandled inbound event: %s from user: %s", env.Event, c.Nickname)
	}
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
			select {
			case c.Send <- bytes:
			default:
				log.Printf("Client send buffer full for user: %s", c.Nickname)
			}
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
			select {
			case c.Send <- bytes:
			default:
				log.Printf("Client send buffer full for user: %s", c.Nickname)
			}
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
				select {
				case c.Send <- bytes:
				default:
				}
			}
		}
	}
}

func (h *Hub) sendToClient(c *Client, env *Envelope) {
	bytes, err := json.Marshal(env)
	if err != nil {
		return
	}
	select {
	case c.Send <- bytes:
	default:
	}
}
