package auth

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestUserStore_UpdateProfileAndValidation(t *testing.T) {
	store := NewUserStore()
	u, err := store.CreateUser("Marina", "marina@porchat.app", "secret123")
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// Valid profile update
	updated, err := store.UpdateProfile(u.ID, ProfileUpdateReq{
		Nickname:    "Marina Costa",
		AvatarColor: "#00CEC9",
		StatusText:  "Online e pronta para jogar",
		Bio:         "Engenheira de software e campeã do Quiz Relâmpago.",
	})
	if err != nil {
		t.Fatalf("expected valid profile update, got error: %v", err)
	}
	if updated.Nickname != "Marina Costa" {
		t.Errorf("expected nickname 'Marina Costa', got '%s'", updated.Nickname)
	}
	if updated.AvatarColor != "#00CEC9" {
		t.Errorf("expected avatar color '#00CEC9', got '%s'", updated.AvatarColor)
	}
	if updated.StatusText != "Online e pronta para jogar" {
		t.Errorf("expected status text, got '%s'", updated.StatusText)
	}
	if updated.Bio != "Engenheira de software e campeã do Quiz Relâmpago." {
		t.Errorf("expected bio, got '%s'", updated.Bio)
	}
	if updated.PasswordHash != "" {
		t.Errorf("PublicCopy must strip PasswordHash, got non-empty hash")
	}

	// Verify lookup by new nickname works and old nickname is removed
	if _, err := store.GetByNickname("Marina Costa"); err != nil {
		t.Errorf("expected lookup by new nickname to succeed: %v", err)
	}
	if _, err := store.GetByNickname("Marina"); err == nil {
		t.Errorf("expected lookup by old nickname to fail")
	}

	// Invalid hex color should fail
	_, err = store.UpdateProfile(u.ID, ProfileUpdateReq{
		AvatarColor: "not-a-color",
	})
	if err == nil {
		t.Errorf("expected invalid hex color to return error")
	}

	// Duplicate nickname collision should fail
	_, _ = store.CreateUser("Carlos", "carlos@porchat.app", "secret123")
	_, err = store.UpdateProfile(u.ID, ProfileUpdateReq{
		Nickname: "Carlos",
	})
	if err == nil {
		t.Errorf("expected duplicate nickname to return error")
	}
}

func TestUserStore_ChangePasswordAndSearch(t *testing.T) {
	store := NewUserStore()
	u, err := store.CreateUser("Rafael", "rafael@porchat.app", "initialPass")
	if err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	// Wrong current password must fail
	if _, err := store.ChangePassword(u.ID, "wrongPass", "newPass123"); err == nil {
		t.Errorf("expected wrong current password to fail")
	}

	// Too short password must fail
	if _, err := store.ChangePassword(u.ID, "initialPass", "123"); err == nil {
		t.Errorf("expected short new password to fail")
	}

	// Same password must fail
	if _, err := store.ChangePassword(u.ID, "initialPass", "initialPass"); err == nil {
		t.Errorf("expected identical new password to fail")
	}

	// Valid password rotation
	if _, err := store.ChangePassword(u.ID, "initialPass", "newStrongPass99"); err != nil {
		t.Fatalf("expected valid password rotation to succeed: %v", err)
	}

	stored, _ := store.GetByID(u.ID)
	if !CheckPasswordHash("newStrongPass99", stored.PasswordHash) {
		t.Errorf("expected new password hash to validate")
	}

	// Search users by query and exclusion
	results := store.SearchUsers("rafael", "")
	if len(results) == 0 {
		t.Errorf("expected search for 'rafael' to return at least 1 user")
	}
	excluded := store.SearchUsers("rafael", u.ID)
	for _, item := range excluded {
		if item.ID == u.ID {
			t.Errorf("expected excluded user ID %s not to appear in search results", u.ID)
		}
	}
}

