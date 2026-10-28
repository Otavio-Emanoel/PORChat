package auth

import (
	"os"
	"path/filepath"
	"testing"
)

func TestHashAndCheckPassword(t *testing.T) {
	raw := "supersecret123"
	hash, err := HashPassword(raw)
	if err != nil {
		t.Fatalf("Failed to hash password: %v", err)
	}

	if !CheckPasswordHash(raw, hash) {
		t.Errorf("Password check failed for correct password")
	}

	if CheckPasswordHash("wrongpassword", hash) {
		t.Errorf("Password check passed for incorrect password")
	}
}

func TestJWTTokenGenerationAndValidation(t *testing.T) {
	u := &User{
		ID:       "test-user-id",
		Nickname: "Tester",
		Email:    "test@porchat.app",
	}

	token, err := GenerateJWT(u)
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}
	if token == "" {
		t.Fatalf("Generated token is empty")
	}

	claims, err := ValidateJWT(token)
	if err != nil {
		t.Fatalf("Failed to validate valid token: %v", err)
	}

	if claims.UserID != u.ID {
		t.Errorf("Expected UserID %s, got %s", u.ID, claims.UserID)
	}
	if claims.Nickname != u.Nickname {
		t.Errorf("Expected Nickname %s, got %s", u.Nickname, claims.Nickname)
	}

	// Validate bogus token
	_, err = ValidateJWT("invalid.jwt.token")
	if err == nil {
		t.Errorf("Expected error for bogus token, got nil")
	}
}

func TestUserStore_CreateAndLookup(t *testing.T) {
	store := &UserStore{
		users: make(map[string]*User),
		byID:  make(map[string]*User),
	}

	u, err := store.CreateUser("Otavio", "otavio.test@porchat.app", "pass123")
	if err != nil {
		t.Fatalf("CreateUser failed: %v", err)
	}

	if u.Nickname != "Otavio" {
		t.Errorf("Expected nickname Otavio, got %s", u.Nickname)
	}

	foundByEmail, err := store.GetByEmail("OTAVIO.TEST@porchat.app")
	if err != nil {
		t.Fatalf("GetByEmail failed: %v", err)
	}
	if foundByEmail.ID != u.ID {
		t.Errorf("ID mismatch: %s != %s", foundByEmail.ID, u.ID)
	}

	foundByID, err := store.GetByID(u.ID)
	if err != nil {
		t.Fatalf("GetByID failed: %v", err)
	}
	if foundByID.Email != "otavio.test@porchat.app" {
		t.Errorf("Email mismatch: %s", foundByID.Email)
	}

	users := store.ListUsers()
	if len(users) != 1 {
		t.Errorf("Expected 1 user in store, got %d", len(users))
	}
}

func TestUserStore_DuplicateEmail(t *testing.T) {
	store := &UserStore{
		users: make(map[string]*User),
		byID:  make(map[string]*User),
	}

	_, err := store.CreateUser("User1", "dup@porchat.app", "123456")
	if err != nil {
		t.Fatalf("Initial creation failed: %v", err)
	}

	_, err = store.CreateUser("User2", "DUP@porchat.app", "abcdef")
	if err == nil {
		t.Errorf("Expected duplicate email error, got nil")
	}
}

func TestUserStore_PersistenceRoundtrip(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "test_users.json")

	store1 := &UserStore{
		users: make(map[string]*User),
		byID:  make(map[string]*User),
	}

	u, err := store1.CreateUser("PersistedUser", "persist@porchat.app", "pass123")
	if err != nil {
		t.Fatalf("Failed to create user: %v", err)
	}

	if err := store1.SaveToDisk(filePath); err != nil {
		t.Fatalf("Failed to save to disk: %v", err)
	}

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		t.Fatalf("Persisted file does not exist at %s", filePath)
	}

	store2 := &UserStore{
		users: make(map[string]*User),
		byID:  make(map[string]*User),
	}

	if loaded := store2.LoadFromDisk(filePath); !loaded {
		t.Fatalf("LoadFromDisk returned false")
	}

	loadedUser, err := store2.GetByID(u.ID)
	if err != nil {
		t.Fatalf("Loaded user not found: %v", err)
	}
	if loadedUser.Nickname != "PersistedUser" {
		t.Errorf("Expected PersistedUser, got %s", loadedUser.Nickname)
	}
}
