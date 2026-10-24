package main

import (
	"log"
	"net"
	"net/http"
	"os"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/porchat/api/internal/auth"
	"github.com/porchat/api/internal/chat"
	"github.com/porchat/api/internal/game"
	"github.com/porchat/api/internal/ws"
)

func main() {
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
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

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
		r.Get("/code/{code}", chatHandler.GetRoomByCode)
		r.Get("/{id}", chatHandler.GetRoom)
		r.Get("/{id}/messages", chatHandler.GetMessages)
	})

	// WebSocket route
	r.Get("/ws", wsHandler.ServeWS)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	if !strings.HasPrefix(port, ":") {
		port = ":" + port
	}

	listener, err := net.Listen("tcp", port)
	if err != nil {
		log.Printf("Port %s busy (%v), trying fallback :8081...", port, err)
		port = ":8081"
		listener, err = net.Listen("tcp", port)
		if err != nil {
			log.Fatalf("Server failed to bind: %v", err)
		}
	}

	log.Printf("🚀 PORChat API running at http://localhost%s", port)
	if err := http.Serve(listener, r); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
