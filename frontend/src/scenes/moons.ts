import * as THREE from "three";
import type { MoonData, PlanetData } from "../data/types";
import { loadTexture } from "../textureCache";
import type { Spinnable } from "../spin";

// Période de référence pour calibrer la vitesse de révolution affichée : une
// lune à la période réelle de notre Lune (27,32 j) boucle en ~30 s à 60 im/s.
// Les autres lunes sont mises à l'échelle par une loi de puissance (exposant
// 0.4, pas un ratio linéaire) sur leur vraie période sidérale — l'écart réel
// entre Phobos (0,32 j) et Néréide (360 j) est trop large pour rester lisible
// en ratio direct ; la puissance compresse l'amplitude tout en préservant
// l'ordre réel des vitesses (signe négatif = orbite rétrograde, ex. Triton).
const MOON_REF_PERIOD_DAYS = 27.32;
const MOON_REF_SPEED = 0.0035;
const SPEED_COMPRESSION_EXPONENT = 0.4;

export function orbitSpeed(periodDays: number): number {
  if (periodDays === 0) return MOON_REF_SPEED;
  const sign = Math.sign(periodDays);
  const ratio = MOON_REF_PERIOD_DAYS / Math.abs(periodDays);
  return sign * MOON_REF_SPEED * Math.pow(ratio, SPEED_COMPRESSION_EXPONENT);
}

export interface MoonScaleOptions {
  planetVisualRadius: number;
  orbitScale: number; // multiplicateur appliqué à sqrt(orbit_km)
  sizeScale: number; // multiplicateur appliqué à sqrt(radius_km)
  minMoonSize: number;
  maxMoonSize: number;
  gapMultiplier?: number; // marge visuelle depuis la surface de la planète
}

function makeOrbitRing(radius: number): THREE.Line {
  const points: THREE.Vector3[] = [];
  const segments = 64;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0x33404f, transparent: true, opacity: 0.5 });
  return new THREE.Line(geometry, material);
}

function moonMaterial(moon: MoonData): THREE.Material {
  const boost = moon.render_brightness_boost ?? 1;
  if (moon.texture) {
    return new THREE.MeshBasicMaterial({ map: loadTexture(moon.texture), color: new THREE.Color(boost, boost, boost) });
  }
  return new THREE.MeshBasicMaterial({ color: moon.color });
}

export interface BuiltMoons {
  objects: THREE.Object3D[]; // pivots à ajouter au groupe parent, positionnés sur la planète
  spinnables: Spinnable[];
  maxOrbitRadius: number; // bord extérieur de l'orbite la plus lointaine, pour cadrer la caméra
  clickable: Map<THREE.Object3D, string>; // mesh de lune -> nom, pour la sélection au clic
}

// Échelle log10 globale, utilisée seulement en repli pour un système à une
// seule lune (aucune comparaison locale possible dans ce cas).
function globalMoonSize(radiusKm: number, opts: MoonScaleOptions): number {
  const size = Math.log10(radiusKm + 1) * opts.sizeScale;
  return Math.min(Math.max(size, opts.minMoonSize), opts.maxMoonSize);
}

// Une échelle globale (log ou racine) écrase la lisibilité dès qu'un système
// de lunes est regroupé dans une portion étroite de l'amplitude réelle totale
// (6 km à 2634 km) : les 4 lunes galiléennes de Jupiter (1561-2634 km) sont
// TOUTES proches du haut de l'échelle globale et finissent visuellement
// indiscernables entre elles, même sans clamp. Comme les lunes d'une même
// planète ne sont jamais comparées à celles d'une autre planète à l'écran, on
// normalise ici les tailles de façon relative *au sein du système de la
// planète affichée* — un étirement linéaire réel (pas une heuristique) entre
// le min et le max de CE système, sur toute l'amplitude visuelle disponible.
function moonSizes(moons: MoonData[], opts: MoonScaleOptions): number[] {
  if (moons.length <= 1) {
    return moons.map((m) => globalMoonSize(m.radius_km, opts));
  }
  const radii = moons.map((m) => m.radius_km);
  const minR = Math.min(...radii);
  const maxR = Math.max(...radii);
  if (maxR === minR) {
    const mid = (opts.minMoonSize + opts.maxMoonSize) / 2;
    return moons.map(() => mid);
  }
  return radii.map((r) => {
    const t = (r - minR) / (maxR - minR);
    return opts.minMoonSize + t * (opts.maxMoonSize - opts.minMoonSize);
  });
}

