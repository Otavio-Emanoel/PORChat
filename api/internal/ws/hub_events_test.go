package ws

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/porchat/api/internal/chat"
)

func TestHub_RealTimeChatEditPinPollAndReadReceipts(t *testing.T) {
	store := chat.NewRoomStore()
	room := store.CreateRoom("Sala WS Integrada", "WS-7777", true, []string{"Otavio", "Pedro"}, "Otavio")

	hub := NewHub(store)
	go hub.Run()
	defer hub.Close()

	cOtavio := &Client{
		Hub:        hub,
		Send:       make(chan []byte, 64),
		UserID:     "Otavio",
		Nickname:   "Otavio",
		RoomID:     room.ID,
		ClientType: "web",
	}
	cPedro := &Client{
		Hub:        hub,
		Send:       make(chan []byte, 64),
		UserID:     "Pedro",
		Nickname:   "Pedro",
		RoomID:     room.ID,
		ClientType: "mobile",
	}

	hub.Register <- cOtavio
	hub.Register <- cPedro
	time.Sleep(15 * time.Millisecond)

	// Drain initial sys:connected & sys:user_joined messages
	drain := func(cl *Client) {
		for {
			select {
			case <-cl.Send:
			default:
				return
			}
		}
	}
	drain(cOtavio)
	drain(cPedro)

	// 1. Send message via chat:send
	sendPayload, _ := json.Marshal(map[string]string{
		"content": "Mensagem original no WebSocket",
	})
	hub.Inbound <- &InboundMessage{
		Client: cOtavio,
		Envelope: &Envelope{
			Event:   "chat:send",
			RoomID:  room.ID,
			Payload: sendPayload,
		},
	}

	var sentMsg chat.ChatMessage
	select {
	case raw := <-cPedro.Send:
		var env Envelope
		_ = json.Unmarshal(raw, &env)
		if env.Event != "chat:new_message" {
			t.Fatalf("expected chat:new_message, got %s", env.Event)
		}
		_ = json.Unmarshal(env.Payload, &sentMsg)
	case <-time.After(200 * time.Millisecond):
		t.Fatalf("timeout waiting for chat:new_message")
	}
	drain(cOtavio)

	// 2. Edit message via chat:edit_message
	editPayload, _ := json.Marshal(map[string]string{
		"message_id": sentMsg.ID,
		"content":    "Mensagem editada ao vivo via WebSocket",
	})
	hub.Inbound <- &InboundMessage{
		Client: cOtavio,
		Envelope: &Envelope{
			Event:   "chat:edit_message",
			RoomID:  room.ID,
			Payload: editPayload,
		},
	}

	select {
	case raw := <-cPedro.Send:
		var env Envelope
		_ = json.Unmarshal(raw, &env)
		if env.Event != "chat:message_edited" {
			t.Fatalf("expected chat:message_edited, got %s", env.Event)
		}
	case <-time.After(200 * time.Millisecond):
		t.Fatalf("timeout waiting for chat:message_edited")
	}
	drain(cOtavio)

	// 3. Pin message via chat:pin_message
	pinPayload, _ := json.Marshal(map[string]string{
		"message_id": sentMsg.ID,
	})
	hub.Inbound <- &InboundMessage{
		Client: cPedro,
		Envelope: &Envelope{
			Event:   "chat:pin_message",
			RoomID:  room.ID,
			Payload: pinPayload,
		},
	}

	select {
	case raw := <-cOtavio.Send:
		var env Envelope
		_ = json.Unmarshal(raw, &env)
		if env.Event != "chat:pin_updated" {
			t.Fatalf("expected chat:pin_updated, got %s", env.Event)
		}
	case <-time.After(200 * time.Millisecond):
		t.Fatalf("timeout waiting for chat:pin_updated")
	}
	drain(cPedro)

	// 4. Mark message read via chat:mark_read
	readPayload, _ := json.Marshal(map[string]interface{}{
		"message_ids": []string{sentMsg.ID},
	})
	hub.Inbound <- &InboundMessage{
		Client: cPedro,
		Envelope: &Envelope{
			Event:   "chat:mark_read",
			RoomID:  room.ID,
			Payload: readPayload,
		},
	}

	select {
	case raw := <-cOtavio.Send:
		var env Envelope
		_ = json.Unmarshal(raw, &env)
		if env.Event != "chat:read_receipt" {
			t.Fatalf("expected chat:read_receipt, got %s", env.Event)
		}
	case <-time.After(200 * time.Millisecond):
		t.Fatalf("timeout waiting for chat:read_receipt")
	}
	drain(cPedro)

	// 5. Create poll via chat:create_poll & vote via chat:vote_poll
	pollPayload, _ := json.Marshal(map[string]interface{}{
		"question":     "Qual horário para o campeonato?",
		"options":      []string{"20:00", "21:30"},
		"multi_select": false,
	})
	hub.Inbound <- &InboundMessage{
		Client: cOtavio,
		Envelope: &Envelope{
			Event:   "chat:create_poll",
			RoomID:  room.ID,
			Payload: pollPayload,
		},
	}

	var pollMsg chat.ChatMessage
	select {
	case raw := <-cPedro.Send:
		var env Envelope
		_ = json.Unmarshal(raw, &env)
		if env.Event != "chat:new_message" {
			t.Fatalf("expected chat:new_message for poll, got %s", env.Event)
		}
		_ = json.Unmarshal(env.Payload, &pollMsg)
	case <-time.After(200 * time.Millisecond):
		t.Fatalf("timeout waiting for poll chat:new_message")
	}
	drain(cOtavio)

	votePayload, _ := json.Marshal(map[string]string{
		"message_id": pollMsg.ID,
		"option_id":  pollMsg.Poll.Options[0].ID,
	})
	hub.Inbound <- &InboundMessage{
		Client: cPedro,
		Envelope: &Envelope{
			Event:   "chat:vote_poll",
			RoomID:  room.ID,
			Payload: votePayload,
		},
	}

	select {
	case raw := <-cOtavio.Send:
		var env Envelope
		_ = json.Unmarshal(raw, &env)
		if env.Event != "chat:poll_updated" {
			t.Fatalf("expected chat:poll_updated, got %s", env.Event)
		}
	case <-time.After(200 * time.Millisecond):
		t.Fatalf("timeout waiting for chat:poll_updated")
	}
}
