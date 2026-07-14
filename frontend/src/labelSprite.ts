import * as THREE from "three";

// Sprite texte (canvas 2D rasterisé en texture) : toujours face caméra, peu
// coûteux, suffisant pour de simples étiquettes de noms — partagé entre les
// labels de planètes/étoile (system.ts) et de satellites (moons.ts).
export function makeLabelSprite(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "24px system-ui, sans-serif";
  ctx.fillStyle = "#e6e6e6";
  ctx.textAlign = "center";
  ctx.fillText(text, 128, 40);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, depthWrite: false, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(8, 2, 1);
  return sprite;
}
