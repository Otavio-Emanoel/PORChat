package chat

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func TestRoomStore_EditPinReadAndFilteredMessages(t *testing.T) {
	store := NewRoomStore()
	room := store.CreateRoom("Sala de Engenharia", "ENG-1010", true, []string{"Otavio", "Pedro", "Raul"}, "Otavio")

	m1 := &ChatMessage{
		ID:        uuid.New().String(),
		RoomID:    room.ID,
		UserID:    "Otavio",
		Nickname:  "Otavio",
		Content:   "Primeira mensagem sobre arquitetura Go",
		Type:      "text",
		CreatedAt: time.Now(),
	}
	store.AddMessage(m1)

	m2 := &ChatMessage{
		ID:        uuid.New().String(),
		RoomID:    room.ID,
		UserID:    "Pedro",
		Nickname:  "Pedro",
		Content:   "Resposta sobre WebSockets",
		Type:      "text",
		ReplyToID: m1.ID,
		CreatedAt: time.Now().Add(1 * time.Second),
	}
	store.AddMessage(m2)

	// Verify reply preview auto-resolution
	if m2.ReplyPreview == nil || m2.ReplyPreview.ID != m1.ID || m2.ReplyPreview.Nickname != "Otavio" {
		t.Fatalf("expected reply preview to be automatically resolved, got %+v", m2.ReplyPreview)
	}

	// Non-author non-admin cannot edit m1
	if _, ok := store.EditMessage(room.ID, m1.ID, "Raul", "Tentativa inválida"); ok {
		t.Errorf("expected non-author non-admin edit to be rejected")
	}

	// Author can edit m1
	edited, ok := store.EditMessage(room.ID, m1.ID, "Otavio", "Mensagem editada sobre arquitetura distribuída")
	if !ok || !edited.IsEdited || edited.EditedAt == "" {
		t.Fatalf("expected author edit to succeed and set IsEdited/EditedAt")
	}

	// Pin message m1
	pinInfo, ok := store.PinMessage(room.ID, m1.ID, "Pedro")
	if !ok || pinInfo == nil || pinInfo.MessageID != m1.ID {
		t.Fatalf("expected PinMessage to succeed")
	}
	if pinInfo.Content != "Mensagem editada sobre arquitetura distribuída" {
		t.Errorf("unexpected pinned content: %s", pinInfo.Content)
	}

	// Editing a pinned message updates the room's pinned message banner text too
	_, _ = store.EditMessage(room.ID, m1.ID, "Otavio", "Texto atualizado no banner fixado")
	updatedRoom, _ := store.GetRoom(room.ID)
	if updatedRoom.PinnedMessage == nil || updatedRoom.PinnedMessage.Content != "Texto atualizado no banner fixado" {
		t.Errorf("expected pinned message banner to update when message is edited")
	}

	// Unpin message
	if !store.UnpinMessage(room.ID) {
		t.Errorf("expected UnpinMessage to succeed")
	}
	updatedRoom, _ = store.GetRoom(room.ID)
	if updatedRoom.PinnedMessage != nil {
		t.Errorf("expected PinnedMessage to be nil after UnpinMessage")
	}

	// Mark messages read by Pedro & Raul
	readIDs := store.MarkMessagesRead(room.ID, "Pedro", []string{m1.ID})
	if len(readIDs) != 1 || readIDs[0] != m1.ID {
		t.Errorf("expected m1 to be marked read by Pedro, got %v", readIDs)
	}
	// Calling again for same user should return 0 newly updated IDs
	duplicateRead := store.MarkMessagesRead(room.ID, "Pedro", []string{m1.ID})
	if len(duplicateRead) != 0 {
		t.Errorf("expected idempotent MarkMessagesRead, got %v", duplicateRead)
	}

	// Search & cursor pagination
	matches := store.GetMessagesFiltered(room.ID, "", "WebSockets", "", 50)
	if len(matches) != 1 || matches[0].ID != m2.ID {
		t.Errorf("expected filtered search for 'WebSockets' to return m2, got %d results", len(matches))
	}

	beforeM2 := store.GetMessagesFiltered(room.ID, m2.ID, "", "text", 50)
	if len(beforeM2) != 1 || beforeM2[0].ID != m1.ID {
		t.Errorf("expected cursor pagination before m2 to return m1, got %d results", len(beforeM2))
	}
}

