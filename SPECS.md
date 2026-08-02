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

## Backlog & priorités (ordre de réalisation souhaité par Cyril, réordonné le 2026-08-02 ; items traités retirés au fur et à mesure)

✅ **Ciel nocturne vu depuis une exoplanète** (validé par Cyril le 2026-07-26) :
option, pour chaque exoplanète, permettant d'afficher son ciel de nuit et d'y
repérer notre Soleil (vu depuis cette exoplanète), avec constellations et
autres systèmes visibles depuis là-bas. Voie lactée texturée avec contours,
halo solaire scintillant + flèche + label — itéré suite retours visuels de
Cyril (bug de recentrage caméra corrigé, rendu de la bande galactique
retravaillé).

✅ **Date de découverte + méthode de détection + anecdote "événement
historique observable"** : ajouté comme paramètres affichés pour chaque
exoplanète (date de découverte, méthode de détection) ; anecdote ludique
complémentaire — si on observait la Terre depuis cette exoplanète (délai
lumière = distance en années-lumière), quel événement historique de
l'humanité serait théoriquement visible cette année-là. Demandé par Cyril le
2026-07-21, livré (commit `57c0bde`).

0. ✅ **Bip de confirmation trop artificiel** : remplacé le bip synthétisé
   Web Audio (sweep+shimmer) par un sample importé (Floraphonic,
   `public/bips/`). Retour de Cyril le 2026-08-02, livré le 2026-08-02.

