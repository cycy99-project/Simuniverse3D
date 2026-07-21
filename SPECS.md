# Projet UNIVERSE3D — Cartographie 3D de l'univers proche

## Pitch

Un "Google Maps de la galaxie" en site web : partir de la Terre, zoomer jusqu'à
la Voie lactée, sélectionner une étoile proche, entrer dans son système
planétaire, observer les orbites, consulter les données scientifiques à jour
(NASA/Gaia/SIMBAD/JWST) et visualiser des simulations plausibles d'atmosphères
et de paysages pour chaque exoplanète.

Objectif de différenciation : voir section "Analyse concurrentielle vérifiée"
ci-dessous — l'espace libre réel est plus étroit que suggéré initialement.

## Sources de données publiques et gratuites (vérifié 2026-07-12)

| Source | Contenu | Format d'accès |
|---|---|---|
| **NASA Exoplanet Archive** | Référence mondiale : exoplanètes confirmées, étoiles hôtes, params orbitaux, masses, rayons, températures, méthode de détection, coordonnées. MàJ fréquente. Migré vers **TAP/ADQL** (requêtes type SQL). | TAP (ADQL) → VOTable/CSV. Doc : exoplanetarchive.ipac.caltech.edu/docs/TAP |
| **SIMBAD** (CDS Strasbourg) | Étoiles, distances, catalogues, noms alternatifs, coordonnées, liens biblio. | TAP/ADQL (standard IVOA) |
| **ESA Gaia Archive** | Positions précises, distances, mouvements propres, luminosité des étoiles — base de la carto 3D du voisinage galactique. | TAP+ REST, ADQL, endpoint gea.esac.esa.int/tap-server/tap |
| **NASA ADS** (Astrophysics Data System) | Suivi des publications scientifiques récentes par objet. | API |
| **The Extrasolar Planets Encyclopaedia** | Référence alternative, parfois en avance sur NASA pour les nouvelles découvertes. | Export CSV |
| **MAST** (Mikulski Archive for Space Telescopes) | Données JWST, Hubble, TESS, Kepler — spectres, observations d'atmosphères. | API |
| **PHL Habitable Exoplanets Catalog** (UPR Arecibo) | Indices d'habitabilité (ESI, HZD, GPH), classifications, dérivé de la NASA Exoplanet Archive. Pas trouvé par la 1ère recherche ChatGPT. | Export web (phl.upr.edu/hec) |

**Bonne surprise non identifiée initialement** : la NASA Exoplanet Archive a
maintenant une table dédiée **"Atmospheric Spectroscopy"** qui centralise tous
les spectres JWST publiés (transmission + émission) dans un format unifié,
avec interface interactive (Firefly/Caltech) — plus mûr que "juste des
spectres à interpréter soi-même". C'est la meilleure porte d'entrée pour la
brique atmosphères.

Note atmosphères : pas d'imagerie directe disponible : on récupère des
spectres + probabilités de présence de molécules (H2O, CH4, CO2, CO...) et on
en dérive une représentation visuelle plausible (couleur du ciel, nuages,
composition) à partir des publications — ce point de ChatGPT est confirmé exact.

## Analyse concurrentielle vérifiée (contre-check du 2026-07-12)

Le premier état de l'art (ChatGPT) était **incomplet** — il a raté le
concurrent le plus sérieux et sous-estimé le nombre de projets similaires déjà
existants. Version corrigée :

- **NASA Eyes on Exoplanets** — confirmé vivant et **activement maintenu**
  (release du 11/06/2026 : 4716 étoiles avec fiches descriptives). Navigation
  3D, comparaison d'orbites, zone habitable. Interface scientifique, peu
  immersive, pas de simulation d'atmosphère/surface.
- **OpenSpace (NASA / American Museum of Natural History)** — **non identifié
  par ChatGPT, c'est pourtant le concurrent le plus proche du concept.**
  Open source (MIT), catalogue Digital Universe (étoiles, exoplanètes,
  galaxies), navigation galactique 3D sur vraies données, activement
  maintenu par la NASA et l'AMNH. Sa seule vraie limite : c'est un logiciel
  desktop (Windows/Linux) installable, **pas un site web** — c'est la
  fenêtre de différenciation la plus solide qui reste.
- **100,000 Stars (Google, 2012)** — zoom Terre → voisinage stellaire →
  galaxie, exactement le concept "Google Maps de la galaxie". Vue galactique
  = rendu artistique (pas les vraies positions Gaia), techniquement daté
  (WebGL/CSS3D 2012), probablement plus maintenu.
- **NASA Exoplanet Catalog** — fiches détaillées par planète + modèle 3D,
  orienté donnée plutôt qu'immersion.
- **SpaceEngine** — voyage dans tout l'univers, génération procédurale pour
  combler l'inconnu. Pas un site web, atmosphères = extrapolations
  artistiques, pas branché sur les publications récentes.
- **PHL Habitable Exoplanets Catalog** — base de données + indices
  d'habitabilité, pas de 3D.
- **Projets indépendants GitHub** — plus nombreux que ChatGPT ne le
  suggérait : `exoplanet-hub`, `exoseeker` et d'autres implémentent déjà
  Three.js + NASA Exoplanet Archive, souvent issus de hackathons NASA Space
  Apps Challenge. Le concept "carte 3D web + données NASA" est un exercice
  déjà répandu dans cette communauté, pas une niche vide.

