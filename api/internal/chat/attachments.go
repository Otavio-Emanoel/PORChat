package chat

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

const MaxAttachmentBytes = 8 * 1024 * 1024 // 8 MB max per attachment

type AttachmentUploadReq struct {
	Kind            string `json:"kind"` // "audio", "image", "document"
	FileName        string `json:"file_name"`
	MimeType        string `json:"mime_type"`
	DataBase64      string `json:"data_base64"`
	Caption         string `json:"caption,omitempty"`
	DurationSeconds int    `json:"duration_seconds,omitempty"`
	Waveform        []int  `json:"waveform,omitempty"`
	ReplyToID       string `json:"reply_to_id,omitempty"`
}

func sanitizeFileName(name string) string {
	base := filepath.Base(strings.TrimSpace(name))
	if base == "" || base == "." || base == "/" {
		return "arquivo.bin"
	}
	// Strip dangerous characters
	clean := strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') ||
			r == '.' || r == '-' || r == '_' || r == ' ' || r == '(' || r == ')' {
			return r
		}
		return '_'
	}, base)
	if len(clean) > 120 {
		clean = clean[len(clean)-120:]
	}
	return clean
}

func normalizeWaveform(bars []int) []int {
	if len(bars) == 0 {
		return []int{25, 48, 62, 35, 80, 54, 90, 42, 68, 75, 50, 84, 60, 40, 72, 95, 58, 44, 66, 38, 52, 70, 45, 30}
	}
	limit := len(bars)
	if limit > 48 {
		limit = 48
	}
	out := make([]int, limit)
	for i := 0; i < limit; i++ {
		v := bars[i]
		if v < 8 {
			v = 8
		} else if v > 100 {
			v = 100
		}
		out[i] = v
	}
	return out
}

func decodeDataPayload(raw string) ([]byte, string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, "", errors.New("empty attachment payload")
	}

	detectedMime := ""
	b64Part := trimmed
	if strings.HasPrefix(trimmed, "data:") {
		commaIdx := strings.Index(trimmed, ",")
		if commaIdx == -1 {
			return nil, "", errors.New("malformed data URL")
		}
		header := trimmed[5:commaIdx]
		b64Part = trimmed[commaIdx+1:]
		semiIdx := strings.Index(header, ";")
		if semiIdx != -1 {
			detectedMime = header[:semiIdx]
		} else {
			detectedMime = header
		}
	}

	decoded, err := base64.StdEncoding.DecodeString(b64Part)
	if err != nil {
		// Try RawStdEncoding fallback
		decoded, err = base64.RawStdEncoding.DecodeString(b64Part)
		if err != nil {
			return nil, "", errors.New("invalid base64 encoding")
		}
	}

	if len(decoded) == 0 {
		return nil, "", errors.New("decoded attachment is empty")
	}
	if len(decoded) > MaxAttachmentBytes {
		return nil, "", fmt.Errorf("attachment exceeds maximum size of %d MB", MaxAttachmentBytes/(1024*1024))
	}

	return decoded, detectedMime, nil
}

