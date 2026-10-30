package ws

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/porchat/api/internal/chat"
)

func setupTestHub(t *testing.T) (*Hub, *chat.RoomStore) {
	roomStore := chat.NewRoomStore()
	hub := NewHub(roomStore)
	go hub.Run()
	t.Cleanup(func() {
		hub.Close()
	})
	return hub, roomStore
}

func createTestClient(hub *Hub, roomID, userID, nickname, clientType string) *Client {
	return &Client{
		Hub:        hub,
		Send:       make(chan []byte, 256),
		UserID:     userID,
		Nickname:   nickname,
		RoomID:     roomID,
		ClientType: clientType,
	}
}

func TestHub_RegisterAndUnregister(t *testing.T) {
	hub, _ := setupTestHub(t)

	roomID := "room-alpha"
	c1 := createTestClient(hub, roomID, "user-1", "Otavio", "web")
	c2 := createTestClient(hub, roomID, "user-2", "Pedro", "mobile")

	// Register c1
	hub.Register <- c1
	time.Sleep(20 * time.Millisecond)

	clients := hub.GetRoomClients(roomID)
	if len(clients) != 1 {
		t.Fatalf("Expected 1 client in room %s, got %d", roomID, len(clients))
	}
	if clients[0].UserID != "user-1" {
		t.Errorf("Expected UserID user-1, got %s", clients[0].UserID)
	}

	// Register c2
	hub.Register <- c2
	time.Sleep(20 * time.Millisecond)

	clients = hub.GetRoomClients(roomID)
	if len(clients) != 2 {
		t.Fatalf("Expected 2 clients in room %s, got %d", roomID, len(clients))
	}

	// Unregister c1
	hub.Unregister <- c1
	time.Sleep(20 * time.Millisecond)

	clients = hub.GetRoomClients(roomID)
	if len(clients) != 1 {
		t.Fatalf("Expected 1 client after unregister, got %d", len(clients))
	}
	if clients[0].UserID != "user-2" {
		t.Errorf("Remaining client should be user-2, got %s", clients[0].UserID)
	}
}

func TestHub_BroadcastIsolation(t *testing.T) {
	hub, _ := setupTestHub(t)

	// Room A clients
	cA1 := createTestClient(hub, "room-A", "user-A1", "Alice", "web")
	cA2 := createTestClient(hub, "room-A", "user-A2", "Bob", "web")

	// Room B client
	cB1 := createTestClient(hub, "room-B", "user-B1", "Charlie", "web")

	hub.Register <- cA1
	hub.Register <- cA2
	hub.Register <- cB1
	time.Sleep(30 * time.Millisecond)

	// Drain initial connection messages
	drainChannel := func(ch chan []byte) {
		for len(ch) > 0 {
			<-ch
		}
	}
	drainChannel(cA1.Send)
	drainChannel(cA2.Send)
	drainChannel(cB1.Send)

	// Broadcast to Room A only
	payload := map[string]string{"text": "Hello Room A"}
	env, err := NewEnvelope("chat:test", "room-A", payload)
	if err != nil {
		t.Fatalf("Failed to create envelope: %v", err)
	}

	hub.BroadcastToRoom("room-A", env)
	time.Sleep(30 * time.Millisecond)

	// cA1 and cA2 must have received message
	if len(cA1.Send) != 1 {
		t.Errorf("Expected cA1 to receive 1 message, got %d", len(cA1.Send))
	}
	if len(cA2.Send) != 1 {
		t.Errorf("Expected cA2 to receive 1 message, got %d", len(cA2.Send))
	}

	// cB1 in Room B must NOT receive message
	if len(cB1.Send) != 0 {
		t.Errorf("Expected cB1 in Room B to receive 0 messages, got %d", len(cB1.Send))
	}
}

