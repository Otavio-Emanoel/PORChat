package main

import (
	"context"
	"encoding/json"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/porchat/api/internal/auth"
	"github.com/porchat/api/internal/chat"
	"github.com/porchat/api/internal/game"
	"github.com/porchat/api/internal/security"
	"github.com/porchat/api/internal/ws"
)

func main() {
	startTime := time.Now()

	auditLogger := security.NewAuditLogger(1000, true)
	defer auditLogger.Close()

	originValidator := security.NewOriginValidator()
	httpLimiter := security.NewRateLimiter(60.0, 120.0, 10*time.Minute)
	defer httpLimiter.Close()

	authLimiter := security.NewRateLimiter(5.0, 10.0, 5*time.Minute)
	defer authLimiter.Close()

	userStore := auth.NewUserStore()
	authHandler := auth.NewAuthHandler(userStore)

	roomStore := chat.NewRoomStore()
	chatHandler := chat.NewChatHandler(roomStore)

	hub := ws.NewHub(roomStore)
	go hub.Run()

	gameManager := game.NewManager(hub, roomStore)
	hub.SetEngineGetter(func(roomID string) ws.GameEngine {
		return gameManager.GetEngine(roomID)
	})

	wsHandler := ws.NewWSHandler(hub, userStore)
	wsHandler.AuditLogger = auditLogger
	wsHandler.OriginValidator = originValidator

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	// Global HTTP Rate Limiting
	r.Use(security.HTTPRateLimitMiddleware(httpLimiter))

	// CSRF / CSWSH Origin Validation for state-changing endpoints
	r.Use(originValidator.OriginMiddleware)

	// Hardened Security Headers Middleware
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("X-XSS-Protection", "1; mode=block")
			w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
			w.Header().Set("Permissions-Policy", "camera=(), microphone=(self), geolocation=()")
			next.ServeHTTP(w, r)
		})
	})

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3001", "http://127.0.0.1:3001", "http://localhost:8082", "http://127.0.0.1:8082", "http://localhost:8081", "https://porchat.app"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link", "Retry-After"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok","app":"PORChat API"}`))
	})

	// System metrics & stats
	r.Get("/api/system/stats", func(w http.ResponseWriter, r *http.Request) {
		stats := hub.GetStats()
		stats["uptime_seconds"] = int64(time.Since(startTime).Seconds())
		stats["total_registered_users"] = len(userStore.ListUsers())
		stats["total_rooms"] = len(roomStore.GetAllRooms())
		stats["status"] = "healthy"
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(stats)
	})

	// Security audit log queries
	r.Get("/api/system/audit", func(w http.ResponseWriter, r *http.Request) {
		events := auditLogger.GetEvents(50, "")
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(events)
	})

	// Auth & Users routes with brute-force defense
	r.Route("/api/auth", func(r chi.Router) {
		r.Use(security.CustomRateLimitMiddleware(authLimiter, "auth"))
		r.Post("/register", authHandler.Register)
		r.Post("/login", authHandler.Login)
		r.Post("/logout", authHandler.Logout)
		r.Get("/me", authHandler.Me)
	})
	r.Get("/api/users", authHandler.ListUsers)

	// Rooms & Chat routes
	r.Route("/api/rooms", func(r chi.Router) {
		r.Get("/", chatHandler.ListRooms)
		r.Post("/", chatHandler.CreateRoom)
		r.Post("/join", chatHandler.JoinRoom)
		r.Get("/code/{code}", chatHandler.GetRoomByCode)
		r.Get("/{id}", chatHandler.GetRoom)
		r.Delete("/{id}", func(w http.ResponseWriter, r *http.Request) {
			roomID := chi.URLParam(r, "id")
			chatHandler.DeleteRoom(w, r)
			hub.BroadcastRoomDeleted(roomID)
			auditLogger.Log(security.EventRoomDelete, security.SeverityWarn, security.ExtractClientIP(r), "", roomID, "Room deleted via API", nil)
		})
		r.Get("/{id}/messages", chatHandler.GetMessages)
	})

	// WebSocket route
	r.Get("/ws", wsHandler.ServeWS)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}
	if !strings.HasPrefix(port, ":") {
		port = ":" + port
	}

	listener, err := net.Listen("tcp", port)
	if err != nil {
		log.Printf("Port %s busy (%v), trying fallback :8088...", port, err)
		port = ":8088"
		listener, err = net.Listen("tcp", port)
		if err != nil {
			log.Fatalf("Server failed to bind: %v", err)
		}
	}

	srv := &http.Server{
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("🚀 PORChat API running at http://localhost%s", port)
		if err := srv.Serve(listener); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	<-stop
	log.Println("Shutting down PORChat API gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Graceful shutdown failed: %v", err)
	}
	log.Println("PORChat API stopped cleanly.")
}
