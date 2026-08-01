export type Lang = "fr" | "en";

const STORAGE_KEY = "universe3d.lang";

let currentLang: Lang = (localStorage.getItem(STORAGE_KEY) as Lang | null) ?? "fr";

const listeners = new Set<() => void>();

export function getLang(): Lang {
  return currentLang;
}

export function setLang(lang: Lang): void {
  if (lang === currentLang) return;
  currentLang = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  listeners.forEach((cb) => cb());
}

export function onLangChange(cb: () => void): void {
  listeners.add(cb);
}

const dict = {
  distanceHudTravel: {
    fr: "voyage",
    en: "travel",
  },
  hintGalaxy: {
    fr: "Clique sur une étoile pour la sélectionner, puis Explorer pour entrer dans son système.",
    en: "Click a star to select it, then Explore to enter its system.",
  },
  hintSystem: {
    fr: "Clique sur une planète pour la sélectionner, puis Explorer pour voir son atmosphère simulée.",
    en: "Click a planet to select it, then Explore to see its simulated atmosphere.",
  },
  hintAtmosphere: {
    fr: "Vue atmosphère — souris pour tourner ; clique ou Échap pour revenir au système.",
    en: "Atmosphere view — drag to rotate; click or Esc to go back to the system.",
  },
  breadcrumbGalaxy: { fr: "Voie Lactée", en: "Milky Way" },
  breadcrumbSky2d: { fr: "Ciel par constellations", en: "Sky by constellation" },
  hintSky2d: {
    fr: "Glisse la souris pour regarder autour de toi, molette pour zoomer ; clique une étoile puis Explorer pour entrer dans son système, ou une constellation pour ses infos.",
    en: "Drag the mouse to look around, scroll to zoom; click a star then Explore to enter its system, or a constellation for its info.",
  },
  breadcrumbExoSky: { fr: "Ciel nocturne", en: "Night sky" },
  hintExoSky: {
    fr: "Glisse la souris pour regarder autour de toi, molette pour zoomer ; le Soleil ☉ est repéré en doré. Clique une étoile puis Explorer pour rejoindre son système.",
    en: "Drag the mouse to look around, scroll to zoom; the Sun ☉ is marked in gold. Click a star then Explore to reach its system.",
  },
  exoSkyToggleShow: { fr: "🌌 Ciel nocturne", en: "🌌 Night sky" },
  exoSkyTitle: { fr: "Ciel nocturne", en: "Night sky" },
  exoSkyViewedFrom: { fr: "Vu depuis", en: "Seen from" },
  exoSkySunDistance: { fr: "Le Soleil ☉ se trouve à environ", en: "The Sun ☉ is about" },
  exoSkyLightYears: { fr: "années-lumière d'ici", en: "light-years from here" },
  exoSkyApproxHint: {
    fr: "Le Soleil et les autres systèmes sont repositionnés selon leur vraie direction depuis ici, mais le fond d'étoiles et les constellations restent ceux vus depuis la Terre (données de distance non disponibles pour ce fond de ciel) — simulation, pas une observation réelle.",
    en: "The Sun and other systems are repositioned according to their true direction from here, but the background stars and constellations remain as seen from Earth (no distance data available for this sky background) — a simulation, not a real observation.",
  },
  sunLocatorLabel: { fr: "🧭 Repérer le Soleil", en: "🧭 Locate the Sun" },
  milkyWayLabel: { fr: "Voie lactée", en: "Milky Way" },
  homeTitle: { fr: "UNIVERSE3D", en: "UNIVERSE3D" },
  homeSubtitle: {
    fr: "Choisis ta vue pour explorer les systèmes exoplanétaires proches.",
    en: "Choose your view to explore nearby exoplanetary systems.",
  },
  homeChoiceGalaxyLabel: { fr: "Vue 3D Voie Lactée", en: "3D Milky Way view" },
  homeChoiceGalaxyDesc: {
    fr: "Naviguer en 3D parmi les étoiles proches et leurs systèmes.",
    en: "Navigate in 3D among nearby stars and their systems.",
  },
  homeChoiceSky2dLabel: { fr: "Vue 2D par constellation", en: "2D constellation view" },
  homeChoiceSky2dDesc: {
    fr: "Le ciel complet des 88 constellations, comme depuis la Terre.",
    en: "The full sky of all 88 constellations, as seen from Earth.",
  },
  homeButton: { fr: "🏠 Accueil", en: "🏠 Home" },
  mobileNavHome: { fr: "Accueil", en: "Home" },
  mobileNavSearch: { fr: "Recherche", en: "Search" },
  mobileNavInfo: { fr: "Infos", en: "Info" },
  mobileNavDisplay: { fr: "Affichage", en: "Display" },
  mobileNavSettings: { fr: "Réglages", en: "Settings" },
  mobileSearchTitle: { fr: "Rechercher", en: "Search" },
  mobileInfoTitle: { fr: "Informations", en: "Information" },
  mobileDisplayTitle: { fr: "Affichage", en: "Display" },
  mobileSettingsTitle: { fr: "Réglages", en: "Settings" },
  creditsTextures: { fr: "Textures", en: "Textures" },
  creditsConstellations: { fr: "Constellations", en: "Constellations" },
  creditsMusic: { fr: "Musique", en: "Music" },
  musicToggleLabel: { fr: "Musique", en: "Music" },
  installAppToggle: { fr: "📲 Installer l'Application", en: "📲 Install the App" },
  lightboxClose: { fr: "Fermer", en: "Close" },
  lightboxPrev: { fr: "Précédent", en: "Previous" },
  lightboxNext: { fr: "Suivant", en: "Next" },
  searchPlaceholder: { fr: "🔍 Rechercher un astre…", en: "🔍 Search a body…" },
  searchNotFound: { fr: "Aucun résultat", en: "No result" },
  spectralType: { fr: "Type spectral", en: "Spectral type" },
  unknown: { fr: "inconnu", en: "unknown" },
  temperature: { fr: "Température (Teff)", en: "Temperature (Teff)" },
  distance: { fr: "Distance", en: "Distance" },
  constellation: { fr: "Constellation", en: "Constellation" },
  constellationSystemsHere: {
    fr: "Systèmes de ce jeu de données situés dans cette constellation :",
    en: "Systems from this dataset located in this constellation:",
  },
  constellationNoSystems: {
    fr: "Aucun système de ce jeu de données dans cette constellation.",
    en: "No system from this dataset in this constellation.",
  },
  constellationBrightestStar: { fr: "Étoile la plus brillante", en: "Brightest star" },
  magnitudeAbbr: { fr: "mag.", en: "mag." },
  constellationDeepSkyObjects: { fr: "Objets du ciel profond notables", en: "Notable deep-sky objects" },
  knownPlanetsCount: { fr: "planète(s) connue(s) dans ce système.", en: "known planet(s) in this system." },
  orbitRadiusMass: { fr: "Orbite", en: "Orbit" },
  radius: { fr: "Rayon", en: "Radius" },
  mass: { fr: "Masse", en: "Mass" },
  equilibriumTemp: { fr: "Température d'équilibre", en: "Equilibrium temperature" },
  molecules: { fr: "Molécules", en: "Molecules" },
  planetType: { fr: "Type de planète", en: "Planet type" },
  noMoleculeDetected: { fr: "Aucune molécule détectée", en: "No molecule detected" },
  discoveryLabel: { fr: "Découverte", en: "Discovery" },
  historicalAnecdoteQuestion: {
    fr: "🔭 Si on observait la Terre depuis ici aujourd'hui ?",
    en: "🔭 What if we observed Earth from here today?",
  },
  historicalAnecdoteBce: { fr: "av. J.-C.", en: "BCE" },
  reference: { fr: "Référence", en: "Reference" },
  learnMore: { fr: "📖 En savoir plus", en: "📖 Learn more" },
  viewSource: { fr: "Voir la fiche source", en: "View source page" },
  visualRendering: { fr: "Rendu visuel (heuristique)", en: "Visual rendering (heuristic)" },
  sourceKnown: { fr: "Donnée connue (Système Solaire)", en: "Known data (Solar System)" },
  sourceJwst: { fr: "Simulation plausible (basée spectroscopie JWST)", en: "Plausible simulation (based on JWST spectroscopy)" },
  sourceNoDetection: {
    fr: "Non-détection (JWST) : probablement pas d'atmosphère épaisse",
    en: "Non-detection (JWST): likely no thick atmosphere",
  },
  sourceNoData: { fr: "Aucune donnée de spectroscopie disponible", en: "No spectroscopy data available" },
  distanceFromEarth: { fr: "Distance depuis la Terre", en: "Distance from Earth" },
  travelTime: { fr: "Temps de trajet estimé", en: "Estimated travel time" },
  travelTimeCaption: {
    fr: "à la vitesse de Voyager 1 (≈17,3 km/s, l'objet le plus rapide ayant quitté le Système Solaire)",
    en: "at Voyager 1's speed (≈17.3 km/s, the fastest object to ever leave the Solar System)",
  },
  compareShow: { fr: "🌍 Comparer à la Terre", en: "🌍 Compare to Earth" },
  compareHide: { fr: "↩ Revenir à la vue normale", en: "↩ Back to normal view" },
  // Libellés statiques (ne changent pas selon l'état, contrairement à
  // compareShow/compareHide ci-dessus) : les deux boutons Terre/Soleil restent
  // affichés en permanence sur les fiches planète et étoile, seul l'état actif
  // (classe CSS .active) indique lequel est sélectionné.
  compareEarthButton: { fr: "🌍 Comparer à la Terre", en: "🌍 Compare to Earth" },
  compareSunButton: { fr: "☉ Comparer au Soleil", en: "☉ Compare to the Sun" },
  rotationPeriod: { fr: "Rotation sur elle-même", en: "Rotation period" },
  retrograde: { fr: "rétrograde", en: "retrograde" },
  satellites: { fr: "Satellites", en: "Moons" },
  noSatellite: { fr: "Aucun satellite connu", en: "No known moon" },
  hintStar: {
    fr: "Vue étoile — clique ou Échap pour revenir au système.",
    en: "Star view — click or Esc to go back to the system.",
  },
  starCategory: { fr: "Catégorie", en: "Category" },
  starRadius: { fr: "Rayon", en: "Radius" },
  starComposition: { fr: "Composition", en: "Composition" },
  starCompositionText: {
    fr: "Hydrogène ≈73 %, Hélium ≈25 %, éléments plus lourds ≈2 % — composition typique d'une étoile de séquence principale.",
    en: "Hydrogen ≈73%, Helium ≈25%, heavier elements ≈2% — typical composition of a main-sequence star.",
  },
  starKnownNote: { fr: "Données réelles du Soleil.", en: "Real Sun data." },
  starArchiveNote: {
    fr: "Type spectral, température et rayon (si mesuré) : NASA Exoplanet Archive. Couleur dérivée du type spectral (approximation physique standard).",
    en: "Spectral type, temperature and radius (if measured): NASA Exoplanet Archive. Color derived from spectral type (standard physical approximation).",
  },
  hintMoon: {
    fr: "Vue satellite — clique ailleurs pour revenir à la planète.",
    en: "Moon view — click elsewhere to go back to the planet.",
  },
  moonRadius: { fr: "Rayon", en: "Radius" },
  moonOrbit: { fr: "Orbite autour de la planète", en: "Orbit around the planet" },
  moonPeriod: { fr: "Période orbitale", en: "Orbital period" },
  moonPhotoNote: { fr: "Photo réelle (texture).", en: "Real photo (texture)." },
  moonColorNote: { fr: "Couleur réelle approximative (pas de photo disponible).", en: "Approximate real color (no photo available)." },
  voyagerDistance: { fr: "Distance au Soleil (estimée en temps réel)", en: "Distance from the Sun (real-time estimate)" },
  voyagerSpeed: { fr: "Vitesse de récession héliocentrique", en: "Heliocentric recession speed" },
  voyagerNote: {
    fr: "Distance extrapolée depuis une position de référence réelle et la vitesse réelle connue de la sonde (pas une simulation) ; direction affichée schématique, non calée sur les coordonnées célestes réelles.",
    en: "Distance extrapolated from a real reference position and the probe's known real speed (not a simulation); displayed direction is schematic, not tied to real celestial coordinates.",
  },
  dwarfPlanetBadge: { fr: "Planète naine", en: "Dwarf planet" },
  asteroidBelt: { fr: "Ceinture d'astéroïdes", en: "Asteroid belt" },
  kuiperBelt: { fr: "Ceinture de Kuiper", en: "Kuiper belt" },
  orbitPlanesSimplified: { fr: "☰ Orbites simplifiées (coplanaires)", en: "☰ Simplified orbits (coplanar)" },
  orbitPlanesReal: { fr: "🪐 Plans orbitaux réels", en: "🪐 Real orbital planes" },
  orbitPlanesUnavailable: {
    fr: "Inclinaisons orbitales réelles non disponibles pour ce système (données non mesurées)",
    en: "Real orbital inclinations not available for this system (unmeasured data)",
  },
  satellitesShown: { fr: "Satellites affichés", en: "Moons shown" },
  satellitesKnown: { fr: "Satellites existants", en: "Known moons" },
  pauseOrbits: { fr: "⏸ Mettre en pause", en: "⏸ Pause" },
  resumeOrbits: { fr: "▶ Reprendre", en: "▶ Resume" },
  habitableZoneShow: { fr: "🌱 Zone habitable", en: "🌱 Habitable zone" },
  habitableZoneHide: { fr: "🌱 Masquer la zone habitable", en: "🌱 Hide habitable zone" },
  habitableZoneUnavailable: {
    fr: "Zone habitable non calculable pour ce système (température/rayon stellaire manquants)",
    en: "Habitable zone not computable for this system (missing stellar temperature/radius)",
  },
  habitableZoneLabel: { fr: "Zone habitable (théorique)", en: "Habitable zone (theoretical)" },
  moonScaleShow: { fr: "🔎 Échelle réelle (par défaut)", en: "🔎 Real scale (default)" },
  moonScaleHide: { fr: "👁 Échelle visuelle (lisibilité)", en: "👁 Visual scale (readability)" },
  moonScaleRealHint: {
    fr: "Taille proportionnelle réelle (rayon lune / rayon planète) : certains satellites deviennent minuscules — zoomez et repérez-les par leur nom.",
    en: "Real proportional size (moon radius / planet radius): some moons become tiny — zoom in and locate them by name.",
  },
  moonDistanceShow: { fr: "📏 Distance réelle", en: "📏 Real distance" },
  moonDistanceHide: { fr: "📏 Distance stylisée (lisibilité)", en: "📏 Stylized distance (readability)" },
  moonDistanceRealHint: {
    fr: "Distance proportionnelle réelle (orbite lune / rayon planète), sans compression : certains satellites s'éloignent beaucoup — la caméra recule automatiquement pour les garder dans le champ.",
    en: "Real proportional distance (moon orbit / planet radius), uncompressed: some moons move very far away — the camera automatically pulls back to keep them in frame.",
  },
  moonDistanceStylizedHint: {
    fr: "Distance stylisée par défaut : à l'échelle réelle, certaines lunes proches (ex. notre Lune, Charon) seraient quasi collées à leur planète et illisibles. On les écarte un peu pour rester lisible — activez « Distance réelle » pour voir les vraies proportions.",
    en: "Stylized distance by default: at true scale, some close moons (e.g. our Moon, Charon) would sit almost against their planet and be unreadable. We space them out a bit for readability — enable \"Real distance\" to see the true proportions.",
  },
  moonSurfaceViewPrefix: { fr: "🌌 Vue de", en: "🌌 View of" },
  moonSurfaceViewHide: { fr: "👁 Retour à la vue du satellite", en: "👁 Back to moon view" },
  hintMoonSurface: {
    fr: "Vue imaginée depuis la surface — taille et couleur réelles de la planète, sol schématique. Glisse la souris pour regarder autour de toi (pas de zoom ni déplacement).",
    en: "Imagined surface view — real size and color of the planet, schematic ground. Drag the mouse to look around (no zoom or movement).",
  },
  hintMoonSurfaceHazy: {
    fr: "Vue imaginée depuis la surface — brume atmosphérique réelle et opaque : ni étoiles ni planète visibles depuis le sol (comme constaté par la sonde Huygens). Glisse la souris pour regarder autour de toi (pas de zoom ni déplacement).",
    en: "Imagined surface view — real, opaque atmospheric haze: no stars or planet visible from the ground (as found by the Huygens probe). Drag the mouse to look around (no zoom or movement).",
  },
  skyQuestionAirless: {
    fr: "🌌 Pourquoi le ciel est-il noir, même en plein jour ?",
    en: "🌌 Why is the sky black, even in broad daylight?",
  },
  skyAnswerAirless: {
    fr: "Sans atmosphère, il n'y a rien pour diffuser la lumière du Soleil dans toutes les directions : le ciel reste noir même en plein jour, exactement comme les astronautes d'Apollo l'ont observé et photographié sur la Lune.",
    en: "With no atmosphere, there's nothing to scatter sunlight in every direction: the sky stays black even in broad daylight — exactly as the Apollo astronauts observed and photographed on the Moon.",
  },
  skyQuestionTitan: {
    fr: "🌫️ Pourquoi le ciel de Titan est-il orange et jamais noir ?",
    en: "🌫️ Why is Titan's sky orange and never black?",
  },
  skyAnswerTitan: {
    fr: "Titan est la seule lune du Système solaire dotée d'une atmosphère dense (azote et méthane) : elle diffuse la lumière et forme une brume opaque orangée qui masque totalement le ciel étoilé — et même Saturne, pourtant énorme dans son ciel. En se posant en 2005, la sonde Huygens n'a jamais pu l'apercevoir à travers cette brume.",
    en: "Titan is the only moon in the Solar System with a dense atmosphere (nitrogen and methane): it scatters light and forms an opaque orange haze that completely hides the starry sky — and even Saturn, despite being huge in its sky. When it landed in 2005, the Huygens probe was never able to glimpse it through this haze.",
  },
  daySwitchToNight: { fr: "🌙 Vue de nuit", en: "🌙 Night view" },
  daySwitchToDay: { fr: "☀️ Vue de jour", en: "☀️ Day view" },
  sciInterpOn: { fr: "🔬 Interprétation scientifique : ON", en: "🔬 Scientific interpretation: ON" },
  sciInterpOff: { fr: "🔬 Interprétation scientifique : OFF", en: "🔬 Scientific interpretation: OFF" },
  sciInterpNote: {
    fr: "Couleur/rendu déduit d'une interprétation scientifique plausible (molécules détectées, température), pas une photo réelle.",
    en: "Color/rendering derived from a plausible scientific interpretation (detected molecules, temperature), not a real photo.",
  },
  photosNasa: { fr: "🖼️ Photos officielles (NASA)", en: "🖼️ Official photos (NASA)" },
  photosWikipedia: { fr: "📖 Rechercher sur Wikipedia", en: "📖 Search on Wikipedia" },
  gravity: { fr: "Gravité de surface", en: "Surface gravity" },
  gravityOfEarth: { fr: "de la gravité terrestre", en: "of Earth's gravity" },
  gravityWeightPrefix: { fr: "tu pèserais", en: "you would weigh" },
  gravityWeightSuffix: { fr: "kg au lieu de 100 kg sur Terre", en: "kg instead of 100 kg on Earth" },
  gravityUnknown: { fr: "Gravité de surface inconnue (masse non mesurée)", en: "Surface gravity unknown (mass not measured)" },
  gravityFunFactPrefix: { fr: "🎈 Ici, tu pèserais environ", en: "🎈 Here, you'd weigh about" },
  gravityFunFactSuffix: { fr: "kg au lieu de 100 kg sur Terre !", en: "kg instead of 100 kg on Earth!" },
  selectionTypeSystem: { fr: "Système", en: "System" },
  selectionTypeStar: { fr: "Étoile", en: "Star" },
  selectionTypePlanet: { fr: "Planète", en: "Planet" },
  selectionExplore: { fr: "Explorer →", en: "Explore →" },
  visitorCounterViews: { fr: "vues", en: "views" },
  visitorCounterOnline: { fr: "en ligne", en: "online" },
} satisfies Record<string, { fr: string; en: string }>;

export type DictKey = keyof typeof dict;

export function t(key: DictKey): string {
  return dict[key][currentLang];
}
