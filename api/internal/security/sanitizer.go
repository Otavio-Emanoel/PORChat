package security

import (
	"errors"
	"fmt"
	"html"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

var (
	// ErrMessageTooShort is returned when payload length is below minimum.
	ErrMessageTooShort = errors.New("message content is too short")
	// ErrMessageTooLong is returned when payload length exceeds maximum.
	ErrMessageTooLong = errors.New("message content exceeds maximum allowed length")
	// ErrNicknameInvalid is returned when nickname format violates security bounds.
	ErrNicknameInvalid = errors.New("nickname must be between 2 and 24 valid alphanumeric characters")

	// Pre-compiled regex patterns for dangerous schemes and malicious inputs
	dangerousSchemeRegex = regexp.MustCompile(`(?i)(javascript:|data:|vbscript:|file:|about:)`)
	zeroWidthRegex       = regexp.MustCompile(`[\x{200B}-\x{200D}\x{FEFF}\x{200E}\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}]`)
	ipInURLRegex         = regexp.MustCompile(`(?i)https?://(\d{1,3}\.){3}\d{1,3}`)
	urlPatternRegex      = regexp.MustCompile(`https?://[^\s/$.?#].[^\s]*`)
)

// SanitizeText performs multi-pass sanitization:
// 1. Strips invisible zero-width and bidirectional override characters.
// 2. Removes non-printable control codes (preserving linebreaks).
// 3. HTML-escapes raw tags to prevent Cross-Site Scripting (XSS).
func SanitizeText(input string) string {
	if input == "" {
		return ""
	}

	// Remove zero-width & bidirectional override characters
	cleaned := zeroWidthRegex.ReplaceAllString(input, "")

	// Filter out non-printable control characters except standard whitespace
	var b strings.Builder
	b.Grow(len(cleaned))
	for _, r := range cleaned {
		if r == '\n' || r == '\r' || r == '\t' || !unicode.IsControl(r) {
			b.WriteRune(r)
		}
	}
	filtered := b.String()

	// HTML-escape brackets, ampersands, quotes
	escaped := html.EscapeString(filtered)

	return strings.TrimSpace(escaped)
}

// SanitizeNickname enforces nickname bounds, strips special characters, and ensures safety.
func SanitizeNickname(input string) (string, error) {
	trimmed := strings.TrimSpace(input)
	if trimmed == "" {
		return "", ErrNicknameInvalid
	}

	// Strip zero-width and control characters
	cleaned := zeroWidthRegex.ReplaceAllString(trimmed, "")

	var b strings.Builder
	for _, r := range cleaned {
		// Allow letters, digits, underscores, spaces, hyphens and dots
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '_' || r == '-' || r == '.' || r == ' ' {
			b.WriteRune(r)
		}
	}
	result := strings.TrimSpace(b.String())

	runeCount := utf8.RuneCountInString(result)
	if runeCount < 2 || runeCount > 24 {
		return "", fmt.Errorf("%w: current length is %d", ErrNicknameInvalid, runeCount)
	}

	return result, nil
}

// ValidateChatMessage validates the message length after sanitization and returns the safe content.
func ValidateChatMessage(input string, minLen, maxLen int) (string, error) {
	sanitized := SanitizeText(input)
	count := utf8.RuneCountInString(sanitized)

	if count < minLen {
		return "", ErrMessageTooShort
	}
	if count > maxLen {
		return "", fmt.Errorf("%w (max %d, got %d)", ErrMessageTooLong, maxLen, count)
	}

	return sanitized, nil
}

// DetectDangerousURLs inspects text for dangerous schemes or bare IP destinations that could indicate phishing.
func DetectDangerousURLs(input string) []string {
	var dangerous []string

	if dangerousSchemeRegex.MatchString(input) {
		matches := dangerousSchemeRegex.FindAllString(input, -1)
		dangerous = append(dangerous, matches...)
	}

	if ipInURLRegex.MatchString(input) {
		matches := ipInURLRegex.FindAllString(input, -1)
		dangerous = append(dangerous, matches...)
	}

	return dangerous
}

// ExtractURLs returns all HTTP/HTTPS links discovered in the text.
func ExtractURLs(input string) []string {
	return urlPatternRegex.FindAllString(input, -1)
}

// MaskSensitiveInfo replaces tokens, emails, or password fields in log strings to protect PII.
func MaskSensitiveInfo(input string) string {
	// Mask Bearer tokens: Bearer <jwt> -> Bearer ***
	bearerRegex := regexp.MustCompile(`(?i)(bearer\s+)([A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+)`)
	masked := bearerRegex.ReplaceAllString(input, "${1}***")

	// Mask email addresses: john.doe@example.com -> j***e@example.com
	emailRegex := regexp.MustCompile(`([a-zA-Z0-9_.+-])[a-zA-Z0-9_.+-]*([a-zA-Z0-9_.+-])@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)`)
	masked = emailRegex.ReplaceAllString(masked, "${1}***${2}@${3}")

	return masked
}
