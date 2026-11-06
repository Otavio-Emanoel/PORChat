package auth

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var (
	JWTSecret      = []byte("porchat-dev-secret-key-super-secure")
	hexColorRegexp = regexp.MustCompile(`^#[0-9A-Fa-f]{6}$`)
)

type User struct {
	ID           string    `json:"id"`
	Nickname     string    `json:"nickname"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"password_hash,omitempty"`
	AvatarURL    string    `json:"avatar_url,omitempty"`
	AvatarColor  string    `json:"avatar_color,omitempty"`
	StatusText   string    `json:"status_text,omitempty"`
	Bio          string    `json:"bio,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at,omitempty"`
}

func (u *User) PublicCopy() *User {
	if u == nil {
		return nil
	}
	return &User{
		ID:          u.ID,
		Nickname:    u.Nickname,
		Email:       u.Email,
		AvatarURL:   u.AvatarURL,
		AvatarColor: u.AvatarColor,
		StatusText:  u.StatusText,
		Bio:         u.Bio,
		CreatedAt:   u.CreatedAt,
		UpdatedAt:   u.UpdatedAt,
	}
}

type Claims struct {
	UserID   string `json:"user_id"`
	Nickname string `json:"nickname"`
	Email    string `json:"email"`
	jwt.RegisteredClaims
}

type ProfileUpdateReq struct {
	Nickname    string `json:"nickname"`
	AvatarURL   string `json:"avatar_url"`
	AvatarColor string `json:"avatar_color"`
	StatusText  string `json:"status_text"`
	Bio         string `json:"bio"`
}

type ChangePasswordReq struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

type UserStore struct {
	mu         sync.RWMutex
	users      map[string]*User // by lowercase email
	byID       map[string]*User // by ID
	byNickname map[string]*User // by lowercase nickname
}

