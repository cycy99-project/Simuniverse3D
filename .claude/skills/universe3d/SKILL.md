---
name: universe3d
description: Contexte projet UNIVERSE3D (cartographie 3D de l'univers proche + simulation d'atmosphères exoplanétaires) — sources de données astronomiques publiques, architecture, conventions du MVP. Activer pour toute question ou tâche sur ce projet (ingestion NASA/Gaia/SIMBAD, scènes Three.js, heuristique d'atmosphère).
---

# UNIVERSE3D — Cartographie 3D de l'univers proche

Site web (à terme) permettant de naviguer en 3D dans le voisinage stellaire,
d'entrer dans un système planétaire, et de visualiser une simulation
plausible de l'atmosphère de chaque exoplanète, basée sur les spectres
publiés (JWST notamment). Voir `SPECS.md` à la racine du projet pour l'étude
complète (sources, état de l'art concurrentiel vérifié, positionnement).

## Règle permanente — tenir ce skill à jour

**Dès qu'une nouvelle API ou source de données publique pertinente pour ce
domaine (exoplanètes, étoiles, spectroscopie, cartographie galactique) est
découverte ou commence à être utilisée dans le projet, l'ajouter immédiatement
à la table "APIs disponibles" ci-dessous** — avec son statut d'utilisation
réel (utilisée / évaluée / connue mais pas encore exploitée). Ne pas laisser
cette table diverger du code.

## APIs disponibles (statut vérifié 2026-07-12)

| Source | Contenu | Accès | Statut dans le projet |
|---|---|---|---|
| **NASA Exoplanet Archive** — table `ps` (Planetary Systems) | Exoplanètes confirmées : paramètres orbitaux, physiques, stellaires, méthode/année de découverte | TAP/ADQL, `https://exoplanetarchive.ipac.caltech.edu/TAP/sync` (GET, params `query`+`format=json`) | ✅ **Utilisée** — `scripts/ingest.py` |
| **NASA Exoplanet Archive** — table Atmospheric Spectroscopy | Spectres de transmission/émission JWST unifiés (molécules détectées) | TAP (schéma exact des colonnes non confirmé publiquement au moment de l'écriture) | ⚠️ **Connue mais pas encore exploitée** — pour le MVP v0, molécules codées en dur dans `KNOWN_ATMOSPHERES` (`scripts/ingest.py`) à partir de la littérature publiée. À remplacer par une vraie requête TAP quand le schéma sera vérifié. |
| **SIMBAD** (CDS Strasbourg) | Étoiles : distances, catalogues, noms alternatifs, coordonnées, liens biblio | TAP/ADQL (standard IVOA) | ⏳ Évaluée, pas encore utilisée (pas nécessaire tant que le jeu de données reste limité à quelques systèmes phares) |
| **ESA Gaia Archive** | Positions précises, distances, mouvements propres, luminosité — base pour une future carte galactique dense | TAP+ REST, ADQL, `https://gea.esac.esa.int/tap-server/tap` | ⏳ Évaluée, pas encore utilisée (prévue pour une v2 "carte galactique" à grande échelle, hors scope MVP) |
| **NASA ADS** (Astrophysics Data System) | Suivi des publications scientifiques par objet | API | ⏳ Connue, pas utilisée |
| **The Extrasolar Planets Encyclopaedia** | Référence alternative, parfois en avance sur la NASA Exoplanet Archive | Export CSV | ⏳ Connue, pas utilisée |
| **MAST** (Mikulski Archive for Space Telescopes) | Données brutes JWST, Hubble, TESS, Kepler | API | ⏳ Connue, pas utilisée |
| **PHL Habitable Exoplanets Catalog** (UPR Arecibo) | Indices d'habitabilité (ESI, HZD, GPH), dérivés de la NASA Exoplanet Archive | Export web (`phl.upr.edu/hec`) | ⏳ Connue, pas utilisée |
| **Solar System Scope — Textures** | Cartes de texture 2K des 8 planètes (dérivées d'imagerie/élévation NASA) | Téléchargement direct (`solarsystemscope.com/textures/download/2k_<planete>.jpg`) | ✅ **Utilisée** — `frontend/public/textures/`, appliquées via `THREE.TextureLoader` sur les sphères du Système Solaire (`scenes/system.ts`, `scenes/atmosphere.ts`). Licence CC BY 4.0 : attribution affichée dans l'UI (`#credits`). N'existe pas pour les exoplanètes (visuel réel inconnu) — ne jamais l'utiliser hors Système Solaire. |

## Architecture du MVP v0 (état actuel)

Voir le plan détaillé archivé : `C:\Users\crieux\.claude\plans\serene-herding-galaxy.md`.

```
C:\_Perso\UNIVERSE3D\
├── SPECS.md                  — étude, sources, concurrence, conseils
├── data\seed_systems.json    — sortie committée de l'ingestion (copie canonique)
├── scripts\
│   ├── requirements.txt
│   └── ingest.py             — one-shot TAP → JSON (Système Solaire codé en dur + 4 systèmes phares JWST)
└── frontend\                 — Vite + TypeScript + Three.js (vanilla, pas de framework UI)
    ├── public\data\seed_systems.json  — copie servie par Vite (dupliquée par ingest.py)
    └── src\
        ├── main.ts                  — bootstrap, state machine galaxy/system/atmosphere, raycasting, UI overlay
        ├── data\{types.ts,loader.ts}
        ├── scenes\{galaxy,system,atmosphere}.ts
        └── atmosphere\heuristic.ts  — deriveAtmosphere() : molécules+temp → rendu visuel
```

### Systèmes phares du MVP (choisis pour avoir des spectres JWST publiés)

- **Système Solaire** (`sol`) — codé en dur, sert de calibration à vérité connue pour l'heuristique.
- **WASP-39 b** — CO2 détecté, première détection JWST marquante (2022).
- **K2-18 b** — candidate "hycéenne", CH4/CO2, détection DMS controversée non retenue.
- **HD 189733 b** — Jupiter chaud bleu, référence Hubble/JWST.
- **TRAPPIST-1** — système à 7 planètes, plusieurs non-détections d'atmosphère notables.

### Conventions établies

- **Toujours étiqueter la source de la donnée** dans l'UI (`source`: `known` / `jwst_spectroscopy` / `no_detection` / `no_data`) — ne jamais laisser une simulation d'atmosphère être confondue avec une observation réelle.
- **Champs NULL de l'archive** : certains champs de la ligne `default_flag=1` peuvent être NULL par host (bug connu côté archive, ex. `sy_dist` pour TRAPPIST-1, `pl_orbsmax`/`pl_eqt` pour HD 189733 b). Compléter via des dictionnaires de repli (`FALLBACK_SY_DIST_PC`, `FALLBACK_PLANET_FIELDS` dans `ingest.py`) sourcés depuis la littérature, jamais deviner silencieusement.
- **Échelles non-linéaires** : distances stellaires en racine carrée (`DISTANCE_SCALE` dans `galaxy.ts`), orbites en racine carrée (`ORBIT_SCALE` dans `system.ts`), tailles de planètes en log (`system.ts`) — nécessaire vu l'écart réel des ordres de grandeur, documenté dans le code.
- **Pas de backend/Docker/Hetzner pour le MVP v0** — site statique local (`npm run dev`), le déploiement (pattern Hetzner documenté dans `C:\_Perso\HETZNER_DEPLOYMENT_GUIDE.md`) est un jalon v0.1+ volontairement différé.

## Hors scope actuel (v0.1+)

- Backend FastAPI + SQLite + rafraîchissement automatique.
- Déploiement Hetzner (Dockerfile, Caddy, sous-domaine duckdns).
- Extension à un jeu de données large (toutes exoplanètes confirmées, Gaia dense).
- Requête réelle de la table Atmospheric Spectroscopy (actuellement simulée par données codées en dur).
