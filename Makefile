.PHONY: help db-up db-down api-run api-build web-dev mobile-start test

help:
	@echo "PORChat Development Commands:"
	@echo "  make db-up         - Start PostgreSQL via docker-compose"
	@echo "  make db-down       - Stop PostgreSQL container"
	@echo "  make api-run       - Run Go backend server"
	@echo "  make api-build     - Build Go backend binary"
	@echo "  make web-dev       - Start Next.js web application"
	@echo "  make mobile-start  - Start React Native / Expo application"
	@echo "  make test          - Run tests across backend and frontends"

db-up:
	docker compose up -d postgres

db-down:
	docker compose down

api-run:
	cd api && PORT=8081 go run cmd/server/main.go

api-build:
	cd api && go build -o bin/server cmd/server/main.go

web-dev:
	cd web && npm run dev

mobile-start:
	cd mobile && npm start

test:
	cd api && go test ./...
	cd shared && npm run typecheck
	cd web && npm run typecheck
	cd mobile && npm run typecheck
