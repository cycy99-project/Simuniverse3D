import * as THREE from "three";
import { shade } from "./colorShade";

// Règle de modélisation appliquée à TOUTES les étoiles (y compris le Soleil) :
// trois sprites additifs superposés au disque granulé (starTexture.ts),
// toujours face caméra comme les autres sprites du projet (labelSprite.ts,
// scenes/galaxy.ts). Même principe que le "sprite doux + blending additif"
// déjà utilisé pour la ceinture d'astéroïdes (scenes/asteroids.ts) — pas de
// pipeline de bloom/post-processing (le renderer reste en NoToneMapping,
// cf. main.ts), donc l'effet est entièrement porté par ces textures canvas
// procédurales, jamais une image téléchargée.
//
// - haloOuter : aura ambiante large et douce, statique, symétrique.
// - haloRim : couronne resserrée juste au contour du disque — dégradé lisse
//   et saturé (cf. images de référence : un bord fin et continu). Une
//   version à contour "façon flammes" irrégulier et animé a été tentée puis
//   abandonnée à la demande de l'utilisateur (rendu jugé peu convaincant,
//   trop flou/proéminences trop marquées) — cette version lisse est celle
//   retenue.
// - backlight : source cachée fixe, au centre (jamais décalée sur le côté,
//   jamais animée) qui "perce" légèrement à travers la sphère opaque pour
//   donner une impression de luminosité interne visible au centre du
//   disque, en permanence, quel que soit l'angle de caméra. Contrairement à
//   haloOuter/haloRim, elle utilise depthTest: false : elle est donc rendue
//   par-dessus la sphère opaque (au lieu d'en être occultée), avec une
//   opacité volontairement faible pour lire comme une lueur qui transperce
//   plutôt que comme un sprite plaqué dessus.

let outerGlowTexture: THREE.Texture | null = null;
function getOuterGlowTexture(): THREE.Texture {
  if (outerGlowTexture) return outerGlowTexture;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.3, "rgba(255,255,255,0.45)");
  gradient.addColorStop(0.65, "rgba(255,255,255,0.12)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  outerGlowTexture = new THREE.CanvasTexture(canvas);
  return outerGlowTexture;
}

let rimGlowTexture: THREE.Texture | null = null;
function getRimGlowTexture(): THREE.Texture {
  if (rimGlowTexture) return rimGlowTexture;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  // Le sprite est mis à l'échelle radius*2.5 (cf. addStarGlow), donc son
  // demi-côté (size/2) vaut 1,25x le rayon affiché de l'étoile : le bord
  // réel du disque tombe à la fraction (1/1,25)=0,8 du rayon du dégradé
  // (size/2). Le pic de luminosité est placé pile sur cette fraction pour
  // que l'anneau colle au contour réel du disque (avant : rien de visible,
  // le bord était placé trop à l'intérieur, entièrement masqué par la
  // sphère opaque).
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(0.72, "rgba(255,255,255,0)");
  gradient.addColorStop(0.8, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.92, "rgba(255,255,255,0.15)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  rimGlowTexture = new THREE.CanvasTexture(canvas);
  return rimGlowTexture;
}

let backlightTexture: THREE.Texture | null = null;
function getBacklightTexture(): THREE.Texture {
  if (backlightTexture) return backlightTexture;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  // Coeur compact et très lumineux (contrairement à haloOuter, large et
  // diffus) : ce qui vend l'effet "lumière qui perce" est le contraste net
  // entre l'occultation (invisible) et la révélation (point vif), pas une
  // diffusion large.
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.25, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.55, "rgba(255,255,255,0.4)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  backlightTexture = new THREE.CanvasTexture(canvas);
  return backlightTexture;
}

export interface StarGlowResult {
  sprites: THREE.Sprite[];
}

/**
 * Ajoute le halo externe + la couronne resserrée + le point de lumière caché
 * (backlight) d'une étoile à `group`, à la position `position` (généralement
 * l'origine locale du mesh de l'étoile), mis à l'échelle de son `radius`
 * affiché. Purement décoratif (sprites additifs), n'affecte pas la
 * géométrie cliquable de l'étoile.
 */
export function addStarGlow(
  group: THREE.Group,
  color: string,
  radius: number,
  position = new THREE.Vector3(0, 0, 0),
): StarGlowResult {
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getOuterGlowTexture(),
      color,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.55,
    }),
  );
  halo.position.copy(position);
  halo.scale.set(radius * 5.5, radius * 5.5, 1);

  const rimColor = shade(color, 0.3);
  const rim = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getRimGlowTexture(),
      color: rimColor,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.9,
    }),
  );
  rim.position.copy(position);
  rim.scale.set(radius * 2.5, radius * 2.5, 1);

  // Pile au centre, fixe (jamais décalée, jamais animée, cf. commentaire en
  // tête de fichier) — depthTest: false pour qu'elle perce toujours à travers
  // la sphère opaque plutôt que d'en être occultée. Opacité volontairement
  // faible pour lire comme une lueur interne qui transparaît au centre du
  // disque, pas comme un sprite plaqué par-dessus.
  const backlight = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getBacklightTexture(),
      color: shade(color, 0.55),
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.35,
    }),
  );
  backlight.position.copy(position);
  backlight.scale.set(radius * 1.4, radius * 1.4, 1);

  group.add(halo, rim, backlight);

  return { sprites: [halo, rim, backlight] };
}
