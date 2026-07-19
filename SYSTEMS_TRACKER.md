# Suivi d'intégration des systèmes exoplanétaires

Systèmes déjà présents dans `data/seed_systems.json` : Système Solaire (11 corps), WASP-39, K2-18 (b+c), HD 189733, TRAPPIST-1 (7 planètes), WASP-96, WASP-107, WASP-17, WASP-121, HD 209458, GJ 1214, TOI-270, 55 Cancri, LHS 3844.

Ce document liste les systèmes candidats pour la suite, avec leur intérêt scientifique/pédagogique et les données déjà disponibles pour les molécules/`interpretation_override`/`planet_type`/`learn_more`. Les dates et papiers cités ci-dessous sont indicatifs (mémoire de travail) — **à revérifier avant rédaction finale du contenu**, comme pour les systèmes déjà intégrés.

## Légende

- **Priorité** : 1 (haute valeur, données solides) → 3 (intérêt narratif, données limitées ou absentes)
- **Statut** : À faire / En cours / Fait

## Tableau de suivi

| # | Système / planète | Catégorie | Intérêt scientifique & pédagogique | Données disponibles | Priorité | Statut |
|---|---|---|---|---|---|---|
| 1 | **WASP-96 b** | Jupiter chaud | Détection nette et propre de vapeur d'eau (JWST NIRISS, 2022) — cas "manuel" simple, bon contraste avec WASP-39 b (CO2) | JWST NIRISS SOSS | 1 | Fait |
| 2 | **WASP-107 b** | Sous-Saturne très peu dense | SO2 détecté (photochimie) mais méthane étonnamment absent malgré la température modérée — signe de mélange interne/chauffage (Dyrek et al. 2024, Nature) | JWST MIRI | 1 | Fait |
| 3 | **WASP-17 b** | Jupiter chaud | Nuages de nanocristaux de quartz (SiO2) identifiés en haute atmosphère — première identification directe d'un minéral précis sur une exoplanète (Grant et al. 2023) | JWST MIRI | 1 | Fait |
| 4 | **WASP-121 b** | Jupiter ultra-chaud | Inversion thermique, métaux ionisés (Fe, Mg, V/VO), eau en émission côté jour — bon exemple de "trop chaud pour les nuages" | HST + JWST | 1 | Fait |
| 5 | **HD 209458 b** ("Osiris") | Jupiter chaud | Valeur historique : première atmosphère exoplanétaire jamais détectée (sodium, Charbonneau et al. 2002) et première atmosphère vue en évaporation (Vidal-Madjar et al. 2003) | HST/STIS | 1 | Fait |
| 6 | **GJ 1214 b** | Mini-Neptune brumeuse | Spectre JWST 2023 quasi plat : atmosphère à très haute métallicité/brumes opaques — excellent contre-exemple pédagogique face à K2-18 b (Kempton et al. 2023, Nature) | JWST NIRSpec | 1 | Fait |
| 7 | **TOI-270 d** | Sous-Neptune tempérée | CH4/CO2/H2O détectés, pas de NH3 — deuxième candidat "hycéen" sérieux après K2-18 b (Benneke et al. 2024) | JWST NIRSpec/NIRISS | 1 | Fait |
| 8 | **55 Cancri e** | Super-Terre de lave | Possible atmosphère secondaire CO2/CO détectée par JWST (2024) — contraste direct avec les TRAPPIST-1 b/c "nues". Système enrichi (2026-07) : 4 planètes géantes b/c/d/f ajoutées, étoile compagne 55 Cancri B (naine rouge, données textuelles uniquement) et texture "lava" dédiée | JWST MIRI | 1 | Fait |
| 9 | **LHS 3844 b** | Super-Terre de lave | Roche nue confirmée sans atmosphère (Spitzer, Kreidberg et al. 2019) — précédent historique qui a motivé les études TRAPPIST-1 b/c | Spitzer | 1 | Fait |
| 10 | **WASP-43 b** | Jupiter chaud | Courbe de phase complète JWST, contraste jour/nuit extrême, eau détectée | JWST | 2 | À faire |
| 11 | **WASP-69 b** | Jupiter chaud gonflé | Échappement atmosphérique d'hélium observé (queue cométaire) — bon exemple de perte de masse atmosphérique | Sol (CARMENES/Palomar) | 2 | À faire |
| 12 | **GJ 486 b** | Super-Terre rocheuse | Signal candidat de vapeur d'eau, dégénéré avec une contamination par taches stellaires — cas d'incertitude scientifique instructif (Moran et al. 2023) | JWST NIRSpec | 2 | À faire |
| 13 | **HR 8799 (b, c, d, e)** | Système multi-Jupiters, imagerie directe | Premier système multi-planétaire directement imagé (Marois et al. 2008) — catégorie visuelle totalement différente (pas de transit, planètes vues individuellement) | Imagerie directe (Keck) | 2 | À faire |
| 14 | **Kepler-186f** | Super-Terre tempérée | Première planète de taille terrestre confirmée en zone habitable d'une autre étoile (2014) — jalon historique | Aucune spectro | 2 | À faire |
| 15 | **Proxima Centauri b** | Terre tempérée | L'exoplanète confirmée la plus proche du Soleil (4,2 al) — forte valeur narrative, mais pas de transit donc pas de spectroscopie possible | Aucune (non-transitante) | 3 | À faire |
| 16 | **TOI-700 d/e** | Système compact, Terres tempérées | Deux planètes de taille terrestre en zone habitable d'une naine calme (TESS) — bon "petit système" pédagogique | Aucune spectro encore | 3 | À faire |
| 17 | **Beta Pictoris b/c** | Jeunes géantes, imagerie directe | Système jeune (~20 Ma) avec disque de débris, imagerie directe — variété visuelle (formation planétaire en cours) | Imagerie directe | 3 | À faire |

## Notes de méthode

- Les priorités 1 favorisent soit une donnée JWST solide et bien médiatisée, soit un contraste pédagogique fort avec un système déjà présent (ex. GJ 1214 b vs K2-18 b, LHS 3844 b / 55 Cnc e vs TRAPPIST-1 b/c).
- Les systèmes en imagerie directe (HR 8799, Beta Pictoris) demandent une géométrie différente de celle des systèmes en transit (positions orbitales réelles observées plutôt que déduites) — à anticiper si on les intègre.
- Avant de rédiger `learn_more`/`spectrum_ref`/`interpretation_override` pour un système, revérifier les faits (dates, auteurs, valeurs) comme pour les systèmes déjà en place.
