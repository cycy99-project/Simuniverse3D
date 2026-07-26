#!/bin/bash
# ============================================================================
# UNIVERSE3D — Mise à jour sur Hetzner VPS (git pull + rebuild + restart)
# Usage : cd /srv/universe3d/deploy/hetzner && ./update.sh
# ============================================================================

set -euo pipefail

INSTALL_DIR="/srv/universe3d"
LOG_FILE="/tmp/universe3d-update.log"

log() { echo -e "\033[1;34m[$(date +%H:%M:%S)]\033[0m $*" | tee -a "$LOG_FILE"; }

if [[ $EUID -ne 0 ]]; then
    SUDO="sudo"
else
    SUDO=""
fi

log "git pull…"
cd "$INSTALL_DIR" && $SUDO git pull --ff-only

cd "$INSTALL_DIR/deploy/hetzner"
log "Rebuild de l'image…"
$SUDO docker compose build

log "Redémarrage du container…"
$SUDO docker compose up -d

log "✅ Mise à jour terminée."
$SUDO docker compose ps
