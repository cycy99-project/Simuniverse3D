# UNIVERSE3D — Cartographie 3D de l'univers proche

Un "Google Maps de la galaxie" en site web statique : partir de la Voie
Lactée, sélectionner une étoile, entrer dans son système planétaire,
observer les orbites (avec option d'inclinaisons réelles), consulter les
données scientifiques (NASA Exoplanet Archive) et visualiser des simulations
plausibles d'atmosphères basées sur les spectres JWST publiés.

Voir [SPECS.md](SPECS.md) pour le pitch complet, l'analyse concurrentielle et
le backlog.

## Stack

- **Frontend** : Vite + TypeScript + Three.js (vanilla), state machine à 4
  vues (`galaxy` / `system` / `star` / `atmosphere`) dans `frontend/src/main.ts`.
- **Ingestion de données** : script Python one-shot (`scripts/ingest.py`),
  interroge la NASA Exoplanet Archive (TAP/ADQL) et écrit un JSON statique
  versionné (`data/seed_systems.json`, dupliqué dans
  `frontend/public/data/seed_systems.json` pour être servi par Vite).
- Pas de backend, pas de base de données : tout est statique côté client.

## Démarrer en local

```bash
# 1. Régénérer les données (optionnel, seed_systems.json est déjà versionné)
cd scripts
pip install -r requirements.txt
python ingest.py

# 2. Lancer le frontend
cd ../frontend
npm install
npm run dev
```

## Convention centrale : donnée réelle vs simulation

Chaque planète porte un champ `source` (`known` / `jwst_spectroscopy` /
`no_detection` / `no_data`) affiché sous forme de badge dans le cartouche.
Toute valeur affichée doit être vérifiée (Wikipedia/NASA/USGS/WebSearch) avant
intégration — aucune donnée n'est jamais inventée. Quand une donnée réelle
n'existe pas (ex. inclinaison orbitale mutuelle des exoplanètes), le champ
reste `null` plutôt que d'être approximé, et la fonctionnalité concernée se
désactive proprement dans l'UI (ex. bouton "plans orbitaux réels" grisé avec
tooltip explicatif).

## Historique des évolutions

### MVP v0 — fondations
- Trois scènes Three.js : galaxie (voisinage stellaire), système (orbites),
  atmosphère (sphère procédurale + panneau de spectre).
- Système Solaire codé en dur comme cas de calibration à vérité connue
  (Mercure → Neptune), comparé à 4 systèmes exoplanétaires phares avec
  spectres JWST publiés : WASP-39 b, K2-18 b, HD 189733 b, TRAPPIST-1.
- Heuristique `deriveAtmosphere()` : molécules détectées + température +
  type spectral → couleur de ciel/nuages plausible, toujours étiquetée
  "simulation" dans l'UI.
- Ingestion NASA Exoplanet Archive via TAP/ADQL (table `ps` + table
  "Atmospheric Spectroscopy").

### Extensions (vues, i18n, unités)
- Vue "étoile" dédiée (`scenes/star.ts`) avec comparaison au Soleil/à la
  Terre.
- Vue "lune" par planète, textures réelles pour la Lune, couleur réelle
  approximative sinon.
- Panneaux Voyager 1 / 2 : distance héliocentrique extrapolée depuis une
  position de référence réelle et la vitesse réelle connue des sondes.
- Bascule de langue FR/EN (`i18n.ts`) et bascule d'unité de température
  K/°C/°F (`units.ts`).
- Bouton de comparaison visuelle (planète/étoile vs Terre/Soleil).

### Système Solaire enrichi (session du 2026-07-12)
- **Inclinaisons orbitales réelles des lunes** par rapport à l'équateur de
  leur planète (Lune, lunes de Mars/Jupiter/Saturne/Uranus/Neptune, Charon),
  rendues via un groupe de tilt statique + groupe de spin animé (nécessaire
  car animer directement un angle d'Euler du milieu quand X/Z sont non nuls
  ne produit pas une orbite inclinée cohérente).
- **Planètes naines** ajoutées avec badge dédié : Cérès, Pluton, Éris
  (données orbitales, physiques et de rotation réelles, y compris la
  rotation rétrograde de Pluton).
