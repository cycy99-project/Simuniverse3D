import * as THREE from "three";
import { createNoise2D } from "simplex-noise";
import type { NoiseFunction2D } from "simplex-noise";
import { shade } from "./colorShade";

// Comme pour starTexture.ts : aucune photo réelle n'existe pour ces
// exoplanètes (résolution insuffisante de tout instrument actuel à ces
// distances) — texture procédurale teintée par la couleur dérivée de la
// recherche (heuristique générique ou interpretation_override calibré),
// jamais présentée comme une observation directe. Le rendu est basé sur du
// bruit cohérent (simplex-noise, fbm multi-octaves) échantillonné pixel par
// pixel plutôt que sur des primitives posées au hasard (cercles/lignes),
// pour un aspect organique et continu façon relief/nuage réel.
const SIZE_W = 512;
const SIZE_H = 256;

export type PlanetTextureStyle = "rocky" | "cloudy" | "icyCracks" | "gasBands" | "lava";

const cache = new Map<string, THREE.CanvasTexture>();

// Repli quand aucun textureStyle explicite n'est fourni (cas générique,
// heuristique molécules+température sans recherche dédiée) : reproduit le
// comportement historique (relief rocheux seul si peu nuageux, bandes
// horizontales façon géante gazeuse au-delà d'un seuil).
function inferStyle(cloudDensity: number): PlanetTextureStyle {
  if (cloudDensity > 0.4) return "gasBands";
  return "rocky";
}

// ---- Graine déterministe --------------------------------------------------
//
// Le cache (Map en mémoire) est vidé à chaque rechargement de page : sans
// graine dérivée de la clé de cache, chaque F5 retomberait sur un tirage de
// bruit différent pour la même exoplanète (aspect visuel instable d'une
// session à l'autre). On dérive donc un seed numérique d'un hash de la clé,
// utilisé pour amorcer un PRNG qui lui-même amorce simplex-noise : à clé de
// cache identique, le champ de bruit — et donc le rendu — est identique.

