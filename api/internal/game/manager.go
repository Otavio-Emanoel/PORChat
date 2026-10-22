package game

import (
	"encoding/json"
	"strings"
	"sync"

	"github.com/porchat/api/internal/chat"
	"github.com/porchat/api/internal/ws"
)

type RoomGameRouter struct {
	mu         sync.RWMutex
	roomID     string
	hub        *ws.Hub
	debate     *DebateEngine
	trivia     *TriviaEngine
	bots       *BotSimulator
	activeGame string // "debate" or "quiz"
}

func NewRoomGameRouter(roomID string, hub *ws.Hub, chatStore *chat.RoomStore, getter func(string) ws.GameEngine) *RoomGameRouter {
	router := &RoomGameRouter{
		roomID:     roomID,
		hub:        hub,
		debate:     NewDebateEngine(roomID, hub),
		trivia:     NewTriviaEngine(roomID, hub),
		activeGame: "debate",
	}
	router.bots = NewBotSimulator(roomID, hub, chatStore, getter)
	return router
}

func (r *RoomGameRouter) IsActive() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if r.activeGame == "quiz" {
		return r.trivia.IsActive()
	}
	return r.debate.IsActive()
}

func (r *RoomGameRouter) GetStateSnapshot() interface{} {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if r.activeGame == "quiz" {
		return r.trivia.GetStateSnapshot()
	}
	return r.debate.GetStateSnapshot()
}

func (r *RoomGameRouter) ToggleBots() bool {
	if r.bots != nil {
		return r.bots.Toggle()
	}
	return false
}

func (r *RoomGameRouter) HandleAction(client *ws.Client, env *ws.Envelope) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if env.Event == "bots:toggle" || env.Event == "game:bots_spawn" {
		if r.bots != nil {
			r.bots.Toggle()
		}
		return
	}

	if env.Event == "game:start" {
		var p struct {
			GameType string `json:"game_type"`
		}
		_ = json.Unmarshal(env.Payload, &p)
		if strings.ToLower(p.GameType) == "quiz" {
			r.activeGame = "quiz"
			r.trivia.HandleAction(client, env)
			return
		}
		r.activeGame = "debate"
		r.debate.HandleAction(client, env)
		return
	}

	if strings.HasPrefix(env.Event, "quiz:") {
		r.trivia.HandleAction(client, env)
		return
	}

	// Default to debate actions
	r.debate.HandleAction(client, env)
}

type Manager struct {
	mu        sync.RWMutex
	hub       *ws.Hub
	chatStore *chat.RoomStore
	routers   map[string]*RoomGameRouter
}

func NewManager(hub *ws.Hub, chatStore *chat.RoomStore) *Manager {
	return &Manager{
		hub:       hub,
		chatStore: chatStore,
		routers:   make(map[string]*RoomGameRouter),
	}
}

func (m *Manager) GetEngine(roomID string) ws.GameEngine {
	m.mu.Lock()
	defer m.mu.Unlock()

	if router, ok := m.routers[roomID]; ok {
		return router
	}

	router := NewRoomGameRouter(roomID, m.hub, m.chatStore, m.GetEngine)
	m.routers[roomID] = router
	return router
}