**Conclusion révisée** : le vrai espace libre n'est pas "combiner ces
sources" (déjà fait par OpenSpace en desktop) mais plus étroit : navigateur
pur sans installation + pipeline auto de spectres JWST → traduction visuelle
d'atmosphère plausible + données vraiment à jour. Un projet de niche crédible,
mais pas un vide de marché aussi béant que suggéré initialement.

## Intérêt du projet et conseils

- Public réel (passionnés, enseignants, vulgarisation) mais aucun concurrent
  cité n'a de modèle économique — projet vitrine/passion plutôt qu'outil à
  utilisateurs immédiats, à la différence des autres projets perso (Cycymulator,
  TchinQuiz) qui ont un besoin concret dès le jour 1.
- Charge de maintenance non triviale : pipelines multi-API, perf 3D
  cross-device, risque réel de scope trop large (galaxie + systèmes +
  atmosphères + auto-update en même temps).
- **Conseil** : viser UN axe différenciant plutôt que refaire une carte
  galactique générique (déjà fait 3 fois) — privilégier la traduction
  spectres JWST → visuel d'atmosphère, la brique la moins couverte ailleurs.
- **Conseil** : s'inspirer/réutiliser le code des projets GitHub existants
  (Three.js + NASA Exoplanet Archive) plutôt que réinventer le pipeline
  d'ingestion et le moteur 3D from scratch.
- **Conseil** : étiqueter clairement "simulation plausible" vs "donnée
  observée" dans l'UI — honnêteté scientifique + protection si diffusion de
  visuels non-officiels basés sur de vrais papiers.

## Pistes techniques (à approfondir)

- Frontend 3D : Three.js / React Three Fiber (cohérent avec le reste de la
  stack perso), ou Babylon.js.
- Backend : ingestion périodique des APIs NASA/Gaia/SIMBAD → cache local
  (SQLite/Postgres) pour éviter de dépendre du live à chaque requête.
- Génération de simulations d'atmosphère : règles heuristiques à partir des
  molécules détectées + température + type d'étoile (pas de ML lourd dans un
  premier temps).
- Échelle : gérer la disproportion des distances (années-lumière) vs tailles
  des orbites → échelles non linéaires / mode "carte" vs mode "système".

## Backlog (idées validées, pas encore planifiées)

- **Vue "Groupe Local" (multi-galaxies)** : niveau de zoom au-dessus de la
  vue "Voie Lactée" actuelle (qui n'affiche en réalité qu'un petit
  voisinage stellaire proche, pas la galaxie entière). Positionner les
  galaxies voisines avec de vraies données connues (Andromède M31 à
  ~2,5 millions d'a.l., Triangulum M33, Grand/Petit Nuage de Magellan) —
  nécessite une nouvelle scène, un nouvel état dans la state machine et une
  nouvelle échelle (mégaparsecs), pas un simple ajustement. Demandé par
  Cyril le 2026-07-12, reporté à un prochain chantier.
- **Vue des constellations connues** dans la vue 3D (probablement la vue
  galaxie/voisinage stellaire) + indiquer, pour chaque système d'étoile du
  jeu de données, dans quelle constellation il se trouve (nouveau champ de
  donnée par système, ex. `constellation` sur `StarData`). Demandé par
  Cyril le 2026-07-20, à faire plus tard.
- **Mode de navigation "vaisseau spatial"** avec vue cockpit, pilotable au
  clavier — uniquement à l'intérieur d'un système solaire donné (pas en vue
  galaxie) : remplacerait ponctuellement OrbitControls par un déplacement
  libre caméra (avance/recul/rotation) dans la scène `system.ts` déjà
  chargée. Demandé par Cyril le 2026-07-21, à faire plus tard.

## Bugs connus (à corriger plus tard)

- **Distance lune↔planète trop compressée visuellement** (ex. Lune vs
  Terre, Charon vs Pluton dans `scenes/moons.ts`) : `naturalRadius` utilise
  une échelle en racine carrée de `orbit_km` (`Math.sqrt(moon.orbit_km /
  50_000) * opts.orbitScale`), puis est repoussée par le clamp anti-
  chevauchement `Math.max(naturalRadius, previousOuterEdge + moonRadius *
  1.5)` — pour des systèmes à une seule lune proche (Terre, Pluton), le
  clamp ou la compression racine carrée dominent et rapprochent la lune
  bien plus que sa distance réelle ne le justifierait. Signalé par Cyril
  le 2026-07-20.

## Prochaines étapes

1. Définir le MVP : scope minimal démontrable (ex. Soleil + ~20-50 étoiles
   proches avec exoplanètes confirmées, navigation 3D basique, fiche par
   planète), en gardant l'axe "atmosphères JWST" comme différenciateur
   principal plutôt que la carte galactique seule.
2. Prototyper l'ingestion NASA Exoplanet Archive via TAP/ADQL (+ table
   Atmospheric Spectroscopy pour les spectres JWST).
3. Choisir la stack 3D et valider les perfs avec un jeu de données réel
   (regarder le code des projets GitHub existants type `exoplanet-hub`
   avant de partir de zéro).
4. Itérer sur la représentation d'atmosphère (mode "plausible" clairement
   étiqueté comme simulation, pas comme observation directe).

---
*Document de travail — étude initiale basée sur une recherche ChatGPT du
2026-07-12, contre-vérifiée par recherche web le même jour (sources APIs
confirmées, état de l'art corrigé : ajout d'OpenSpace, 100,000 Stars, PHL
Habitable Exoplanets Catalog, projets GitHub indépendants). À affiner en
spec technique une fois le MVP cadré.*