func NewUserStore() *UserStore {
	store := &UserStore{
		users:      make(map[string]*User),
		byID:       make(map[string]*User),
		byNickname: make(map[string]*User),
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
	if s.byNickname == nil {
		s.byNickname = make(map[string]*User)
	}
	for _, u := range usersList {
		if u.AvatarColor == "" {
			u.AvatarColor = "#6C5CE7"
		}
		if u.StatusText == "" {
			u.StatusText = "Disponível no PORChat"
		}
		s.users[strings.ToLower(u.Email)] = u
		s.byID[u.ID] = u
		s.byNickname[strings.ToLower(u.Nickname)] = u
	}
	return len(usersList) > 0
}

func (s *UserStore) seedUsers() {
	pass, _ := HashPassword("123456")
	now := time.Now()
	demoUsers := []*User{
		{
			ID:           "11111111-1111-1111-1111-111111111111",
			Nickname:     "Otavio",
			Email:        "otavio@porchat.app",
			PasswordHash: pass,
			AvatarColor:  "#6C5CE7",
			StatusText:   "Pronto para o próximo debate",
			Bio:          "Co-fundador do PORChat e entusiasta de sistemas distribuídos em Go.",
			CreatedAt:    now,
			UpdatedAt:    now,
		},
		{
			ID:           "22222222-2222-2222-2222-222222222222",
			Nickname:     "Pedro",
			Email:        "pedro@porchat.app",
			PasswordHash: pass,
			AvatarColor:  "#00CEC9",
			StatusText:   "Online no controle mobile",
			Bio:          "Co-fundador do PORChat e especialista em experiências mobile.",
			CreatedAt:    now,
			UpdatedAt:    now,
		},
		{
			ID:           "33333333-3333-3333-3333-333333333333",
			Nickname:     "Raul",
			Email:        "raul@porchat.app",
			PasswordHash: pass,
			AvatarColor:  "#FF7675",
			StatusText:   "No comando do Modo TV",
			Bio:          "Co-fundador do PORChat e arquiteto do Modo TV e Quiz Relâmpago.",
			CreatedAt:    now,
			UpdatedAt:    now,
		},
	}
	if s.byNickname == nil {
		s.byNickname = make(map[string]*User)
	}
	for _, u := range demoUsers {
		s.users[strings.ToLower(u.Email)] = u
		s.byID[u.ID] = u
		s.byNickname[strings.ToLower(u.Nickname)] = u
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
	return GenerateJWTAt(user, time.Now())
}

func GenerateJWTAt(user *User, issuedAt time.Time) (string, error) {
	claims := Claims{
		UserID:   user.ID,
		Nickname: user.Nickname,
		Email:    user.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(issuedAt.Add(72 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(issuedAt),
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

	emailNorm := strings.ToLower(strings.TrimSpace(email))
	cleanNick := strings.TrimSpace(nickname)
	if cleanNick == "" || len(cleanNick) > 40 {
		return nil, errors.New("nickname must be between 1 and 40 characters")
	}
	if _, exists := s.users[emailNorm]; exists {
		return nil, errors.New("email already in use")
	}

	hash, err := HashPassword(password)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	u := &User{
		ID:           uuid.New().String(),
		Nickname:     cleanNick,
		Email:        emailNorm,
		PasswordHash: hash,
		AvatarColor:  "#6C5CE7",
		StatusText:   "Disponível no PORChat",
		Bio:          "",
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	s.users[emailNorm] = u
	s.byID[u.ID] = u
	if s.byNickname == nil {
		s.byNickname = make(map[string]*User)
	}
	s.byNickname[strings.ToLower(cleanNick)] = u
	go func() { _ = s.SaveToDisk("data/user_store.json") }()
	return u, nil
}

func (s *UserStore) GetByEmail(email string) (*User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	u, ok := s.users[strings.ToLower(strings.TrimSpace(email))]
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

func (s *UserStore) GetByNickname(nickname string) (*User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	u, ok := s.byNickname[strings.ToLower(strings.TrimSpace(nickname))]
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
		list = append(list, u.PublicCopy())
	}
	sort.Slice(list, func(i, j int) bool {
		return strings.ToLower(list[i].Nickname) < strings.ToLower(list[j].Nickname)
	})
	return list
}

func (s *UserStore) SearchUsers(query string, excludeUserID string) []*User {
	s.mu.RLock()
	defer s.mu.RUnlock()

	q := strings.ToLower(strings.TrimSpace(query))
	results := make([]*User, 0)
	for _, u := range s.byID {
		if excludeUserID != "" && u.ID == excludeUserID {
			continue
		}
		if q == "" ||
			strings.Contains(strings.ToLower(u.Nickname), q) ||
			strings.Contains(strings.ToLower(u.Email), q) ||
			strings.Contains(strings.ToLower(u.StatusText), q) ||
			strings.Contains(strings.ToLower(u.Bio), q) {
			results = append(results, u.PublicCopy())
		}
	}

	sort.Slice(results, func(i, j int) bool {
		return strings.ToLower(results[i].Nickname) < strings.ToLower(results[j].Nickname)
	})
	return results
}

func (s *UserStore) GetOrCreateUser(nickname string) *User {
	s.mu.Lock()
	defer s.mu.Unlock()

	clean := strings.TrimSpace(nickname)
	if clean == "" {
		clean = "Player"
	}
	lower := strings.ToLower(clean)
	if u, exists := s.byNickname[lower]; exists {
		return u.PublicCopy()
	}

	newID := uuid.New().String()
	email := lower + "@porchat.app"
	newUser := &User{
		ID:          newID,
		Nickname:    clean,
		Email:       email,
		AvatarColor: "#6C5CE7",
		StatusText:  "Disponível no PORChat",
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	s.byID[newID] = newUser
	s.byNickname[lower] = newUser
	s.users[email] = newUser
	go func() { _ = s.SaveToDisk("data/user_store.json") }()
	return newUser.PublicCopy()
}

func (s *UserStore) UpdateProfile(userID string, req ProfileUpdateReq) (*User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	u, exists := s.byID[userID]
	if !exists {
		return nil, errors.New("user not found")
	}

	if req.Nickname != "" {
		if s.byNickname == nil {
			s.byNickname = make(map[string]*User)
		}
		cleanNick := strings.TrimSpace(req.Nickname)
		if len(cleanNick) < 2 || len(cleanNick) > 40 {
			return nil, errors.New("nickname must be between 2 and 40 characters")
		}
		if existing, taken := s.byNickname[strings.ToLower(cleanNick)]; taken && existing.ID != userID {
			return nil, errors.New("nickname already in use")
		}
		delete(s.byNickname, strings.ToLower(u.Nickname))
		u.Nickname = cleanNick
		s.byNickname[strings.ToLower(cleanNick)] = u
	}

	if req.AvatarURL != "" {
		cleanURL := strings.TrimSpace(req.AvatarURL)
		if strings.EqualFold(cleanURL, "clear") || cleanURL == "none" {
			u.AvatarURL = ""
		} else {
			if len(cleanURL) > 500 {
				cleanURL = cleanURL[:500]
			}
			u.AvatarURL = cleanURL
		}
	}

	if req.AvatarColor != "" {
		cleanColor := strings.TrimSpace(req.AvatarColor)
		if !hexColorRegexp.MatchString(cleanColor) {
			return nil, errors.New("invalid hex color format")
		}
		u.AvatarColor = cleanColor
	}

	if req.StatusText != "" {
		cleanStatus := strings.TrimSpace(req.StatusText)
		if len(cleanStatus) > 120 {
			cleanStatus = cleanStatus[:120]
		}
		u.StatusText = cleanStatus
	}

	if req.Bio != "" {
		cleanBio := strings.TrimSpace(req.Bio)
		if len(cleanBio) > 300 {
			cleanBio = cleanBio[:300]
		}
		u.Bio = cleanBio
	}

	u.UpdatedAt = time.Now()
	copyUser := u.PublicCopy()
	go func() { _ = s.SaveToDisk("data/user_store.json") }()
	return copyUser, nil
}

func (s *UserStore) ChangePassword(userID, currentPassword, newPassword string) (*User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	u, exists := s.byID[userID]
	if !exists {
		return nil, errors.New("user not found")
	}

	if !CheckPasswordHash(currentPassword, u.PasswordHash) {
		return nil, errors.New("current password is incorrect")
	}

	if len(strings.TrimSpace(newPassword)) < 6 {
		return nil, errors.New("new password must have at least 6 characters")
	}

	if currentPassword == newPassword {
		return nil, errors.New("new password must differ from current password")
	}

	newHash, err := HashPassword(newPassword)
	if err != nil {
		return nil, err
	}

	u.PasswordHash = newHash
	u.UpdatedAt = time.Now()
	copyUser := u.PublicCopy()
	go func() { _ = s.SaveToDisk("data/user_store.json") }()
	return copyUser, nil
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

func (h *AuthHandler) AuthenticateRequest(r *http.Request) (*Claims, string, error) {
	authHeader := r.Header.Get("Authorization")
	parts := strings.Split(authHeader, "Bearer ")
	if len(parts) != 2 {
		return nil, "", errors.New("unauthorized")
	}
	tokenStr := strings.TrimSpace(parts[1])
	if tokenStr == "" {
		return nil, "", errors.New("unauthorized")
	}

	if h.Blacklist.IsTokenRevoked(tokenStr) {
		return nil, "", errors.New("token has been revoked")
	}

	claims, err := ValidateJWT(tokenStr)
	if err != nil {
		return nil, "", errors.New("invalid token")
	}

	if claims.IssuedAt != nil && !h.Blacklist.IsUserTokenValid(claims.UserID, claims.IssuedAt.Time) {
		return nil, "", errors.New("session invalidated by security policy")
	}

	return claims, tokenStr, nil
}

func (h *AuthHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	users := h.Store.ListUsers()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(users)
}

func (h *AuthHandler) SearchUsers(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	excludeID := ""
	if claims, _, err := h.AuthenticateRequest(r); err == nil {
		excludeID = claims.UserID
	}
	results := h.Store.SearchUsers(query, excludeID)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(results)
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
	_ = json.NewEncoder(w).Encode(AuthRes{User: user.PublicCopy(), Token: token})
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
	_ = json.NewEncoder(w).Encode(AuthRes{User: user.PublicCopy(), Token: token})
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
	claims, _, err := h.AuthenticateRequest(r)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusUnauthorized)
		return
	}

	user, err := h.Store.GetByID(claims.UserID)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(user.PublicCopy())
}

func (h *AuthHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	var targetUserID string
	claims, _, err := h.AuthenticateRequest(r)
	if err == nil && claims != nil && claims.UserID != "" {
		targetUserID = claims.UserID
	} else {
		userQuery := strings.TrimSpace(r.URL.Query().Get("user"))
		if userQuery != "" {
			u := h.Store.GetOrCreateUser(userQuery)
			if u != nil {
				targetUserID = u.ID
			}
		}
	}

	if targetUserID == "" {
		http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
		return
	}

	var req ProfileUpdateReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid payload"}`, http.StatusBadRequest)
		return
	}

	updatedUser, err := h.Store.UpdateProfile(targetUserID, req)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	newToken, _ := GenerateJWT(updatedUser)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(AuthRes{
		User:  updatedUser,
		Token: newToken,
	})
}

func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	claims, tokenStr, err := h.AuthenticateRequest(r)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusUnauthorized)
		return
	}

	var req ChangePasswordReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid payload"}`, http.StatusBadRequest)
		return
	}

	updatedUser, err := h.Store.ChangePassword(claims.UserID, req.CurrentPassword, req.NewPassword)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	// Revoke old tokens and issue a fresh token post-cutoff
	if claims.ExpiresAt != nil {
		h.Blacklist.RevokeToken(tokenStr, claims.ExpiresAt.Time)
	}
	h.Blacklist.RevokeAllUserTokens(claims.UserID)

	newToken, _ := GenerateJWTAt(updatedUser, time.Now().Add(2*time.Second))
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(AuthRes{
		User:  updatedUser,
		Token: newToken,
	})
}

func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	claims, oldToken, err := h.AuthenticateRequest(r)
	if err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusUnauthorized)
		return
	}

	user, err := h.Store.GetByID(claims.UserID)
	if err != nil {
		http.Error(w, `{"error":"user not found"}`, http.StatusNotFound)
		return
	}

	if claims.ExpiresAt != nil {
		h.Blacklist.RevokeToken(oldToken, claims.ExpiresAt.Time)
	}

	newToken, _ := GenerateJWTAt(user, time.Now().Add(1*time.Second))
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(AuthRes{
		User:  user.PublicCopy(),
		Token: newToken,
	})
}
