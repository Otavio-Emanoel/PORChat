#!/usr/bin/env bash
# ==============================================================================
# PORChat — Production Update & Deployment Script
# Safely pulls the latest main branch, creates a snapshot backup, and updates
# Docker containers with zero loss of messages or room data.
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
echo -e "${CYAN}              PORChat Production Auto-Deploy                    ${NC}"
echo -e "${CYAN}================================================================${NC}"

# 1. Automatic backup of data before deploying updates
echo -e "\n${YELLOW}[1/4] Creating safety backup of data stores...${NC}"
if [ -f "$PROJECT_ROOT/scripts/backup_data.sh" ]; then
  bash "$PROJECT_ROOT/scripts/backup_data.sh"
fi

# 2. Pull latest git code
echo -e "\n${YELLOW}[2/4] Pulling latest changes from Git...${NC}"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  echo "Current branch: $CURRENT_BRANCH"
  git pull origin "$CURRENT_BRANCH"
  echo -e "${GREEN}[OK] Git repository updated.${NC}"
else
  echo -e "${YELLOW}[WARN] Not a git repository or git pull skipped.${NC}"
fi

# 3. Build and recreate containers
echo -e "\n${YELLOW}[3/4] Rebuilding Docker containers...${NC}"
docker compose build --pull
docker compose up -d --remove-orphans

# 4. Healthcheck verification
echo -e "\n${YELLOW}[4/4] Verifying service health...${NC}"
RETRIES=12
READY=false

for i in $(seq 1 $RETRIES); do
  if curl -sf http://localhost:8081/health >/dev/null 2>&1; then
    READY=true
    break
  fi
  sleep 2
done

if [ "$READY" = true ]; then
  echo -e "${GREEN}================================================================${NC}"
  echo -e "${GREEN}   Deployment Complete: All services running and healthy!       ${NC}"
  echo -e "${GREEN}================================================================${NC}"
  docker compose ps
else
  echo -e "${RED}[ERROR] Healthcheck failed after deployment. Inspect logs with:${NC}"
  echo -e "${CYAN}docker compose logs --tail=100${NC}"
  exit 1
fi