func TestAuthHandler_ProfilePasswordAndRefreshHTTP(t *testing.T) {
	store := NewUserStore()
	handler := NewAuthHandler(store)

	// 1. Register user via HTTP
	regBody, _ := json.Marshal(RegisterReq{
		Nickname: "Helena",
		Email:    "helena@porchat.app",
		Password: "password123",
	})
	regReq := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewReader(regBody))
	regRec := httptest.NewRecorder()
	handler.Register(regRec, regReq)

	if regRec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", regRec.Code, regRec.Body.String())
	}

	var authRes AuthRes
	if err := json.Unmarshal(regRec.Body.Bytes(), &authRes); err != nil {
		t.Fatalf("failed to decode register response: %v", err)
	}
	initialToken := authRes.Token

	// 2. Update profile via HTTP PUT /api/auth/profile
	profBody, _ := json.Marshal(ProfileUpdateReq{
		Nickname:    "Helena Silva",
		AvatarColor: "#FF7675",
		StatusText:  "Debatedora Oficial",
		Bio:         "Especialista em argumentação lógica.",
	})
	profReq := httptest.NewRequest(http.MethodPut, "/api/auth/profile", bytes.NewReader(profBody))
	profReq.Header.Set("Authorization", "Bearer "+initialToken)
	profRec := httptest.NewRecorder()
	handler.UpdateProfile(profRec, profReq)

	if profRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on UpdateProfile, got %d: %s", profRec.Code, profRec.Body.String())
	}

	var profRes AuthRes
	_ = json.Unmarshal(profRec.Body.Bytes(), &profRes)
	if profRes.User.Nickname != "Helena Silva" || profRes.User.AvatarColor != "#FF7675" {
		t.Errorf("unexpected updated profile payload: %+v", profRes.User)
	}

	// 3. Change password via HTTP PUT /api/auth/password and verify old token is revoked
	pwdBody, _ := json.Marshal(ChangePasswordReq{
		CurrentPassword: "password123",
		NewPassword:     "rotatedPassword456",
	})
	pwdReq := httptest.NewRequest(http.MethodPut, "/api/auth/password", bytes.NewReader(pwdBody))
	pwdReq.Header.Set("Authorization", "Bearer "+initialToken)
	pwdRec := httptest.NewRecorder()
	handler.ChangePassword(pwdRec, pwdReq)

	if pwdRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on ChangePassword, got %d: %s", pwdRec.Code, pwdRec.Body.String())
	}

	var pwdRes AuthRes
	_ = json.Unmarshal(pwdRec.Body.Bytes(), &pwdRes)
	if pwdRes.Token == "" {
		t.Fatalf("expected new JWT token after password rotation")
	}

	// Old token must be rejected on /api/auth/me
	meOldReq := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	meOldReq.Header.Set("Authorization", "Bearer "+initialToken)
	meOldRec := httptest.NewRecorder()
	handler.Me(meOldRec, meOldReq)
	if meOldRec.Code != http.StatusUnauthorized {
		t.Errorf("expected old token to return 401 after password rotation, got %d", meOldRec.Code)
	}

	// New token must succeed on /api/auth/me
	meNewReq := httptest.NewRequest(http.MethodGet, "/api/auth/me", nil)
	meNewReq.Header.Set("Authorization", "Bearer "+pwdRes.Token)
	meNewRec := httptest.NewRecorder()
	handler.Me(meNewRec, meNewReq)
	if meNewRec.Code != http.StatusOK {
		t.Errorf("expected rotated token to succeed on /api/auth/me, got %d: %s", meNewRec.Code, meNewRec.Body.String())
	}

	// 4. Refresh token via POST /api/auth/refresh
	refReq := httptest.NewRequest(http.MethodPost, "/api/auth/refresh", nil)
	refReq.Header.Set("Authorization", "Bearer "+pwdRes.Token)
	refRec := httptest.NewRecorder()
	handler.RefreshToken(refRec, refReq)
	if refRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on RefreshToken, got %d", refRec.Code)
	}

	// 5. Search users via GET /api/users/search?q=Helena
	searchReq := httptest.NewRequest(http.MethodGet, "/api/users/search?q=Helena", nil)
	searchRec := httptest.NewRecorder()
	handler.SearchUsers(searchRec, searchReq)
	if searchRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on SearchUsers, got %d", searchRec.Code)
	}
	var found []*User
	_ = json.Unmarshal(searchRec.Body.Bytes(), &found)
	if len(found) == 0 || found[0].Nickname != "Helena Silva" {
		t.Errorf("expected to find 'Helena Silva' in search results, got %+v", found)
	}
}
