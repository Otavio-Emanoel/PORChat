package game

import (
	"sync"

	"github.com/porchat/api/internal/ws"
)

type Manager struct {
	mu      sync.RWMutex
	hub     *ws.Hub
	engines map[string]ws.GameEngine
}

func NewManager(hub *ws.Hub) *Manager {
	return &Manager{
		hub:     hub,
		engines: make(map[string]ws.GameEngine),
	}
}

func (m *Manager) GetEngine(roomID string) ws.GameEngine {
	m.mu.Lock()
	defer m.mu.Unlock()

	if eng, ok := m.engines[roomID]; ok {
		return eng
	}

	// Create a new Debate engine for the room by default
	eng := NewDebateEngine(roomID, m.hub)
	m.engines[roomID] = eng
	return eng
}
