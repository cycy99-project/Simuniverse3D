import * as THREE from "three";
import type { PlanetData, StarData } from "../data/types";
import { deriveAtmosphere, type AtmosphereVisual } from "../atmosphere/heuristic";
import { loadTexture } from "../textureCache";
import { makePlanetSurfaceTexture } from "../planetTexture";
import { makeStarSurfaceTexture } from "../starTexture";
import { addStarGlow } from "../starGlow";
import type { Spinnable } from "../spin";
import { buildMoons } from "./moons";
import { buildRing } from "./rings";

export interface AtmosphereSceneResult {
  group: THREE.Group;
  cameraPos: THREE.Vector3;
  visual: AtmosphereVisual;
  // Sous-groupes à faire tourner individuellement sur leur propre axe (un ou
  // deux en mode comparaison), plutôt que de tourner la scène entière — sinon
  // les deux planètes tourneraient l'une autour de l'autre au lieu de tourner
  // chacune sur elle-même.
  spinnables: Spinnable[];
  // Mesh de lune -> nom, pour la sélection au clic (vide en mode comparaison,
  // où les lunes ne sont pas affichées).
  clickable: Map<THREE.Object3D, string>;
}

const EARTH_UNIT_RADIUS = 3; // rayon affiché pour 1 rayon terrestre (mode comparaison)
const SUN_RADIUS_KM = 695_700;
const EARTH_RADIUS_KM = 6371;
const SUN_RADIUS_IN_EARTH_RADII = SUN_RADIUS_KM / EARTH_RADIUS_KM; // ~109,2
// Écart de taille aussi extrême que Terre-vs-Soleil dans star.ts : même
// plancher, pour la même raison (sinon la planète devient un point invisible).
const MIN_VISIBLE_PLANET_RADIUS = 0.05;
const SUN_SPIN_SPEED = 0.0009; // identique à STAR_SPIN_SPEED de star.ts

// Vitesse de rotation à l'écran, calibrée pour qu'une planète à la période
// réelle de la Terre (23,93 h) boucle en ~20 s à 60 im/s — les autres corps
// sont mis à l'échelle par une loi de puissance (exposant 0.4) sur leur vraie
// période sidérale (signée : négatif = rotation rétrograde, ex. Vénus,
// Uranus). Un ratio linéaire rendrait Mercure/Vénus quasi figées à l'écran
// (rapport réel ~1:340) ; la compression préserve l'ordre réel des vitesses
// tout en gardant chaque planète visiblement animée.
const EARTH_ROTATION_HOURS = 23.93;
const EARTH_SPIN_SPEED = 0.0052; // rad/frame pour une période = EARTH_ROTATION_HOURS
const DEFAULT_SPIN_SPEED = 0.0018; // repli générique pour les exoplanètes (période réelle inconnue)
const SPEED_COMPRESSION_EXPONENT = 0.4;

function spinSpeed(rotationHours: number | null): number {
  if (rotationHours === null || rotationHours === 0) return DEFAULT_SPIN_SPEED;
  const sign = Math.sign(rotationHours);
  const ratio = EARTH_ROTATION_HOURS / Math.abs(rotationHours);
  return sign * EARTH_SPIN_SPEED * Math.pow(ratio, SPEED_COMPRESSION_EXPONENT);
}

const MOON_SCALE = {
  orbitScale: 0.9,
  sizeScale: 0.38,
  minMoonSize: 0.15,
  maxMoonSize: 1.3,
  gapMultiplier: 1.15,
  showLabels: true,
};

// Couleur neutre utilisée quand l'interprétation scientifique est désactivée
// (cf. showScientificInterpretation) : signale "donnée insuffisante" plutôt
// que de proposer une teinte déduite, cohérent avec system.ts.
const NEUTRAL_UNKNOWN_COLOR = "#6b6b6b";

function materialFor(
  planet: PlanetData,
  visual: AtmosphereVisual,
  showScientificInterpretation: boolean,
): THREE.MeshBasicMaterial {
  if (planet.texture) {
    return new THREE.MeshBasicMaterial({ map: loadTexture(planet.texture) });
  }
  if (planet.color) {
    return new THREE.MeshBasicMaterial({ color: planet.color });
  }
  if (showScientificInterpretation) {
    // Texture procédurale (granulation/nuages/bandes/craquelures, cf.
    // planetTexture.ts) plutôt qu'un aplat uni : plus lisible visuellement,
    // jamais présentée comme une observation réelle.
    return new THREE.MeshBasicMaterial({
      map: makePlanetSurfaceTexture(
        visual.skyColor,
        visual.hazeColor,
        visual.cloudDensity,
        planet.interpretation_override?.textureStyle,
      ),
    });
  }
  return new THREE.MeshBasicMaterial({ color: NEUTRAL_UNKNOWN_COLOR });
}

function buildPlanetGroup(
  planet: PlanetData,
  radius: number,
  showScientificInterpretation: boolean,
): { group: THREE.Group; visual: AtmosphereVisual } {
  // Une recherche dédiée à ce corps précis (interpretation_override, cf.
  // types.ts) prime sur l'heuristique générique molécules+température —
  // celle-ci reste le repli par défaut pour tout corps non encore étudié en
  // détail.
  const visual = planet.interpretation_override ?? deriveAtmosphere(planet.molecules, planet.pl_eqt);
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 48), materialFor(planet, visual, showScientificInterpretation)));

  if (visual.cloudDensity > 0 && showScientificInterpretation) {
    group.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.03, 48, 48),
        new THREE.MeshBasicMaterial({
          color: visual.hazeColor,
          transparent: true,
          opacity: visual.cloudDensity * 0.6,
        }),
      ),
    );
  }

  if (planet.ring) {
    // Enfant du groupe planète : une rotation propre sur un anneau (symétrie
    // circulaire) est visuellement imperceptible, donc sans risque de
    // désynchronisation avec la rotation planétaire.
    group.add(buildRing(planet.ring, radius));
  }

  return { group, visual };
}

