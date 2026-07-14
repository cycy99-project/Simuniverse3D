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
  hintGalaxy: { fr: "Clique sur une étoile pour entrer dans son système.", en: "Click a star to enter its system." },
  hintSystem: { fr: "Clique sur une planète pour voir son atmosphère simulée.", en: "Click a planet to see its simulated atmosphere." },
  hintAtmosphere: {
    fr: "Vue atmosphère — souris pour tourner ; clique ou Échap pour revenir au système.",
    en: "Atmosphere view — drag to rotate; click or Esc to go back to the system.",
  },
  breadcrumbGalaxy: { fr: "Voie Lactée", en: "Milky Way" },
  searchPlaceholder: { fr: "🔍 Rechercher un astre…", en: "🔍 Search a body…" },
  searchNotFound: { fr: "Aucun résultat", en: "No result" },
  spectralType: { fr: "Type spectral", en: "Spectral type" },
  unknown: { fr: "inconnu", en: "unknown" },
  temperature: { fr: "Température (Teff)", en: "Temperature (Teff)" },
  distance: { fr: "Distance", en: "Distance" },
  knownPlanetsCount: { fr: "planète(s) connue(s) dans ce système.", en: "known planet(s) in this system." },
  orbitRadiusMass: { fr: "Orbite", en: "Orbit" },
  radius: { fr: "Rayon", en: "Radius" },
  mass: { fr: "Masse", en: "Mass" },
  equilibriumTemp: { fr: "Température d'équilibre", en: "Equilibrium temperature" },
  molecules: { fr: "Molécules", en: "Molecules" },
  noMoleculeDetected: { fr: "Aucune molécule détectée", en: "No molecule detected" },
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
  rotationPeriod: { fr: "Rotation sur elle-même", en: "Rotation period" },
  retrograde: { fr: "rétrograde", en: "retrograde" },
  satellites: { fr: "Satellites", en: "Moons" },
  noSatellite: { fr: "Aucun satellite connu", en: "No known moon" },
  hintStar: {
    fr: "Vue étoile — clique ou Échap pour revenir au système.",
    en: "Star view — click or Esc to go back to the system.",
  },
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
  compareShowSun: { fr: "☉ Comparer au Soleil", en: "☉ Compare to the Sun" },
  compareShowEarthStar: { fr: "🌍 Comparer à la Terre", en: "🌍 Compare to Earth" },
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
  studentModeOn: { fr: "🎓 Mode Élève : ON", en: "🎓 Pupil mode: ON" },
  studentModeOff: { fr: "🎓 Mode Élève : OFF", en: "🎓 Pupil mode: OFF" },
  studentModeNote: {
    fr: "Cartouches simplifiées et anecdotes ludiques, pensées pour les plus jeunes.",
    en: "Simplified panels and fun facts, designed for younger explorers.",
  },
} satisfies Record<string, { fr: string; en: string }>;

export type DictKey = keyof typeof dict;

export function t(key: DictKey): string {
  return dict[key][currentLang];
}
