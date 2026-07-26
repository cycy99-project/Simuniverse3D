#!/bin/bash
# ============================================================================
# UNIVERSE3D — Bootstrap script pour Hetzner VPS Ubuntu 22.04 / 24.04
# ============================================================================
# Prérequis : Cycymulator déjà installé sur le VPS (Docker + Caddy en place).
# Site 100% statique : pas de .env, pas de DB, pas de secret à générer.
#
# Usage :
#   curl -fsSL https://raw.githubusercontent.com/cycy99-project/Simuniverse3D/main/deploy/hetzner/install.sh | bash
# OU :
#   wget https://raw.githubusercontent.com/cycy99-project/Simuniverse3D/main/deploy/hetzner/install.sh
#   chmod +x install.sh
#   ./install.sh
# ============================================================================

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/cycy99-project/Simuniverse3D.git}"
INSTALL_DIR="/srv/universe3d"
CYCY_DIR="/srv/cycymulator"
LOG_FILE="/tmp/universe3d-install.log"
DOMAIN="universe3d.duckdns.org"

log()  { echo -e "\033[1;34m[$(date +%H:%M:%S)]\033[0m $*" | tee -a "$LOG_FILE"; }
fail() { echo -e "\033[1;31m[ERREUR]\033[0m $*" | tee -a "$LOG_FILE"; exit 1; }

# ----- Préchecks ------------------------------------------------------------
log "Vérification des prérequis…"
command -v docker &>/dev/null || fail "Docker manquant. Installe Cycymulator d'abord."
docker compose version &>/dev/null || fail "docker compose plugin manquant."
[[ -d "$CYCY_DIR/deploy/hetzner" ]] || fail "Cycymulator pas trouvé dans $CYCY_DIR — il fournit le réseau Caddy partagé."

if [[ $EUID -ne 0 ]]; then
    SUDO="sudo"
else
    SUDO=""
fi

# ----- Vérif réseau Caddy partagé -------------------------------------------
NET_NAME=$($SUDO docker network ls --filter "name=hetzner_web" --format '{{.Name}}' | head -1)
if [[ -z "$NET_NAME" ]]; then
    log "Réseau hetzner_web introuvable — démarrage Cycymulator pour le créer…"
    cd "$CYCY_DIR/deploy/hetzner" && $SUDO docker compose up -d
    NET_NAME=$($SUDO docker network ls --filter "name=hetzner_web" --format '{{.Name}}' | head -1)
    [[ -n "$NET_NAME" ]] || fail "Impossible de créer/trouver le réseau hetzner_web."
fi
log "Réseau Caddy partagé OK : $NET_NAME"

# ----- Clone / pull du repo -------------------------------------------------
log "Récupération du code UNIVERSE3D dans $INSTALL_DIR…"
$SUDO mkdir -p /srv
if [[ ! -d "$INSTALL_DIR/.git" ]]; then
    $SUDO git clone "$REPO_URL" "$INSTALL_DIR"
else
    log "Repo déjà cloné, mise à jour (git pull)…"
    cd "$INSTALL_DIR" && $SUDO git pull --ff-only
fi

cd "$INSTALL_DIR/deploy/hetzner"

# ----- Build & démarrage ----------------------------------------------------
log "Build de l'image Docker (peut prendre 1-2 min la 1ère fois)…"
$SUDO docker compose build

log "Démarrage du container…"
$SUDO docker compose up -d

# ----- Caddy : ajout du vhost si absent -------------------------------------
CADDYFILE="$CYCY_DIR/deploy/hetzner/Caddyfile"
if ! $SUDO grep -q "$DOMAIN" "$CADDYFILE"; then
    log "Ajout du bloc vhost UNIVERSE3D au Caddyfile de Cycymulator…"
    $SUDO tee -a "$CADDYFILE" >/dev/null < "$INSTALL_DIR/deploy/hetzner/Caddyfile.snippet"
    log "Reload de Caddy…"
    cd "$CYCY_DIR/deploy/hetzner"
    $SUDO docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile || \
        { log "⚠ reload échoué, restart full…"; $SUDO docker compose restart caddy; }
else
    log "Bloc vhost UNIVERSE3D déjà présent dans Caddyfile."
fi

# ----- État final -----------------------------------------------------------
sleep 5
log "État du container UNIVERSE3D :"
cd "$INSTALL_DIR/deploy/hetzner"
$SUDO docker compose ps

log "✅ Installation terminée."
echo
echo "📋 Étapes restantes :"
echo "  1. Vérifie que ton sous-domaine duckdns pointe sur l'IP du VPS :"
echo "     IP du VPS : $(curl -s -4 ifconfig.me)"
echo "     Va sur https://www.duckdns.org/ → créer/modifier universe3d → cette IP."
echo "  2. Attends 1-2 min la propagation DNS + Let's Encrypt :"
echo "     curl -I https://$DOMAIN"
echo
echo "🔧 Mise à jour future :"
echo "  cd $INSTALL_DIR/deploy/hetzner && ./update.sh"
echo
echo "📁 Logs install : $LOG_FILE"
