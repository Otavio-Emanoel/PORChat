package security

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

// --- Rate Limiter Tests ---

func TestRateLimiter_AllowAndExceed(t *testing.T) {
	// 5 tokens/sec, capacity 3.0, ttl 1s
	rl := NewRateLimiter(5.0, 3.0, 1*time.Second)
	defer rl.Close()

	key := "test-client"

	// Should allow 3 burst requests
	if !rl.Allow(key) {
		t.Errorf("Expected 1st request to be allowed")
	}
	if !rl.Allow(key) {
		t.Errorf("Expected 2nd request to be allowed")
	}
	if !rl.Allow(key) {
		t.Errorf("Expected 3rd request to be allowed")
	}

	// 4th request immediately should fail (burst exhausted)
	if rl.Allow(key) {
		t.Errorf("Expected 4th request to be denied immediately")
	}

	// Wait 250ms -> 5 * 0.25 = 1.25 tokens refilled
	time.Sleep(250 * time.Millisecond)
	if !rl.Allow(key) {
		t.Errorf("Expected request to be allowed after token refill")
	}
}

func TestRateLimiter_Reset(t *testing.T) {
	rl := NewRateLimiter(1.0, 1.0, 1*time.Second)
	defer rl.Close()

	key := "reset-client"
	rl.Allow(key)
	if rl.Allow(key) {
		t.Errorf("Expected bucket to be empty")
	}

	rl.Reset(key)
	if !rl.Allow(key) {
		t.Errorf("Expected bucket to be refreshed after reset")
	}
}

func TestRateLimiter_ConcurrentAccess(t *testing.T) {
	rl := NewRateLimiter(100.0, 50.0, 1*time.Second)
	defer rl.Close()

	var wg sync.WaitGroup
	workers := 20
	iterations := 50

	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			key := "shared-key"
			for j := 0; j < iterations; j++ {
				_ = rl.Allow(key)
			}
		}(i)
	}

	wg.Wait()
}

func TestHTTPRateLimitMiddleware(t *testing.T) {
	rl := NewRateLimiter(1.0, 2.0, 1*time.Minute)
	defer rl.Close()

	handler := HTTPRateLimitMiddleware(rl)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.100:1234"

	// 1st request: OK
	rec1 := httptest.NewRecorder()
	handler.ServeHTTP(rec1, req)
	if rec1.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", rec1.Code)
	}

	// 2nd request: OK
	rec2 := httptest.NewRecorder()
	handler.ServeHTTP(rec2, req)
	if rec2.Code != http.StatusOK {
		t.Fatalf("Expected 200 OK, got %d", rec2.Code)
	}

	// 3rd request: 429 Too Many Requests
	rec3 := httptest.NewRecorder()
	handler.ServeHTTP(rec3, req)
	if rec3.Code != http.StatusTooManyRequests {
		t.Fatalf("Expected 429 Too Many Requests, got %d", rec3.Code)
	}

	if rec3.Header().Get("Retry-After") == "" {
		t.Errorf("Expected Retry-After header to be set")
	}
}

// --- Origin Validator Tests ---

func TestOriginValidator(t *testing.T) {
	v := NewOriginValidator()

	tests := []struct {
		name     string
		origin   string
		expected bool
	}{
		{"Allowed Web Dev", "http://localhost:3001", true},
		{"Allowed Mobile Web Dev", "http://localhost:8082", true},
		{"Allowed Production Domain", "https://porchat.app", true},
		{"Allowed Local IP Web", "http://127.0.0.1:3001", true},
		{"Allowed Trailing Slash", "http://localhost:3001/", true},
		{"Disallowed External Domain", "http://evil-attacker.com", false},
		{"Disallowed Phishing Clone", "http://porchat.app.attacker.com", false},
		{"Disallowed Wrong Port", "http://localhost:9999", false},
		{"Allowed Expo Scheme", "exp://127.0.0.1:8082", true},
		{"Allowed PORChat Native Scheme", "porchat://app", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/ws", nil)
			req.Header.Set("Origin", tt.origin)

			got := v.ValidateOrigin(req)
			if got != tt.expected {
				t.Errorf("ValidateOrigin(%q) = %v, want %v", tt.origin, got, tt.expected)
			}
		})
	}

	// Missing origin test (native mobile app)
	reqNoOrigin := httptest.NewRequest("GET", "/ws", nil)
	if !v.ValidateOrigin(reqNoOrigin) {
		t.Errorf("Expected missing origin to be allowed for native clients")
	}
}

