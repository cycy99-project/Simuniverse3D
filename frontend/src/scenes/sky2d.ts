import * as THREE from "three";
import type { SeedData, ConstellationSkyData } from "../data/types";
import { localizeName } from "../nameTranslations";
import { deriveStarColor } from "../starColor";
import { makeStarfield, makeLabelSprite, makeStarDot, realStarPosition } from "./galaxy";
import { t } from "../i18n";

// Matrice de rotation coordonnées galactiques → équatoriales J2000 (IAU 1958,
// pôle galactique nord RA=192.85948°/Dec=27.12825°) — constantes standard,
// cf. https://en.wikipedia.org/wiki/Galactic_coordinate_system#Conversion_between_equatorial_and_galactic_coordinates
const GALACTIC_TO_EQUATORIAL: [[number, number, number], [number, number, number], [number, number, number]] = [
  [-0.05487556, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.4448296300, 0.7469822445],
  [-0.8676661490, -0.1980763734, 0.4559837762],
];

function galacticToRaDec(lDeg: number, bDeg: number): { ra: number; dec: number } {
  const l = (lDeg * Math.PI) / 180;
  const b = (bDeg * Math.PI) / 180;
  const xg = Math.cos(b) * Math.cos(l);
  const yg = Math.cos(b) * Math.sin(l);
  const zg = Math.sin(b);
  const [r0, r1, r2] = GALACTIC_TO_EQUATORIAL;
  const xe = r0[0] * xg + r0[1] * yg + r0[2] * zg;
  const ye = r1[0] * xg + r1[1] * yg + r1[2] * zg;
  const ze = r2[0] * xg + r2[1] * yg + r2[2] * zg;
  const dec = Math.asin(THREE.MathUtils.clamp(ze, -1, 1)) * (180 / Math.PI);
  const raRaw = (Math.atan2(ye, xe) * 180) / Math.PI;
  return { ra: raRaw < 0 ? raRaw + 360 : raRaw, dec };
}

// 1 pc ≈ 3,26156 al (même constante que distance.ts, dupliquée ici pour
// éviter une dépendance circulaire scenes/ ↔ distance.ts).
const PC_TO_LY = 3.26156;

// Rayon fixe du "dôme céleste" : contrairement à galaxy.ts::starPosition (qui
// compresse la vraie distance en racine carrée pour étaler les systèmes dans
// l'espace), ici TOUT est projeté à la même distance de l'observateur — comme
// le ciel vu depuis la Terre, où seule la direction (RA/Dec) est perceptible
// à l'œil nu, jamais la profondeur réelle.
const SKY_RADIUS = 500;

function raDecToSphere(ra: number, dec: number, radius: number): THREE.Vector3 {
  const raRad = (ra * Math.PI) / 180;
  const decRad = (dec * Math.PI) / 180;
  return new THREE.Vector3(
    Math.cos(decRad) * Math.cos(raRad) * radius,
    Math.sin(decRad) * radius,
    Math.cos(decRad) * Math.sin(raRad) * radius,
  );
}

// Bande de la Voie lactée : ruban de triangles suivant le plan galactique
// (grand cercle incliné ~63° sur l'équateur céleste, cf. GALACTIC_TO_EQUATORIAL
// ci-dessus), légèrement au-delà du rayon des étoiles catalogue pour rester
// "en arrière-plan" (depthTest naturel, pas de z-fighting).
//
// Vu depuis le CENTRE de la sphère (comme la caméra ici), une bande
// d'angle constant projetée en perspective peut sembler "s'évaser" et
// occuper une grande partie de l'écran quand on regarde presque tangente à
// son plan (effet réel, similaire à la Voie lactée qui semble déborder près
// de l'horizon sur une photo grand-angle) — mais un dégradé de COULEUR DE
// SOMMET pur rendait cet effet comme un aplat gris à bord net, illisible.
// On utilise donc une texture (dégradé alpha doux + grain de points, comme
// une nappe d'étoiles innombrables) mappée en UV le long du ruban, avec un
// vrai canal alpha (blending normal, pas additif) : la transparence réelle
// empêche tout effet d'aplat saturé, même vu presque à plat.
const MILKY_WAY_HALF_WIDTH_DEG = 14;
const MILKY_WAY_LON_STEPS = 240;
const MILKY_WAY_LAT_STEPS = 10;
const MILKY_WAY_TEXTURE_REPEAT = 10;

