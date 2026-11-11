#!/usr/bin/env bash
# ==============================================================================
# PORChat — Install Systemd Service on Ubuntu Server
# Enables automatic boot startup and service management via systemctl
# ==============================================================================

set -euo pipefail

if [ "$EUID" -ne 0 ]; then
  echo "[ERROR] Please run with sudo: sudo ./scripts/install_systemd.sh"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SERVICE_FILE="/etc/systemd/system/porchat.service"
TEMPLATE="$PROJECT_ROOT/scripts/porchat.service"

echo "Configuring systemd service for PORChat at $PROJECT_ROOT..."

# Replace WorkingDirectory in template with actual project root
sed "s|WorkingDirectory=.*|WorkingDirectory=$PROJECT_ROOT|g" "$TEMPLATE" > "$SERVICE_FILE"

systemctl daemon-reload
systemctl enable porchat.service

echo "[OK] porchat.service installed and enabled."
echo "Commands available:"
echo "  sudo systemctl start porchat"
echo "  sudo systemctl stop porchat"
echo "  sudo systemctl status porchat"
echo "  sudo systemctl restart porchat"
