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
	"github.com/porchat/api/internal/ws"
)

func main() {
	startTime := time.Now()

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

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	// Security Headers Middleware
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "SAMEORIGIN")
			w.Header().Set("X-XSS-Protection", "1; mode=block")
			next.ServeHTTP(w, r)
		})
	})

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
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

	// Auth & Users routes
	r.Route("/api/auth", func(r chi.Router) {
		r.Post("/register", authHandler.Register)
		r.Post("/login", authHandler.Login)
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
