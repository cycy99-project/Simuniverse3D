import * as THREE from "three";
import type { StarData } from "../data/types";
import { deriveStarColor } from "../starColor";
import { loadTexture } from "../textureCache";
import { makeStarSurfaceTexture } from "../starTexture";
import { addStarGlow } from "../starGlow";
import type { Spinnable } from "../spin";

export type StarCompareTarget = "sun" | "earth" | null;

const SUN_UNIT_RADIUS = 3; // rayon affiché pour 1 rayon solaire (mode comparaison)
const SUN_RADIUS_KM = 695_700;
const EARTH_RADIUS_KM = 6371;
const EARTH_RADIUS_IN_SUN_RADII = EARTH_RADIUS_KM / SUN_RADIUS_KM;
const MIN_VISIBLE_RADIUS = 0.05; // la Terre à l'échelle solaire serait un point invisible sans ce plancher
const STAR_SPIN_SPEED = 0.0009; // vitesse générique : la rotation stellaire des cibles n'est pas mesurée ici

function starColorFor(star: StarData, isSun: boolean): string {
  return isSun ? "#ffd97a" : deriveStarColor(star.spectype, star.st_teff);
}

function starMesh(radius: number, color: string, texture?: string | null): THREE.Mesh {
  // Pas de photo réelle disponible pour une étoile autre que le Soleil (cf.
  // starTexture.ts) : texture procédurale de granulation à défaut d'une
  // couleur plate, plausible mais jamais présentée comme une observation.
  const material = texture
    ? new THREE.MeshBasicMaterial({ map: loadTexture(texture) })
    : new THREE.MeshBasicMaterial({ map: makeStarSurfaceTexture(color) });
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 48), material);
}

export interface StarSceneResult {
  group: THREE.Group;
  cameraPos: THREE.Vector3;
  spinnables: Spinnable[];
}

export function buildStarScene(
  star: StarData,
  isSun: boolean,
  compareWith: StarCompareTarget,
  sun: StarData,
): StarSceneResult {
  const group = new THREE.Group();
  const color = starColorFor(star, isSun);

  if (compareWith === null) {
    const radius = 6;
    const mesh = starMesh(radius, color, isSun ? star.texture : null);
    group.add(mesh);
    addStarGlow(group, color, radius);
    return {
      group,
      cameraPos: new THREE.Vector3(0, 4, radius * 3.2),
      spinnables: [{ group: mesh, speed: STAR_SPIN_SPEED }],
    };
  }

  // Mode comparaison : tailles réelles relatives, 1 rayon solaire = SUN_UNIT_RADIUS.
  const starRadiusSolar = star.st_rad ?? 1;
  const otherRadiusSolar = compareWith === "sun" ? (sun.st_rad ?? 1) : EARTH_RADIUS_IN_SUN_RADII;
  const otherColor = compareWith === "sun" ? "#ffd97a" : "#4f83cc";

  const r1 = Math.max(SUN_UNIT_RADIUS * starRadiusSolar, MIN_VISIBLE_RADIUS);
  const r2 = Math.max(SUN_UNIT_RADIUS * otherRadiusSolar, MIN_VISIBLE_RADIUS);
  const gap = Math.max(r1, r2) * 0.6;

  const mesh1 = starMesh(r1, color, isSun ? star.texture : null);
  mesh1.position.x = -(r1 + gap / 2);

  const mesh2 = starMesh(r2, otherColor, compareWith === "sun" ? sun.texture : null);
  mesh2.position.x = r2 + gap / 2;

  group.add(mesh1, mesh2);
  addStarGlow(group, color, r1, mesh1.position);
  addStarGlow(group, otherColor, r2, mesh2.position);

  const halfWidthLeft = Math.abs(mesh1.position.x) + r1;
  const halfWidthRight = mesh2.position.x + r2;
  const camDist = Math.max(halfWidthLeft, halfWidthRight) * 3.2;

  return {
    group,
    cameraPos: new THREE.Vector3(0, Math.max(r1, r2) * 0.5, camDist),
    spinnables: [
      { group: mesh1, speed: STAR_SPIN_SPEED },
      { group: mesh2, speed: STAR_SPIN_SPEED },
    ],
  };
}