// Hash FNV-1a : simple, rapide, suffisant pour dériver un seed 32 bits
// (pas besoin de résistance cryptographique ici).
function hashStringToSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32 : PRNG 32 bits compact, passé à createNoise2D (qui accepte une
// fonction random en option) pour rendre la table de permutation du bruit
// déterministe.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Bruit fractal ---------------------------------------------------------

// fbm "standard" : somme de plusieurs octaves de simplex-noise à amplitude
// décroissante (persistence) et fréquence croissante (lacunarity), normalisée
// dans [-1, 1]. Contrairement aux anciennes primitives (cercles/ellipses
// posés au hasard, sans lien entre eux), ce champ est continu : deux pixels
// voisins ont des valeurs proches, ce qui donne un relief/une couverture
// nuageuse cohérente plutôt que du bruit blanc.
function fbm(
  noise2D: NoiseFunction2D,
  x: number,
  y: number,
  octaves: number,
  persistence: number,
  lacunarity: number,
): number {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let max = 0;
  for (let o = 0; o < octaves; o++) {
    sum += noise2D(x * frequency, y * frequency) * amplitude;
    max += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  return sum / max;
}

// fbm "ridged" : chaque octave est repliée via (1 - |bruit|) avant d'être
// sommée, ce qui produit des crêtes fines et nettes là où le bruit de base
// passe par zéro (technique classique de "ridged multifractal"). Résultat
// dans [0, 1], avec des pics marqués — utilisé pour les fissures de glace et
// les veines de lave, en remplacement des marches aléatoires isolées.
function ridgedFbm(
  noise2D: NoiseFunction2D,
  x: number,
  y: number,
  octaves: number,
  persistence: number,
  lacunarity: number,
): number {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let max = 0;
  for (let o = 0; o < octaves; o++) {
    const ridge = 1 - Math.abs(noise2D(x * frequency, y * frequency));
    sum += ridge * amplitude;
    max += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  return sum / max;
}

// ---- Utilitaires couleur / interpolation -----------------------------------

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(
  c1: [number, number, number],
  c2: [number, number, number],
  t: number,
): [number, number, number] {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

// Peint un champ RGB calculé pixel par pixel dans le canvas, en une seule
// passe O(SIZE_W * SIZE_H) : chaque pixel coûte un nombre constant d'appels
// de bruit (indépendant des autres pixels), donc pas d'algorithme en O(n²).
// Ce calcul n'a lieu qu'une fois par texture grâce au cache en aval.
function paintPixelField(
  ctx: CanvasRenderingContext2D,
  pixelColor: (x: number, y: number) => [number, number, number],
): void {
  const imageData = ctx.createImageData(SIZE_W, SIZE_H);
  const data = imageData.data;
  for (let y = 0; y < SIZE_H; y++) {
    for (let x = 0; x < SIZE_W; x++) {
      const [r, g, b] = pixelColor(x, y);
      const idx = (y * SIZE_W + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

// ---- Styles -----------------------------------------------------------------

// Monde rocheux/tellurique : relief fbm multi-octaves converti en élévation,
// qui module la teinte entre une version plus sombre et plus claire de la
// couleur de base (continents/dépressions cohérents plutôt qu'un mouchetis
// de cercles épars), plus une couche de bruit haute fréquence en léger
// overlay pour le grain de surface / cratères.
function drawRocky(
  ctx: CanvasRenderingContext2D,
  color: string,
  cloudDensity: number,
  random: () => number,
): void {
  const elevationNoise = createNoise2D(random);
  const grainNoise = createNoise2D(random);
  const dark = hexToRgb(shade(color, -0.35));
  const light = hexToRgb(shade(color, 0.3));
  const base = hexToRgb(color);
  const grainAmplitude = 8 + cloudDensity * 10;

  paintPixelField(ctx, (x, y) => {
    const elevation = fbm(elevationNoise, x / 70, y / 70, 5, 0.5, 2.0);
    const t = clamp01(elevation * 0.5 + 0.5);
    const [r, g, b] = t < 0.5 ? lerpRgb(dark, base, t * 2) : lerpRgb(base, light, (t - 0.5) * 2);
    const grain = fbm(grainNoise, x / 9, y / 9, 3, 0.5, 2.0) * grainAmplitude;
    return [clampByte(r + grain), clampByte(g + grain), clampByte(b + grain)];
  });
}

// Couverture nuageuse organique (mondes océaniques/nuageux, ex. TRAPPIST-1
// d/e) : un bruit fbm est distordu par deux autres champs de bruit (domain
// warping horizontal/vertical) avant d'être seuillé selon cloudDensity, ce
// qui donne des masses nuageuses continues et irrégulières — pas des amas
// d'ellipses isolées — mélangées à hazeColor (pas un simple éclaircissement
// de la couleur de base, pour garder un vrai contraste nuage/fond).
function drawOrganicClouds(
  ctx: CanvasRenderingContext2D,
  color: string,
  hazeColor: string,
  cloudDensity: number,
  random: () => number,
): void {
  const terrainNoise = createNoise2D(random);
  const warpXNoise = createNoise2D(random);
  const warpYNoise = createNoise2D(random);
  const cloudNoise = createNoise2D(random);
  const darkBase = hexToRgb(shade(color, -0.2));
  const lightBase = hexToRgb(shade(color, 0.15));
  const haze = hexToRgb(hazeColor);
  // densité 0 -> seuil haut (peu de nuages) ; densité 1 -> seuil bas (couverture quasi totale).
  const bias = 1 - cloudDensity * 2;

  paintPixelField(ctx, (x, y) => {
    const terrain = fbm(terrainNoise, x / 90, y / 90, 4, 0.5, 2.0);
    const terrainT = clamp01(terrain * 0.5 + 0.5);
    const surface = lerpRgb(darkBase, lightBase, terrainT);

    const warpX = fbm(warpXNoise, x / 60, y / 60, 2, 0.5, 2.0) * 40;
    const warpY = fbm(warpYNoise, x / 60, y / 60, 2, 0.5, 2.0) * 40;
    const cloud = fbm(cloudNoise, (x + warpX) / 45, (y + warpY) / 45, 4, 0.5, 2.0);
    const cloudT = smoothstep(bias - 0.2, bias + 0.2, cloud);

    return lerpRgb(surface, haze, cloudT);
  });
}

// Banquise fracturée (ex. TRAPPIST-1 f) : bruit "ridged" pour un réseau de
// crêtes fines et continues façon fissures (au lieu de marches aléatoires
// anguleuses sans lien entre elles), tracé en hazeColor. Le fond reste clair
// mais garde une légère variation d'élévation (bruit fbm de basse fréquence)
// pour donner un peu de relief à la glace.
function drawIceCracks(
  ctx: CanvasRenderingContext2D,
  color: string,
  hazeColor: string,
  cloudDensity: number,
  random: () => number,
): void {
  const reliefNoise = createNoise2D(random);
  const crackNoise = createNoise2D(random);
  const iceDark = hexToRgb(shade(color, 0.1));
  const iceLight = hexToRgb(shade(color, 0.35));
  const haze = hexToRgb(hazeColor);
  // Seuil de crête plus bas quand cloudDensity augmente -> réseau de fissures plus dense.
  const crackThreshold = 0.86 - cloudDensity * 0.18;

  paintPixelField(ctx, (x, y) => {
    const relief = fbm(reliefNoise, x / 50, y / 50, 4, 0.5, 2.0);
    const reliefT = clamp01(relief * 0.5 + 0.5);
    const surface = lerpRgb(iceDark, iceLight, reliefT);

    const ridge = ridgedFbm(crackNoise, x / 34, y / 34, 5, 0.55, 2.1);
    const crackT = smoothstep(crackThreshold, crackThreshold + 0.1, ridge);

    return lerpRgb(surface, haze, crackT);
  });
}

// Bandes façon géante gazeuse : la latitude (y) pilote une phase de bande
// périodique (sinusoïde), mais la coordonnée de latitude utilisée est
// distordue horizontalement par un bruit fbm (domain warping) et perturbée
// par un second bruit de turbulence — les bandes ondulent et se mélangent
// localement au lieu d'empiler des ellipses parfaitement horizontales.
function drawGasBands(
  ctx: CanvasRenderingContext2D,
  color: string,
  cloudDensity: number,
  random: () => number,
): void {
  const warpNoise = createNoise2D(random);
  const turbulenceNoise = createNoise2D(random);
  const dark = hexToRgb(shade(color, -0.28));
  const light = hexToRgb(shade(color, 0.22));
  const bandCount = 3 + cloudDensity * 5;

  paintPixelField(ctx, (x, y) => {
    const warp = fbm(warpNoise, x / 80, y / 40, 3, 0.5, 2.0) * 18;
    const turbulence = fbm(turbulenceNoise, x / 30, y / 30, 3, 0.5, 2.0);
    const bandPhase = ((y + warp) / SIZE_H) * bandCount * Math.PI * 2 + turbulence * 1.5;
    const t = Math.sin(bandPhase) * 0.5 + 0.5;
    return lerpRgb(dark, light, t);
  });
}

// Océan de lave (ex. 55 Cancri e, monde ultra-chaud verrouillé par les
// marées) : bruit "ridged" turbulent formant un réseau de veines continu
// (au lieu de marches aléatoires isolées), mappé vers un dégradé chaud à
// deux seuils : croûte sombre (color assombrie) -> hazeColor (veine) ->
// quasi-blanc (cœur incandescent, hazeColor éclairci).
function drawLavaCracks(
  ctx: CanvasRenderingContext2D,
  color: string,
  hazeColor: string,
  cloudDensity: number,
  random: () => number,
): void {
  const veinNoise = createNoise2D(random);
  const crust = hexToRgb(shade(color, -0.25));
  const vein = hexToRgb(hazeColor);
  const core = hexToRgb(shade(hazeColor, 0.55));
  // Plus cloudDensity est élevé, plus le réseau de veines couvre la surface.
  const t1 = 0.62 - cloudDensity * 0.12;
  const t2 = 0.88 - cloudDensity * 0.08;

  paintPixelField(ctx, (x, y) => {
    const ridge = ridgedFbm(veinNoise, x / 38, y / 38, 5, 0.55, 2.1);
    const crustToVein = smoothstep(0, t1, ridge);
    const veinToCore = smoothstep(t1, t2, ridge);
    const step1 = lerpRgb(crust, vein, crustToVein);
    return lerpRgb(step1, core, veinToCore);
  });
}

export function makePlanetSurfaceTexture(
  color: string,
  hazeColor: string,
  cloudDensity: number,
  style?: PlanetTextureStyle,
): THREE.CanvasTexture {
  const resolvedStyle = style ?? inferStyle(cloudDensity);
  const key = `${color}|${hazeColor}|${cloudDensity.toFixed(2)}|${resolvedStyle}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = SIZE_W;
  canvas.height = SIZE_H;
  const ctx = canvas.getContext("2d")!;

  // Graine déterministe dérivée de la clé de cache (cf. commentaire en haut
  // de fichier) : une même exoplanète garde le même aspect visuel d'une
  // session à l'autre.
  const random = mulberry32(hashStringToSeed(key));

  if (resolvedStyle === "gasBands") {
    drawGasBands(ctx, color, cloudDensity, random);
  } else if (resolvedStyle === "cloudy") {
    drawOrganicClouds(ctx, color, hazeColor, cloudDensity, random);
  } else if (resolvedStyle === "icyCracks") {
    drawIceCracks(ctx, color, hazeColor, cloudDensity, random);
  } else if (resolvedStyle === "lava") {
    drawLavaCracks(ctx, color, hazeColor, cloudDensity, random);
  } else {
    drawRocky(ctx, color, cloudDensity, random);
  }

  const texture = new THREE.CanvasTexture(canvas);
  cache.set(key, texture);
  return texture;
}
