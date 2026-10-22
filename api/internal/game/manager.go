package game

import (
	"encoding/json"
	"strings"
	"sync"

	"github.com/porchat/api/internal/ws"
)

type RoomGameRouter struct {
	mu         sync.RWMutex
	roomID     string
	hub        *ws.Hub
	debate     *DebateEngine
	trivia     *TriviaEngine
	activeGame string // "debate" or "quiz"
}

func NewRoomGameRouter(roomID string, hub *ws.Hub) *RoomGameRouter {
	return &RoomGameRouter{
		roomID:     roomID,
		hub:        hub,
		debate:     NewDebateEngine(roomID, hub),
		trivia:     NewTriviaEngine(roomID, hub),
		activeGame: "debate",
	}
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

func (r *RoomGameRouter) HandleAction(client *ws.Client, env *ws.Envelope) {
	r.mu.Lock()
	defer r.mu.Unlock()

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
	mu      sync.RWMutex
	hub     *ws.Hub
	routers map[string]*RoomGameRouter
}

func NewManager(hub *ws.Hub) *Manager {
	return &Manager{
		hub:     hub,
		routers: make(map[string]*RoomGameRouter),
	}
}

func (m *Manager) GetEngine(roomID string) ws.GameEngine {
	m.mu.Lock()
	defer m.mu.Unlock()

	if router, ok := m.routers[roomID]; ok {
		return router
	}

	router := NewRoomGameRouter(roomID, m.hub)
	m.routers[roomID] = router
	return router
}
