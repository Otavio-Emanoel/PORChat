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
	activeGame string // "debate" or "quiz"
}

func NewRoomGameRouter(roomID string, hub *ws.Hub, stats *StatsStore, bank *CustomBankStore) *RoomGameRouter {
	deb := NewDebateEngine(roomID, hub)
	deb.SetStores(stats, bank)

	triv := NewTriviaEngine(roomID, hub)
	triv.SetStores(stats, bank)

	return &RoomGameRouter{
		roomID:     roomID,
		hub:        hub,
		debate:     deb,
		trivia:     triv,
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

	if env.Event == "game:pause" || env.Event == "game:resume" || env.Event == "game:skip_phase" || env.Event == "game:abort" {
		if r.activeGame == "quiz" {
			r.trivia.HandleAction(client, env)
		} else {
			r.debate.HandleAction(client, env)
		}
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
	mu         sync.RWMutex
	hub        *ws.Hub
	chatStore  *chat.RoomStore
	statsStore *StatsStore
	customBank *CustomBankStore
	routers    map[string]*RoomGameRouter
}

func NewManager(hub *ws.Hub, chatStore *chat.RoomStore) *Manager {
	return &Manager{
		hub:        hub,
		chatStore:  chatStore,
		statsStore: NewStatsStore("data/game_stats.json", chatStore, hub),
		customBank: NewCustomBankStore("data/custom_bank.json"),
		routers:    make(map[string]*RoomGameRouter),
	}
}

func (m *Manager) StatsStore() *StatsStore {
	return m.statsStore
}

func (m *Manager) CustomBank() *CustomBankStore {
	return m.customBank
}

func (m *Manager) GetEngine(roomID string) ws.GameEngine {
	m.mu.Lock()
	defer m.mu.Unlock()

	if router, ok := m.routers[roomID]; ok {
		return router
	}

	router := NewRoomGameRouter(roomID, m.hub, m.statsStore, m.customBank)
	m.routers[roomID] = router
	return router
}
