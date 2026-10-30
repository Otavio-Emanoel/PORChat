package game

import (
	"encoding/json"
	"log"
	"math/rand"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/porchat/api/internal/chat"
	"github.com/porchat/api/internal/ws"
)

type BotProfile struct {
	ID       string
	Nickname string
}

var defaultDemoBots = []BotProfile{
	{ID: "bot-lucas-1", Nickname: "Lucas (Bot)"},
	{ID: "bot-mariana-2", Nickname: "Mariana (Bot)"},
	{ID: "bot-gui-3", Nickname: "Guilherme (Bot)"},
	{ID: "bot-bia-4", Nickname: "Beatriz (Bot)"},
	{ID: "bot-leo-5", Nickname: "Leonardo (Bot)"},
}

type BotSimulator struct {
	mu           sync.RWMutex
	roomID       string
	hub          *ws.Hub
	chatStore    *chat.RoomStore
	engineGetter func(roomID string) ws.GameEngine
	active       bool
	stopChan     chan struct{}
	lastPhase    string
}

func NewBotSimulator(roomID string, hub *ws.Hub, chatStore *chat.RoomStore, engineGetter func(string) ws.GameEngine) *BotSimulator {
	return &BotSimulator{
		roomID:       roomID,
		hub:          hub,
		chatStore:    chatStore,
		engineGetter: engineGetter,
		stopChan:     make(chan struct{}),
	}
}

func (s *BotSimulator) IsActive() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.active
}

func (s *BotSimulator) Toggle() bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.active {
		// Stop bots
		s.active = false
		close(s.stopChan)
		s.stopChan = make(chan struct{})

		// Emit left events
		for _, b := range defaultDemoBots {
			leftPayload := map[string]interface{}{
				"user_id":     b.ID,
				"nickname":    b.Nickname,
				"client_type": "mobile",
			}
			if env, err := ws.NewEnvelope("sys:user_left", s.roomID, leftPayload); err == nil {
				s.hub.BroadcastToRoom(s.roomID, env)
			}
		}

		s.sendSystemMessage("Demo Bots desconectados da sala.")
		log.Printf("[Room %s] Demo Bots deactivated.", s.roomID)
		return false
	}

	// Start bots
	s.active = true
	for _, b := range defaultDemoBots {
		joinedPayload := map[string]interface{}{
			"user_id":     b.ID,
			"nickname":    b.Nickname,
			"client_type": "mobile",
		}
		if env, err := ws.NewEnvelope("sys:user_joined", s.roomID, joinedPayload); err == nil {
			s.hub.BroadcastToRoom(s.roomID, env)
		}
	}

	s.sendSystemMessage("5 Demo Bots conectados! Eles vão interagir e votar ao vivo no telão.")
	log.Printf("[Room %s] Demo Bots activated with %d bots.", s.roomID, len(defaultDemoBots))

	go s.runBotLoop()
	return true
}

func (s *BotSimulator) sendSystemMessage(content string) {
	msg := &chat.ChatMessage{
		ID:        uuid.New().String(),
		RoomID:    s.roomID,
		UserID:    "system-bots",
		Nickname:  "PORBot",
		Content:   content,
		Type:      "system",
		CreatedAt: time.Now(),
	}
	s.chatStore.AddMessage(msg)
	if env, err := ws.NewEnvelope("chat:new_message", s.roomID, msg); err == nil {
		s.hub.BroadcastToRoom(s.roomID, env)
	}
}

func (s *BotSimulator) runBotLoop() {
	reactionTicker := time.NewTicker(2 * time.Second)
	gameCheckTicker := time.NewTicker(1 * time.Second)
	defer reactionTicker.Stop()
	defer gameCheckTicker.Stop()

	emojis := []string{"fire", "applause", "shock", "point", "cheer", "star"}

	for {
		select {
		case <-s.stopChan:
			return

		case <-reactionTicker.C:
			// Emit random emoji reaction to the TV stage
			randEmoji := emojis[rand.Intn(len(emojis))]
			payload := map[string]interface{}{
				"reactions": []map[string]interface{}{
					{"emoji": randEmoji, "count": rand.Intn(3) + 1},
				},
			}
			if env, err := ws.NewEnvelope("tv:reaction_stream", s.roomID, payload); err == nil {
				s.hub.BroadcastToClientType(s.roomID, "tv", env)
			}

		case <-gameCheckTicker.C:
			if s.engineGetter == nil {
				continue
			}
			eng := s.engineGetter(s.roomID)
			if eng == nil || !eng.IsActive() {
				s.lastPhase = ""
				continue
			}

			snapshot, ok := eng.GetStateSnapshot().(map[string]interface{})
			if !ok {
				continue
			}

			currentPhase, _ := snapshot["phase"].(string)
			if currentPhase == "" {
				// might be QuizPhase or DebatePhase
				if qp, ok := snapshot["phase"].(QuizPhase); ok {
					currentPhase = string(qp)
				} else if dp, ok := snapshot["phase"].(DebatePhase); ok {
					currentPhase = string(dp)
				}
			}

			// Trigger actions only once per phase entry
			if currentPhase != s.lastPhase {
				s.lastPhase = currentPhase
				s.onPhaseTransition(eng, snapshot, currentPhase)
			}
		}
	}
}

func (s *BotSimulator) onPhaseTransition(eng ws.GameEngine, snapshot map[string]interface{}, phase string) {
	gameType, _ := snapshot["game_type"].(string)

	if gameType == "debate" && phase == "VOTING" {
		// Simulate bots voting with realistic staggered delays
		go func() {
			time.Sleep(1 * time.Second)
			sides := []string{"side_a", "side_b"}

			for _, bot := range defaultDemoBots {
				time.Sleep(time.Duration(rand.Intn(1200)+300) * time.Millisecond)

				s.mu.RLock()
				if !s.active {
					s.mu.RUnlock()
					return
				}
				s.mu.RUnlock()

				choice := sides[rand.Intn(len(sides))]
				votePayload, _ := json.Marshal(map[string]interface{}{
					"choice": choice,
				})
				env := &ws.Envelope{
					Event:   "debate:cast_vote",
					RoomID:  s.roomID,
					Payload: votePayload,
				}
				client := &ws.Client{
					UserID:   bot.ID,
					Nickname: bot.Nickname,
					RoomID:   s.roomID,
				}
				eng.HandleAction(client, env)
			}
		}()
	}

	if gameType == "quiz" && phase == "QUESTION" {
		// Simulate bots picking quiz options
		go func() {
			time.Sleep(1 * time.Second)
			options := []string{"A", "B", "C", "D"}

			for _, bot := range defaultDemoBots {
				time.Sleep(time.Duration(rand.Intn(2000)+500) * time.Millisecond)

				s.mu.RLock()
				if !s.active {
					s.mu.RUnlock()
					return
				}
				s.mu.RUnlock()

				choice := options[rand.Intn(len(options))]
				answerPayload, _ := json.Marshal(map[string]interface{}{
					"choice": choice,
				})
				env := &ws.Envelope{
					Event:   "quiz:submit_answer",
					RoomID:  s.roomID,
					Payload: answerPayload,
				}
				client := &ws.Client{
					UserID:   bot.ID,
					Nickname: bot.Nickname,
					RoomID:   s.roomID,
				}
				eng.HandleAction(client, env)
			}
		}()
	}
}
