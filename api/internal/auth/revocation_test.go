package auth

import (
	"sync"
	"testing"
	"time"
)

func TestTokenBlacklist_RevokeAndCheck(t *testing.T) {
	tb := NewTokenBlacklist()
	defer tb.Close()

	token := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sample.token"
	exp := time.Now().Add(10 * time.Minute)

	if tb.IsTokenRevoked(token) {
		t.Errorf("Fresh token should not be revoked")
	}

	tb.RevokeToken(token, exp)

	if !tb.IsTokenRevoked(token) {
		t.Errorf("Token should be identified as revoked after RevokeToken")
	}

	// Empty token check
	if !tb.IsTokenRevoked("") {
		t.Errorf("Empty token should always be treated as revoked/invalid")
	}
}

func TestTokenBlacklist_UserCutoff(t *testing.T) {
	tb := NewTokenBlacklist()
	defer tb.Close()

	userID := "user-1234"
	issuedBefore := time.Now().Add(-5 * time.Minute)

	if !tb.IsUserTokenValid(userID, issuedBefore) {
		t.Errorf("Token issued before any cutoff should be valid")
	}

	// Revoke all existing tokens for this user
	tb.RevokeAllUserTokens(userID)

	if tb.IsUserTokenValid(userID, issuedBefore) {
		t.Errorf("Token issued prior to cutoff must be invalid")
	}

	issuedAfter := time.Now().Add(1 * time.Minute)
	if !tb.IsUserTokenValid(userID, issuedAfter) {
		t.Errorf("Token issued after cutoff should remain valid")
	}
}

func TestTokenBlacklist_ConcurrentAccess(t *testing.T) {
	tb := NewTokenBlacklist()
	defer tb.Close()

	var wg sync.WaitGroup
	workers := 20
	iterations := 50

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < iterations; j++ {
				token := "token-concurrent"
				tb.RevokeToken(token, time.Now().Add(1*time.Hour))
				_ = tb.IsTokenRevoked(token)
				_ = tb.IsUserTokenValid("user-x", time.Now())
			}
		}(i)
	}

	wg.Wait()
}

func TestLoginAttemptsTracker_LockoutAndSuccess(t *testing.T) {
	// Max 3 failures, 1 second window, 500ms lock duration
	lat := NewLoginAttemptsTracker(3, 1*time.Second, 500*time.Millisecond)
	defer lat.Close()

	key := "test-user@porchat.app"

	// 1st failure
	locked, _ := lat.RecordFailure(key)
	if locked {
		t.Errorf("Expected not locked after 1st failure")
	}

	// 2nd failure
	locked, _ = lat.RecordFailure(key)
	if locked {
		t.Errorf("Expected not locked after 2nd failure")
	}

	// 3rd failure -> Must be locked
	locked, duration := lat.RecordFailure(key)
	if !locked {
		t.Errorf("Expected user to be locked out after 3 failures")
	}
	if duration <= 0 {
		t.Errorf("Expected positive lockout duration, got %v", duration)
	}

	isLocked, _ := lat.IsLocked(key)
	if !isLocked {
		t.Errorf("IsLocked returned false while in lockout penalty")
	}

	// Wait for lockout duration to elapse
	time.Sleep(550 * time.Millisecond)
	isLockedAfter, _ := lat.IsLocked(key)
	if isLockedAfter {
		t.Errorf("Expected lockout to have expired")
	}

	// Success clears failure record
	lat.RecordFailure(key)
	lat.RecordSuccess(key)
	isLocked, _ = lat.IsLocked(key)
	if isLocked {
		t.Errorf("RecordSuccess failed to clear failure state")
	}
}
