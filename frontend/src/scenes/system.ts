import * as THREE from "three";
import type { PlanetData, SystemData } from "../data/types";
import { deriveAtmosphere } from "../atmosphere/heuristic";
import { deriveStarColor } from "../starColor";
import { makeStarSurfaceTexture } from "../starTexture";
import { addStarGlow } from "../starGlow";
import { computeHabitableZone } from "../habitableZone";
import { loadTexture } from "../textureCache";
import type { Spinnable } from "../spin";
import { buildMoons } from "./moons";
import { buildRing } from "./rings";
import { localizeName } from "../nameTranslations";
import { makeLabelSprite } from "../labelSprite";
import { makeAsteroidBelt, makeKuiperCloud } from "./asteroids";
import { t } from "../i18n";

export const STAR_CLICK_ID = "__star__";

// Couleur neutre utilisée quand l'interprétation scientifique est désactivée
// (cf. showScientificInterpretation) : signale visuellement "donnée
// insuffisante" plutôt que de proposer une teinte déduite (heuristique), pour
// les corps sans photo réelle ni couleur mesurée.
const NEUTRAL_UNKNOWN_COLOR = "#6b6b6b";

function planetMaterial(planet: PlanetData, showScientificInterpretation: boolean): THREE.Material {
  if (planet.texture) {
    return new THREE.MeshBasicMaterial({ map: loadTexture(planet.texture) });
  }
  if (planet.color) {
    return new THREE.MeshBasicMaterial({ color: planet.color });
  }
  const color = showScientificInterpretation
    ? (planet.interpretation_override ?? deriveAtmosphere(planet.molecules, planet.pl_eqt)).skyColor
    : NEUTRAL_UNKNOWN_COLOR;
  return new THREE.MeshBasicMaterial({ color });
}

// Échelle non-linéaire (racine carrée) pour garder les orbites lisibles
// malgré l'écart réel (0.01 UA pour TRAPPIST-1 b à 30 UA pour Neptune).
const ORBIT_SCALE = 15;
const MIN_PLANET_SIZE = 0.4;
const MAX_PLANET_SIZE = 2.2;

function planetSize(radiusEarth: number | null): number {
  if (radiusEarth === null) return MIN_PLANET_SIZE;
  // Compression log pour éviter que les géantes gazeuses n'écrasent la vue.
  const size = Math.log10(radiusEarth + 1) * 1.6;
  return Math.min(Math.max(size, MIN_PLANET_SIZE), MAX_PLANET_SIZE);
}

// Vitesse de révolution à l'écran, dérivée de la 3e loi de Kepler
// (T² ∝ a³) en supposant une étoile d'une masse solaire — exact pour le
// Système Solaire (le Soleil fait 1 M☉ par définition, donc les périodes
// obtenues correspondent aux vraies périodes sidérales réelles : Mercure
// ≈88 j, Terre 365,25 j, Neptune ≈165 ans), approximation schématique pour
// les systèmes exoplanétaires dont la masse stellaire n'est pas dans nos
// données. La Terre (1 an) boucle en ~40 s à 60 im/s ; les autres planètes
// sont compressées par la même loi de puissance (exposant 0.4) que les
// lunes et les rotations, pour rester lisibles malgré l'écart réel
// (0,24 an pour Mercure à 165 ans pour Neptune).
const EARTH_ORBIT_YEARS = 1;
const EARTH_ORBIT_SPEED = 0.00262;
const ORBIT_SPEED_EXPONENT = 0.4;

function orbitRevolutionSpeed(orbitAU: number): number {
  const periodYears = Math.pow(orbitAU, 1.5);
  const ratio = EARTH_ORBIT_YEARS / periodYears;
  return EARTH_ORBIT_SPEED * Math.pow(ratio, ORBIT_SPEED_EXPONENT);
}

// Échelle des lunes adaptée aux petites tailles de planètes de cette vue
// (0.4 à 2.2 unités, contre 6 pour la vue atmosphère d'une seule planète).
const MOON_SCALE = {
  orbitScale: 0.35,
  sizeScale: 0.065,
  minMoonSize: 0.03,
  maxMoonSize: 0.22,
  gapMultiplier: 1.15,
};

