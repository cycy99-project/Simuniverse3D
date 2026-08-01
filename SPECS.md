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

## Backlog & priorités (ordre de réalisation souhaité par Cyril, réordonné le 2026-07-21 ; items traités retirés le 2026-07-26)

✅ **Ciel nocturne vu depuis une exoplanète** (validé par Cyril le 2026-07-26) :
option, pour chaque exoplanète, permettant d'afficher son ciel de nuit et d'y
repérer notre Soleil (vu depuis cette exoplanète), avec constellations et
autres systèmes visibles depuis là-bas. Voie lactée texturée avec contours,
halo solaire scintillant + flèche + label — itéré suite retours visuels de
Cyril (bug de recentrage caméra corrigé, rendu de la bande galactique
retravaillé).

1. **Date de découverte + méthode de détection + anecdote "événement
   historique observable"** : ajouter comme paramètres affichés pour chaque
   exoplanète sa date de découverte et sa méthode de détection ; anecdote
   ludique complémentaire — si on observait la Terre depuis cette
   exoplanète (délai lumière = distance en années-lumière), quel événement
   historique de l'humanité serait théoriquement visible cette année-là.
   Demandé par Cyril le 2026-07-21. **En cours (2026-07-26).**
2. **Comparaison exoplanète vs Terre** : pour chaque exoplanète, une fiche
   de comparaison directe avec la Terre (taille, masse, température, type
   de planète...). Demandé par Cyril le 2026-07-21.
3. **Losange de sélection + bouton "Explorer"** pour les satellites, comme
   c'est déjà le cas pour les étoiles/systèmes et les planètes (indicateur
   visuel en losange autour de l'objet sélectionné + carte du bas avec nom,
   type et bouton "Explorer →") : actuellement absent pour les lunes
   sélectionnées en vue système/planète. Demandé par Cyril le 2026-07-26.
4. **Mode de navigation "vaisseau spatial"** avec vue cockpit, pilotable au
   clavier — uniquement à l'intérieur d'un système solaire donné (pas en vue
   galaxie) : remplacerait ponctuellement OrbitControls par un déplacement
   libre caméra (avance/recul/rotation) dans la scène `system.ts` déjà
   chargée. Demandé par Cyril le 2026-07-21 (non inclus dans le
   réordonnancement explicite du même jour, conservé en fin de liste).
5. **Dézoomer et voir notre galaxie de l'extérieur, avec ses voisines**
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
   Priorité basse (repoussé en fin de liste le 2026-07-26) : jugé purement
   cosmétique — aucune exoplanète ni spectre JWST à afficher à cette échelle,
   ça ne sert pas l'axe différenciant du projet (atmosphères simulées à
   partir de spectres réels), contrairement aux autres points ci-dessus.
   Demandé par Cyril le 2026-07-12.
6. **Textures imaginées pour les exoplanètes — aller plus loin que
   l'existant** : `planetTexture.ts` a déjà un rendu procédural (styles
   rocky/cloudy/icyCracks/gasBands/lava, déduit de `cloudDensity` ou calibré
   via `interpretation_override.textureStyle` pour certaines exoplanètes
   précises) — donc la brique de base existe déjà. Le point ici est
   d'enrichir/diversifier ce rendu pour qu'il soit visuellement plus
   distinctif et "habité" par corps (ex. reliefs, variations de teinte plus
   organiques, motifs moins répétitifs d'une exoplanète à l'autre), tout en
   gardant explicitement le cadre "simulation/impression d'artiste" déjà en
   place (jamais présenté comme une photo réelle). Demandé par Cyril le
   2026-07-26.
7. **Mobile — toucher un astre doit afficher directement ses infos** : sur
   mobile, sélectionner un astre (ex. le Soleil ou la Terre) n'affiche pas
   ses explications tant qu'on n'a pas explicitement ouvert l'onglet "Infos"
   du menu du bas. Comportement actuel bogué en plus : toucher le Soleil en
   vue système fait *retourner* à la vue système (au lieu de juste le
   sélectionner) ; toucher la Terre ne fait rien du tout. Objectif : un tap
   sur un astre doit toujours faire apparaître ses informations directement,
   sans étape intermédiaire ni comportement de navigation surprise. À
   investiguer : logique de sélection tactile (`selectPending`/
   `updateSelectionCard` dans `main.ts`) qui semble traiter le tap différemment
   du clic desktop. Demandé par Cyril le 2026-08-01. **Implémenté le
   2026-08-01** (tap mobile = sélection + ouverture auto de l'onglet Infos).
8. **Ciel nocturne exoplanète — fond d'étoiles/constellations non
   physiquement exact** : remarque d'un physicien consulté par Cyril (le
   2026-08-01) : les constellations affichées dans la vue "ciel nocturne
   depuis une exoplanète" sont exactement les mêmes qu'observées depuis la
   Terre — physiquement faux dès qu'on change de point d'observation de
   plusieurs années-lumière (parallaxe : les étoiles proches changeraient
   fortement de position apparente les unes par rapport aux autres, aucune
   des constellations terrestres ne resterait reconnaissable). Déjà documenté
   comme limitation connue dans le code (`scenes/sky2d.ts`, commentaire ~L572) :
   seuls les objets à distance connue (notre Soleil vu depuis l'exoplanète)
   sont repositionnés correctement ; le fond d'étoiles catalogue
   (Hipparcos) + les figures de constellations n'ont pas de distance
   disponible dans le jeu de données ingéré, donc restent tels que vus
   depuis la Terre, par simplification. Deux pistes, non tranchées : (a)
   court terme — ajouter un disclaimer explicite dans l'UI précisant que le
   fond d'étoiles est "vu depuis la Terre, à titre de repère" (cohérent avec
   la convention centrale du projet de toujours étiqueter les simulations,
   cf. `deriveAtmosphere()`) ; (b) long terme — le catalogue Hipparcos
   contient des données de parallaxe (donc de distance) qui permettraient de
   reprojeter correctement les étoiles proches (quelques centaines
   d'années-lumière) depuis le point de vue de l'exoplanète ; chantier de
   données conséquent, non commencé.

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