func TestOriginMiddleware_BlocksMutation(t *testing.T) {
	v := NewOriginValidator()
	handler := v.OriginMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// POST from attacker
	req := httptest.NewRequest("POST", "/api/rooms", nil)
	req.Header.Set("Origin", "http://evil.com")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusForbidden {
		t.Errorf("Expected 403 Forbidden for bad origin on mutation, got %d", rec.Code)
	}

	// GET from attacker (read operations pass origin middleware, guarded by auth/CORS)
	reqGet := httptest.NewRequest("GET", "/api/rooms", nil)
	reqGet.Header.Set("Origin", "http://evil.com")
	recGet := httptest.NewRecorder()

	handler.ServeHTTP(recGet, reqGet)
	if recGet.Code != http.StatusOK {
		t.Errorf("Expected 200 OK for GET, got %d", recGet.Code)
	}
}

// --- Sanitizer Tests ---

func TestSanitizeText_StripsXSSAndControlChars(t *testing.T) {
	raw := "<script>alert('xss')</script> Hello \u200BWorld!\x00\x08"
	sanitized := SanitizeText(raw)

	if strings.Contains(sanitized, "<script>") {
		t.Errorf("SanitizeText failed to escape script tag: %s", sanitized)
	}
	if strings.Contains(sanitized, "\u200B") {
		t.Errorf("SanitizeText failed to strip zero-width space")
	}
	if strings.Contains(sanitized, "\x00") || strings.Contains(sanitized, "\x08") {
		t.Errorf("SanitizeText failed to strip control characters")
	}

	expectedPrefix := "&lt;script&gt;"
	if !strings.HasPrefix(sanitized, expectedPrefix) {
		t.Errorf("Expected sanitized output to start with %q, got %q", expectedPrefix, sanitized)
	}
}

