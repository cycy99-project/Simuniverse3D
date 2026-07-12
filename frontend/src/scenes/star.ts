import * as THREE from "three";
import type { StarData } from "../data/types";
import { deriveStarColor } from "../starColor";
import type { Spinnable } from "../spin";

export type StarCompareTarget = "sun" | "earth" | null;

const SUN_UNIT_RADIUS = 3; // rayon affiché pour 1 rayon solaire (mode comparaison)
const SUN_RADIUS_KM = 695_700;
const EARTH_RADIUS_KM = 6371;
const EARTH_RADIUS_IN_SUN_RADII = EARTH_RADIUS_KM / SUN_RADIUS_KM;
const MIN_VISIBLE_RADIUS = 0.05; // la Terre à l'échelle solaire serait un point invisible sans ce plancher
const STAR_SPIN_SPEED = 0.0009; // vitesse générique : la rotation stellaire des cibles n'est pas mesurée ici

function starColorFor(star: StarData, isSun: boolean): string {
  return isSun ? "#ffd97a" : deriveStarColor(star.spectype);
}

function starMesh(radius: number, color: string): THREE.Mesh {
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 48), new THREE.MeshBasicMaterial({ color }));
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
    const mesh = starMesh(radius, color);
    group.add(mesh);
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

  const mesh1 = starMesh(r1, color);
  mesh1.position.x = -(r1 + gap / 2);

  const mesh2 = starMesh(r2, otherColor);
  mesh2.position.x = r2 + gap / 2;

  group.add(mesh1, mesh2);

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
