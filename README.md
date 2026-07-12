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

## Prochaines étapes

Voir la section "Backlog" et "Prochaines étapes" de [SPECS.md](SPECS.md).
