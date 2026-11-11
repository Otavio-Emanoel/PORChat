#!/usr/bin/env bash
# ==============================================================================
# PORChat — Production Startup Script (Docker Compose)
# Starts Go API (8081) and Next.js Web (3001) in isolated background containers
# ==============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo -e "${CYAN}================================================================${NC}"
echo -e "${CYAN}             Starting PORChat Production Stack                  ${NC}"
echo -e "${CYAN}================================================================${NC}"

# Check Docker daemon
if ! docker info >/dev/null 2>&1; then
  echo -e "${RED}[ERROR] Docker daemon is not running or current user lacks permissions.${NC}"
  echo "Try starting Docker: sudo systemctl start docker"
  echo "Or check group membership: sudo usermod -aG docker \$USER (requires re-login)"
  exit 1
fi

# Ensure data directory exists
mkdir -p "$PROJECT_ROOT/data"

# Check if environment file exists, or create default
if [ ! -f "$PROJECT_ROOT/.env" ]; then
  echo -e "${YELLOW}Creating default .env file...${NC}"
  cat << 'EOF' > "$PROJECT_ROOT/.env"
# PORChat Production Environment Variables
PORT=8081
JWT_SECRET=porchat-super-secure-production-secret-change-me-in-prod
NEXT_PUBLIC_API_URL=http://localhost:8081
NEXT_PUBLIC_WS_URL=ws://localhost:8081/ws
NODE_ENV=production
EOF
  echo -e "${GREEN}[OK] Created .env template. Customize it as needed.${NC}"
fi

# Audit ports before binding
if [ -f "$PROJECT_ROOT/scripts/audit_ports.sh" ]; then
  bash "$PROJECT_ROOT/scripts/audit_ports.sh" || true
fi

echo -e "\n${YELLOW}Building and starting Docker containers in detached mode...${NC}"
docker compose up -d --build

echo -e "\n${YELLOW}Waiting for services to become healthy...${NC}"
RETRIES=15
API_HEALTHY=false

for i in $(seq 1 $RETRIES); do
  if curl -sf http://localhost:8081/health >/dev/null 2>&1; then
    API_HEALTHY=true
    break
  fi
  sleep 2
done

if [ "$API_HEALTHY" = true ]; then
  echo -e "${GREEN}[OK] PORChat Go API is healthy on port 8081.${NC}"
else
  echo -e "${YELLOW}[WARN] API healthcheck did not respond yet. Checking docker compose ps...${NC}"
fi

# Display running containers
docker compose ps

SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")"

echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}             PORChat Stack is Live and Operational!              ${NC}"
echo -e "${GREEN}================================================================${NC}"
echo -e "Web Client & TV Mode:     ${CYAN}http://${SERVER_IP}:3001${NC}"
echo -e "Big Screen TV Stage:      ${CYAN}http://${SERVER_IP}:3001/tv${NC}"
echo -e "REST API & Health:        ${CYAN}http://${SERVER_IP}:8081/health${NC}"
echo -e "WebSocket Stream:         ${CYAN}ws://${SERVER_IP}:8081/ws${NC}"
echo -e "\nHelpful Commands:"
echo -e "  View Logs:              ${CYAN}docker compose logs -f${NC}"
echo -e "  Stop Stack:             ${CYAN}./scripts/stop_production.sh${NC}"
echo -e "  Deploy Updates:         ${CYAN}./scripts/deploy.sh${NC}"
echo -e "  Data Backup:            ${CYAN}./scripts/backup_data.sh${NC}"
echo -e "================================================================"