let milkyWayTexture: THREE.Texture | null = null;
function getMilkyWayTexture(): THREE.Texture {
  if (milkyWayTexture) return milkyWayTexture;
  const width = 256;
  const height = 128;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "rgba(190, 205, 255, 0)");
  gradient.addColorStop(0.32, "rgba(200, 212, 255, 0.16)");
  gradient.addColorStop(0.5, "rgba(220, 226, 255, 0.3)");
  gradient.addColorStop(0.68, "rgba(200, 212, 255, 0.16)");
  gradient.addColorStop(1, "rgba(190, 205, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Grain de points (nappe d'étoiles innombrables) : casse l'aspect "dégradé
  // plat géométrique" du gradient seul, plus concentré au centre de la bande.
  for (let i = 0; i < 700; i++) {
    const x = Math.random() * width;
    const yc = height / 2 + (Math.random() - 0.5) * height * 0.7;
    const distFromCenter = Math.abs(yc - height / 2) / (height / 2);
    const r = 0.4 + Math.random() * 1.3;
    const alpha = (0.05 + Math.random() * 0.22) * (1 - distFromCenter * 0.6);
    ctx.beginPath();
    ctx.fillStyle = `rgba(255,255,255,${Math.max(0, alpha)})`;
    ctx.arc(x, yc, r, 0, Math.PI * 2);
    ctx.fill();
  }

  milkyWayTexture = new THREE.CanvasTexture(canvas);
  milkyWayTexture.wrapS = THREE.RepeatWrapping;
  milkyWayTexture.wrapT = THREE.ClampToEdgeWrapping;
  return milkyWayTexture;
}