✅ **Comparaison exoplanète vs Terre** : fiche de comparaison directe avec la
Terre (rayon, masse, température, gravité, type de planète) ajoutée dans le
panneau infos, juste après la ligne de gravité. Demandé par Cyril le
2026-07-21, livré et poussé sur GitHub le 2026-08-02 — **reste à déployer
sur le VPS** (`update.sh`, pas d'accès SSH depuis le PC Windows) avant
validation réelle par Cyril.

✅ **Losange de sélection + bouton "Explorer" pour les satellites** :
étendu aux lunes le pattern déjà en place pour étoiles/systèmes/planètes, en
vue système et en vue atmosphère. Demandé par Cyril le 2026-07-26, livré et
poussé sur GitHub le 2026-08-02 — **reste à déployer sur le VPS** (idem
ci-dessus).

✅ **Bug — anecdote historique toujours "Tchernobyl"** : signalé par Cyril
le 2026-08-02 (toutes les exoplanètes renvoyaient le même événement, avec
juste l'année affichée qui changeait) : la frise `HISTORICAL_EVENTS`
(`frontend/src/history/timeline.ts`) avait deux trous (476-1066 et
1969-1986) qui absorbaient toutes les années cibles proches. Densifiée avec
9 événements vérifiés ; texte reformulé ("Actuellement depuis le sol de
cette planète, tu y verrais la Terre telle qu'elle était en {année} :
{événement}.", suggéré par Cyril). Vérifié sur les 13 systèmes actuels :
plus aucune collision entre systèmes dont l'année cible diffère de plus de
15 ans. Livré et poussé sur GitHub le 2026-08-02 — **reste à déployer sur
le VPS**.

1. **Version du site affichée en bas de page** : afficher un numéro de
   version (ou un hash de commit court) discret en bas de la page,
   probablement à côté des crédits existants (`#credits` dans
   `frontend/index.html`) — utile pour vérifier rapidement, notamment sur
   mobile après déploiement, que la version attendue est bien celle servie
   (cache navigateur/service worker). Reste à définir : source de la
   version (champ `package.json` versionné manuellement, ou hash de commit
   injecté au build via Vite `define`/`import.meta.env`). Demandé par Cyril
   le 2026-08-02.
2. **Textures imaginées pour les exoplanètes — aller plus loin que
   l'existant** : `planetTexture.ts` a déjà un rendu procédural (styles
   rocky/cloudy/icyCracks/gasBands/lava, déduit de `cloudDensity` ou calibré
   via `interpretation_override.textureStyle` pour certaines exoplanètes
   précises) — donc la brique de base existe déjà. Le point ici est
   d'enrichir/diversifier ce rendu pour qu'il soit visuellement plus
   distinctif et "habité" par corps (ex. reliefs, variations de teinte plus
   organiques, motifs moins répétitifs d'une exoplanète à l'autre), tout en
   gardant explicitement le cadre "simulation/impression d'artiste" déjà en
   place (jamais présenté comme une photo réelle). Demandé par Cyril le
   2026-07-26, **remonté en priorité haute le 2026-08-02** ("très
   important" — rendu actuel jugé décevant sur les exoplanètes, contrairement
   au Système Solaire qui bénéficie de vraies photos NASA). Étude comparative
   des solutions gratuites lancée le 2026-08-02 (en cours).
3. **Ciel nocturne exoplanète — fond d'étoiles/constellations non
   physiquement exact** : remarque d'un physicien consulté par Cyril (le
   2026-08-01) : les constellations affichées dans la vue "ciel nocturne
   depuis une exoplanète" sont exactement les mêmes qu'observées depuis la
   Terre — physiquement faux dès qu'on change de point d'observation de
   plusieurs années-lumière (parallaxe : les étoiles proches changeraient
   fortement de position apparente les unes par rapport aux autres, aucune
   des constellations terrestres ne resterait reconnaissable). **Vérifié et
   confirmé le 2026-08-02** (investigation détaillée, sans nuance) :
   - Le fond catalogue Hipparcos (`makeCatalogStars`/`makeConstellationLines`
     dans `scenes/sky2d.ts:588-589`) ne consomme que `ra`/`dec` géocentriques,
     sans tenir compte du point d'observation — confirmé par le commentaire du
     code lui-même (`sky2d.ts:570-579`). Seuls les systèmes du jeu de données
     NASA (dont le Soleil) sont correctement reprojetés par parallaxe, via
     `realStarPosition()` (`scenes/galaxy.ts:45-57`) — ~15 systèmes sur les
     ~1500 étoiles du catalogue.
   - Le commentaire existant dans le code ("~65 pc") est **obsolète** : les
     systèmes du jeu de données actuel vont jusqu'à 406 pc (~1324 al), et de
     nombreuses étoiles brillantes des constellations (Sirius, Vega,
     Arcturus...) sont à une distance du même ordre que le déplacement de
     l'observateur — donc l'effet de déformation concerne la quasi-totalité
     des exoplanètes proposées, pas seulement des cas extrêmes.
   - Un disclaimer existe déjà (`renderExoSkyInfoPanel`, clé i18n
     `exoSkyApproxHint`, `main.ts:1434-1441`) mais reste discret (italique,
     11px, opacité 0.7) — quick-win identifié : le rendre plus visible + corriger
     le commentaire "~65 pc" obsolète dans `sky2d.ts`.
   - Le champ parallaxe (`Plx`) existe dans la table Hipparcos interrogée par
     `scripts/ingest_constellations.py:65-68` mais n'est pas demandé — ajouter
     la distance des étoiles du catalogue est donc trivial côté ingestion ;
     en revanche reprojeter le fond + refaire les figures de constellations
     reste un vrai chantier de rendu, pas juste un fetch de données. Urgence
     jugée faible à moyenne (pas de désinformation active grâce au
     disclaimer existant, mais à muscler).
4. **Dézoomer et voir notre galaxie de l'extérieur, avec ses voisines**
   (Groupe Local). Concrètement : aujourd'hui la vue "galaxie" du site ne
   montre qu'un petit voisinage stellaire proche (le Soleil + une poignée de
   systèmes exoplanétaires réels) — pas du tout la Voie Lactée entière, et
   encore moins l'univers. Ce point ajouterait un niveau de zoom
   supplémentaire *au-dessus* de la vue actuelle, où l'on dézoomerait jusqu'à
   voir la Voie Lactée comme un simple point parmi ses galaxies voisines
   réelles (Andromède M31, Triangulum M33, Grand/Petit Nuage de Magellan), à
   leurs vraies distances (échelle en mégaparsecs, donc une toute nouvelle
   échelle en plus de celle déjà utilisée). Nécessite une nouvelle scène 3D
   et un nouvel état dans la navigation — un chantier non négligeable.
   Priorité basse : jugé purement cosmétique — aucune exoplanète ni spectre
   JWST à afficher à cette échelle, ça ne sert pas l'axe différenciant du
   projet (atmosphères simulées à partir de spectres réels), contrairement
   aux autres points ci-dessus. Demandé par Cyril le 2026-07-12.
5. **Mode de navigation "vaisseau spatial"** avec vue cockpit, pilotable au
   clavier — uniquement à l'intérieur d'un système solaire donné (pas en vue
   galaxie) : remplacerait ponctuellement OrbitControls par un déplacement
   libre caméra (avance/recul/rotation) dans la scène `system.ts` déjà
   chargée. Demandé par Cyril le 2026-07-21, **repoussé en dernière priorité
   le 2026-08-02** (fonctionnalité cosmétique de confort de navigation, sans
   lien avec l'axe différenciant atmosphères/spectres du projet).

✅ **Mobile — toucher un astre doit afficher directement ses infos** : sur
mobile, sélectionner un astre (ex. le Soleil ou la Terre) n'affichait pas ses
explications tant qu'on n'avait pas explicitement ouvert l'onglet "Infos" du
menu du bas ; toucher le Soleil en vue système faisait en plus *retourner* à
la vue système au lieu de juste le sélectionner, et toucher la Terre ne
faisait rien du tout. Demandé par Cyril le 2026-08-01, **implémenté le
2026-08-01** (tap mobile = sélection + ouverture auto de l'onglet Infos).

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
