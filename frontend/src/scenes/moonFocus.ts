import * as THREE from "three";
import type { MoonData, PlanetData } from "../data/types";
import { loadTexture } from "../textureCache";
import type { Spinnable } from "../spin";

export interface MoonFocusResult {
  group: THREE.Group;
  cameraPos: THREE.Vector3;
  spinnables: Spinnable[];
}

const MOON_FOCUS_RADIUS = 5;
// Repli générique (même valeur que DEFAULT_SPIN_SPEED dans atmosphere.ts) :
// la période de rotation propre des lunes n'est pas dans nos données, cette
// vitesse n'est qu'un effet visuel, pas une valeur physique réelle.
const DEFAULT_SPIN_SPEED = 0.0018;
const EARTH_RADIUS_KM = 6371;
// Même échelle que EARTH_UNIT_RADIUS dans atmosphere.ts (1 rayon terrestre
// affiché) : permet une comparaison visuelle cohérente entre le mode
// "comparer une planète à la Terre" et celui-ci pour les lunes.
const EARTH_UNIT_RADIUS = 3;

function moonMaterial(moon: MoonData): THREE.Material {
  const boost = moon.render_brightness_boost ?? 1;
  if (moon.texture) return new THREE.MeshBasicMaterial({ map: loadTexture(moon.texture), color: new THREE.Color(boost, boost, boost) });
  return new THREE.MeshBasicMaterial({ color: moon.color });
}

function buildMoonGroup(moon: MoonData, radius: number): THREE.Group {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 48), moonMaterial(moon));
  if (moon.shape_ratio) {
    // Corps triaxial irrégulier (cf. types.ts) : mêmes ratios de demi-axes
    // qu'en vue système, pour ne pas afficher une sphère parfaite trompeuse.
    mesh.scale.set(...moon.shape_ratio);
  }
  group.add(mesh);
  return group;
}

function buildEarthGroup(earth: PlanetData, radius: number): THREE.Group {
  const group = new THREE.Group();
  const material = earth.texture
    ? new THREE.MeshBasicMaterial({ map: loadTexture(earth.texture) })
    : new THREE.MeshBasicMaterial({ color: earth.color ?? "#3b82f6" });
  group.add(new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 48), material));
  return group;
}

export function buildMoonFocusScene(moon: MoonData, compareWithEarth: PlanetData | null = null): MoonFocusResult {
  const group = new THREE.Group();

  if (!compareWithEarth) {
    const moonGroup = buildMoonGroup(moon, MOON_FOCUS_RADIUS);
    group.add(moonGroup);
    const camDist = MOON_FOCUS_RADIUS * 3.2;
    return {
      group,
      cameraPos: new THREE.Vector3(0, camDist * 0.5, camDist),
      spinnables: [{ group: moonGroup, speed: DEFAULT_SPIN_SPEED }],
    };
  }

  // Mode comparaison : tailles réelles relatives (rayon en km converti en
  // rayons terrestres), même échelle que la comparaison planète-Terre.
  const moonRadius = EARTH_UNIT_RADIUS * (moon.radius_km / EARTH_RADIUS_KM);
  const earthRadius = EARTH_UNIT_RADIUS;
  const gap = Math.max(moonRadius, earthRadius) * 0.7;

  const moonGroup = buildMoonGroup(moon, moonRadius);
  moonGroup.position.x = -(moonRadius + gap / 2);

  const earthGroup = buildEarthGroup(compareWithEarth, earthRadius);
  earthGroup.position.x = earthRadius + gap / 2;

  group.add(moonGroup, earthGroup);

  const halfWidthLeft = Math.abs(moonGroup.position.x) + moonRadius;
  const halfWidthRight = earthGroup.position.x + earthRadius;
  const camDist = Math.max(halfWidthLeft, halfWidthRight) * 3.2;

  return {
    group,
    cameraPos: new THREE.Vector3(0, Math.max(moonRadius, earthRadius) * 0.5, camDist),
    spinnables: [
      { group: moonGroup, speed: DEFAULT_SPIN_SPEED },
      { group: earthGroup, speed: DEFAULT_SPIN_SPEED },
    ],
  };
}
