#!/usr/bin/env bash
# ==============================================================================
# PORChat — Ubuntu Server Initialization & Docker Bootstrap Script
# Target OS: Ubuntu 20.04 LTS / 22.04 LTS / 24.04 LTS
# ==============================================================================

set -euo pipefail

# Visual formatting
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}================================================================${NC}"
echo -e "${CYAN}       PORChat — Ubuntu Server Bootstrap & Docker Setup         ${NC}"
echo -e "${CYAN}================================================================${NC}"

# 1. Require root or sudo privileges
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[ERROR] This script must be run as root or with sudo.${NC}"
  echo "Usage: sudo ./scripts/setup_ubuntu.sh"
  exit 1
fi

CURRENT_USER="${SUDO_USER:-$(whoami)}"

echo -e "\n${YELLOW}[1/6] Updating Ubuntu package indexes...${NC}"
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -q

echo -e "\n${YELLOW}[2/6] Installing essential dependencies...${NC}"
DEBIAN_FRONTEND=noninteractive apt-get install -y -q \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  git \
  jq \
  ufw \
  net-tools \
  tar \
  gzip

# 3. Check and install Docker Engine & Docker Compose Plugin
echo -e "\n${YELLOW}[3/6] Verifying Docker installation...${NC}"
if ! command -v docker >/dev/null 2>&1; then
  echo -e "${CYAN}Docker not found. Installing official Docker Engine...${NC}"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc

  UBUNTU_CODENAME="$(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")"
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    ${UBUNTU_CODENAME} stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

  apt-get update -y
  DEBIAN_FRONTEND=noninteractive apt-get install -y -q \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin

  systemctl enable --now docker
  echo -e "${GREEN}[OK] Docker Engine installed successfully.${NC}"
else
  echo -e "${GREEN}[OK] Docker is already installed: $(docker --version)${NC}"
fi

# Ensure docker-compose plugin is available
if docker compose version >/dev/null 2>&1; then
  echo -e "${GREEN}[OK] Docker Compose is available: $(docker compose version)${NC}"
else
  echo -e "${YELLOW}Installing Docker Compose plugin...${NC}"
  apt-get install -y -q docker-compose-plugin
fi

# Add invoking user to docker group if not root
if [ "$CURRENT_USER" != "root" ]; then
  echo -e "${CYAN}Adding user '$CURRENT_USER' to 'docker' group...${NC}"
  usermod -aG docker "$CURRENT_USER" || true
fi

# 4. Prepare data persistence directories
echo -e "\n${YELLOW}[4/6] Setting up project directories and data persistence...${NC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

mkdir -p "$PROJECT_ROOT/data"
mkdir -p "$PROJECT_ROOT/backups"

# If running as sudo, fix ownership so the normal user can write
if [ "$CURRENT_USER" != "root" ]; then
  chown -R "$CURRENT_USER:$CURRENT_USER" "$PROJECT_ROOT/data" "$PROJECT_ROOT/backups"
fi
chmod 755 "$PROJECT_ROOT/data" "$PROJECT_ROOT/backups"
echo -e "${GREEN}[OK] Data directories verified: $PROJECT_ROOT/data${NC}"

# 5. Configure firewall (UFW)
echo -e "\n${YELLOW}[5/6] Configuring UFW Firewall...${NC}"
if command -v ufw >/dev/null 2>&1; then
  # Ensure SSH is open before enabling
  ufw allow 22/tcp comment 'SSH' || true
  # Open PORChat Dedicated Ports
  ufw allow 8081/tcp comment 'PORChat API & WebSockets'
  ufw allow 3001/tcp comment 'PORChat Web & TV Mode'
  # Open standard Web ports for Reverse Proxy (Nginx / Caddy)
  ufw allow 80/tcp comment 'HTTP Web'
  ufw allow 443/tcp comment 'HTTPS SSL Web'
  
  if [ "$(ufw status | grep -c "Status: active")" -eq 1 ]; then
    ufw reload
    echo -e "${GREEN}[OK] UFW rules updated and reloaded.${NC}"
  else
    echo -e "${CYAN}UFW is installed but inactive. Rules have been configured.${NC}"
    echo -e "${CYAN}Run 'sudo ufw enable' when ready to enforce firewall policy.${NC}"
  fi
fi

# 6. Audit ports to ensure no conflicts with any protected ports
echo -e "\n${YELLOW}[6/6] Auditing PORChat dedicated ports (8081, 3001)...${NC}"
if [ -f "$PROJECT_ROOT/scripts/audit_ports.sh" ]; then
  bash "$PROJECT_ROOT/scripts/audit_ports.sh" || true
fi

# Summary
echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}   Setup Completed Successfully!                                ${NC}"
echo -e "${GREEN}================================================================${NC}"
echo -e "You can now start PORChat with Docker Compose:"
echo -e "  ${CYAN}cd $PROJECT_ROOT${NC}"
echo -e "  ${CYAN}./scripts/start_production.sh${NC}"
echo -e "\nTo install the systemd service for automatic reboot recovery:"
echo -e "  ${CYAN}sudo ./scripts/install_systemd.sh${NC}"
echo -e "================================================================"
