#!/usr/bin/env bash
# ==============================================================================
# PORChat — Production Shutdown Script
# Gracefully stops Docker containers without data loss
# ==============================================================================

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo -e "${CYAN}Stopping PORChat containers...${NC}"
docker compose down

echo -e "${GREEN}[OK] PORChat containers stopped. Persistent data in ./data is preserved.${NC}"