function makeMilkyWayBand(): THREE.Mesh {
  const radius = SKY_RADIUS * 1.05;
  const latSteps = MILKY_WAY_LAT_STEPS;
  const lonSteps = MILKY_WAY_LON_STEPS;
  const rowSize = latSteps * 2 + 1;

  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= lonSteps; i++) {
    const l = (i / lonSteps) * 360;
    // Le renflement central (direction du centre galactique, l≈0/360) est
    // réellement plus dense/lumineux que la direction anti-centre (l≈180) —
    // approximation simple de cette asymétrie réelle, pas une vraie carte de
    // densité stellaire. N'affecte que la LUMINOSITÉ (couleur de sommet),
    // la transparence vient uniquement de la texture.
    const lRad = (l * Math.PI) / 180;
    const densityFactor = 0.6 + 0.4 * Math.max(0, Math.cos(lRad));
    for (let j = 0; j <= latSteps * 2; j++) {
      const b = -MILKY_WAY_HALF_WIDTH_DEG + (j / (latSteps * 2)) * (MILKY_WAY_HALF_WIDTH_DEG * 2);
      const { ra, dec } = galacticToRaDec(l, b);
      const p = raDecToSphere(ra, dec, radius);
      positions.push(p.x, p.y, p.z);
      colors.push(densityFactor, densityFactor, densityFactor);
      uvs.push((i / lonSteps) * MILKY_WAY_TEXTURE_REPEAT, j / (latSteps * 2));
    }
  }

  for (let i = 0; i < lonSteps; i++) {
    for (let j = 0; j < latSteps * 2; j++) {
      const a = i * rowSize + j;
      const b = (i + 1) * rowSize + j;
      const c = (i + 1) * rowSize + (j + 1);
      const d = i * rowSize + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colors), 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);

  const material = new THREE.MeshBasicMaterial({
    map: getMilkyWayTexture(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geometry, material);
}

// Ligne de contour ("épine dorsale") le long du centre du plan galactique —
// même principe visuel que makeConstellationLines (trait fin semi-
// transparent) pour donner à la bande un contour net et suivable à l'œil,
// en plus du dégradé texturé diffus (qui seul restait flou/peu identifiable).
function makeMilkyWayContourLine(): THREE.LineLoop {
  const radius = SKY_RADIUS * 1.06;
  const positions: number[] = [];
  const steps = 360;
  for (let i = 0; i < steps; i++) {
    const l = (i / steps) * 360;
    const { ra, dec } = galacticToRaDec(l, 0);
    const p = raDecToSphere(ra, dec, radius);
    positions.push(p.x, p.y, p.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
  const material = new THREE.LineBasicMaterial({ color: 0x9fc2ff, transparent: true, opacity: 0.35 });
  return new THREE.LineLoop(geometry, material);
}

// Repères textuels "Voie lactée" espacés tous les 90° le long de la bande
// (et non un seul, qui serait souvent hors champ dans cette vue "regarder
// autour de soi" librement orientable) — pour répondre au besoin de
// l'identifier rapidement sans deviner.
function makeMilkyWayLabels(): THREE.Sprite[] {
  const radius = SKY_RADIUS * 1.05;
  const labels: THREE.Sprite[] = [];
  for (const l of [0, 90, 180, 270]) {
    const { ra, dec } = galacticToRaDec(l, 0);
    const pos = raDecToSphere(ra, dec, radius);
    const label = makeLabelSprite(t("milkyWayLabel"), 20, [16, 4], { glow: true });
    label.position.copy(pos);
    label.material.opacity = 0.55;
    labels.push(label);
  }
  return labels;
}

// Halo doré derrière le marqueur du Soleil vu depuis une exoplanète — un
// simple point de la même taille que les autres étoiles catalogue se noierait
// dans le champ (cf. retour utilisateur "on ne voit rien du tout"). Sprite à
// part (pas juste un makeStarDot plus gros) pour un vrai halo diffus en
// blending additif, distinct des étoiles ordinaires.
let sunGlowTexture: THREE.Texture | null = null;
function getSunGlowTexture(): THREE.Texture {
  if (sunGlowTexture) return sunGlowTexture;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255, 240, 200, 0.95)");
  gradient.addColorStop(0.25, "rgba(255, 217, 122, 0.55)");
  gradient.addColorStop(0.6, "rgba(255, 217, 122, 0.18)");
  gradient.addColorStop(1, "rgba(255, 217, 122, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  sunGlowTexture = new THREE.CanvasTexture(canvas);
  return sunGlowTexture;
}

// Volontairement exagéré (bien plus gros que ce que la vraie taille angulaire
// du Soleil vu de si loin justifierait) — demande explicite : un repère qu'on
// ne peut pas manquer, quitte à sur-jouer l'effet, plutôt qu'un point réaliste
// mais illisible perdu dans le champ d'étoiles.
function makeSunGlowSprite(): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: getSunGlowTexture(),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(150, 150, 1);
  return sprite;
}

// Flèche pointant vers le marqueur solaire, positionnée au-dessus du label —
// en plus du halo, un repère directionnel explicite ("c'est ici") qui ne
// laisse aucune ambiguïté sur l'astre à identifier.
let sunArrowTexture: THREE.Texture | null = null;
function getSunArrowTexture(): THREE.Texture {
  if (sunArrowTexture) return sunArrowTexture;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.shadowColor = "rgba(255, 217, 122, 0.95)";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#ffe6a3";
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size * 0.88);
  ctx.lineTo(size * 0.12, size * 0.22);
  ctx.lineTo(size * 0.88, size * 0.22);
  ctx.closePath();
  ctx.fill();
  sunArrowTexture = new THREE.CanvasTexture(canvas);
  return sunArrowTexture;
}

function makeSunArrowSprite(): THREE.Sprite {
  const material = new THREE.SpriteMaterial({ map: getSunArrowTexture(), transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(16, 16, 1);
  return sprite;
}

// Regroupement par magnitude en quelques nuages de points (et non un sprite
// par étoile) : ~700 étoiles catalogue, un seul point par étoile suffit (pas
// besoin du rendu "disque lumineux" texturé des vrais systèmes du jeu de
// données) — plus léger, et la taille/opacité par tranche de magnitude imite
// la perception réelle (les étoiles brillantes paraissent plus grosses).
const MAGNITUDE_BUCKETS: { max: number; size: number; opacity: number }[] = [
  { max: 1.5, size: 3.4, opacity: 1.0 },
  { max: 3.0, size: 2.6, opacity: 0.9 },
  { max: 4.5, size: 1.9, opacity: 0.75 },
  { max: Infinity, size: 1.3, opacity: 0.55 },
];

function makeCatalogStars(stars: ConstellationSkyData["stars"]): THREE.Points[] {
  const buckets: THREE.Vector3[][] = MAGNITUDE_BUCKETS.map(() => []);
  for (const star of Object.values(stars)) {
    const mag = star.mag ?? 4.5;
    const bucketIndex = MAGNITUDE_BUCKETS.findIndex((b) => mag <= b.max);
    buckets[bucketIndex === -1 ? MAGNITUDE_BUCKETS.length - 1 : bucketIndex].push(
      raDecToSphere(star.ra, star.dec, SKY_RADIUS),
    );
  }
  return buckets.map((points, i) => {
    const { size, opacity } = MAGNITUDE_BUCKETS[i];
    const positions = new Float32Array(points.length * 3);
    points.forEach((p, idx) => {
      positions[idx * 3] = p.x;
      positions[idx * 3 + 1] = p.y;
      positions[idx * 3 + 2] = p.z;
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size,
      sizeAttenuation: false,
      transparent: true,
      opacity,
    });
    return new THREE.Points(geometry, material);
  });
}

// Figures en traits (stick figures) : segments discontinus (LineSegments, pas
// une Line continue) car chaque polyligne du fichier source est indépendante
// des autres — les relier en une seule ligne créerait des traits parasites
// entre la fin d'une polyligne et le début de la suivante.
function makeConstellationLines(
  constellations: ConstellationSkyData["constellations"],
  stars: ConstellationSkyData["stars"],
): THREE.LineSegments {
  const positions: number[] = [];
  for (const constellation of constellations) {
    for (const polyline of constellation.lines) {
      for (let i = 0; i < polyline.length - 1; i++) {
        const a = stars[polyline[i]];
        const b = stars[polyline[i + 1]];
        if (!a || !b) continue; // HIP sans position résolue (cf. ingest_constellations.py)
        const pa = raDecToSphere(a.ra, a.dec, SKY_RADIUS);
        const pb = raDecToSphere(b.ra, b.dec, SKY_RADIUS);
        positions.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
  const material = new THREE.LineBasicMaterial({ color: 0x6f8fc9, transparent: true, opacity: 0.4 });
  return new THREE.LineSegments(geometry, material);
}

// Le jeu de données stick-figures nomme les constellations en CamelCase sans
// espace ("UrsaMajor", "CanesVenatici") ; on réinsère les espaces pour
// l'affichage. Cas particulier : Serpens est scindé en deux figures
// (SerpensA/SerpensB, cf. ingest_constellations.py) → "Serpens A"/"Serpens B".
export function formatConstellationName(rawName: string): string {
  return rawName.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export interface ConstellationZone {
  // Nom brut ("UrsaMajor") : sert de clé stable pour retrouver la zone,
  // formatConstellationName() n'est appliqué qu'à l'affichage.
  name: string;
  // Centroïde REPROJETÉ sur la sphère céleste (cf. commentaire plus bas).
  centroid: THREE.Vector3;
  // Rayon angulaire (radians) : plus grand angle entre le centroïde et une
  // étoile de la figure — sert à dimensionner le halo de surbrillance.
  angularRadius: number;
}

// Un centroïde + rayon angulaire par constellation, calculés une fois à la
// construction de la scène : sert à la fois à positionner le nom (label) ET,
// nouveauté, de base à une sélection "par zone" façon diagramme de Voronoï
// (cf. findNearestZone) — une approximation du découpage réel du ciel en
// zones IAU, qu'on n'a pas ingéré (pas de jeu de données de frontières
// officielles disponible ici), mais qui a la même propriété clé : le ciel
// entier est couvert, sans trou, par la zone de la constellation la plus
// proche.
function makeConstellationZones(
  constellations: ConstellationSkyData["constellations"],
  stars: ConstellationSkyData["stars"],
): ConstellationZone[] {
  const zones: ConstellationZone[] = [];
  for (const constellation of constellations) {
    const points = constellation.lines
      .flat()
      .map((hip) => stars[hip])
      .filter((s): s is ConstellationSkyData["stars"][string] => !!s)
      .map((s) => raDecToSphere(s.ra, s.dec, SKY_RADIUS));
    if (points.length === 0) continue;
    // Le simple barycentre des points 3D "coupe" à l'intérieur de la sphère
    // (jusqu'à ~10 % de rayon en moins pour les plus grandes constellations
    // comme Hydre) — d'où la renormalisation à SKY_RADIUS.
    const centroid = points
      .reduce((acc, p) => acc.add(p), new THREE.Vector3())
      .divideScalar(points.length)
      .normalize()
      .multiplyScalar(SKY_RADIUS);
    const angularRadius = Math.max(...points.map((p) => centroid.angleTo(p)));

    zones.push({ name: constellation.name, centroid, angularRadius });
  }
  return zones;
}

// Nom de la constellation sélectionnée : plus de label discret en permanence
// (illisible sur le fond étoilé, cf. retour utilisateur) — à la place, un
// texte UNIQUEMENT tracé au contour ("police à traits", intérieur creux) que
// l'on ne construit qu'au moment de la sélection, pour laisser voir le fond
// étoilé à travers chaque lettre plutôt qu'un pavé plein. Un seul sprite
// partagé suffit puisqu'une seule zone est sélectionnée à la fois.
const NAME_SPRITE_HEIGHT = 46; // unités monde — grand, bien visible dans sa zone
const NAME_FONT_PX = 160; // résolution canvas ; la taille à l'écran vient de scale, pas de ce chiffre

function makeHollowTextTexture(text: string): { texture: THREE.CanvasTexture; aspect: number } {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const font = `700 ${NAME_FONT_PX}px "Orbitron", "Segoe UI", system-ui, sans-serif`;
  ctx.font = font;
  const paddingX = NAME_FONT_PX * 0.35;
  const paddingY = NAME_FONT_PX * 0.55;
  canvas.width = Math.ceil(ctx.measureText(text).width + paddingX * 2);
  canvas.height = Math.ceil(NAME_FONT_PX + paddingY * 2);
  // Redimensionner le canvas réinitialise son contexte : le font doit être réappliqué.
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  // Halo doux (contour large et translucide) pour rester lisible sur le fond
  // étoilé, puis contour net par-dessus — jamais de fillText : l'intérieur de
  // chaque lettre doit rester vide (fond du ciel visible au travers).
  ctx.strokeStyle = "rgba(140, 190, 255, 0.45)";
  ctx.lineWidth = NAME_FONT_PX * 0.16;
  ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
  ctx.strokeStyle = "#eaf4ff";
  ctx.lineWidth = NAME_FONT_PX * 0.045;
  ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return { texture, aspect: canvas.width / canvas.height };
}

function makeZoneNameSprite(): THREE.Sprite {
  const material = new THREE.SpriteMaterial({ transparent: true, opacity: 0, depthWrite: false, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 1;
  return sprite;
}

// Halo doux (dégradé radial) pour matérialiser la zone sélectionnée : une
// approximation stylisée (disque centré sur le centroïde, pas le contour
// polygonal exact de la constellation, qu'on n'a pas) — cohérent avec le
// reste de l'esthétique sci-fi de l'appli (mêmes teintes que le glow des
// labels).
let zoneHighlightTexture: THREE.Texture | null = null;
function getZoneHighlightTexture(): THREE.Texture {
  if (zoneHighlightTexture) return zoneHighlightTexture;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(140, 190, 255, 0.35)");
  gradient.addColorStop(0.55, "rgba(140, 190, 255, 0.16)");
  gradient.addColorStop(1, "rgba(140, 190, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  zoneHighlightTexture = new THREE.CanvasTexture(canvas);
  return zoneHighlightTexture;
}

function makeZoneHighlightSprite(): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: getZoneHighlightTexture(),
    depthWrite: false,
    depthTest: false,
    transparent: true,
    opacity: 0,
  });
  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 0; // sous le nom (cf. makeZoneNameSprite, renderOrder 1)
  return sprite;
}

// Sphère invisible englobant tout le ciel (rayon > SKY_RADIUS, donc "derrière"
// les étoiles/labels du point de vue du rayon de picking — un clic précis sur
// une étoile ou un système garde priorité, cf. clickable). Sert uniquement de
// cible de raycast pour capter un clic dans une zone vide de la carte, dont on
// déduit la constellation la plus proche (cf. findNearestZone). BackSide
// obligatoire : la caméra est À L'INTÉRIEUR de la sphère (au centre), il faut
// donc capter sa face interne.
export const SKY_ZONE_HIT_ID = "sky-zone-hit";
const ZONE_HIT_RADIUS = SKY_RADIUS * 1.4;

function makeZoneHitSphere(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(ZONE_HIT_RADIUS, 24, 16);
  const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false });
  return new THREE.Mesh(geometry, material);
}

// Constellation dont le centroïde est angulairement le plus proche du point
// cliqué — partition façon Voronoï de tout le ciel, sans trou (cf.
// commentaire de makeConstellationZones).
export function findNearestZone(zones: ConstellationZone[], point: THREE.Vector3): ConstellationZone | null {
  if (zones.length === 0) return null;
  const dir = point.clone().normalize();
  let best = zones[0];
  let bestAngle = dir.angleTo(best.centroid.clone().normalize());
  for (const zone of zones.slice(1)) {
    const angle = dir.angleTo(zone.centroid.clone().normalize());
    if (angle < bestAngle) {
      best = zone;
      bestAngle = angle;
    }
  }
  return best;
}

// Applique (ou retire, si selection est null) la sélection visuelle d'une
// zone : halo positionné dessus + nom (déjà localisé par l'appelant, cf.
// main.ts) tracé en grand au contour (police creuse, cf.
// makeHollowTextTexture). Ne reconstruit rien (pas de render()) — cf. le
// principe de "Nouvelle Navigation" déjà en place pour pendingSelection dans
// main.ts, qui préserve le cadrage caméra choisi par l'utilisateur.
export function applyZoneSelection(
  zones: ConstellationZone[],
  highlightSprite: THREE.Sprite,
  nameSprite: THREE.Sprite,
  selection: { rawName: string; displayName: string } | null,
): void {
  const highlightMaterial = highlightSprite.material as THREE.SpriteMaterial;
  const nameMaterial = nameSprite.material as THREE.SpriteMaterial;
  const selected = selection ? (zones.find((z) => z.name === selection.rawName) ?? null) : null;

  if (selected && selection) {
    // Le halo est un sprite carré : on le dimensionne un peu plus large que
    // le rayon angulaire pour bien couvrir la figure, sans prétendre suivre
    // son contour exact.
    const diameter = selected.angularRadius * SKY_RADIUS * 2.6;
    highlightSprite.position.copy(selected.centroid);
    highlightSprite.scale.set(diameter, diameter, 1);
    highlightMaterial.opacity = 1;

    nameMaterial.map?.dispose();
    const { texture, aspect } = makeHollowTextTexture(selection.displayName);
    nameMaterial.map = texture;
    nameMaterial.opacity = 1;
    nameMaterial.needsUpdate = true;
    nameSprite.scale.set(NAME_SPRITE_HEIGHT * aspect, NAME_SPRITE_HEIGHT, 1);
    nameSprite.position.copy(selected.centroid);
  } else {
    highlightMaterial.opacity = 0;
    nameMaterial.opacity = 0;
  }
}

export interface Sky2dSceneResult {
  group: THREE.Group;
  clickable: Map<THREE.Object3D, string>;
  // Direction de regard initiale (un des systèmes réels du jeu de données)
  // plutôt qu'une orientation arbitraire — cf. main.ts::setLookDirection.
  initialLookTarget: THREE.Vector3;
  zones: ConstellationZone[];
  highlightSprite: THREE.Sprite;
  nameSprite: THREE.Sprite;
  // Distance réelle (années-lumière) observateur → Soleil : présent
  // uniquement en mode "ciel vu depuis une exoplanète" (observerSystemId
  // fourni), cf. main.ts::renderExoSkyInfoPanel.
  sunDistanceLy?: number;
  // Halo du Soleil, exposé uniquement en mode exo, pour permettre à
  // main.ts::animate() de le faire scintiller (pulse d'échelle/opacité).
  sunGlowSprite?: THREE.Sprite;
}

// observerSystemId : quand fourni, le ciel n'est plus vu depuis la Terre mais
// depuis l'étoile hôte de ce système — le Soleil et les autres systèmes du
// jeu de données sont replacés sur le dôme selon leur vraie direction 3D
// relative (cf. realStarPosition), avec leur vraie distance. Le fond
// (étoiles catalogue Hipparcos + figures de constellations) reste identique
// à la vue depuis la Terre : ces étoiles n'ont pas de distance connue dans ce
// jeu de données, donc pas moyen de recalculer leur vraie direction — une
// approximation assumée et documentée dans l'UI (cf. i18n exoSkyApproxHint),
// raisonnable vu que ces étoiles catalogue sont pour la plupart bien plus
// loin que l'écart entre les systèmes de ce jeu de données (jusqu'à ~65 pc).
export function buildSky2dScene(seed: SeedData, sky: ConstellationSkyData, observerSystemId?: string): Sky2dSceneResult {
  const group = new THREE.Group();
  const clickable = new Map<THREE.Object3D, string>();

  group.add(makeStarfield(1500, SKY_RADIUS * 1.8));
  group.add(makeMilkyWayBand());
  group.add(makeMilkyWayContourLine());
  for (const label of makeMilkyWayLabels()) group.add(label);
  for (const points of makeCatalogStars(sky.stars)) group.add(points);
  group.add(makeConstellationLines(sky.constellations, sky.stars));

  const zones = makeConstellationZones(sky.constellations, sky.stars);

  const highlightSprite = makeZoneHighlightSprite();
  group.add(highlightSprite);

  const nameSprite = makeZoneNameSprite();
  group.add(nameSprite);

  const zoneHitSphere = makeZoneHitSphere();
  group.add(zoneHitSphere);
  clickable.set(zoneHitSphere, SKY_ZONE_HIT_ID);

  const observer = observerSystemId ? seed.systems.find((s) => s.id === observerSystemId) : null;
  const observerPos = observer ? realStarPosition(observer) : null;

  let initialLookTarget = new THREE.Vector3(0, 0, -SKY_RADIUS);
  let firstHostStar = true;
  let sunDistanceLy: number | undefined;
  let sunProjected: THREE.Vector3 | null = null;
  let sunGlowSprite: THREE.Sprite | undefined;

  for (const system of seed.systems) {
    if (observer && system.id === observer.id) continue; // pas de marqueur pour l'étoile où l'on se trouve déjà

    let pos: THREE.Vector3;
    if (observerPos) {
      const real = realStarPosition(system);
      const offset = real.clone().sub(observerPos);
      const distPc = offset.length();
      if (distPc < 1e-6) continue;
      pos = offset.normalize().multiplyScalar(SKY_RADIUS);
      if (system.id === "sol") sunDistanceLy = distPc * PC_TO_LY;
    } else {
      const { ra, dec } = system.star;
      // Le Soleil n'a pas de RA/Dec (on est dedans) : il ne peut pas être
      // projeté sur le dôme céleste, donc pas de marqueur pour lui ici — cf.
      // StarData.constellation, null pour la même raison.
      if (ra === null || dec === null) continue;
      pos = raDecToSphere(ra, dec, SKY_RADIUS);
    }

    // Le Soleil vu depuis une exoplanète mérite un marqueur distinct (plus
    // gros, couleur réelle jaune-blanc) — c'est LE point de repère demandé,
    // pas juste un système exoplanétaire de plus parmi d'autres.
    const isSunFromExo = observerPos && system.id === "sol";
    const color = isSunFromExo ? "#ffd97a" : deriveStarColor(system.star.spectype, system.star.st_teff);
    const marker = makeStarDot(color, isSunFromExo ? 9 : 2.2);
    marker.position.copy(pos);
    group.add(marker);
    clickable.set(marker, system.id);

    if (isSunFromExo) {
      const glow = makeSunGlowSprite();
      glow.position.copy(pos);
      group.add(glow);
      sunGlowSprite = glow;

      // Flèche pointant vers le marqueur, juste au-dessus du halo — le repère
      // directionnel explicite demandé en plus du halo et du gros label.
      const arrow = makeSunArrowSprite();
      arrow.position.copy(pos).add(new THREE.Vector3(0, 13, 0));
      group.add(arrow);
    }

    const labelText = isSunFromExo ? `☉ ${localizeName(system.name)}` : localizeName(system.name);
    const label = isSunFromExo ? makeLabelSprite(labelText, 30, [22, 5.5]) : makeLabelSprite(labelText, 22, [14, 3.5]);
    label.position.copy(pos).add(new THREE.Vector3(0, isSunFromExo ? 28 : 4, 0));
    group.add(label);
    clickable.set(label, system.id);

    if (isSunFromExo) {
      sunProjected = pos.clone();
    } else if (firstHostStar && !observerPos) {
      initialLookTarget = pos.clone();
      firstHostStar = false;
    }
  }

  // En mode exoplanète, on regarde le Soleil par défaut (c'est la demande
  // initiale : "repérer notre Soleil vu depuis cette exoplanète").
  if (sunProjected) initialLookTarget = sunProjected;

  return { group, clickable, initialLookTarget, zones, highlightSprite, nameSprite, sunDistanceLy, sunGlowSprite };
}
