import * as THREE from "three";
import type { SeedData, SystemData } from "../data/types";
import { VOYAGER_1, VOYAGER_2, voyagerPosition, type VoyagerInfo } from "../voyager";
import { localizeName } from "../nameTranslations";
import { loadTexture, loadChromaKeyedTexture } from "../textureCache";
import { deriveStarColor } from "../starColor";

// Distance fixe, arbitraire et volontairement courte : à cette échelle (pc),
// la distance réelle des sondes (quelques centaines d'UA) serait totalement
// invisible collée au Soleil. Seule la DIRECTION (vraie latitude écliptique +
// azimut schématique, cf. voyager.ts) a un sens ici, pas une position à
// l'échelle — d'où un simple décalage court, sans flèche pour la matérialiser
// (jugée trop envahissante à l'écran).
const VOYAGER_OFFSET = 3.2;

// Compression racine carrée des distances (en parsecs) pour garder tous les
// systèmes visibles dans une même vue malgré l'écart réel (12 à 214 pc) —
// ce n'est pas une échelle linéaire fidèle, juste un choix de lisibilité.
// Exportée pour que distance.ts puisse convertir en sens inverse une distance
// caméra (unités de scène) vers une distance réelle, pour le repère de
// distance dynamique de la vue galaxie (cf. main.ts::updateDistanceHud).
export const DISTANCE_SCALE = 20;

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

// fontSize/scale ajustables : les labels des sondes Voyager doivent rester
// visuellement subordonnés au nom du système (hiérarchie de lecture), pas
// juste plus loin sur l'écran.
// Supersampling x4 (canvas plus grand que la taille d'affichage réelle) pour
// un texte net : à basse résolution, l'agrandissement du sprite en unités
// scène pixelise/floute la police.
const LABEL_SUPERSAMPLE = 4;

function makeLabelSprite(text: string, fontSize = 28, scale: [number, number] = [12, 3]): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256 * LABEL_SUPERSAMPLE;
  canvas.height = 64 * LABEL_SUPERSAMPLE;
  const ctx = canvas.getContext("2d")!;
  ctx.font = `700 ${fontSize * LABEL_SUPERSAMPLE}px "Orbitron", "Segoe UI", system-ui, sans-serif`;
  ctx.fillStyle = "#e6e6e6";
  ctx.textAlign = "center";
  ctx.fillText(text, canvas.width / 2, 40 * LABEL_SUPERSAMPLE);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  const material = new THREE.SpriteMaterial({ map: texture, depthWrite: false, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scale[0], scale[1], 1);
  return sprite;
}

// Point de lumière circulaire (dégradé radial doux) utilisé pour les étoiles
// autres que le Soleil : un sprite est TOUJOURS face caméra, donc toujours
// parfaitement rond à l'écran, contrairement à une sphère 3D qui s'étire en
// ellipse près des bords du champ de vision sous perspective grand-angle
// (60°, cf. main.ts) — effet réel de la projection perspective, pas un bug de
// géométrie. Bonus : à ces distances, une étoile est un point de lumière non
// résolu, pas un disque visible — le sprite est donc aussi plus juste que la
// sphère qu'il remplace.
let starDotTexture: THREE.Texture | null = null;
function getStarDotTexture(): THREE.Texture {
  if (starDotTexture) return starDotTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.5, "rgba(255,255,255,0.9)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  starDotTexture = new THREE.CanvasTexture(canvas);
  return starDotTexture;
}

function makeStarDot(color: string, size: number): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: getStarDotTexture(),
    color,
    depthWrite: false,
    transparent: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size * 2.2, size * 2.2, 1);
  return sprite;
}

// Plan de quadrillage horizontal (repère de profondeur, cf. capture du site
// concurrent Solar System Scope) posé sur le plan équatorial (y=0 — c'est
// aussi le plan de référence des coordonnées RA/Dec utilisées par
// starPosition, donc un repère cohérent, pas arbitraire). Généré comme les
// autres textures du projet : canvas 2D procédural (grille + fondu radial
// vers les bords façon horizon), jamais une image téléchargée.
let groundGridTexture: THREE.Texture | null = null;
function getGroundGridTexture(): THREE.Texture {
  if (groundGridTexture) return groundGridTexture;
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cell = 32;
  ctx.strokeStyle = "rgba(143, 180, 255, 0.55)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= size; i += cell) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }
  // "destination-in" multiplie l'alpha déjà dessiné (le quadrillage) par ce
  // dégradé radial, au lieu de le dessiner par-dessus : la grille s'estompe
  // vers les bords sans halo ajouté.
  ctx.globalCompositeOperation = "destination-in";
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.6, "rgba(255,255,255,0.7)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  groundGridTexture = new THREE.CanvasTexture(canvas);
  return groundGridTexture;
}

