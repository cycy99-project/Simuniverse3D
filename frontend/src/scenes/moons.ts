import * as THREE from "three";
import type { MoonData, PlanetData } from "../data/types";
import { loadTexture } from "../textureCache";
import type { Spinnable } from "../spin";
import { makeLabelSprite } from "../labelSprite";
import { localizeName } from "../nameTranslations";

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
  // Étiquette de nom au-dessus de la lune (comme pour les planètes en vue
  // système) : activée uniquement en vue atmosphère, où les lunes sont assez
  // grandes/espacées pour rester lisibles — désactivée dans la vue système
  // (échelle trop petite, labels qui se chevaucheraient entre les lunes).
  showLabels?: boolean;
  // Vrai ratio (rayon lune / rayon planète, tous deux réels) au lieu de
  // l'étirement min-max visuel ci-dessus — certaines lunes (Phobos, Mimas...)
  // deviennent alors quasi invisibles, comme dans la réalité ; le nom au-dessus
  // (showLabels) reste la seule façon fiable de les repérer une fois zoomé.
  realScale?: boolean;
  // Distance réelle (orbit_km lune / rayon planète, tous deux réels) au lieu
  // de la compression en racine carrée + clamp anti-chevauchement ci-dessous —
  // certaines lunes irrégulières lointaines (Néréide, Phoebé...) s'éloignent
  // alors énormément, sans plafond artificiel ; c'est à l'appelant (system.ts,
  // atmosphere.ts) d'éloigner la caméra en conséquence via maxOrbitRadius.
  realDistance?: boolean;
}

// Rayon terrestre en km, pour convertir pl_rade (rayons terrestres) en km et
// obtenir le vrai rayon de la planète comparé au rayon réel (km) de sa lune.
const EARTH_RADIUS_KM = 6371;

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

// Taille à l'échelle réelle : planetVisualRadius représente le vrai rayon de
// la planète à l'écran, donc (radius_km lune / radius_km planète) appliqué
// tel quel donne un rayon lune honnête — sans clamp ni étirement, contrairement
// à moonSizes() ci-dessus qui est une convention de lisibilité, pas une mesure.
function moonSizesRealScale(moons: MoonData[], planetRadiusKm: number, planetVisualRadius: number): number[] {
  return moons.map((m) => planetVisualRadius * (m.radius_km / planetRadiusKm));
}

// Distance à l'échelle réelle : même principe que moonSizesRealScale(), mais
// pour l'orbite — un ratio direct (orbit_km / planetRadiusKm), sans la
// compression en racine carrée ni le clamp anti-chevauchement utilisés par
// défaut. Peut repousser une lune très loin (ex. Néréide à ~470 rayons de
// Neptune) ; c'est le comportement recherché quand ce mode est actif.
function moonOrbitRealScale(orbitKm: number, planetRadiusKm: number, planetVisualRadius: number): number {
  return planetVisualRadius * (orbitKm / planetRadiusKm);
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
  const planetRadiusKm = (planet.pl_rade ?? 1) * EARTH_RADIUS_KM;
  const sizes = opts.realScale
    ? moonSizesRealScale(planet.moons, planetRadiusKm, opts.planetVisualRadius)
    : moonSizes(planet.moons, opts);

  planet.moons.forEach((moon, index) => {
    const moonRadius = sizes[index];
    const orbitRadius = opts.realDistance
      ? Math.max(
          opts.planetVisualRadius * gap,
          moonOrbitRealScale(moon.orbit_km, planetRadiusKm, opts.planetVisualRadius),
        )
      : Math.max(
          opts.planetVisualRadius * gap + Math.sqrt(moon.orbit_km / 50_000) * opts.orbitScale,
          previousOuterEdge + moonRadius * 1.5,
        );
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

    if (opts.showLabels) {
      const label = makeLabelSprite(localizeName(moon.name));
      // Taille/décalage proportionnels au rayon de CETTE lune (pas une valeur
      // fixe comme pour les planètes) : l'écart de taille entre lunes d'un
      // même système est important (ex. Titan vs Mimas), un label à taille
      // unique serait soit illisible sur les petites, soit énorme sur les grandes.
      const labelScale = Math.max(moonRadius * 2.2, 1.1);
      label.scale.set(labelScale, labelScale * 0.25, 1);
      label.position.set(orbitRadius, moonRadius + labelScale * 0.35, 0);
      spinGroup.add(label);
    }

    objects.push(tiltGroup);
    spinnables.push({ group: spinGroup, speed: orbitSpeed(moon.period_days) });
  });

  return { objects, spinnables, maxOrbitRadius: previousOuterEdge, clickable };
}
