package ws

import (
	"encoding/json"
	"time"
)

type Envelope struct {
	Event     string          `json:"event"`
	RoomID    string          `json:"room_id"`
	Timestamp int64           `json:"timestamp"`
	Payload   json.RawMessage `json:"payload"`
}

func NewEnvelope(event, roomID string, payload interface{}) (*Envelope, error) {
	bytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	return &Envelope{
		Event:     event,
		RoomID:    roomID,
		Timestamp: time.Now().UnixMilli(),
		Payload:   bytes,
	}, nil
}
