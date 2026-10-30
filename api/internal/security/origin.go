package security

import (
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
)

// OriginValidator controls allowed Cross-Origin requests and WebSocket handshakes,
// mitigating Cross-Site WebSocket Hijacking (CSWSH) and malicious iframe embeddings.
type OriginValidator struct {
	mu             sync.RWMutex
	allowedOrigins map[string]bool
	allowedHosts   map[string]bool
	allowMissing   bool // true allows native mobile apps or direct curl without browser Origin
}

// NewOriginValidator builds a validator initialized with default PORChat ecosystem origins.
func NewOriginValidator() *OriginValidator {
	v := &OriginValidator{
		allowedOrigins: make(map[string]bool),
		allowedHosts:   make(map[string]bool),
		allowMissing:   true, // Native React Native / Expo clients typically don't send Origin
	}

	// Default development and local network origins
	defaults := []string{
		"http://localhost:3001",
		"http://127.0.0.1:3001",
		"http://localhost:8082",
		"http://127.0.0.1:8082",
		"http://localhost:8081",
		"http://127.0.0.1:8081",
		"https://porchat.app",
		"https://web.porchat.app",
	}

	for _, o := range defaults {
		v.AddAllowedOrigin(o)
	}

	// Add any environment-configured origins (comma-separated)
	if envOrigins := os.Getenv("ALLOWED_ORIGINS"); envOrigins != "" {
		for _, o := range strings.Split(envOrigins, ",") {
			trimmed := strings.TrimSpace(o)
			if trimmed != "" {
				v.AddAllowedOrigin(trimmed)
			}
		}
	}

	return v
}

// AddAllowedOrigin registers a URL or host pattern as trusted.
func (v *OriginValidator) AddAllowedOrigin(originStr string) {
	v.mu.Lock()
	defer v.mu.Unlock()

	cleaned := strings.TrimRight(strings.ToLower(strings.TrimSpace(originStr)), "/")
	v.allowedOrigins[cleaned] = true

	// Also extract host portion for flexible checks
	if parsed, err := url.Parse(cleaned); err == nil && parsed.Host != "" {
		v.allowedHosts[parsed.Host] = true
	} else {
		v.allowedHosts[cleaned] = true
	}
}

// RemoveAllowedOrigin removes an origin from trusted set.
func (v *OriginValidator) RemoveAllowedOrigin(originStr string) {
	v.mu.Lock()
	defer v.mu.Unlock()
	cleaned := strings.TrimRight(strings.ToLower(strings.TrimSpace(originStr)), "/")
	delete(v.allowedOrigins, cleaned)
}

// ValidateOrigin checks whether the Origin header in an incoming HTTP / WebSocket request is trusted.
func (v *OriginValidator) ValidateOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")

	// Native mobile apps and non-browser clients (curl, Go clients) often omit the Origin header.
	if origin == "" {
		v.mu.RLock()
		allowed := v.allowMissing
		v.mu.RUnlock()
		return allowed
	}

	cleaned := strings.TrimRight(strings.ToLower(strings.TrimSpace(origin)), "/")

	v.mu.RLock()
	defer v.mu.RUnlock()

	// Direct match against known origins
	if v.allowedOrigins[cleaned] {
		return true
	}

	// Parse host and compare
	parsed, err := url.Parse(cleaned)
	if err != nil {
		return false
	}

	if v.allowedHosts[parsed.Host] {
		return true
	}

	// Allow localhost / 127.0.0.1 on ports 3001 and 8082 for dev flexibility
	host := parsed.Hostname()
	port := parsed.Port()
	if (host == "localhost" || host == "127.0.0.1") && (port == "3001" || port == "8082" || port == "8081" || port == "8088") {
		return true
	}

	// Mobile Expo local tunnel or exp scheme support
	if parsed.Scheme == "exp" || parsed.Scheme == "porchat" {
		return true
	}

	return false
}

// CheckOriginFunc returns a function conforming to gorilla/websocket Upgrader.CheckOrigin.
func (v *OriginValidator) CheckOriginFunc() func(r *http.Request) bool {
	return func(r *http.Request) bool {
		return v.ValidateOrigin(r)
	}
}

// OriginMiddleware enforces origin validation for state-changing HTTP requests (POST, PUT, DELETE).
func (v *OriginValidator) OriginMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Only enforce on mutation requests where Cross-Site Request Forgery (CSRF) is relevant
		if r.Method == http.MethodPost || r.Method == http.MethodPut || r.Method == http.MethodDelete || r.Method == http.MethodPatch {
			origin := r.Header.Get("Origin")
			if origin != "" && !v.ValidateOrigin(r) {
				w.Header().Set("Content-Type", "application/json; charset=utf-8")
				w.WriteHeader(http.StatusForbidden)
				_, _ = w.Write([]byte(fmt.Sprintf(`{"error":"Forbidden","message":"Origin '%s' is not authorized"}`, origin)))
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