const GROUND_GRID_RADIUS = 400;

function makeGroundGrid(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(GROUND_GRID_RADIUS * 2, GROUND_GRID_RADIUS * 2);
  const material = new THREE.MeshBasicMaterial({
    map: getGroundGridTexture(),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

// Révélation progressive au dézoom (adaptation de l'idée du site concurrent
// Solar System Scope, cf. discussion utilisateur : on garde notre navigation
// discrète par états — pas de zoom continu unique jusqu'aux systèmes lointains
// — mais, À L'INTÉRIEUR de cette vue galaxie, un système apparaît en fondu
// quand la caméra s'éloigne suffisamment de l'origine (le Soleil). Le seuil
// est une fraction de la distance d'affichage propre du système
// (starPosition) : les systèmes proches se révèlent donc à un dézoom moindre
// que les systèmes lointains, exactement l'effet recherché. Prêt à s'étendre
// naturellement quand d'autres systèmes, potentiellement bien plus éloignés,
// seront ajoutés (cf. roadmap pré-CDM).
const REVEAL_START_FRACTION = 0.35;
const REVEAL_END_FRACTION = 0.65;

export interface RevealableSystem {
  systemId: string;
  materials: (THREE.SpriteMaterial | THREE.MeshBasicMaterial)[];
  thresholdStart: number;
  thresholdEnd: number;
}

export interface SunLine {
  systemId: string;
  line: THREE.Line;
  material: THREE.LineBasicMaterial;
  thresholdStart: number;
  thresholdEnd: number;
}

export interface GalaxySceneResult {
  group: THREE.Group;
  clickable: Map<THREE.Object3D, string>;
  cameraPos: THREE.Vector3;
  revealables: RevealableSystem[];
  sunLines: SunLine[];
}

function revealFraction(cameraDistance: number, thresholdStart: number, thresholdEnd: number): number {
  const t = (cameraDistance - thresholdStart) / (thresholdEnd - thresholdStart);
  return THREE.MathUtils.clamp(t, 0, 1);
}

// Applique l'opacité de fondu (0 = invisible, 1 = pleinement visible) selon la
// distance caméra↔origine courante, et épaissit/éclaircit le trait Soleil→
// système correspondant à la cible de sélection en attente (losange + encart
// "Explorer" — mécanisme déjà existant, cf. main.ts::pendingSelection) — le
// tout appelé à chaque frame depuis main.ts pendant que la vue galaxie est
// active.
export function applyGalaxyReveal(
  revealables: RevealableSystem[],
  sunLines: SunLine[],
  cameraDistance: number,
  selectedSystemId: string | null,
): void {
  for (const r of revealables) {
    const opacity = revealFraction(cameraDistance, r.thresholdStart, r.thresholdEnd);
    for (const material of r.materials) material.opacity = opacity;
  }
  for (const { systemId, material, thresholdStart, thresholdEnd } of sunLines) {
    const reveal = revealFraction(cameraDistance, thresholdStart, thresholdEnd);
    const selected = systemId === selectedSystemId;
    material.opacity = reveal * (selected ? 0.9 : 0.25);
    material.color.set(selected ? 0xd8e8ff : 0x8fb4ff);
  }
}

export function buildGalaxyScene(seed: SeedData): GalaxySceneResult {
  const group = new THREE.Group();
  const clickable = new Map<THREE.Object3D, string>();
  const revealables: RevealableSystem[] = [];
  const sunLines: SunLine[] = [];

  group.add(makeStarfield(3000, 1500));
  group.add(makeGroundGrid());

  for (const system of seed.systems) {
    const pos = starPosition(system);
    const isSun = system.id === "sol";
    // Couleur réelle dérivée du type spectral (même helper que system.ts/star.ts,
    // ex. naine rouge M8V de TRAPPIST-1 → orangé, pas un bleu générique).
    const color = isSun ? "#ffd97a" : deriveStarColor(system.star.spectype, system.star.st_teff);
    const size = isSun ? 1.2 : 0.8;

    // Notre Soleil a une texture réelle connue (cf. system.ts) : on l'utilise
    // aussi dans la vue galaxie plutôt qu'un point de couleur générique,
    // seul cas où cette donnée existe parmi les étoiles du jeu de données —
    // et une vraie sphère 3D reste adaptée ici (proche du centre de vue,
    // texture riche). Les autres étoiles sont des sprites circulaires (cf.
    // makeStarDot) pour rester rondes quelle que soit leur position à l'écran.
    const mesh =
      isSun && system.star.texture
        ? new THREE.Mesh(new THREE.SphereGeometry(size, 16, 16), new THREE.MeshBasicMaterial({ map: loadTexture(system.star.texture) }))
        : makeStarDot(color, size);
    mesh.position.copy(pos);
    group.add(mesh);
    clickable.set(mesh, system.id);

    const label = makeLabelSprite(localizeName(system.name));
    label.position.copy(pos).add(new THREE.Vector3(0, size + 2, 0));
    group.add(label);

    if (!isSun) {
      const displayDist = pos.length();
      const dotMaterial = mesh.material as THREE.SpriteMaterial;
      const labelMaterial = label.material as THREE.SpriteMaterial;
      dotMaterial.opacity = 0;
      labelMaterial.opacity = 0;
      revealables.push({
        systemId: system.id,
        materials: [dotMaterial, labelMaterial],
        thresholdStart: displayDist * REVEAL_START_FRACTION,
        thresholdEnd: displayDist * REVEAL_END_FRACTION,
      });

      // Trait en équerre reliant le Soleil à ce système (adapté de l'idée du
      // site concurrent, cf. capture de référence) : un segment horizontal le
      // long du quadrillage (jusqu'à l'aplomb du système) puis un segment
      // vertical qui rejoint sa position réelle au-dessus/en-dessous du plan
      // — plutôt qu'un trait direct dans l'espace — pour matérialiser
      // visuellement son écart au plan de référence (utile aussi lisiblement
      // à mesure que d'autres systèmes, potentiellement bien plus excentrés,
      // seront ajoutés). S'épaissit/s'éclaircit quand ce système est la cible
      // de la sélection en attente (cf. main.ts::pendingSelection).
      const groundShadow = new THREE.Vector3(pos.x, 0, pos.z);
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), groundShadow, pos]);
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0x8fb4ff, transparent: true, opacity: 0 });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      group.add(line);
      sunLines.push({
        systemId: system.id,
        line,
        material: lineMaterial,
        thresholdStart: displayDist * REVEAL_START_FRACTION,
        thresholdEnd: displayDist * REVEAL_END_FRACTION,
      });
    }

    if (isSun) {
      for (const v of [VOYAGER_1, VOYAGER_2] as VoyagerInfo[]) {
        const dir = voyagerPosition(v, 1).normalize();

        const label2 = makeLabelSprite(v.name, 13, [4.4, 1.1]);
        label2.position.copy(pos).addScaledVector(dir, VOYAGER_OFFSET);
        group.add(label2);
        clickable.set(label2, v.id);

        // Petite icône (illustration officielle NASA, cf. voyager.ts) sous
        // le nom de la sonde.
        const icon = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: loadChromaKeyedTexture(v.iconTexture), depthWrite: false, transparent: true }),
        );
        icon.scale.set(2, 1.5, 1);
        icon.position.copy(label2.position).add(new THREE.Vector3(0, -1.2, 0));
        group.add(icon);
        clickable.set(icon, v.id);
      }
    }
  }

  // Cadrage initial resserré sur le Système Solaire (origine de la scène,
  // cf. starPosition qui renvoie (0,0,0) pour le Soleil) plutôt que la vue
  // large de toute la carte — cf. capture de référence où le Soleil occupe
  // une bonne partie du cadre avec les systèmes voisins visibles en arrière-
  // plan. L'utilisateur peut toujours dézoomer via OrbitControls.
  return { group, clickable, cameraPos: new THREE.Vector3(0, 6, 18), revealables, sunLines };
}
