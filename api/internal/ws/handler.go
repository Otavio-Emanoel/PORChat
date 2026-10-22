package ws

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"
	"github.com/porchat/api/internal/auth"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow cross-origin for dev Web & Mobile
	},
}

type WSHandler struct {
	Hub       *Hub
	UserStore *auth.UserStore
}

func NewWSHandler(hub *Hub, userStore *auth.UserStore) *WSHandler {
	return &WSHandler{Hub: hub, UserStore: userStore}
}

func (h *WSHandler) ServeWS(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	token := q.Get("token")
	roomID := q.Get("room_id")
	clientType := q.Get("client_type")

	if roomID == "" {
		http.Error(w, "missing room_id parameter", http.StatusBadRequest)
		return
	}
	if clientType == "" {
		clientType = "web"
	}

	var userID string
	var nickname string

	if token != "" {
		claims, err := auth.ValidateJWT(token)
		if err == nil {
			userID = claims.UserID
			nickname = claims.Nickname
		}
	}

	// Dev fallback if token not provided or test nickname specified
	if userID == "" {
		if devUser := q.Get("nickname"); devUser != "" {
			nickname = devUser
			userID = "dev-" + devUser
		} else {
			http.Error(w, "unauthorized: valid token or nickname required", http.StatusUnauthorized)
			return
		}
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WS upgrade error: %v", err)
		return
	}

	client := &Client{
		Hub:        h.Hub,
		Conn:       conn,
		Send:       make(chan []byte, 256),
		UserID:     userID,
		Nickname:   nickname,
		RoomID:     roomID,
		ClientType: clientType,
	}

	h.Hub.Register <- client

	go client.WritePump()
	go client.ReadPump()
}
