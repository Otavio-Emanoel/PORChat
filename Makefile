.PHONY: help up down logs api-run api-build web-dev mobile-start test audit-ports

help:
	@echo "PORChat Development Commands:"
	@echo "  make up            - Build and start API & Web containers via docker compose"
	@echo "  make down          - Stop docker compose containers"
	@echo "  make logs          - Follow docker compose logs"
	@echo "  make api-run       - Run Go backend server"
	@echo "  make api-build     - Build Go backend binary"
	@echo "  make web-dev       - Start Next.js web application"
	@echo "  make mobile-start  - Start React Native / Expo application"
	@echo "  make test          - Run tests and typechecks across backend, shared, web, and mobile"
	@echo "  make audit-ports   - Validate port safety and isolation"

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

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
	cd web && npm run typecheck && npm test
	cd mobile && npm run typecheck && npm test

audit-ports:
	./scripts/audit_ports.sh