// Fond étoilé purement décoratif : positions aléatoires sur une coquille
// sphérique très éloignée (bien au-delà de la Ceinture de Kuiper), pas les
// vraies positions d'étoiles catalogées — contrairement à la vue galaxie qui,
// elle, utilise les vraies coordonnées RA/Dec des systèmes du jeu de données.
function makeStarfield(count: number, radius: number): THREE.Points {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false });
  return new THREE.Points(geometry, material);
}

function makeOrbitRing(radius: number): THREE.Line {
  const points: THREE.Vector3[] = [];
  const segments = 96;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0x33404f });
  return new THREE.Line(geometry, material);
}

export interface SystemSceneResult {
  group: THREE.Group;
  clickable: Map<THREE.Object3D, string>;
  cameraPos: THREE.Vector3;
  spinnables: Spinnable[];
  habitableZoneAvailable: boolean;
}

export function buildSystemScene(
  system: SystemData,
  realOrbitalPlanes = false,
  showHabitableZone = false,
  showScientificInterpretation = true,
  realMoonDistance = false,
): SystemSceneResult {
  const group = new THREE.Group();
  const clickable = new Map<THREE.Object3D, string>();
  const spinnables: Spinnable[] = [];

  group.add(makeStarfield(2000, 800));

  const isSun = system.id === "sol";
  // Rayon réel (rayons solaires, st_rad) plutôt qu'une taille générique fixe :
  // une naine rouge comme TRAPPIST-1 (0,119 R☉) doit paraître nettement plus
  // petite qu'une étoile de type solaire (K2-18, HD 189733), sans quoi son
  // disque schématique (avant : taille fixe 2) pouvait dépasser le rayon
  // orbital de ses propres planètes les plus proches.
  const starRadius = isSun ? 2.5 : Math.min(2.5, Math.max(0.8, 2.5 * (system.star.st_rad ?? 1)));
  const starColor = isSun ? "#ffd97a" : deriveStarColor(system.star.spectype, system.star.st_teff);
  // Pas de photo réelle disponible pour une étoile autre que le Soleil (cf.
  // starTexture.ts) : texture procédurale de granulation à défaut d'une
  // couleur plate, plausible mais jamais présentée comme une observation.
  const starMaterial = system.star.texture
    ? new THREE.MeshBasicMaterial({ map: loadTexture(system.star.texture) })
    : new THREE.MeshBasicMaterial({ map: makeStarSurfaceTexture(starColor) });
  const starMesh = new THREE.Mesh(new THREE.SphereGeometry(starRadius, 24, 24), starMaterial);
  group.add(starMesh);
  addStarGlow(group, starColor, starRadius);
  clickable.set(starMesh, STAR_CLICK_ID);
  group.add(makeLabelSprite(localizeName(system.star.name)).translateY(starRadius + 2));

  // Échelle absolue (sqrt(AU) * ORBIT_SCALE) calibrée sur le Système Solaire
  // (0,39 à 39,5 UA) : appliquée telle quelle à un système ultra-compact comme
  // TRAPPIST-1 (0,011 à 0,062 UA), elle produit des orbites plus petites que
  // le rayon même de l'étoile. Pour les systèmes exoplanétaires, on étire donc
  // linéairement sqrt(AU) sur une bande visuelle fixe — un transform affine
  // qui préserve l'ordre et les proportions RELATIVES des écarts entre
  // planètes du même système (ex. la chaîne quasi-résonnante de TRAPPIST-1
  // reste visible), sans prétendre à une échelle absolue comparable entre
  // systèmes différents (jamais montrés côte à côte de toute façon).
  const orbitAUs = system.planets.map((p) => p.pl_orbsmax ?? 1);
  const minOrbitAU = Math.min(...orbitAUs);
  const maxOrbitAU = Math.max(...orbitAUs);
  const NORMALIZED_MIN_RADIUS = starRadius + 3;
  const NORMALIZED_SPAN = 6 + system.planets.length * 3;

  function computeOrbitRadius(orbitAU: number): number {
    if (isSun) return Math.sqrt(orbitAU) * ORBIT_SCALE;
    if (maxOrbitAU === minOrbitAU) return NORMALIZED_MIN_RADIUS + NORMALIZED_SPAN / 2;
    const t = (Math.sqrt(orbitAU) - Math.sqrt(minOrbitAU)) / (Math.sqrt(maxOrbitAU) - Math.sqrt(minOrbitAU));
    return NORMALIZED_MIN_RADIUS + t * NORMALIZED_SPAN;
  }

  let maxOrbit = 5;
  system.planets.forEach((planet, index) => {
    const orbitAU = planet.pl_orbsmax ?? 1;
    const orbitRadius = computeOrbitRadius(orbitAU);
    maxOrbit = Math.max(maxOrbit, orbitRadius);

    // Deux groupes imbriqués (même principe que les lunes, cf. moons.ts) :
    // le groupe extérieur porte le VRAI tilt orbital (magnitude réelle,
    // orbit_inclination_deg — Système Solaire uniquement, cf. types.ts),
    // jamais animé ; le groupe intérieur ne fait tourner que son axe Y local
    // à chaque frame pour la révolution. Sans données réelles (exoplanètes),
    // orbit_inclination_deg vaut null et le tilt reste à 0 (vue coplanaire
    // honnête, pas de simulation fabriquée).
    const tiltGroup = new THREE.Group();
    const inclinationRad =
      realOrbitalPlanes && planet.orbit_inclination_deg != null ? (planet.orbit_inclination_deg * Math.PI) / 180 : 0;
    tiltGroup.rotation.x = inclinationRad;
    // Longitude du nœud ascendant réelle non disponible dans nos données :
    // répartie schématiquement par l'angle d'or pour éviter que toutes les
    // planètes inclinées partagent le même plan (ce qui serait trompeur).
    tiltGroup.rotation.z = inclinationRad !== 0 ? ((index * 137.5) * Math.PI) / 180 : 0;
    group.add(tiltGroup);
    tiltGroup.add(makeOrbitRing(orbitRadius));

    // Pivot centré sur l'étoile : on fait tourner le pivot (rotation.y),
    // pas la planète elle-même, pour obtenir une vraie révolution autour de
    // l'étoile — même principe que les pivots de lunes dans moons.ts.
    const pivot = new THREE.Group();
    pivot.rotation.y = Math.random() * Math.PI * 2;
    tiltGroup.add(pivot);
    spinnables.push({ group: pivot, speed: orbitRevolutionSpeed(orbitAU) });

    const localPos = new THREE.Vector3(orbitRadius, 0, 0);

    const size = planetSize(planet.pl_rade);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size, 32, 32),
      planetMaterial(planet, showScientificInterpretation),
    );
    mesh.position.copy(localPos);
    pivot.add(mesh);
    clickable.set(mesh, planet.name);

    const label = makeLabelSprite(localizeName(planet.name));
    label.position.copy(localPos).add(new THREE.Vector3(0, size + 1.5, 0));
    pivot.add(label);

    const moons = buildMoons(planet, localPos, {
      ...MOON_SCALE,
      planetVisualRadius: size,
      realDistance: realMoonDistance,
    });
    pivot.add(...moons.objects);
    spinnables.push(...moons.spinnables);
    // En mode distance réelle, une lune irrégulière lointaine (Néréide,
    // Phoebé...) peut s'étendre bien au-delà de l'orbite de sa propre
    // planète autour de l'étoile — il faut alors l'inclure dans le cadrage
    // caméra, pas seulement les orbites planétaires.
    maxOrbit = Math.max(maxOrbit, orbitRadius + moons.maxOrbitRadius);

    if (planet.ring) {
      const ringMesh = buildRing(planet.ring, size);
      ringMesh.position.copy(localPos);
      pivot.add(ringMesh);
    }
  });

  // Zone habitable (Kopparapu et al. 2013/2014, cf. habitableZone.ts) : anneau
  // translucide converti dans le même repère visuel que les orbites via
  // computeOrbitRadius, pour que sa position relative aux planètes affichées
  // reste directement comparable (ex. TRAPPIST-1 e/f dans la zone). null si
  // st_teff/st_rad manquent (pas d'approximation fabriquée dans ce cas).
  const habitableZone = computeHabitableZone(system.star.st_teff, system.star.st_rad);
  if (showHabitableZone && habitableZone) {
    const rawInner = computeOrbitRadius(habitableZone.innerAU);
    const rawOuter = computeOrbitRadius(habitableZone.outerAU);
    // Repli visuel : computeOrbitRadius extrapole linéairement hors de la
    // plage des planètes connues (t hors [0,1]) quand la zone habitable
    // tombe en dehors de leurs orbites — la borne interne peut alors
    // ressortir plus petite que le rayon de l'étoile elle-même. On la
    // recale juste hors de la surface stellaire plutôt que de laisser
    // l'anneau traverser l'étoile, sans changer la position de la borne
    // externe (qui reste l'information scientifique utile ici).
    const hzInnerRadius = Math.max(starRadius + 0.3, Math.min(rawInner, rawOuter));
    const hzOuterRadius = Math.max(hzInnerRadius + 0.2, Math.max(rawInner, rawOuter));
    const hzGeometry = new THREE.RingGeometry(hzInnerRadius, hzOuterRadius, 64);
    hzGeometry.rotateX(-Math.PI / 2);
    const hzMaterial = new THREE.MeshBasicMaterial({
      color: 0x4caf7a,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    group.add(new THREE.Mesh(hzGeometry, hzMaterial));
    const hzLabel = makeLabelSprite(t("habitableZoneLabel"));
    hzLabel.position.set(0, 1.5, hzOuterRadius);
    group.add(hzLabel);
    maxOrbit = Math.max(maxOrbit, hzOuterRadius);
  }

  // Bornes réelles approximatives (UA) des deux ceintures du Système Solaire ;
  // voir les commentaires dans asteroids.ts pour la limite de ce qui est réel
  // (la région) vs schématique (les cailloux/points individuels).
  const ASTEROID_BELT_AU: [number, number] = [2.1, 3.3];
  const KUIPER_BELT_AU: [number, number] = [30, 50];

  if (isSun) {
    // Éclaire les astéroïdes (MeshStandardMaterial) sans affecter le reste de
    // la scène : tous les autres objets utilisent MeshBasicMaterial, qui
    // ignore les lumières.
    const beltLight = new THREE.PointLight(0xfff4e0, 4000, 0, 2);
    group.add(beltLight);
    group.add(new THREE.AmbientLight(0x333333, 1));

    const beltMidRadius = Math.sqrt((ASTEROID_BELT_AU[0] + ASTEROID_BELT_AU[1]) / 2) * ORBIT_SCALE;
    group.add(makeAsteroidBelt(ASTEROID_BELT_AU[0], ASTEROID_BELT_AU[1], ORBIT_SCALE, 1500));
    const beltLabel = makeLabelSprite(t("asteroidBelt"));
    beltLabel.position.set(0, 2, beltMidRadius);
    group.add(beltLabel);

    const kuiperMidRadius = Math.sqrt((KUIPER_BELT_AU[0] + KUIPER_BELT_AU[1]) / 2) * ORBIT_SCALE;
    group.add(makeKuiperCloud(KUIPER_BELT_AU[0], KUIPER_BELT_AU[1], ORBIT_SCALE, 3500));
    const kuiperLabel = makeLabelSprite(t("kuiperBelt"));
    kuiperLabel.position.set(0, 2, kuiperMidRadius);
    group.add(kuiperLabel);

    maxOrbit = Math.max(maxOrbit, Math.sqrt(KUIPER_BELT_AU[1]) * ORBIT_SCALE);
  }

  // Les sondes Voyager 1/2 ne sont plus représentées dans cette vue système
  // (trop loin de l'échelle utile ici, cf. leur distance en UA — même à
  // maxOrbit exclu du cadrage caméra, les traits/marqueurs restaient une
  // distraction visuelle) : elles restent visibles et cliquables uniquement
  // dans la vue galaxie (cf. scenes/galaxy.ts), où leur échelle a du sens.

  return {
    group,
    clickable,
    cameraPos: new THREE.Vector3(0, maxOrbit * 0.8, maxOrbit * 1.4),
    spinnables,
    habitableZoneAvailable: habitableZone !== null,
  };
}
