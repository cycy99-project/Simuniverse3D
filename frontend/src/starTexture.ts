import * as THREE from "three";
import { shade } from "./colorShade";

// Aucune photo réelle de la surface d'une étoile autre que le Soleil
// n'existe (résolution insuffisante de tout instrument actuel pour ces
// distances) — la NASA/ESA elles-mêmes n'illustrent ces étoiles que par des
// vues d'artiste. On génère donc ici une texture procédurale (granulation
// façon convection stellaire), teintée par la couleur réelle dérivée de la
// température (cf. starColor.ts) : une représentation plausible assumée
// comme telle, jamais présentée comme une observation directe.
const SIZE_W = 512;
const SIZE_H = 256;

const cache = new Map<string, THREE.CanvasTexture>();

export function makeStarSurfaceTexture(color: string): THREE.CanvasTexture {
  const cached = cache.get(color);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = SIZE_W;
  canvas.height = SIZE_H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, SIZE_W, SIZE_H);

  // Granulation : nombreuses taches douces, un peu plus claires ou plus
  // sombres que la couleur de base, qui se chevauchent (cellules de
  // convection stellaire, motif réel observé sur le Soleil et extrapolé
  // ici aux autres étoiles).
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * SIZE_W;
    const y = Math.random() * SIZE_H;
    const r = 6 + Math.random() * 16;
    const lighter = Math.random() > 0.45;
    ctx.globalAlpha = 0.08 + Math.random() * 0.1;
    ctx.fillStyle = shade(color, lighter ? 0.35 : -0.35);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Quelques taches stellaires plus larges et plus sombres (starspots) —
  // phénomène réel et documenté, particulièrement actif chez les naines
  // rouges comme TRAPPIST-1.
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = shade(color, -0.5);
  for (let i = 0; i < 4; i++) {
    const x = Math.random() * SIZE_W;
    const y = Math.random() * SIZE_H;
    const r = 14 + Math.random() * 22;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  cache.set(color, texture);
  return texture;
}