// Chaque lune orbite via un pivot centré sur la planète, contenant l'anneau
// d'orbite et la lune décalée en x — on fait tourner le pivot (rotation.y)
// plutôt que la lune directement, pour obtenir une vraie révolution autour
// de la planète (et non une rotation sur elle-même).
export function buildMoons(planet: PlanetData, position: THREE.Vector3, opts: MoonScaleOptions): BuiltMoons {
  const objects: THREE.Object3D[] = [];
  const spinnables: Spinnable[] = [];
  const clickable = new Map<THREE.Object3D, string>();
  const gap = opts.gapMultiplier ?? 1.3;
  const moonCount = planet.moons.length;

  // Les lunes sont déjà triées par distance réelle croissante dans les
  // données ingérées ; on garantit ici un espacement minimum entre orbites
  // successives (pour éviter le chevauchement visuel) sans jamais rapprocher
  // une lune plus proche que la précédente — l'ordre réel est donc toujours
  // respecté, contrairement à l'ancien décalage `index * moonRadius` qui
  // pouvait déformer les distances relatives.
  let previousOuterEdge = opts.planetVisualRadius * gap;
  const sizes = moonSizes(planet.moons, opts);

  planet.moons.forEach((moon, index) => {
    const moonRadius = sizes[index];
    const naturalRadius = opts.planetVisualRadius * gap + Math.sqrt(moon.orbit_km / 50_000) * opts.orbitScale;
    const orbitRadius = Math.max(naturalRadius, previousOuterEdge + moonRadius * 1.5);
    previousOuterEdge = orbitRadius + moonRadius;

    // Deux groupes imbriqués pour combiner une VRAIE inclinaison orbitale
    // (magnitude réelle, cf. types.ts) avec une révolution animée propre :
    // un Euler à 3 composantes qu'on anime sur un seul axe ne produit pas un
    // cercle incliné cohérent (la composition XYZ mélange les axes). Le
    // groupe extérieur porte le tilt fixe (jamais animé), le groupe intérieur
    // ne fait tourner que son axe Y local à chaque frame.
    const tiltGroup = new THREE.Group();
    tiltGroup.position.copy(position);
    const inclinationRad = ((moon.inclination_deg ?? 0) * Math.PI) / 180;
    // L'angle du nœud ascendant réel n'est pas dans nos données : réparti
    // schématiquement par l'angle d'or pour éviter que les lunes d'une même
    // planète partagent toutes le même plan incliné (ce qui serait factuellement
    // faux et visuellement redondant).
    tiltGroup.rotation.x = inclinationRad;
    tiltGroup.rotation.z = ((index * 137.5) * Math.PI) / 180;

    const spinGroup = new THREE.Group();
    // Phase de départ répartie uniformément entre les lunes : sans cela,
    // toutes démarrent alignées sur le même axe (rotation.y = 0) et semblent
    // "les unes derrière les autres" tant que les vitesses différentes n'ont
    // pas eu le temps de les désynchroniser à l'écran.
    spinGroup.rotation.y = (index / moonCount) * Math.PI * 2;
    spinGroup.add(makeOrbitRing(orbitRadius));
    tiltGroup.add(spinGroup);

    const mesh = new THREE.Mesh(new THREE.SphereGeometry(moonRadius, 16, 16), moonMaterial(moon));
    if (moon.shape_ratio) {
      // Corps triaxial irrégulier (pas à l'équilibre hydrostatique) : on
      // déforme la sphère de base par les vrais ratios de demi-axes plutôt
      // que d'afficher une sphère parfaite, factuellement fausse pour ces
      // lunes (cf. commentaires de shape_ratio dans types.ts/ingest.py).
      mesh.scale.set(...moon.shape_ratio);
    }
    mesh.position.x = orbitRadius;
    spinGroup.add(mesh);
    clickable.set(mesh, moon.name);

    objects.push(tiltGroup);
    spinnables.push({ group: spinGroup, speed: orbitSpeed(moon.period_days) });
  });

  return { objects, spinnables, maxOrbitRadius: previousOuterEdge, clickable };
}
