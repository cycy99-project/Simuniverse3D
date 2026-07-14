import * as THREE from "three";

// Bruit pseudo-aléatoire déterministe (pas de vraie forme mesurée par corps :
// aucun astéroïde individuel de la ceinture principale ou de Kuiper n'est
// catalogué avec sa géométrie précise ici) — sert uniquement à casser la
// symétrie parfaite d'un icosaèdre pour obtenir un caillou plausible.
function hashNoise(x: number, y: number, z: number, seed: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 269.5) * 43758.5453123;
  return s - Math.floor(s);
}

function seededRandom(seed: number): number {
  const s = Math.sin(seed * 12.9898) * 43758.5453123;
  return s - Math.floor(s);
}

// Icosaèdre déformé le long des normales par vertex : donne une roche
// bosselée/allongée plutôt qu'une sphère parfaite, sans dépendre d'un modèle
// 3D externe. Chaque `seed` produit une forme distincte et stable.
function createRockGeometry(radius: number, seed: number): THREE.BufferGeometry {
  const geometry = new THREE.IcosahedronGeometry(radius, 1);
  const posAttr = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < posAttr.count; i++) {
    v.fromBufferAttribute(posAttr, i);
    const n = hashNoise(v.x, v.y, v.z, seed);
    const bump = 0.65 + n * 0.55; // 0.65-1.2 : creux et bosses marqués
    v.multiplyScalar(bump);
    posAttr.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

// Texture procédurale (bruit + quelques cratères sombres) : aucune photo
// réelle d'astéroïde individuel n'existe pour la quasi-totalité des corps de
// la ceinture, donc ce grain reste une texture plausible générique, jamais
// présentée comme une observation.
function createRockTexture(seed: number): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const base = 100 + seededRandom(seed) * 35;
  const imageData = ctx.createImageData(size, size);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const i = (py * size + px) * 4;
      const n = (hashNoise(px * 0.15, py * 0.15, seed, seed * 3.1) - 0.5) * 70;
      imageData.data[i] = Math.min(255, Math.max(0, base + n));
      imageData.data[i + 1] = Math.min(255, Math.max(0, base * 0.93 + n * 0.9));
      imageData.data[i + 2] = Math.min(255, Math.max(0, base * 0.82 + n * 0.8));
      imageData.data[i + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);

  const craterCount = 5 + Math.floor(seededRandom(seed + 1) * 6);
  for (let c = 0; c < craterCount; c++) {
    const cx = seededRandom(seed + c * 7 + 2) * size;
    const cy = seededRandom(seed + c * 11 + 3) * size;
    const cr = 4 + seededRandom(seed + c * 13 + 4) * 14;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
    gradient.addColorStop(0, "rgba(0,0,0,0.45)");
    gradient.addColorStop(0.7, "rgba(0,0,0,0.2)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

const ROCK_VARIANTS = 6;

// Ceinture d'astéroïdes en cailloux 3D texturés (InstancedMesh) plutôt qu'un
// nuage de points carrés : chaque variante de forme/texture est mutualisée
// entre plusieurs milliers d'instances pour rester peu coûteuse en rendu.
// Nécessite un éclairage (cf. le PointLight ajouté dans system.ts) puisque le
// matériau est un MeshStandardMaterial, contrairement au reste de la scène
// qui utilise des MeshBasicMaterial non éclairés.
export function makeAsteroidBelt(innerAU: number, outerAU: number, orbitScale: number, count: number): THREE.Group {
  const innerRadius = Math.sqrt(innerAU) * orbitScale;
  const outerRadius = Math.sqrt(outerAU) * orbitScale;
  const thickness = 1.4;
  const group = new THREE.Group();
  const perVariant = Math.ceil(count / ROCK_VARIANTS);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  for (let variant = 0; variant < ROCK_VARIANTS; variant++) {
    const geometry = createRockGeometry(0.16, variant * 91 + 7);
    const material = new THREE.MeshStandardMaterial({
      map: createRockTexture(variant * 53 + 11),
      roughness: 0.95,
      metalness: 0.02,
      flatShading: true,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, perVariant);

    for (let i = 0; i < perVariant; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = innerRadius + Math.random() * (outerRadius - innerRadius);
      const y = (Math.random() - 0.5) * thickness;
      dummy.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      // Peu de gros blocs, beaucoup de petits cailloux (distribution en loi de
      // puissance, plus réaliste que des tailles uniformes).
      const scale = 0.25 + Math.pow(Math.random(), 3) * 1.6;
      dummy.scale.setScalar(scale);
      dummy.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const shade = 0.75 + Math.random() * 0.4;
      color.setRGB(0.55 * shade, 0.5 * shade, 0.44 * shade);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
  }

  return group;
}

let softDotTexture: THREE.CanvasTexture | null = null;
function getSoftDotTexture(): THREE.CanvasTexture {
  if (softDotTexture) return softDotTexture;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.4, "rgba(255,255,255,0.45)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  softDotTexture = new THREE.CanvasTexture(canvas);
  return softDotTexture;
}

// Nuage de Kuiper "pelucheux" : la région (bornes en UA) reste la seule
// donnée réelle — chaque point individuel est une position aléatoire, pas un
// objet catalogué réel. On épaissit et on
// utilise un sprite doux + blending additif pour un rendu proche d'un nuage
// de poussière/glace diffus, comme sur les illustrations d'artiste NASA,
// au lieu du nuage de carrés gris plat précédent.
export function makeKuiperCloud(innerAU: number, outerAU: number, orbitScale: number, count: number): THREE.Points {
  const innerRadius = Math.sqrt(innerAU) * orbitScale;
  const outerRadius = Math.sqrt(outerAU) * orbitScale;
  const midRadius = (innerRadius + outerRadius) / 2;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    // Distribution radiale en cloche (moyenne de plusieurs tirages) centrée
    // sur le milieu de la ceinture, avec un débordement doux au-delà des
    // bornes réelles pour un aspect "halo" plutôt qu'un bord net.
    const spread = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    const radius = midRadius + spread * (outerRadius - innerRadius) * 0.75;
    // Épaisseur verticale en cloche également (plus dense au plan médian).
    const thickness = (outerRadius - innerRadius) * 0.4;
    const y = ((Math.random() + Math.random() - 1) / 2) * thickness;

    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.sin(angle) * radius;

    const shade = 0.5 + Math.random() * 0.5;
    color.setRGB(0.48 * shade, 0.56 * shade, 0.62 * shade);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 1.1,
    sizeAttenuation: true,
    map: getSoftDotTexture(),
    transparent: true,
    opacity: 0.55,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}