func TestRoomStore_PollsLifecycle(t *testing.T) {
	store := NewRoomStore()
	room := store.CreateRoom("Sala de Enquetes", "POL-2020", true, []string{"Otavio", "Pedro", "Raul"}, "Otavio")

	// Less than 2 options must fail
	if _, err := store.CreatePoll(room.ID, "Otavio", "Otavio", "Qual modo jogar?", []string{"Apenas 1"}, false); err == nil {
		t.Errorf("expected poll with <2 options to fail")
	}

	// Create valid single-choice poll
	pollMsg, err := store.CreatePoll(
		room.ID,
		"Otavio",
		"Otavio",
		"Qual modo vamos jogar agora?",
		[]string{"Modo Debate", "Quiz Relâmpago", "Modo Debate"}, // duplicate option should be deduplicated
		false,
	)
	if err != nil {
		t.Fatalf("expected valid poll creation, got error: %v", err)
	}
	if pollMsg.Poll == nil || len(pollMsg.Poll.Options) != 2 {
		t.Fatalf("expected 2 deduplicated poll options, got %+v", pollMsg.Poll)
	}

	opt1 := pollMsg.Poll.Options[0].ID
	opt2 := pollMsg.Poll.Options[1].ID

	// Otavio votes for opt1
	pollState, err := store.VotePoll(room.ID, pollMsg.ID, opt1, "Otavio")
	if err != nil || len(pollState.Options[0].VoterIDs) != 1 {
		t.Fatalf("expected Otavio vote on opt1 to succeed: %v", err)
	}

	// Single-select: Otavio switches vote to opt2 -> opt1 must have 0 votes, opt2 must have 1 vote
	pollState, err = store.VotePoll(room.ID, pollMsg.ID, opt2, "Otavio")
	if err != nil {
		t.Fatalf("expected vote switch to succeed: %v", err)
	}
	if len(pollState.Options[0].VoterIDs) != 0 || len(pollState.Options[1].VoterIDs) != 1 {
		t.Errorf("expected single-select switch from opt1 to opt2, got %+v", pollState.Options)
	}

	// Close poll
	closedPoll, err := store.ClosePoll(room.ID, pollMsg.ID, "Otavio")
	if err != nil || !closedPoll.IsClosed {
		t.Fatalf("expected ClosePoll by creator to succeed: %v", err)
	}

	// Voting on closed poll must fail
	if _, err := store.VotePoll(room.ID, pollMsg.ID, opt1, "Pedro"); err == nil {
		t.Errorf("expected voting on closed poll to fail")
	}
}

