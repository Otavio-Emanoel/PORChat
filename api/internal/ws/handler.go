package ws

import (
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"github.com/porchat/api/internal/auth"
	"github.com/porchat/api/internal/security"
)

type WSHandler struct {
	Hub             *Hub
	UserStore       *auth.UserStore
	OriginValidator *security.OriginValidator
	RateLimiter     *security.RateLimiter
	AuditLogger     *security.AuditLogger
	upgrader        websocket.Upgrader
}

func NewWSHandler(hub *Hub, userStore *auth.UserStore) *WSHandler {
	val := security.NewOriginValidator()
	return &WSHandler{
		Hub:             hub,
		UserStore:       userStore,
		OriginValidator: val,
		RateLimiter:     security.NewRateLimiter(20.0, 40.0, 5*time.Minute),
		AuditLogger:     security.NewAuditLogger(1000, false),
		upgrader: websocket.Upgrader{
			ReadBufferSize:  2048,
			WriteBufferSize: 2048,
			CheckOrigin:     val.CheckOriginFunc(),
		},
	}
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
	if clientType != "tv" && clientType != "mobile" {
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

	clientIP := security.ExtractClientIP(r)
	if h.RateLimiter != nil && !h.RateLimiter.Allow("ws:"+clientIP) {
		http.Error(w, `{"error":"too many connection attempts"}`, http.StatusTooManyRequests)
		if h.AuditLogger != nil {
			h.AuditLogger.Log(security.EventRateLimitExceeded, security.SeverityWarn, clientIP, userID, roomID, "WS handshake rate limit exceeded", nil)
		}
		return
	}

	// Nickname sanitization using multi-pass sanitizer
	if cleanNick, err := security.SanitizeNickname(nickname); err == nil {
		nickname = cleanNick
	} else if len(nickname) < 2 {
		nickname = "Player"
	}

	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WS upgrade error: %v", err)
		if h.AuditLogger != nil {
			h.AuditLogger.Log(security.EventWSRejected, security.SeverityWarn, clientIP, userID, roomID, "WS handshake rejected", map[string]interface{}{"error": err.Error()})
		}
		return
	}

	if h.AuditLogger != nil {
		h.AuditLogger.Log(security.EventWSConnect, security.SeverityInfo, clientIP, userID, roomID, "WS client connected", map[string]interface{}{"client_type": clientType})
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
