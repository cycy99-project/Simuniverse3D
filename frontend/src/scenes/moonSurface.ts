import * as THREE from "three";
import type { MoonData, PlanetData } from "../data/types";
import { deriveAtmosphere } from "../atmosphere/heuristic";
import { loadTexture } from "../textureCache";
import { makeLabelSprite } from "../labelSprite";
import { localizeName } from "../nameTranslations";

export interface MoonSurfaceResult {
  group: THREE.Group;
  cameraPos: THREE.Vector3;
  cameraTarget: THREE.Vector3;
}

const EARTH_RADIUS_KM = 6371;
// Hauteur d'œil humaine, dans la même unité arbitraire que le reste de la
// scène (pas de rapport avec les mètres réels) : très petite face au sol
// (GROUND_RADIUS) pour donner la sensation d'un humain minuscule sur un
// paysage qui s'étend jusqu'à l'horizon.
const EYE_HEIGHT = 1.7;
const GROUND_RADIUS = 90;
// Distance de mise en scène pour la planète dans le ciel : purement
// arbitraire (pas la vraie distance orbitale en km, irréaliste à cohabiter
// dans le même repère qu'un sol à hauteur humaine). Seul l'ANGLE apparent
// compte pour le réalisme, et il est calculé à partir des vraies données
// (rayon planète / distance orbitale réelle) puis reproduit exactement via
// skyRadius = distance * tan(angle) — la distance de mise en scène choisie
// ici n'affecte donc pas la taille apparente réelle du disque dans le ciel.
const SKY_PRESENTATION_DISTANCE = 500;

function planetSkyMaterial(planet: PlanetData): THREE.Material {
  if (planet.texture) return new THREE.MeshBasicMaterial({ map: loadTexture(planet.texture) });
  if (planet.color) return new THREE.MeshBasicMaterial({ color: planet.color });
  return new THREE.MeshBasicMaterial({ color: "#8a8a8a" });
}

// Couleur utilisée pour teinter le sol la nuit ("clair de planète") : la vraie
// couleur de la planète (connue pour toutes les planètes du Système Solaire,
// seul contexte où ce jeu de données a des lunes) ; repli neutre sinon.
const NEUTRAL_PLANET_TINT = "#8a8a8a";

function planetTintColor(planet: PlanetData, showScientificInterpretation: boolean): THREE.Color {
  if (planet.color) return new THREE.Color(planet.color);
  if (showScientificInterpretation) {
    return new THREE.Color(deriveAtmosphere(planet.molecules, planet.pl_eqt).hazeColor);
  }
  return new THREE.Color(NEUTRAL_PLANET_TINT);
}

// Nuit : le Soleil n'éclaire plus la face où l'on se trouve, mais une géante
// comme Jupiter reste un puissant "clair de planète" pour ses lunes (bien
// plus lumineux qu'un clair de lune terrestre, du fait de sa taille et de son
// albédo) — d'où un sol assombri mais teinté par la vraie couleur de la
// planète plutôt que rendu totalement noir.
const NIGHT_DARKEN = 0.12;
const NIGHT_TINT_MIX = 0.35;

function groundMaterial(moon: MoonData, dayMode: boolean, tint: THREE.Color): THREE.Material {
  const boost = moon.render_brightness_boost ?? 1;
  if (dayMode) {
    if (moon.texture) {
      return new THREE.MeshBasicMaterial({ map: loadTexture(moon.texture), color: new THREE.Color(boost, boost, boost) });
    }
    return new THREE.MeshBasicMaterial({ color: moon.color });
  }
  if (moon.texture) {
    const nightColor = new THREE.Color(boost, boost, boost).multiplyScalar(NIGHT_DARKEN).lerp(tint, NIGHT_TINT_MIX);
    return new THREE.MeshBasicMaterial({ map: loadTexture(moon.texture), color: nightColor });
  }
  const nightColor = new THREE.Color(moon.color).multiplyScalar(NIGHT_DARKEN).lerp(tint, NIGHT_TINT_MIX);
  return new THREE.MeshBasicMaterial({ color: nightColor });
}

// Ciel de brume opaque (Titan uniquement, cf. has_thick_atmosphere) : la vraie
// atmosphère épaisse d'azote/méthane diffuse la lumière et masque totalement
// les étoiles et la planète, comme constaté par la sonde Huygens en 2005 (on
// ne voit jamais Saturne depuis le sol de Titan). Teinte dérivée de la vraie
// couleur de la lune (`color`, déjà la teinte orangée réelle de Titan) ; la
// nuit, la brume reste opaque mais nettement plus sombre.
const HAZE_NIGHT_DARKEN = 0.25;