func TestHub_InboundChatSendAndReaction(t *testing.T) {
	hub, roomStore := setupTestHub(t)

	room := roomStore.CreateRoom("Test Room", "TST-1234", true, []string{"Otavio", "Pedro"}, "Otavio")
	c := createTestClient(hub, room.ID, "user-otavio", "Otavio", "web")
	hub.Register <- c
	time.Sleep(20 * time.Millisecond)

	// Drain initial join messages
	for len(c.Send) > 0 {
		<-c.Send
	}

	// Send chat message
	chatPayload, _ := json.Marshal(map[string]string{"content": "Let's test security!"})
	inboundMsg := &InboundMessage{
		Client: c,
		Envelope: &Envelope{
			Event:   "chat:send",
			RoomID:  room.ID,
			Payload: chatPayload,
		},
	}

	hub.Inbound <- inboundMsg
	time.Sleep(30 * time.Millisecond)

	// Verify message was stored
	msgs := roomStore.GetMessages(room.ID, 10)
	if len(msgs) < 2 { // initial system message + new chat message
		t.Fatalf("Expected at least 2 messages in room, got %d", len(msgs))
	}
	lastMsg := msgs[len(msgs)-1]
	if lastMsg.Content != "Let&#39;s test security!" {
		t.Errorf("Expected sanitized content 'Let&#39;s test security!', got %q", lastMsg.Content)
	}

	// Send reaction on last message
	reactPayload, _ := json.Marshal(map[string]string{
		"message_id": lastMsg.ID,
		"emoji":      "🔥",
	})
	hub.Inbound <- &InboundMessage{
		Client: c,
		Envelope: &Envelope{
			Event:   "chat:reaction",
			RoomID:  room.ID,
			Payload: reactPayload,
		},
	}
	time.Sleep(30 * time.Millisecond)

	// Check reaction state
	msgsAfter := roomStore.GetMessages(room.ID, 10)
	lastMsgAfter := msgsAfter[len(msgsAfter)-1]
	if len(lastMsgAfter.Reactions["🔥"]) != 1 {
		t.Errorf("Expected 1 reaction for 🔥, got %v", lastMsgAfter.Reactions["🔥"])
	}

	// Send delete message
	deletePayload, _ := json.Marshal(map[string]string{
		"message_id": lastMsg.ID,
	})
	hub.Inbound <- &InboundMessage{
		Client: c,
		Envelope: &Envelope{
			Event:   "chat:delete_message",
			RoomID:  room.ID,
			Payload: deletePayload,
		},
	}
	time.Sleep(30 * time.Millisecond)

	// Verify message was deleted
	msgsDeleted := roomStore.GetMessages(room.ID, 10)
	for _, m := range msgsDeleted {
		if m.ID == lastMsg.ID {
			t.Errorf("Expected message %s to be deleted, but it is still present", lastMsg.ID)
		}
	}
}

func TestHub_ConcurrentReadWriteRace(t *testing.T) {
	hub, _ := setupTestHub(t)

	var wg sync.WaitGroup
	clientsCount := 20
	iterations := 25

	clients := make([]*Client, clientsCount)
	for i := 0; i < clientsCount; i++ {
		clients[i] = createTestClient(hub, "race-room", strings.Repeat("u", i+1), "Nick", "web")
		hub.Register <- clients[i]
	}

	time.Sleep(20 * time.Millisecond)

	for i := 0; i < clientsCount; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			c := clients[idx]
			for j := 0; j < iterations; j++ {
				// Broadcast
				payload := map[string]int{"val": j}
				env, _ := NewEnvelope("chat:test", "race-room", payload)
				hub.BroadcastToRoom("race-room", env)

				// Inbound ping
				hub.Inbound <- &InboundMessage{
					Client: c,
					Envelope: &Envelope{
						Event:  "sys:ping",
						RoomID: "race-room",
					},
				}

				// Drain send channel to prevent blocking
				select {
				case <-c.Send:
				default:
				}
			}
		}(i)
	}

	wg.Wait()
}

func TestWebSocketHandshake_FullFlow(t *testing.T) {
	hub, _ := setupTestHub(t)
	handler := NewWSHandler(hub, nil)

	server := httptest.NewServer(http.HandlerFunc(handler.ServeWS))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http") + "/ws?room_id=test-room&nickname=Otavio&client_type=web"

	header := make(http.Header)
	header.Set("Origin", "http://localhost:3001")

	conn, resp, err := websocket.DefaultDialer.Dial(wsURL, header)
	if err != nil {
		t.Fatalf("Failed to establish WebSocket handshake: %v, resp status: %v", err, resp)
	}
	defer conn.Close()

	// Read initial connected envelope
	var env Envelope
	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	err = conn.ReadJSON(&env)
	if err != nil {
		t.Fatalf("Failed to read initial handshake envelope: %v", err)
	}

	if env.Event != "sys:connected" {
		t.Errorf("Expected first event 'sys:connected', got %q", env.Event)
	}
}
