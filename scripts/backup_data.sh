#!/usr/bin/env bash
# ==============================================================================
# PORChat — Persistent Data Backup Script
# Creates a compressed, timestamped snapshot of ./data in ./backups/
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DATA_DIR="$PROJECT_ROOT/data"
BACKUP_DIR="$PROJECT_ROOT/backups"
TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
BACKUP_FILE="$BACKUP_DIR/porchat_data_${TIMESTAMP}.tar.gz"

mkdir -p "$BACKUP_DIR"

if [ ! -d "$DATA_DIR" ] || [ -z "$(ls -A "$DATA_DIR" 2>/dev/null)" ]; then
  echo "[WARN] Data directory $DATA_DIR is empty or does not exist yet. Nothing to backup."
  exit 0
fi

echo "Backing up $DATA_DIR to $BACKUP_FILE..."
tar -czf "$BACKUP_FILE" -C "$PROJECT_ROOT" data

echo "[OK] Backup created: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# Keep last 14 backups, remove older snapshots
find "$BACKUP_DIR" -name "porchat_data_*.tar.gz" -type f -mtime +14 -delete || true