function makeHazySky(moon: MoonData, dayMode: boolean, radius: number): THREE.Mesh {
  const color = dayMode ? new THREE.Color(moon.color) : new THREE.Color(moon.color).multiplyScalar(HAZE_NIGHT_DARKEN);
  const material = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, fog: false });
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 32), material);
}

// Fond étoilé décoratif (mêmes positions aléatoires que system.ts/galaxy.ts,
// jamais présentées comme les vraies coordonnées célestes vues depuis cette
// lune — aucune donnée de ciel étoilé réel par lune dans ce jeu de données).
function makeStarfield(count: number, radius: number): THREE.Points {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = Math.abs(radius * Math.cos(phi)); // hémisphère haute uniquement (le sol occupe le bas)
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false });
  return new THREE.Points(geometry, material);
}

// Vue imaginée (aucune photo de surface réelle n'existe pour la quasi-totalité
// des lunes) : le sol est schématique, mais la taille angulaire et la couleur
// de la planète dans le ciel sont dérivées des vraies données (rayon réel,
// distance orbitale réelle, texture/couleur réelle déjà utilisée ailleurs
// dans l'app) — pas une image d'artiste inventée au hasard.
export function buildMoonSurfaceScene(
  moon: MoonData,
  planet: PlanetData,
  showScientificInterpretation = true,
  dayMode = true,
): MoonSurfaceResult {
  const group = new THREE.Group();

  // Cas Titan (has_thick_atmosphere) : brume opaque, ni étoiles ni planète
  // visibles depuis le sol (fidèle aux observations réelles de Huygens) —
  // sinon, ciel noir étoilé + disque de la planète à sa vraie taille
  // angulaire, seul cas couvert par les données de ce jeu (lunes sans
  // atmosphère significative).
  let cameraTarget: THREE.Vector3;
  if (moon.has_thick_atmosphere) {
    group.add(makeHazySky(moon, dayMode, 3000));
    cameraTarget = new THREE.Vector3(0, EYE_HEIGHT, -SKY_PRESENTATION_DISTANCE);
  } else {
    group.add(makeStarfield(1500, 3000));

    const planetRadiusKm = (planet.pl_rade ?? 1) * EARTH_RADIUS_KM;
    const angularRadius = Math.atan(planetRadiusKm / moon.orbit_km);
    const skyRadius = SKY_PRESENTATION_DISTANCE * Math.tan(angularRadius);

    const planetGroup = new THREE.Group();
    const planetMesh = new THREE.Mesh(new THREE.SphereGeometry(skyRadius, 64, 64), planetSkyMaterial(planet));
    planetGroup.add(planetMesh);

    if (showScientificInterpretation) {
      const visual = deriveAtmosphere(planet.molecules, planet.pl_eqt);
      if (visual.cloudDensity > 0) {
        planetGroup.add(
          new THREE.Mesh(
            new THREE.SphereGeometry(skyRadius * 1.02, 48, 48),
            new THREE.MeshBasicMaterial({ color: visual.hazeColor, transparent: true, opacity: visual.cloudDensity * 0.5 }),
          ),
        );
      }
    }

    planetGroup.position.set(0, skyRadius * 0.7, -SKY_PRESENTATION_DISTANCE);
    group.add(planetGroup);

    const labelScale = Math.max(skyRadius * 0.5, 6);
    const label = makeLabelSprite(localizeName(planet.name));
    label.scale.set(labelScale, labelScale * 0.25, 1);
    label.position.copy(planetGroup.position).add(new THREE.Vector3(0, skyRadius + labelScale * 0.4, 0));
    group.add(label);

    cameraTarget = planetGroup.position.clone();
  }

  // Sol schématique (pas de relevé topographique réel disponible) : seule la
  // couleur/texture globale de la lune (déjà réelle, réutilisée depuis
  // moons.ts/moonFocus.ts) rend compte de son vrai aspect général. La nuit,
  // elle est assombrie et teintée par la vraie couleur de la planète (clair
  // de planète, cf. groundMaterial).
  const tint = planetTintColor(planet, showScientificInterpretation);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(GROUND_RADIUS, 48), groundMaterial(moon, dayMode, tint));
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  return {
    group,
    cameraPos: new THREE.Vector3(0, EYE_HEIGHT, 0),
    cameraTarget,
  };
}
