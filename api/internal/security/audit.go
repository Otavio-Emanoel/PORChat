package security

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
)

// AuditEventType identifies categorized security-relevant system actions.
type AuditEventType string

const (
	EventAuthLoginSuccess  AuditEventType = "AUTH_LOGIN_SUCCESS"
	EventAuthLoginFailure  AuditEventType = "AUTH_LOGIN_FAILURE"
	EventAuthRegister      AuditEventType = "AUTH_REGISTER"
	EventAuthLogout        AuditEventType = "AUTH_LOGOUT"
	EventAuthLockedOut     AuditEventType = "AUTH_LOCKED_OUT"
	EventRoomCreate        AuditEventType = "ROOM_CREATE"
	EventRoomDelete        AuditEventType = "ROOM_DELETE"
	EventRoomAccessDenied  AuditEventType = "ROOM_ACCESS_DENIED"
	EventWSConnect         AuditEventType = "WS_CONNECT"
	EventWSDisconnect      AuditEventType = "WS_DISCONNECT"
	EventWSRejected        AuditEventType = "WS_REJECTED"
	EventRateLimitExceeded AuditEventType = "RATE_LIMIT_EXCEEDED"
	EventSuspiciousPayload AuditEventType = "SUSPICIOUS_PAYLOAD"
)

// AuditSeverity denotes the urgency level of an audit event.
type AuditSeverity string

const (
	SeverityInfo     AuditSeverity = "INFO"
	SeverityWarn     AuditSeverity = "WARN"
	SeverityCritical AuditSeverity = "CRITICAL"
)

// AuditEvent represents a single recorded security event.
type AuditEvent struct {
	ID        string                 `json:"id"`
	Timestamp time.Time              `json:"timestamp"`
	Type      AuditEventType         `json:"type"`
	Severity  AuditSeverity          `json:"severity"`
	ClientIP  string                 `json:"client_ip,omitempty"`
	UserID    string                 `json:"user_id,omitempty"`
	RoomID    string                 `json:"room_id,omitempty"`
	Message   string                 `json:"message"`
	Details   map[string]interface{} `json:"details,omitempty"`
}

// AuditLogger manages an asynchronous, non-blocking queue and thread-safe in-memory
// buffer of security audit events.
type AuditLogger struct {
	mu         sync.RWMutex
	buffer     []AuditEvent
	maxEntries int
	queue      chan AuditEvent
	stopCh     chan struct{}
	verboseLog bool
}

// NewAuditLogger initializes an asynchronous audit logger with specified in-memory retention.
func NewAuditLogger(maxEntries int, verbose bool) *AuditLogger {
	if maxEntries <= 0 {
		maxEntries = 1000
	}

	al := &AuditLogger{
		buffer:     make([]AuditEvent, 0, maxEntries),
		maxEntries: maxEntries,
		queue:      make(chan AuditEvent, 512),
		stopCh:     make(chan struct{}),
		verboseLog: verbose,
	}

	go al.worker()
	return al
}

// Log records an event asynchronously. It is non-blocking and safe under heavy concurrency.
func (al *AuditLogger) Log(evtType AuditEventType, severity AuditSeverity, clientIP, userID, roomID, message string, details map[string]interface{}) {
	evt := AuditEvent{
		ID:        uuid.New().String(),
		Timestamp: time.Now().UTC(),
		Type:      evtType,
		Severity:  severity,
		ClientIP:  clientIP,
		UserID:    userID,
		RoomID:    roomID,
		Message:   message,
		Details:   details,
	}

	select {
	case al.queue <- evt:
	default:
		// Queue full: log directly to avoid blocking active request goroutines
		log.Printf("[AUDIT-OVERFLOW] Dropped async event: %s %s - %s", evt.Type, evt.Severity, evt.Message)
	}
}

func (al *AuditLogger) worker() {
	for {
		select {
		case evt := <-al.queue:
			al.appendEvent(evt)
			if al.verboseLog || evt.Severity == SeverityCritical {
				al.printEvent(evt)
			}
		case <-al.stopCh:
			// Drain remaining events
			for len(al.queue) > 0 {
				evt := <-al.queue
				al.appendEvent(evt)
			}
			return
		}
	}
}

func (al *AuditLogger) appendEvent(evt AuditEvent) {
	al.mu.Lock()
	defer al.mu.Unlock()

	if len(al.buffer) >= al.maxEntries {
		// Evict oldest item (first element)
		al.buffer = al.buffer[1:]
	}
	al.buffer = append(al.buffer, evt)
}

func (al *AuditLogger) printEvent(evt AuditEvent) {
	bytes, err := json.Marshal(evt)
	if err == nil {
		fmt.Printf("[SECURITY-AUDIT] %s\n", string(bytes))
	} else {
		fmt.Printf("[SECURITY-AUDIT] %s [%s] %s: %s\n", evt.Timestamp.Format(time.RFC3339), evt.Severity, evt.Type, evt.Message)
	}
}

// GetEvents returns a slice copy of recorded events, optionally filtered by event type or limit.
func (al *AuditLogger) GetEvents(limit int, filterType AuditEventType) []AuditEvent {
	al.mu.RLock()
	defer al.mu.RUnlock()

	var result []AuditEvent
	// Iterate in reverse chronological order (newest first)
	for i := len(al.buffer) - 1; i >= 0; i-- {
		evt := al.buffer[i]
		if filterType == "" || evt.Type == filterType {
			result = append(result, evt)
			if limit > 0 && len(result) >= limit {
				break
			}
		}
	}

	return result
}

// Count returns total events currently in the buffer.
func (al *AuditLogger) Count() int {
	al.mu.RLock()
	defer al.mu.RUnlock()
	return len(al.buffer)
}

// Close gracefully terminates the worker.
func (al *AuditLogger) Close() {
	select {
	case <-al.stopCh:
	default:
		close(al.stopCh)
	}
}
