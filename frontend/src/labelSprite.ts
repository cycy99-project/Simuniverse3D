import * as THREE from "three";

// Supersampling x4 : le canvas est rendu à une résolution bien plus grande
// que sa taille d'affichage réelle, pour un texte net une fois le sprite
// agrandi en unités scène (sans ça, la police apparaît pixelisée/floue).
const SUPERSAMPLE = 4;
const BASE_CANVAS_WIDTH = 256 * SUPERSAMPLE;
const CANVAS_HEIGHT = 64 * SUPERSAMPLE;
const BASE_SCALE_X = 8;
const SCALE_Y = 2;
const PADDING = 24 * SUPERSAMPLE; // marge pour ne jamais couper un glyphe en bord de canvas
// "Orbitron" (police HUD géométrique, cf. capture de référence Solar System
// Scope) : préchargée explicitement dans main.ts (document.fonts.load) avant
// le premier rendu, car ces libellés sont rasterisés une fois pour toutes
// dans une texture canvas — contrairement à du texte DOM, ils ne se
// redessinent jamais tout seuls si la police finit de charger après coup.
// DIAGNOSTIC TEMPORAIRE : Orbitron retirée pour isoler si le bug d'affichage
// mobile (glyphes cassés) vient du fichier de police custom ou d'un souci
// plus général du rendu canvas sur ce Chrome — à réintégrer une fois le test
// concluant (cf. conversation).
const FONT = `700 ${24 * SUPERSAMPLE}px "Segoe UI", system-ui, sans-serif`;

// Sprite texte (canvas 2D rasterisé en texture) : toujours face caméra, peu
// coûteux, suffisant pour de simples étiquettes de noms — partagé entre les
// labels de planètes/étoile (system.ts) et de satellites (moons.ts). La
// largeur du canvas s'adapte au texte (mesurée via measureText) : les libellés
// courts (noms de planètes) gardent la taille/largeur d'origine, les plus
// longs (ex. "Zone habitable (théorique)") ne sont plus tronqués — la largeur
// du sprite en unités scène suit la même proportion pour ne pas déformer le texte.
// willReadFrequently : force le rendu logiciel du canvas plutôt qu'accéléré
// GPU. Sur Chrome Android, le cache de glyphes GPU d'un canvas accéléré peut
// se désynchroniser de l'API de chargement de polices juste après le
// chargement d'une police custom ("Orbitron"), rasterisant du texte
// illisible (glyphes de remplacement) de façon définitive — ce hint
// contourne ce bug spécifique à Chrome mobile (constaté absent sur Samsung
// Internet, qui n'utilise pas le même pipeline de rendu de canvas).
export function makeLabelSprite(text: string): THREE.Sprite {
  const measureCtx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  measureCtx.font = FONT;
  const textWidth = measureCtx.measureText(text).width;
  const canvasWidth = Math.max(BASE_CANVAS_WIDTH, textWidth + PADDING);

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.font = FONT;
  ctx.fillStyle = "#e6e6e6";
  ctx.textAlign = "center";
  ctx.fillText(text, canvas.width / 2, 40 * SUPERSAMPLE);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  const material = new THREE.SpriteMaterial({ map: texture, depthWrite: false, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(BASE_SCALE_X * (canvasWidth / BASE_CANVAS_WIDTH), SCALE_Y, 1);
  return sprite;
}