// CreateAttachmentMessage stores a verified binary attachment (audio note, image, or document)
// with SHA-256 integrity hash and creates a corresponding message in the room.
func (s *RoomStore) CreateAttachmentMessage(roomID, userID, nickname string, req AttachmentUploadReq) (*ChatMessage, error) {
	rawBytes, detectedMime, err := decodeDataPayload(req.DataBase64)
	if err != nil {
		return nil, err
	}

	mimeType := strings.TrimSpace(req.MimeType)
	if mimeType == "" {
		mimeType = detectedMime
	}
	if mimeType == "" {
		mimeType = http.DetectContentType(rawBytes)
	}

	kind := strings.ToLower(strings.TrimSpace(req.Kind))
	if kind != "audio" && kind != "image" && kind != "document" {
		if strings.HasPrefix(mimeType, "audio/") {
			kind = "audio"
		} else if strings.HasPrefix(mimeType, "image/") {
			kind = "image"
		} else {
			kind = "document"
		}
	}

	cleanFileName := sanitizeFileName(req.FileName)
	if kind == "audio" && cleanFileName == "arquivo.bin" {
		cleanFileName = "nota-de-voz.wav"
	}

	sum := sha256.Sum256(rawBytes)
	hashHex := hex.EncodeToString(sum[:])

	attID := uuid.New().String()
	now := time.Now()
	dataURL := fmt.Sprintf("data:%s;base64,%s", mimeType, base64.StdEncoding.EncodeToString(rawBytes))

	att := &MessageAttachment{
		ID:              attID,
		RoomID:          roomID,
		Kind:            kind,
		FileName:        cleanFileName,
		MimeType:        mimeType,
		SizeBytes:       len(rawBytes),
		SHA256:          hashHex,
		URL:             "/api/attachments/" + attID,
		DataURL:         dataURL,
		DurationSeconds: req.DurationSeconds,
		CreatedAt:       now.Format(time.RFC3339),
	}

	if kind == "audio" {
		if att.DurationSeconds <= 0 {
			att.DurationSeconds = 1
		}
		att.Waveform = normalizeWaveform(req.Waveform)
	}

	msgType := "file"
	defaultContent := fmt.Sprintf("Arquivo: %s (%d KB)", cleanFileName, (len(rawBytes)+1023)/1024)
	if kind == "audio" {
		msgType = "voice"
		mins := att.DurationSeconds / 60
		secs := att.DurationSeconds % 60
		defaultContent = fmt.Sprintf("Mensagem de voz (%d:%02d)", mins, secs)
	} else if kind == "image" {
		defaultContent = fmt.Sprintf("Imagem: %s", cleanFileName)
	}

	caption := strings.TrimSpace(req.Caption)
	if caption != "" {
		if len(caption) > 500 {
			caption = caption[:500]
		}
		defaultContent = caption
	}

	s.mu.Lock()
	s.ensureMapsLocked()
	room, ok := s.rooms[roomID]
	if !ok {
		s.mu.Unlock()
		return nil, errors.New("room not found")
	}

	s.attachments[attID] = att

	msg := &ChatMessage{
		ID:         uuid.New().String(),
		RoomID:     roomID,
		UserID:     userID,
		Nickname:   nickname,
		Content:    defaultContent,
		Type:       msgType,
		ReplyToID:  strings.TrimSpace(req.ReplyToID),
		ReadBy:     []string{nickname},
		Attachment: att,
		CreatedAt:  now,
	}

	if msg.ReplyToID != "" {
		for _, existing := range s.messages[roomID] {
			if existing.ID == msg.ReplyToID {
				previewText := existing.Content
				if len(previewText) > 120 {
					previewText = previewText[:120] + "..."
				}
				msg.ReplyPreview = &ReplyPreview{
					ID:       existing.ID,
					Nickname: existing.Nickname,
					Content:  previewText,
				}
				break
			}
		}
	}

	s.messages[roomID] = append(s.messages[roomID], msg)
	room.LastMessage = msg.Content
	room.LastMessageAt = now
	s.mu.Unlock()

	go func() { _ = s.SaveToDisk("data/chat_store.json") }()
	return msg, nil
}

// GetAttachment retrieves a stored attachment by its ID.
func (s *RoomStore) GetAttachment(attID string) (*MessageAttachment, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.attachments == nil {
		return nil, false
	}
	att, ok := s.attachments[attID]
	return att, ok
}

// UploadAttachmentHTTP handles POST /api/rooms/{id}/attachments
func (h *ChatHandler) UploadAttachmentHTTP(w http.ResponseWriter, r *http.Request) {
	roomID := chi.URLParam(r, "id")
	user := h.extractUser(r)
	if user == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req AttachmentUploadReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid attachment payload"}`, http.StatusBadRequest)
		return
	}

	msg, err := h.Store.CreateAttachmentMessage(roomID, user, user, req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	h.emitRoomEvent(roomID, "chat:new_message", msg)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(msg)
}

// ServeAttachmentHTTP handles GET /api/attachments/{attId}
func (h *ChatHandler) ServeAttachmentHTTP(w http.ResponseWriter, r *http.Request) {
	attID := chi.URLParam(r, "attId")
	att, ok := h.Store.GetAttachment(attID)
	if !ok {
		http.Error(w, `{"error":"attachment not found"}`, http.StatusNotFound)
		return
	}

	rawBytes, _, err := decodeDataPayload(att.DataURL)
	if err != nil {
		http.Error(w, `{"error":"corrupted attachment data"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", att.MimeType)
	w.Header().Set("X-Content-SHA256", att.SHA256)
	w.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, att.FileName))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(rawBytes)
}
