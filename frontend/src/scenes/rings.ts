import * as THREE from "three";
import type { RingData } from "../data/types";
import { loadTexture } from "../textureCache";

// RingGeometry est plat dans le plan XY par défaut ; on le couche à plat
// dans le plan XZ (rotation -90° sur X) pour rester cohérent avec le plan
// orbital/équatorial simplifié utilisé partout ailleurs dans le projet.
export function buildRing(ring: RingData, planetVisualRadius: number): THREE.Mesh {
  const inner = planetVisualRadius * ring.inner_radius_ratio;
  const outer = planetVisualRadius * ring.outer_radius_ratio;
  const geometry = new THREE.RingGeometry(inner, outer, 64, 1);

  // RingGeometry mappe l'UV radialement de façon peu naturelle pour une
  // texture de type "dégradé radial" (ex. l'alpha de Saturne) ; on réécrit
  // l'UV en fonction de la distance réelle au centre pour un dégradé correct.
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const v3 = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v3.fromBufferAttribute(pos, i);
    const dist = v3.length();
    const t = (dist - inner) / (outer - inner);
    uv.setXY(i, t, 0.5);
  }

  const material = ring.texture
    ? new THREE.MeshBasicMaterial({
        map: loadTexture(ring.texture),
        transparent: true,
        side: THREE.DoubleSide,
      })
    : new THREE.MeshBasicMaterial({
        color: ring.color,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}