func TestRoomStore_GroupAdminAndMembership(t *testing.T) {
	store := NewRoomStore()
	room := store.CreateRoom("Grupo Privado", "GRP-5050", true, []string{"Otavio", "Pedro"}, "Otavio")

	// Add new members
	updated, err := store.AddGroupMembers(room.ID, []string{"Raul", "Marina"}, "Otavio")
	if err != nil || len(updated.Members) != 4 {
		t.Fatalf("expected 4 members after AddGroupMembers, got %v (err=%v)", updated.Members, err)
	}

	// Non-admin cannot remove member
	if _, err := store.RemoveGroupMember(room.ID, "Marina", "Pedro"); err == nil {
		t.Errorf("expected non-admin RemoveGroupMember to fail")
	}

	// Promote Pedro to admin
	updated, err = store.ToggleGroupAdmin(room.ID, "Pedro", "Otavio")
	if err != nil || len(updated.Admins) != 2 {
		t.Fatalf("expected Pedro to be promoted to admin, got admins=%v (err=%v)", updated.Admins, err)
	}

	// Now Pedro (as admin) can remove Marina
	updated, err = store.RemoveGroupMember(room.ID, "Marina", "Pedro")
	if err != nil || len(updated.Members) != 3 {
		t.Fatalf("expected Pedro to remove Marina, got members=%v (err=%v)", updated.Members, err)
	}

	// Update group settings
	updated, err = store.UpdateGroupSettings(room.ID, "Grupo Oficial PORChat", "Descrição atualizada para testes", "Pedro")
	if err != nil || updated.Name != "Grupo Oficial PORChat" || updated.Description != "Descrição atualizada para testes" {
		t.Errorf("unexpected group settings after update: %+v (err=%v)", updated, err)
	}

	// Regenerate room code
	oldCode := updated.Code
	updated, err = store.RegenerateRoomCode(room.ID, "Otavio")
	if err != nil || updated.Code == "" || updated.Code == oldCode {
		t.Errorf("expected room code to regenerate from %s, got %s (err=%v)", oldCode, updated.Code, err)
	}

	// Leave room
	afterLeave, ok := store.LeaveRoom(room.ID, "Otavio")
	if !ok || len(afterLeave.Members) != 2 {
		t.Fatalf("expected Otavio to leave room cleanly, remaining members: %v", afterLeave.Members)
	}
}

func TestRoomStore_AttachmentsAndHTTPHandlers(t *testing.T) {
	store := NewRoomStore()
	handler := NewChatHandler(store)
	room := store.CreateRoom("Sala de Mídia", "MED-9000", true, []string{"Otavio", "Pedro"}, "Otavio")

	// Create a synthetic WAV header + PCM payload
	wavBytes := []byte("RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x44\xac\x00\x00\x88\x58\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00")
	b64Audio := base64.StdEncoding.EncodeToString(wavBytes)

	uploadBody, _ := json.Marshal(AttachmentUploadReq{
		Kind:            "audio",
		FileName:        "gravacao_teste.wav",
		MimeType:        "audio/wav",
		DataBase64:      b64Audio,
		DurationSeconds: 7,
		Waveform:        []int{20, 45, 80, 60, 95, 40, 30},
	})

	r := chi.NewRouter()
	r.Post("/api/rooms/{id}/attachments", handler.UploadAttachmentHTTP)
	r.Get("/api/attachments/{attId}", handler.ServeAttachmentHTTP)
	r.Post("/api/rooms/{id}/polls", handler.CreatePollHTTP)
	r.Post("/api/rooms/{id}/polls/{msgId}/vote", handler.VotePollHTTP)

	req := httptest.NewRequest(http.MethodPost, "/api/rooms/"+room.ID+"/attachments?user=Otavio", bytes.NewReader(uploadBody))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created on voice attachment upload, got %d: %s", rec.Code, rec.Body.String())
	}

	var createdMsg ChatMessage
	if err := json.Unmarshal(rec.Body.Bytes(), &createdMsg); err != nil {
		t.Fatalf("failed to unmarshal attachment message: %v", err)
	}
	if createdMsg.Type != "voice" || createdMsg.Attachment == nil {
		t.Fatalf("expected voice message with attachment metadata, got %+v", createdMsg)
	}
	if createdMsg.Attachment.SHA256 == "" || createdMsg.Attachment.DurationSeconds != 7 {
		t.Errorf("expected SHA-256 and duration=7s on attachment, got %+v", createdMsg.Attachment)
	}

	// Serve attachment binary and verify SHA-256 header
	getAttReq := httptest.NewRequest(http.MethodGet, "/api/attachments/"+createdMsg.Attachment.ID, nil)
	getAttRec := httptest.NewRecorder()
	r.ServeHTTP(getAttRec, getAttReq)

	if getAttRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK serving attachment, got %d", getAttRec.Code)
	}
	if getAttRec.Header().Get("X-Content-SHA256") != createdMsg.Attachment.SHA256 {
		t.Errorf("SHA-256 header mismatch")
	}
	if !bytes.Equal(getAttRec.Body.Bytes(), wavBytes) {
		t.Errorf("served binary bytes do not match uploaded audio bytes")
	}
}
