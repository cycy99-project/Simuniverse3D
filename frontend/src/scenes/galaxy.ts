import * as THREE from "three";
import type { SeedData, SystemData } from "../data/types";
import { VOYAGER_1, VOYAGER_2, voyagerPosition, type VoyagerInfo } from "../voyager";
import { localizeName } from "../nameTranslations";

// Longueur fixe, arbitraire et volontairement courte : à cette échelle (pc),
// la distance réelle des sondes (quelques centaines d'UA) serait totalement
// invisible collée au Soleil. La flèche n'indique donc que la DIRECTION
// réelle (vraie latitude écliptique + azimut schématique, cf. voyager.ts),
// pas une position à l'échelle.
const VOYAGER_ARROW_LENGTH = 5;

// Compression racine carrée des distances (en parsecs) pour garder tous les
// systèmes visibles dans une même vue malgré l'écart réel (12 à 214 pc) —
// ce n'est pas une échelle linéaire fidèle, juste un choix de lisibilité.
const DISTANCE_SCALE = 20;

function starPosition(system: SystemData): THREE.Vector3 {
  const { ra, dec, sy_dist } = system.star;
  if (ra === null || dec === null || sy_dist === null || sy_dist === 0) {
    return new THREE.Vector3(0, 0, 0);
  }
  const raRad = (ra * Math.PI) / 180;
  const decRad = (dec * Math.PI) / 180;
  const displayDist = Math.sqrt(sy_dist) * DISTANCE_SCALE;
  return new THREE.Vector3(
    Math.cos(decRad) * Math.cos(raRad) * displayDist,
    Math.sin(decRad) * displayDist,
    Math.cos(decRad) * Math.sin(raRad) * displayDist,
  );
}

// Fond étoilé décoratif, même principe que dans system.ts : positions
// aléatoires sur une coquille lointaine, pas les vraies positions Gaia —
// les seuls points représentant de vraies coordonnées ici sont les systèmes
// du jeu de données (starPosition, RA/Dec réels).
function makeStarfield(count: number, radius: number): THREE.Points {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false });
  return new THREE.Points(geometry, material);
}

function makeLabelSprite(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "28px system-ui, sans-serif";
  ctx.fillStyle = "#e6e6e6";
  ctx.textAlign = "center";
  ctx.fillText(text, 128, 40);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, depthWrite: false, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(12, 3, 1);
  return sprite;
}

export interface GalaxySceneResult {
  group: THREE.Group;
  clickable: Map<THREE.Object3D, string>;
  cameraPos: THREE.Vector3;
}

export function buildGalaxyScene(seed: SeedData): GalaxySceneResult {
  const group = new THREE.Group();
  const clickable = new Map<THREE.Object3D, string>();

  group.add(makeStarfield(3000, 1500));

  for (const system of seed.systems) {
    const pos = starPosition(system);
    const isSun = system.id === "sol";
    const color = isSun ? 0xffd97a : 0x8fd0ff;
    const size = isSun ? 1.2 : 0.8;

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size, 16, 16),
      new THREE.MeshBasicMaterial({ color }),
    );
    mesh.position.copy(pos);
    group.add(mesh);
    clickable.set(mesh, system.id);

    const label = makeLabelSprite(localizeName(system.name));
    label.position.copy(pos).add(new THREE.Vector3(0, size + 2, 0));
    group.add(label);

    if (isSun) {
      for (const v of [VOYAGER_1, VOYAGER_2] as VoyagerInfo[]) {
        const dir = voyagerPosition(v, 1).normalize();
        const arrow = new THREE.ArrowHelper(dir, pos, VOYAGER_ARROW_LENGTH, v.color, 1, 0.6);
        group.add(arrow);

        const label2 = makeLabelSprite(v.name);
        label2.position.copy(pos).addScaledVector(dir, VOYAGER_ARROW_LENGTH + 1.5);
        group.add(label2);
      }
    }
  }

  return { group, clickable, cameraPos: new THREE.Vector3(0, 60, 160) };
}