func TestSanitizeNickname(t *testing.T) {
	tests := []struct {
		input       string
		expected    string
		shouldError bool
	}{
		{"Otavio", "Otavio", false},
		{"Pedro-123", "Pedro-123", false},
		{"Raul_King", "Raul_King", false},
		{"<script>Bad</script>", "scriptBadscript", false}, // brackets and slashes stripped
		{"A", "", true},                                      // too short
		{"ThisNicknameIsWayTooLongForOurSystemBounds", "", true},
		{"  Valid Nick  ", "Valid Nick", false},
	}

	for _, tt := range tests {
		got, err := SanitizeNickname(tt.input)
		if (err != nil) != tt.shouldError {
			t.Errorf("SanitizeNickname(%q) error = %v, shouldError = %v", tt.input, err, tt.shouldError)
			continue
		}
		if !tt.shouldError && got != tt.expected {
			t.Errorf("SanitizeNickname(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}

func TestValidateChatMessage(t *testing.T) {
	// Min 1, Max 100
	msg, err := ValidateChatMessage("Hello world!", 1, 100)
	if err != nil {
		t.Fatalf("Unexpected error for valid message: %v", err)
	}
	if msg != "Hello world!" {
		t.Errorf("Got message %q, want 'Hello world!'", msg)
	}

	// Empty message
	_, err = ValidateChatMessage("   \u200B  ", 1, 100)
	if err != ErrMessageTooShort {
		t.Errorf("Expected ErrMessageTooShort for blank/zero-width message, got %v", err)
	}

	// Too long
	longInput := strings.Repeat("A", 101)
	_, err = ValidateChatMessage(longInput, 1, 100)
	if err == nil {
		t.Errorf("Expected error for message exceeding max length")
	}
}

func TestDetectDangerousURLs(t *testing.T) {
	input := "Check out javascript:alert(1) and http://192.168.1.1/admin also https://porchat.app"
	dangers := DetectDangerousURLs(input)

	if len(dangers) < 2 {
		t.Errorf("Expected at least 2 dangerous URLs detected, got %d: %v", len(dangers), dangers)
	}
}

func TestMaskSensitiveInfo(t *testing.T) {
	raw := "User otavio@porchat.app sent header Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ID"
	masked := MaskSensitiveInfo(raw)

	if strings.Contains(masked, "otavio@porchat.app") {
		t.Errorf("MaskSensitiveInfo failed to mask email: %s", masked)
	}
	if strings.Contains(masked, "eyJhbGciOiJIUzI1Ni") {
		t.Errorf("MaskSensitiveInfo failed to mask bearer token: %s", masked)
	}
}

// --- Crypto & PIN Tests ---

func TestConstantTimeCompare(t *testing.T) {
	if !ConstantTimeCompare("secret-token-123", "secret-token-123") {
		t.Errorf("ConstantTimeCompare failed on equal strings")
	}
	if ConstantTimeCompare("secret-token-123", "secret-token-456") {
		t.Errorf("ConstantTimeCompare succeeded on different strings")
	}
}

func TestHMACGenerationAndVerification(t *testing.T) {
	secret := []byte("super-secure-key-32-bytes-long!")
	payload := []byte("{\"user\":\"Otavio\",\"message\":\"Let's debate!\"}")

	signature := GenerateHMAC(payload, secret)
	if signature == "" {
		t.Fatalf("HMAC signature is empty")
	}

	// Verify valid signature
	if !VerifyHMAC(payload, secret, signature) {
		t.Errorf("Failed to verify valid HMAC signature")
	}

	// Verify tampered payload
	tampered := []byte("{\"user\":\"Otavio\",\"message\":\"Tampered!\"}")
	if VerifyHMAC(tampered, secret, signature) {
		t.Errorf("Verification succeeded on tampered payload")
	}

	// Verify wrong secret
	if VerifyHMAC(payload, []byte("wrong-key"), signature) {
		t.Errorf("Verification succeeded with wrong secret key")
	}
}

func TestGenerateSecureNonce(t *testing.T) {
	nonce1, err := GenerateSecureNonce(16)
	if err != nil {
		t.Fatalf("GenerateSecureNonce failed: %v", err)
	}
	nonce2, err := GenerateSecureNonce(16)
	if err != nil {
		t.Fatalf("GenerateSecureNonce failed: %v", err)
	}

	if nonce1 == nonce2 {
		t.Errorf("Expected nonces to be unique, got collision")
	}
	if len(nonce1) != 32 { // 16 bytes = 32 hex chars
		t.Errorf("Expected 32 hex characters, got %d", len(nonce1))
	}
}

func TestRoomPINValidation(t *testing.T) {
	pin, err := GenerateSecurePIN("POR")
	if err != nil {
		t.Fatalf("GenerateSecurePIN failed: %v", err)
	}

	if !ValidatePINFormat(pin) {
		t.Errorf("Generated PIN %q failed validation", pin)
	}

	if !ValidatePINFormat("DEB-2000") {
		t.Errorf("Valid pin DEB-2000 failed validation")
	}

	if ValidatePINFormat("INVALID") {
		t.Errorf("Invalid pin without hyphen passed validation")
	}

	if ValidatePINFormat("POR-@#$!") {
		t.Errorf("Pin with special characters passed validation")
	}
}

// --- Audit Logger Tests ---

func TestAuditLogger(t *testing.T) {
	al := NewAuditLogger(5, false)
	defer al.Close()

	// Log 7 events (buffer capacity is 5 -> oldest 2 must be evicted)
	for i := 1; i <= 7; i++ {
		al.Log(
			EventAuthLoginSuccess,
			SeverityInfo,
			"127.0.0.1",
			"user-1",
			"",
			strings.Repeat("event", i),
			map[string]interface{}{"index": i},
		)
	}

	// Allow async worker to process queue
	time.Sleep(50 * time.Millisecond)

	count := al.Count()
	if count != 5 {
		t.Errorf("Expected buffer count to be clamped to 5, got %d", count)
	}

	events := al.GetEvents(10, EventAuthLoginSuccess)
	if len(events) != 5 {
		t.Errorf("Expected 5 events returned, got %d", len(events))
	}

	// Verify newest event is first
	idxVal, ok := events[0].Details["index"].(int)
	if !ok || idxVal != 7 {
		t.Errorf("Expected newest event index 7 first, got %v", events[0].Details["index"])
	}
}
