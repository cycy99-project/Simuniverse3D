# Déploiement UNIVERSE3D — Hetzner VPS

Site 100% statique (Vite + TypeScript + Three.js, pas de backend, pas de DB,
pas de secret) servi par nginx dans un container Docker, mutualisé avec le
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
3. build l'image et démarre le container,
4. ajoute automatiquement le vhost `universe3d.duckdns.org` au Caddyfile de
   Cycymulator et recharge Caddy.

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
