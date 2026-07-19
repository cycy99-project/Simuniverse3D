import * as THREE from "three";
import { shade } from "./colorShade";

// Comme pour starTexture.ts : aucune photo réelle n'existe pour ces
// exoplanètes (résolution insuffisante de tout instrument actuel à ces
// distances) — texture procédurale teintée par la couleur dérivée de la
// recherche (heuristique générique ou interpretation_override calibré),
// jamais présentée comme une observation directe.
const SIZE_W = 512;
const SIZE_H = 256;

export type PlanetTextureStyle = "rocky" | "cloudy" | "icyCracks" | "gasBands" | "lava";

const cache = new Map<string, THREE.CanvasTexture>();

// Repli quand aucun textureStyle explicite n'est fourni (cas générique,
// heuristique molécules+température sans recherche dédiée) : reproduit le
// comportement historique (mouchetis seul si peu nuageux, bandes horizontales
// façon géante gazeuse au-delà d'un seuil).
function inferStyle(cloudDensity: number): PlanetTextureStyle {
  if (cloudDensity > 0.4) return "gasBands";
  return "rocky";
}

function drawSpeckles(ctx: CanvasRenderingContext2D, color: string, cloudDensity: number): void {
  const speckleCount = Math.round(60 + cloudDensity * 140);
  for (let i = 0; i < speckleCount; i++) {
    const x = Math.random() * SIZE_W;
    const y = Math.random() * SIZE_H;
    const r = 4 + Math.random() * (8 + cloudDensity * 10);
    const lighter = Math.random() > 0.5;
    ctx.globalAlpha = 0.06 + Math.random() * 0.1;
    ctx.fillStyle = shade(color, lighter ? 0.3 : -0.3);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGasBands(ctx: CanvasRenderingContext2D, color: string, cloudDensity: number): void {
  const bandCount = 3 + Math.round(cloudDensity * 5);
  for (let i = 0; i < bandCount; i++) {
    const y = Math.random() * SIZE_H;
    const height = 6 + Math.random() * 14;
    const lighter = Math.random() > 0.5;
    ctx.globalAlpha = 0.1 + Math.random() * 0.15;
    ctx.fillStyle = shade(color, lighter ? 0.25 : -0.25);
    ctx.beginPath();
    ctx.ellipse(SIZE_W / 2, y, SIZE_W / 2 + 20, height, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Amas nuageux organiques (mondes océaniques/nuageux, ex. TRAPPIST-1 d/e) :
// grappes de petites ellipses tournées aléatoirement, teintées par hazeColor
// (pas simplement éclaircies à partir de skyColor) pour un vrai contraste
// nuage blanc/clair sur fond océan, plutôt que des mouchetis de la même teinte.
function drawOrganicClouds(ctx: CanvasRenderingContext2D, hazeColor: string, cloudDensity: number): void {
  const clusterCount = Math.round(6 + cloudDensity * 16);
  for (let c = 0; c < clusterCount; c++) {
    const cx = Math.random() * SIZE_W;
    const cy = Math.random() * SIZE_H;
    const blobCount = 4 + Math.round(Math.random() * 6);
    for (let b = 0; b < blobCount; b++) {
      const x = cx + (Math.random() - 0.5) * 70;
      const y = cy + (Math.random() - 0.5) * 34;
      const r = 8 + Math.random() * 18;
      ctx.globalAlpha = 0.12 + Math.random() * 0.2;
      ctx.fillStyle = hazeColor;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.4, r * 0.7, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Réseau de fissures linéaires façon banquise fracturée (ex. TRAPPIST-1 f) :
// marches aléatoires anguleuses tracées avec hazeColor, sur un fond clair
// légèrement moucheté pour donner un peu de relief à la glace (sinon un aplat
// blanc pur ne "ressemble" à rien).
function drawIceCracks(ctx: CanvasRenderingContext2D, hazeColor: string, cloudDensity: number): void {
  const crackCount = 8 + Math.round(cloudDensity * 20);
  for (let i = 0; i < crackCount; i++) {
    let x = Math.random() * SIZE_W;
    let y = Math.random() * SIZE_H;
    let angle = Math.random() * Math.PI * 2;
    const segments = 6 + Math.round(Math.random() * 10);
    ctx.globalAlpha = 0.3 + Math.random() * 0.3;
    ctx.strokeStyle = hazeColor;
    ctx.lineWidth = 1 + Math.random() * 2.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < segments; s++) {
      angle += (Math.random() - 0.5) * 1.3;
      x += Math.cos(angle) * (8 + Math.random() * 16);
      y += Math.sin(angle) * (8 + Math.random() * 16);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// Océan de lave (ex. 55 Cancri e, monde ultra-chaud verrouillé par les
// marées) : réseau de veines incandescentes façon coulée de lave sur une
// croûte sombre figée, avec quelques poches de fusion plus larges — contraste
// volontaire avec drawIceCracks (fond clair + fissures pâles) : ici fond
// sombre (basalte refroidi) + fissures lumineuses (hazeColor, ton orange/rouge).
function drawLavaCracks(ctx: CanvasRenderingContext2D, hazeColor: string, cloudDensity: number): void {
  const crackCount = 10 + Math.round(cloudDensity * 20);
  for (let i = 0; i < crackCount; i++) {
    let x = Math.random() * SIZE_W;
    let y = Math.random() * SIZE_H;
    let angle = Math.random() * Math.PI * 2;
    const segments = 5 + Math.round(Math.random() * 8);
    const points: [number, number][] = [[x, y]];
    for (let s = 0; s < segments; s++) {
      angle += (Math.random() - 0.5) * 1.1;
      x += Math.cos(angle) * (10 + Math.random() * 18);
      y += Math.sin(angle) * (10 + Math.random() * 18);
      points.push([x, y]);
    }
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Halo large et diffus (lueur) sous la veine nette.
    ctx.globalAlpha = 0.15 + Math.random() * 0.12;
    ctx.strokeStyle = hazeColor;
    ctx.lineWidth = 7 + Math.random() * 7;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (const [px, py] of points.slice(1)) ctx.lineTo(px, py);
    ctx.stroke();

    // Veine nette et claire par-dessus, quasi blanche-orangée (coeur incandescent).
    ctx.globalAlpha = 0.75 + Math.random() * 0.25;
    ctx.strokeStyle = shade(hazeColor, 0.45);
    ctx.lineWidth = 1.5 + Math.random() * 1.5;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (const [px, py] of points.slice(1)) ctx.lineTo(px, py);
    ctx.stroke();
  }

  // Poches de lave en fusion (plus larges, isolées).
  const poolCount = 4 + Math.round(cloudDensity * 8);
  for (let i = 0; i < poolCount; i++) {
    const x = Math.random() * SIZE_W;
    const y = Math.random() * SIZE_H;
    const r = 4 + Math.random() * 8;
    ctx.globalAlpha = 0.55 + Math.random() * 0.3;
    ctx.fillStyle = shade(hazeColor, 0.35);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
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

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, SIZE_W, SIZE_H);

  // Mouchetis de base — toujours présent (même un monde rocheux nu ou une
  // banquise a un grain de surface) avant le motif spécifique au style.
  drawSpeckles(ctx, color, cloudDensity);

  if (resolvedStyle === "gasBands") {
    drawGasBands(ctx, color, cloudDensity);
  } else if (resolvedStyle === "cloudy") {
    drawOrganicClouds(ctx, hazeColor, cloudDensity);
  } else if (resolvedStyle === "icyCracks") {
    drawIceCracks(ctx, hazeColor, cloudDensity);
  } else if (resolvedStyle === "lava") {
    drawLavaCracks(ctx, hazeColor, cloudDensity);
  }

  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  cache.set(key, texture);
  return texture;
}
