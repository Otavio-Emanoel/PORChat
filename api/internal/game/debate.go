package game

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/porchat/api/internal/ws"
)

type DebatePhase string

const (
	PhaseChat             DebatePhase = "CHAT"
	PhaseLobby            DebatePhase = "LOBBY"
	PhaseOpeningArguments DebatePhase = "OPENING_ARGUMENTS"
	PhaseRebuttal         DebatePhase = "REBUTTAL"
	PhaseVoting           DebatePhase = "VOTING"
	PhaseResults          DebatePhase = "RESULTS"
)

type Debater struct {
	ID       string `json:"id"`
	Nickname string `json:"nickname"`
	Argument string `json:"argument,omitempty"`
	Votes    int    `json:"votes"`
}

type DebateState struct {
	Topic            string              `json:"topic"`
	DebaterA         *Debater            `json:"debater_a"`
	DebaterB         *Debater            `json:"debater_b"`
	CurrentSpeakerID string              `json:"current_speaker_id,omitempty"`
	VotesCount       map[string]int      `json:"votes_count"`
	WinnerSide       string              `json:"winner_side,omitempty"`
}

type DebateEngine struct {
	mu               sync.RWMutex
	roomID           string
	hub              *ws.Hub
	phase            DebatePhase
	phaseEndsAt      time.Time
	remainingSeconds int
	state            *DebateState
	voters           map[string]string // userID -> side
	stopTicker       chan struct{}
}

func NewDebateEngine(roomID string, hub *ws.Hub) *DebateEngine {
	return &DebateEngine{
		roomID:     roomID,
		hub:        hub,
		phase:      PhaseChat,
		voters:     make(map[string]string),
		stopTicker: make(chan struct{}),
	}
}

func (e *DebateEngine) IsActive() bool {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.phase != PhaseChat
}

func (e *DebateEngine) GetStateSnapshot() interface{} {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return map[string]interface{}{
		"game_type":         "debate",
		"phase":             e.phase,
		"phase_ends_at":     e.phaseEndsAt.UnixMilli(),
		"remaining_seconds": e.remainingSeconds,
		"debate_state":      e.state,
	}
}

func (e *DebateEngine) HandleAction(client *ws.Client, env *ws.Envelope) {
	e.mu.Lock()
	defer e.mu.Unlock()

	switch env.Event {
	case "game:start":
		var p struct {
			GameType   string `json:"game_type"`
			Topic      string `json:"topic"`
			DebaterAID string `json:"debater_a_id"`
			DebaterBID string `json:"debater_b_id"`
		}
		_ = json.Unmarshal(env.Payload, &p)
		if p.Topic == "" {
			p.Topic = "Abacaxi na pizza é crime ou alta gastronomia?"
		}
		e.startDebate(p.Topic, p.DebaterAID, p.DebaterBID)
	}
}

func (e *DebateEngine) startDebate(topic, debaterAID, debaterBID string) {
	e.phase = PhaseLobby
	e.remainingSeconds = 10
	e.phaseEndsAt = time.Now().Add(10 * time.Second)
	e.voters = make(map[string]string)
	e.state = &DebateState{
		Topic: topic,
		DebaterA: &Debater{
			ID:       debaterAID,
			Nickname: "Lado A",
			Votes:    0,
		},
		DebaterB: &Debater{
			ID:       debaterBID,
			Nickname: "Lado B",
			Votes:    0,
		},
		VotesCount: map[string]int{"side_a": 0, "side_b": 0},
	}
	e.broadcastState()
}

func (e *DebateEngine) broadcastState() {
	snapshot := map[string]interface{}{
		"game_type":         "debate",
		"phase":             e.phase,
		"phase_ends_at":     e.phaseEndsAt.UnixMilli(),
		"remaining_seconds": e.remainingSeconds,
		"debate_state":      e.state,
	}
	if out, err := ws.NewEnvelope("game:state_update", e.roomID, snapshot); err == nil {
		e.hub.BroadcastToRoom(e.roomID, out)
	}
}