- **Ceinture d'astéroïdes** (2,1–3,3 UA) et **ceinture de Kuiper**
  (30–50 UA) visualisées sous forme de nuages de points avec étiquette,
  dans la vue Système Solaire uniquement.
- **Bouton bascule "plans orbitaux réels"** : affiche les inclinaisons
  orbitales réelles des planètes par rapport à l'écliptique (même
  technique tilt/spin que les lunes). Désactivé avec tooltip explicatif
  pour les systèmes exoplanétaires, faute de donnée mutuelle mesurée (la
  colonne `pl_orbincl` de l'archive NASA mesure l'inclinaison par rapport à
  notre ligne de visée, une notion différente qu'il serait trompeur de
  réutiliser ici).
- **Fond étoilé** (nuage de points décoratif) ajouté à la vue Système
  Solaire puis à la vue Voie Lactée.
- **Renommage** du repère "Galaxie" en "Voie Lactée" / "Milky Way", pour
  refléter qu'il s'agit d'un voisinage stellaire proche et non de la
  galaxie entière (vue "Groupe Local" multi-galaxies envisagée en backlog,
  voir SPECS.md).
- **Cartouche planète corrigé** : distinction entre satellites affichés
  (sous-ensemble rendu, ex. 4 pour Jupiter) et satellites existants
  (nombre réel total connu, ex. 101 pour Jupiter au 2026-07) — évite de
  laisser croire que le rendu visuel liste l'intégralité des lunes connues.

### Textures réelles complétées (session du 2026-07-12)
- **Soleil** : texture réelle (Solar System Scope) appliquée dans la vue
  Système Solaire et dans la vue étoile dédiée (seule/comparaison).
- **Lunes galiléennes de Jupiter** (Io, Europe, Ganymède, Callisto),
  **Charon** (lune de Pluton) : mosaïques globales réelles Voyager/Galileo et
  New Horizons (USGS Astrogeology / NASA, domaine public).
- **Cérès** et **Pluton** : mosaïques globales réelles Dawn (FC) et New
  Horizons (LORRI/MVIC), remplaçant l'absence de texture précédente.

### Lunes restantes texturées (session du 2026-07-12, suite)
- **Phobos, Deimos** (Mars), **Mimas, Encelade, Téthys, Dioné, Rhéa, Titan,
  Japet** (Saturne), **Miranda, Ariel, Umbriel, Titania, Obéron** (Uranus),
  **Triton** (Neptune) : textures réelles reconstruites à partir d'images
  Voyager/Cassini/New Horizons (via le pack de textures libres du projet
  Celestia — crédits ci-dessous, CC-BY/CC-BY-SA, auteurs P. Stooke, P. Schenk,
  Askaniy Anpilogov, ItzImcool — sources NASA/JPL/USGS).
- **Néréide** (Neptune) reste sans texture : aucune image rapprochée de sa
  surface n'a jamais été prise (survolée de trop loin par Voyager 2), donc
  aucune texture réelle n'existe nulle part pour cette lune.

## Crédits textures

- Soleil, Mercure, Vénus, Terre, Lune, Mars, Jupiter, Saturne (+anneaux),
  Uranus : [Solar System Scope](https://www.solarsystemscope.com/textures/)
  (CC BY 4.0).
- Io, Europe, Ganymède, Callisto, Cérès, Pluton, Charon : mosaïques globales
  USGS Astrogeology / NASA (domaine public), missions Voyager/Galileo/Dawn/New
  Horizons.
- Phobos, Deimos, Mimas, Encelade, Téthys, Dioné, Rhéa, Titan, Japet, Miranda,
  Ariel, Umbriel, Titania, Obéron, Triton : pack de textures du
  [projet Celestia](https://github.com/CelestiaProject/CelestiaContent)
  (CC BY 3.0 / CC BY-SA 4.0 selon fichier), basé sur des données
  NASA/JPL/USGS — cartographies P. Stooke (Stooke Small Bodies Maps V3.0,
  NASA PDS) et P. Schenk, texturage Askaniy Anpilogov et ItzImcool.

## Prochaines étapes

Voir la section "Backlog" et "Prochaines étapes" de [SPECS.md](SPECS.md).

## Liens

- Repository : https://github.com/cycy99-project/Simuniverse3D
