# Déploiement UNIVERSE3D — Hetzner VPS

Frontend 100% statique (Vite + TypeScript + Three.js) servi par nginx, plus
une petite API FastAPI + SQLite (`universe3d-api`) pour le dashboard de
fréquentation (`/admin.html`). Deux containers Docker, mutualisés avec le
Caddy déjà en place pour Cycymulator/TchinQuiz/LoupsGarous sur le même VPS.

## Prérequis

- VPS avec Cycymulator déjà installé (Docker + réseau `hetzner_web` + Caddy).
- Un sous-domaine DuckDNS (ex. `universe3d.duckdns.org`) pointé sur l'IP du VPS.

## Installation (première fois)

```bash
curl -fsSL https://raw.githubusercontent.com/cycy99-project/Simuniverse3D/main/deploy/hetzner/install.sh | bash
```

Le script :
1. vérifie Docker + le réseau `hetzner_web` partagé,
2. clone le repo dans `/srv/universe3d`,
3. génère `.env` (mot de passe admin + clé de session, aléatoires),
4. build les images et démarre les containers (frontend + API stats),
5. ajoute automatiquement le vhost `universe3d.duckdns.org` au Caddyfile de
   Cycymulator (routage `/api/*` → API, reste → frontend) et recharge Caddy.

## Dashboard fréquentation

`https://universe3d.duckdns.org/admin.html` — vues totales/7j/30j, visiteurs
distincts, répartition par pays (géolocalisation IP via ip-api.com), 30
dernières visites. Mot de passe dans `.env` (`ADMIN_PASSWORD`). Les vues
brutes sont purgées après 30 jours et agrégées en résumé mensuel permanent
(pas d'IP conservée au-delà de 30 jours) — même pattern que le suivi de
connexions de Cycymulator (`api/login_tracker.py`).

## Mise à jour

```bash
cd /srv/universe3d/deploy/hetzner
./update.sh
```

## Fichiers

| Fichier | Rôle |
|---|---|
| `docker-compose.yml` | Service unique `universe3d`, build depuis `../../frontend`, rejoint `hetzner_web` |
| `Caddyfile.snippet` | Bloc vhost à ajouter au Caddyfile partagé (fait automatiquement par `install.sh`) |
| `install.sh` | Bootstrap (clone + build + vhost) — à ne lancer qu'une fois |
| `update.sh` | git pull + rebuild + restart — pour toute mise à jour ultérieure |

## Vérification post-déploiement

```bash
curl -I https://universe3d.duckdns.org
```

Doit répondre `HTTP/2 200` une fois le certificat Let's Encrypt obtenu par
Caddy (quelques secondes à 1-2 minutes après le premier accès, une fois le
DNS propagé).
