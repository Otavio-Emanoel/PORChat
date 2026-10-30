package security

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
)

var (
	// ErrInvalidNonceLength is returned if requested nonce length is non-positive.
	ErrInvalidNonceLength = errors.New("nonce byte length must be greater than zero")
)

// ConstantTimeCompare performs a timing-attack resistant comparison of two strings.
func ConstantTimeCompare(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

// HashSHA256 returns the hexadecimal representation of the SHA-256 digest of input.
func HashSHA256(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

// GenerateHMAC computes the HMAC-SHA256 signature for data using the specified secret key.
func GenerateHMAC(message, secret []byte) string {
	mac := hmac.New(sha256.New, secret)
	mac.Write(message)
	return hex.EncodeToString(mac.Sum(nil))
}

// VerifyHMAC timing-safely verifies whether the computed HMAC matches expectedHex.
func VerifyHMAC(message, secret []byte, expectedHex string) bool {
	expectedBytes, err := hex.DecodeString(expectedHex)
	if err != nil {
		return false
	}

	mac := hmac.New(sha256.New, secret)
	mac.Write(message)
	computedBytes := mac.Sum(nil)

	return subtle.ConstantTimeCompare(computedBytes, expectedBytes) == 1
}

// GenerateSecureNonce produces a cryptographically secure random hexadecimal token.
func GenerateSecureNonce(byteLength int) (string, error) {
	if byteLength <= 0 {
		return "", ErrInvalidNonceLength
	}

	b := make([]byte, byteLength)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("failed to read secure random bytes: %w", err)
	}

	return hex.EncodeToString(b), nil
}

// GenerateSecurePIN creates an alphanumeric room PIN with prefix (e.g., "POR-7A2B").
func GenerateSecurePIN(prefix string) (string, error) {
	const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Exclude easily confused O, 0, I, 1
	bytes := make([]byte, 4)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}

	var code strings.Builder
	for _, b := range bytes {
		code.WriteByte(charset[int(b)%len(charset)])
	}

	cleanPrefix := strings.ToUpper(strings.TrimSpace(prefix))
	if cleanPrefix == "" {
		cleanPrefix = "POR"
	}

	return fmt.Sprintf("%s-%s", cleanPrefix, code.String()), nil
}

// ValidatePINFormat checks if a given PIN follows valid format conventions (e.g. PREFIX-XXXX).
func ValidatePINFormat(pin string) bool {
	trimmed := strings.ToUpper(strings.TrimSpace(pin))
	parts := strings.Split(trimmed, "-")
	if len(parts) != 2 {
		return false
	}

	prefix, code := parts[0], parts[1]
	if len(prefix) < 2 || len(prefix) > 6 {
		return false
	}
	if len(code) < 3 || len(code) > 8 {
		return false
	}

	// Code must only consist of alphanumeric characters
	for _, r := range code {
		if !((r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9')) {
			return false
		}
	}

	return true
}
