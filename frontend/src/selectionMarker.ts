import * as THREE from "three";

// Contour "losange" affiché autour d'un astre sélectionné mais pas encore
// confirmé (cf. Nouvelle Navigation dans main.ts : un clic ne fait plus
// qu'illustrer + proposer un bouton "Explorer" ; il n'entre plus directement
// dans la vue). Toujours face caméra (sprite) comme les autres marqueurs du
// projet (labelSprite.ts, starGlow.ts) ; depthTest: false pour rester visible
// par-dessus l'astre quel que soit l'angle de caméra, même principe que le
// "backlight" de starGlow.ts.
let markerTexture: THREE.Texture | null = null;
function getMarkerTexture(): THREE.Texture {
  if (markerTexture) return markerTexture;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const c = size / 2;
  const r = size * 0.4;
  ctx.beginPath();
  ctx.moveTo(c, c - r);
  ctx.lineTo(c + r, c);
  ctx.lineTo(c, c + r);
  ctx.lineTo(c - r, c);
  ctx.closePath();
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = size * 0.02;
  ctx.stroke();
  markerTexture = new THREE.CanvasTexture(canvas);
  return markerTexture;
}

export function createSelectionMarker(): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: getMarkerTexture(),
    color: "#8fd0ff",
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Sprite(material);
}

// Ajuste position + échelle du losange pour qu'il encadre `target`, quel que
// soit son type concret (Mesh sphérique pour une planète/étoile, Sprite pour
// un point d'étoile en vue galaxie) — la bounding sphere en coordonnées
// MONDE fonctionne uniformément dans les deux cas, sans logique par scène.
export function fitSelectionMarker(marker: THREE.Sprite, target: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(target);
  const sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);
  const radius = sphere.radius || 1;
  marker.position.copy(sphere.center);
  marker.scale.set(radius * 2.8, radius * 2.8, 1);
}
