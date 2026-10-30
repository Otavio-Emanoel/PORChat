package auth

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var (
	JWTSecret = []byte("porchat-dev-secret-key-super-secure")
)

type User struct {
	ID           string    `json:"id"`
	Nickname     string    `json:"nickname"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"password_hash,omitempty"`
	AvatarURL    string    `json:"avatar_url,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

type Claims struct {
	UserID   string `json:"user_id"`
	Nickname string `json:"nickname"`
	Email    string `json:"email"`
	jwt.RegisteredClaims
}

type UserStore struct {
	mu    sync.RWMutex
	users map[string]*User // by email
	byID  map[string]*User // by ID
}

func NewUserStore() *UserStore {
	store := &UserStore{
		users: make(map[string]*User),
		byID:  make(map[string]*User),
	}
	if !store.LoadFromDisk("data/user_store.json") {
		store.seedUsers()
	}
	return store
}

func (s *UserStore) SaveToDisk(filePath string) error {
	s.mu.RLock()
	defer s.mu.RUnlock()

	usersList := make([]*User, 0, len(s.users))
	for _, u := range s.users {
		usersList = append(usersList, u)
	}

	bytes, err := json.MarshalIndent(usersList, "", "  ")
	if err != nil {
		return err
	}

	_ = os.MkdirAll(filepath.Dir(filePath), 0755)
	tmpPath := filePath + ".tmp"
	if err := os.WriteFile(tmpPath, bytes, 0644); err != nil {
		return err
	}
	return os.Rename(tmpPath, filePath)
}

func (s *UserStore) LoadFromDisk(filePath string) bool {
	bytes, err := os.ReadFile(filePath)
	if err != nil {
		return false
	}

	var usersList []*User
	if err := json.Unmarshal(bytes, &usersList); err != nil {
		return false
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	for _, u := range usersList {
		s.users[strings.ToLower(u.Email)] = u
		s.byID[u.ID] = u
	}
	return len(usersList) > 0
}

func (s *UserStore) seedUsers() {
	pass, _ := HashPassword("123456")
	demoUsers := []*User{
		{ID: "11111111-1111-1111-1111-111111111111", Nickname: "Otavio", Email: "otavio@porchat.app", PasswordHash: pass, CreatedAt: time.Now()},
		{ID: "22222222-2222-2222-2222-222222222222", Nickname: "Pedro", Email: "pedro@porchat.app", PasswordHash: pass, CreatedAt: time.Now()},
		{ID: "33333333-3333-3333-3333-333333333333", Nickname: "Raul", Email: "raul@porchat.app", PasswordHash: pass, CreatedAt: time.Now()},
	}
	for _, u := range demoUsers {
		s.users[strings.ToLower(u.Email)] = u
		s.byID[u.ID] = u
	}
}

func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

func GenerateJWT(user *User) (string, error) {
	claims := Claims{
		UserID:   user.ID,
		Nickname: user.Nickname,
		Email:    user.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(72 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "porchat",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(JWTSecret)
}

func ValidateJWT(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("invalid signing method")
		}
		return JWTSecret, nil
	})
	if err != nil {
		return nil, err
	}
	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}
	return nil, errors.New("invalid token")
}

func (s *UserStore) CreateUser(nickname, email, password string) (*User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	emailNorm := strings.ToLower(email)
	if _, exists := s.users[emailNorm]; exists {
		return nil, errors.New("email already in use")
	}

	hash, err := HashPassword(password)
	if err != nil {
		return nil, err
	}

	u := &User{
		ID:           uuid.New().String(),
		Nickname:     nickname,
		Email:        emailNorm,
		PasswordHash: hash,
		CreatedAt:    time.Now(),
	}
	s.users[emailNorm] = u
	s.byID[u.ID] = u
	go func() { _ = s.SaveToDisk("data/user_store.json") }()
	return u, nil
}

func (s *UserStore) GetByEmail(email string) (*User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	u, ok := s.users[strings.ToLower(email)]
	if !ok {
		return nil, errors.New("user not found")
	}
	return u, nil
}

func (s *UserStore) GetByID(id string) (*User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	u, ok := s.byID[id]
	if !ok {
		return nil, errors.New("user not found")
	}
	return u, nil
}

func (s *UserStore) ListUsers() []*User {
	s.mu.RLock()
	defer s.mu.RUnlock()
	list := make([]*User, 0, len(s.byID))
	for _, u := range s.byID {
		list = append(list, u)
	}
	return list
}

type AuthHandler struct {
	Store     *UserStore
	Blacklist *TokenBlacklist
	Tracker   *LoginAttemptsTracker
}

func NewAuthHandler(store *UserStore) *AuthHandler {
	return &AuthHandler{
		Store:     store,
		Blacklist: NewTokenBlacklist(),
		Tracker:   NewLoginAttemptsTracker(5, 5*time.Minute, 15*time.Minute),
	}
}

func (h *AuthHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	users := h.Store.ListUsers()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(users)
}

type RegisterReq struct {
	Nickname string `json:"nickname"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthRes struct {
	User  *User  `json:"user"`
	Token string `json:"token"`
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid payload"}`, http.StatusBadRequest)
		return
	}
	if req.Nickname == "" || req.Email == "" || req.Password == "" {
		http.Error(w, `{"error":"missing required fields"}`, http.StatusBadRequest)
		return
	}

	user, err := h.Store.CreateUser(req.Nickname, req.Email, req.Password)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusConflict)
		return
	}

	token, _ := GenerateJWT(user)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(AuthRes{User: user, Token: token})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid payload"}`, http.StatusBadRequest)
		return
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(req.Email))

	// Check brute-force lockout
	if locked, remaining := h.Tracker.IsLocked(cleanEmail); locked {
		w.Header().Set("Retry-After", fmt.Sprintf("%d", int(remaining.Seconds())))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		_, _ = w.Write([]byte(fmt.Sprintf(`{"error":"Account temporarily locked due to excessive failed attempts. Please retry in %d seconds."}`, int(remaining.Seconds()))))
		return
	}

	user, err := h.Store.GetByEmail(cleanEmail)
	if err != nil || !CheckPasswordHash(req.Password, user.PasswordHash) {
		locked, duration := h.Tracker.RecordFailure(cleanEmail)
		if locked {
			w.Header().Set("Retry-After", fmt.Sprintf("%d", int(duration.Seconds())))
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte(`{"error":"Too many failed attempts. Account locked for 15 minutes."}`))
			return
		}

		http.Error(w, `{"error":"invalid email or password"}`, http.StatusUnauthorized)
		return
	}

	// Login successful: reset failed attempt counter
	h.Tracker.RecordSuccess(cleanEmail)

	token, _ := GenerateJWT(user)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(AuthRes{User: user, Token: token})
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	parts := strings.Split(authHeader, "Bearer ")
	if len(parts) == 2 {
		tokenStr := strings.TrimSpace(parts[1])
		if claims, err := ValidateJWT(tokenStr); err == nil {
			exp := time.Now().Add(24 * time.Hour)
			if claims.ExpiresAt != nil {
				exp = claims.ExpiresAt.Time
			}
			h.Blacklist.RevokeToken(tokenStr, exp)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"message":"logged out successfully"}`))
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	parts := strings.Split(authHeader, "Bearer ")
	if len(parts) != 2 {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}
	tokenStr := strings.TrimSpace(parts[1])

	// Check token revocation
	if h.Blacklist.IsTokenRevoked(tokenStr) {
		http.Error(w, `{"error":"token has been revoked"}`, http.StatusUnauthorized)
		return
	}

	claims, err := ValidateJWT(tokenStr)
	if err != nil {
		http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
		return
	}

	if claims.IssuedAt != nil && !h.Blacklist.IsUserTokenValid(claims.UserID, claims.IssuedAt.Time) {
		http.Error(w, `{"error":"session invalidated by security policy"}`, http.StatusUnauthorized)
		return
	}

	user, err := h.Store.GetByID(claims.UserID)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(user)
}
