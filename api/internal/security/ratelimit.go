package security

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// RateLimiter implements a thread-safe token-bucket algorithm with sliding expiration
// for defending HTTP routes and WebSocket connections against brute-force and DoS floods.
type RateLimiter struct {
	mu          sync.RWMutex
	visitors    map[string]*visitorBucket
	rate        float64       // tokens replenished per second
	capacity    float64       // maximum burst token capacity
	ttl         time.Duration // idle time after which a visitor record is pruned
	cleanupStop chan struct{}
}

type visitorBucket struct {
	tokens     float64
	lastRefill time.Time
	lastSeen   time.Time
}

// NewRateLimiter creates a new rate limiter with specified replenishment rate and burst capacity.
// rate: tokens added per second (e.g., 5.0 allows 5 req/sec steady state).
// capacity: maximum tokens in the bucket (e.g., 10.0 allows burst of 10).
// ttl: retention duration before dormant visitors are evicted (e.g., 5 * time.Minute).
func NewRateLimiter(rate float64, capacity float64, ttl time.Duration) *RateLimiter {
	rl := &RateLimiter{
		visitors:    make(map[string]*visitorBucket),
		rate:        rate,
		capacity:    capacity,
		ttl:         ttl,
		cleanupStop: make(chan struct{}),
	}
	go rl.startCleanupLoop(1 * time.Minute)
	return rl
}

// Allow reports whether a single event is permitted for the given key.
func (rl *RateLimiter) Allow(key string) bool {
	return rl.AllowN(key, 1.0)
}

// AllowN reports whether n tokens can be consumed for the given key.
func (rl *RateLimiter) AllowN(key string, n float64) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	v, exists := rl.visitors[key]
	if !exists {
		v = &visitorBucket{
			tokens:     rl.capacity - n,
			lastRefill: now,
			lastSeen:   now,
		}
		if v.tokens < 0 {
			v.tokens = 0
			rl.visitors[key] = v
			return false
		}
		rl.visitors[key] = v
		return true
	}

	// Refill tokens based on elapsed duration
	elapsed := now.Sub(v.lastRefill).Seconds()
	v.lastRefill = now
	v.lastSeen = now

	v.tokens += elapsed * rl.rate
	if v.tokens > rl.capacity {
		v.tokens = rl.capacity
	}

	if v.tokens >= n {
		v.tokens -= n
		return true
	}

	return false
}

// Reset clears the bucket for a specific key (useful after successful login).
func (rl *RateLimiter) Reset(key string) {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	delete(rl.visitors, key)
}

// Close stops the background eviction goroutine and clears state.
func (rl *RateLimiter) Close() {
	select {
	case <-rl.cleanupStop:
		// already closed
	default:
		close(rl.cleanupStop)
	}

	rl.mu.Lock()
	defer rl.mu.Unlock()
	rl.visitors = make(map[string]*visitorBucket)
}

// GetVisitorCount returns the active number of tracked rate limit keys.
func (rl *RateLimiter) GetVisitorCount() int {
	rl.mu.RLock()
	defer rl.mu.RUnlock()
	return len(rl.visitors)
}

func (rl *RateLimiter) startCleanupLoop(interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			rl.cleanupStale()
		case <-rl.cleanupStop:
			return
		}
	}
}

func (rl *RateLimiter) cleanupStale() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	for key, v := range rl.visitors {
		if now.Sub(v.lastSeen) > rl.ttl {
			delete(rl.visitors, key)
		}
	}
}

// ExtractClientIP retrieves the real client IP, respecting trusted proxy headers if present.
func ExtractClientIP(r *http.Request) string {
	// X-Forwarded-For may contain multiple comma-separated IPs; the leftmost is the client
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			ip := strings.TrimSpace(parts[0])
			if net.ParseIP(ip) != nil {
				return ip
			}
		}
	}

	if xri := strings.TrimSpace(r.Header.Get("X-Real-IP")); xri != "" {
		if net.ParseIP(xri) != nil {
			return xri
		}
	}

	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && net.ParseIP(host) != nil {
		return host
	}

	return r.RemoteAddr
}

// HTTPRateLimitMiddleware wraps an http.Handler with rate limiting keyed on client IP.
func HTTPRateLimitMiddleware(rl *RateLimiter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := ExtractClientIP(r)
			key := fmt.Sprintf("http:%s", ip)

			if !rl.Allow(key) {
				w.Header().Set("Retry-After", "5")
				w.Header().Set("Content-Type", "application/json; charset=utf-8")
				w.WriteHeader(http.StatusTooManyRequests)
				_, _ = w.Write([]byte(`{"error":"Too Many Requests","message":"Rate limit exceeded. Please wait before retrying."}`))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// CustomRateLimitMiddleware allows different limits per route category (e.g., auth vs static)
func CustomRateLimitMiddleware(rl *RateLimiter, prefix string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ip := ExtractClientIP(r)
			key := fmt.Sprintf("%s:%s", prefix, ip)

			if !rl.Allow(key) {
				w.Header().Set("Retry-After", "10")
				w.Header().Set("Content-Type", "application/json; charset=utf-8")
				w.WriteHeader(http.StatusTooManyRequests)
				_, _ = w.Write([]byte(fmt.Sprintf(`{"error":"Too Many Requests","message":"Rate limit exceeded for %s."}`, prefix)))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// KeyFunc extracts a rate-limiting key from a request context or headers.
type KeyFunc func(r *http.Request) string

// KeyedRateLimitMiddleware allows custom extraction (e.g. user ID or auth token).
func KeyedRateLimitMiddleware(rl *RateLimiter, keyFn KeyFunc) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := keyFn(r)
			if key == "" {
				key = ExtractClientIP(r)
			}

			if !rl.Allow(key) {
				w.Header().Set("Retry-After", "5")
				w.Header().Set("Content-Type", "application/json; charset=utf-8")
				w.WriteHeader(http.StatusTooManyRequests)
				_, _ = w.Write([]byte(`{"error":"Too Many Requests","message":"Rate limit exceeded."}`))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// ContextWithIP stores client IP in context for downstream audit or metrics.
type contextKey string

const clientIPKey contextKey = "security:client_ip"

func ContextWithIP(ctx context.Context, ip string) context.Context {
	return context.WithValue(ctx, clientIPKey, ip)
}

func GetIPFromContext(ctx context.Context) string {
	if val, ok := ctx.Value(clientIPKey).(string); ok {
		return val
	}
	return ""
}
