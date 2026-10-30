package auth

import (
	"crypto/sha256"
	"encoding/hex"
	"sync"
	"time"
)

// TokenBlacklist manages revoked JWT tokens (logout, security invalidation)
// with automatic garbage collection of expired entries.
type TokenBlacklist struct {
	mu            sync.RWMutex
	revokedTokens map[string]time.Time // token hash -> expiration time
	userCutoffs   map[string]time.Time // user_id -> tokens issued before this time are invalid
	stopCh        chan struct{}
}

// NewTokenBlacklist instantiates the blacklist with an automatic background cleanup worker.
func NewTokenBlacklist() *TokenBlacklist {
	tb := &TokenBlacklist{
		revokedTokens: make(map[string]time.Time),
		userCutoffs:   make(map[string]time.Time),
		stopCh:        make(chan struct{}),
	}
	go tb.startPruneLoop(2 * time.Minute)
	return tb
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// RevokeToken marks a specific token as revoked until its native expiration time.
func (tb *TokenBlacklist) RevokeToken(token string, expiresAt time.Time) {
	if token == "" {
		return
	}
	h := hashToken(token)

	tb.mu.Lock()
	defer tb.mu.Unlock()
	tb.revokedTokens[h] = expiresAt
}

// IsTokenRevoked checks whether a specific token has been invalidated.
func (tb *TokenBlacklist) IsTokenRevoked(token string) bool {
	if token == "" {
		return true
	}
	h := hashToken(token)

	tb.mu.RLock()
	defer tb.mu.RUnlock()

	exp, found := tb.revokedTokens[h]
	if !found {
		return false
	}

	// If token has already expired naturally, treat it as expired/revoked
	return time.Now().Before(exp)
}

// RevokeAllUserTokens invalidates all existing tokens issued to a user prior to now.
// Useful when password changes or account takeover is detected.
func (tb *TokenBlacklist) RevokeAllUserTokens(userID string) {
	if userID == "" {
		return
	}
	tb.mu.Lock()
	defer tb.mu.Unlock()
	tb.userCutoffs[userID] = time.Now()
}

// IsUserTokenValid checks if a token's issued-at timestamp is after the user's cutoff.
func (tb *TokenBlacklist) IsUserTokenValid(userID string, issuedAt time.Time) bool {
	if userID == "" {
		return false
	}
	tb.mu.RLock()
	defer tb.mu.RUnlock()

	cutoff, exists := tb.userCutoffs[userID]
	if !exists {
		return true
	}

	return issuedAt.After(cutoff)
}

func (tb *TokenBlacklist) startPruneLoop(interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			tb.pruneExpired()
		case <-tb.stopCh:
			return
		}
	}
}

func (tb *TokenBlacklist) pruneExpired() {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	now := time.Now()
	for h, exp := range tb.revokedTokens {
		if now.After(exp) {
			delete(tb.revokedTokens, h)
		}
	}
}

// Close terminates the blacklist prune loop.
func (tb *TokenBlacklist) Close() {
	select {
	case <-tb.stopCh:
	default:
		close(tb.stopCh)
	}
}

// --- Brute-Force Login Attempt Tracker ---

type attemptRecord struct {
	count     int
	firstFail time.Time
	lockedUntil time.Time
}

// LoginAttemptsTracker tracks failed authentication attempts to mitigate credential stuffing.
type LoginAttemptsTracker struct {
	mu           sync.RWMutex
	attempts     map[string]*attemptRecord
	maxFailures  int           // e.g. 5
	window       time.Duration // e.g. 5 minutes
	lockDuration time.Duration // e.g. 15 minutes
	stopCh       chan struct{}
}

// NewLoginAttemptsTracker creates a tracker with failure thresholds and lockout durations.
func NewLoginAttemptsTracker(maxFailures int, window, lockDuration time.Duration) *LoginAttemptsTracker {
	lat := &LoginAttemptsTracker{
		attempts:     make(map[string]*attemptRecord),
		maxFailures:  maxFailures,
		window:       window,
		lockDuration: lockDuration,
		stopCh:       make(chan struct{}),
	}
	go lat.startCleanupLoop(5 * time.Minute)
	return lat
}

// RecordFailure registers a failed login attempt and returns whether the identifier is now locked out.
func (lat *LoginAttemptsTracker) RecordFailure(key string) (bool, time.Duration) {
	lat.mu.Lock()
	defer lat.mu.Unlock()

	now := time.Now()
	rec, exists := lat.attempts[key]
	if !exists || now.Sub(rec.firstFail) > lat.window {
		rec = &attemptRecord{
			count:     1,
			firstFail: now,
		}
		lat.attempts[key] = rec
		return false, 0
	}

	rec.count++
	if rec.count >= lat.maxFailures {
		rec.lockedUntil = now.Add(lat.lockDuration)
		return true, lat.lockDuration
	}

	return false, 0
}

// RecordSuccess clears any failure records for the identifier upon valid login.
func (lat *LoginAttemptsTracker) RecordSuccess(key string) {
	lat.mu.Lock()
	defer lat.mu.Unlock()
	delete(lat.attempts, key)
}

// IsLocked checks whether the identifier is currently under a lockout penalty.
func (lat *LoginAttemptsTracker) IsLocked(key string) (bool, time.Duration) {
	lat.mu.RLock()
	defer lat.mu.RUnlock()

	rec, exists := lat.attempts[key]
	if !exists {
		return false, 0
	}

	now := time.Now()
	if now.Before(rec.lockedUntil) {
		return true, rec.lockedUntil.Sub(now)
	}

	return false, 0
}

func (lat *LoginAttemptsTracker) startCleanupLoop(interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			lat.cleanup()
		case <-lat.stopCh:
			return
		}
	}
}

func (lat *LoginAttemptsTracker) cleanup() {
	lat.mu.Lock()
	defer lat.mu.Unlock()

	now := time.Now()
	for k, rec := range lat.attempts {
		if now.After(rec.lockedUntil) && now.Sub(rec.firstFail) > lat.window {
			delete(lat.attempts, k)
		}
	}
}

// Close stops background cleanup.
func (lat *LoginAttemptsTracker) Close() {
	select {
	case <-lat.stopCh:
	default:
		close(lat.stopCh)
	}
}