export function buildAtmosphereScene(
  planet: PlanetData,
  compareWithEarth: PlanetData | null,
  showScientificInterpretation = true,
  realMoonScale = false,
  realMoonDistance = false,
  compareWithSun: StarData | null = null,
): AtmosphereSceneResult {
  const group = new THREE.Group();

  if (!compareWithEarth && !compareWithSun) {
    const radius = 6;
    const { group: planetGroup, visual } = buildPlanetGroup(planet, radius, showScientificInterpretation);
    group.add(planetGroup);

    const moons = buildMoons(planet, new THREE.Vector3(0, 0, 0), {
      ...MOON_SCALE,
      planetVisualRadius: radius,
      realScale: realMoonScale,
      realDistance: realMoonDistance,
    });
    group.add(...moons.objects);

    const camDist = Math.max(radius * 3.2, moons.maxOrbitRadius * 2.4);

    // Élévation proportionnelle à la distance (pas une hauteur fixe) : avec
    // plusieurs lunes éloignées, une hauteur fixe de 4 devenait quasiment
    // rasante (quelques degrés à peine) et les orbites, vues presque par la
    // tranche, semblaient toutes alignées "à la queue leu leu" au lieu
    // d'anneaux concentriques distincts.
    return {
      group,
      cameraPos: new THREE.Vector3(0, camDist * 0.5, camDist),
      visual,
      spinnables: [{ group: planetGroup, speed: spinSpeed(planet.rotation_hours) }, ...moons.spinnables],
      clickable: moons.clickable,
    };
  }

  if (compareWithEarth) {
    // Mode comparaison : tailles réelles relatives, 1 rayon terrestre = EARTH_UNIT_RADIUS.
    const planetRadius = EARTH_UNIT_RADIUS * (planet.pl_rade ?? 1);
    const earthRadius = EARTH_UNIT_RADIUS;
    const gap = Math.max(planetRadius, earthRadius) * 0.7;

    const { group: planetGroup, visual } = buildPlanetGroup(planet, planetRadius, showScientificInterpretation);
    planetGroup.position.x = -(planetRadius + gap / 2);

    const { group: earthGroup } = buildPlanetGroup(compareWithEarth, earthRadius, showScientificInterpretation);
    earthGroup.position.x = earthRadius + gap / 2;

    group.add(planetGroup, earthGroup);

    const halfWidthLeft = Math.abs(planetGroup.position.x) + planetRadius;
    const halfWidthRight = earthGroup.position.x + earthRadius;
    const camDist = Math.max(halfWidthLeft, halfWidthRight) * 3.2;

    return {
      group,
      cameraPos: new THREE.Vector3(0, Math.max(planetRadius, earthRadius) * 0.5, camDist),
      visual,
      spinnables: [
        { group: planetGroup, speed: spinSpeed(planet.rotation_hours) },
        { group: earthGroup, speed: spinSpeed(compareWithEarth.rotation_hours) },
      ],
      clickable: new Map(),
    };
  }

  // Mode comparaison planète vs Soleil : même principe que ci-dessus, mais le
  // rayon solaire réel (st_rad, en rayons solaires) doit d'abord être converti
  // en rayons terrestres (SUN_RADIUS_IN_EARTH_RADII ~109,2) pour rester dans
  // l'unité EARTH_UNIT_RADIUS utilisée dans ce fichier — cf. star.ts pour le
  // même principe appliqué à une comparaison étoile vs étoile/Terre.
  const sun = compareWithSun as StarData;
  const planetRadius = Math.max(EARTH_UNIT_RADIUS * (planet.pl_rade ?? 1), MIN_VISIBLE_PLANET_RADIUS);
  const sunRadius = EARTH_UNIT_RADIUS * (sun.st_rad ?? 1) * SUN_RADIUS_IN_EARTH_RADII;
  const gap = Math.max(planetRadius, sunRadius) * 0.6;

  const { group: planetGroup, visual } = buildPlanetGroup(planet, planetRadius, showScientificInterpretation);
  planetGroup.position.x = -(planetRadius + gap / 2);

  const sunColor = "#ffd97a";
  const sunMaterial = sun.texture
    ? new THREE.MeshBasicMaterial({ map: loadTexture(sun.texture) })
    : new THREE.MeshBasicMaterial({ map: makeStarSurfaceTexture(sunColor) });
  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(sunRadius, 48, 48), sunMaterial);
  sunMesh.position.x = sunRadius + gap / 2;

  group.add(planetGroup, sunMesh);
  addStarGlow(group, sunColor, sunRadius, sunMesh.position);

  const halfWidthLeft = Math.abs(planetGroup.position.x) + planetRadius;
  const halfWidthRight = sunMesh.position.x + sunRadius;
  const camDist = Math.max(halfWidthLeft, halfWidthRight) * 3.2;

  return {
    group,
    cameraPos: new THREE.Vector3(0, Math.max(planetRadius, sunRadius) * 0.5, camDist),
    visual,
    spinnables: [
      { group: planetGroup, speed: spinSpeed(planet.rotation_hours) },
      { group: sunMesh, speed: SUN_SPIN_SPEED },
    ],
    clickable: new Map(),
  };
}
