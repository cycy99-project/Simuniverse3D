import type { PlanetData, SystemData } from "./data/types";
import { DISTANCE_SCALE } from "./scenes/galaxy";

export const AU_KM = 149_597_870.7;
export const LY_KM = 9.4607e12;
const PC_KM = 3.0857e13;
const SECONDS_PER_YEAR = 365.25 * 24 * 3600;

// Voyager 1 : ~62 100 km/h, l'objet fabriqué par l'homme le plus rapide à
// quitter le Système Solaire (source : NASA, 2026). Sert de référence pour
// une estimation "meilleure technologie actuelle", volontairement simple.
const VOYAGER_SPEED_KMS = 17.25;

export interface EarthDistanceInfo {
  distance: { fr: string; en: string };
  travelTime: { fr: string; en: string };
}

function formatYears(years: number): { fr: string; en: string } {
  if (years < 1) {
    const days = years * 365.25;
    return { fr: `${days.toFixed(1)} jours`, en: `${days.toFixed(1)} days` };
  }
  if (years < 1000) {
    return { fr: `${years.toFixed(1)} ans`, en: `${years.toFixed(1)} years` };
  }
  if (years < 1_000_000) {
    const k = years / 1000;
    return { fr: `${k.toFixed(1)} milliers d'années`, en: `${k.toFixed(1)} thousand years` };
  }
  const m = years / 1_000_000;
  return { fr: `${m.toFixed(2)} millions d'années`, en: `${m.toFixed(2)} million years` };
}

// Temps de trajet à la vitesse de Voyager 1 (cf. VOYAGER_SPEED_KMS ci-dessus) —
// même référence "meilleure technologie actuelle" utilisée partout dans
// l'appli (panneau d'info planète, repère de distance de la vue galaxie).
function travelTimeForKm(distanceKm: number): { fr: string; en: string } {
  const years = distanceKm / VOYAGER_SPEED_KMS / SECONDS_PER_YEAR;
  return formatYears(years);
}

// Seuil de bascule UA/années-lumière du repère de distance dynamique de la
// vue galaxie (cf. main.ts::updateDistanceHud) : 1 al ≈ 63 241 UA.
const AU_PER_LY = LY_KM / AU_KM;

// Convertit la distance caméra↔Soleil (unités de scène de la vue galaxie,
// cf. scenes/galaxy.ts::starPosition) en distance réelle affichable + temps
// de trajet équivalent, pour le repère dynamique façon "Solar System Scope"
// demandé par l'utilisateur : UA en dessous d'un seuil, années-lumière
// au-delà — bascule automatique selon le niveau de zoom, comme sur le site
// de référence.
export function computeGalaxyViewDistance(sceneDistance: number): EarthDistanceInfo {
  // Inverse de starPosition : displayDist = sqrt(pc) * DISTANCE_SCALE.
  const pc = (sceneDistance / DISTANCE_SCALE) ** 2;
  const au = (pc * PC_KM) / AU_KM;
  const distanceKm = pc * PC_KM;
  const distance =
    au < AU_PER_LY
      ? { fr: `${au.toFixed(1)} UA`, en: `${au.toFixed(1)} AU` }
      : { fr: `${(au / AU_PER_LY).toFixed(2)} années-lumière`, en: `${(au / AU_PER_LY).toFixed(2)} light-years` };
  return { distance, travelTime: travelTimeForKm(distanceKm) };
}

export function computeEarthDistance(system: SystemData, planet: PlanetData): EarthDistanceInfo {
  const isEarth = system.id === "sol" && planet.name === "Terre";
  if (isEarth) {
    return {
      distance: { fr: "Vous y êtes déjà : c'est la Terre.", en: "You're already there: this is Earth." },
      travelTime: { fr: "—", en: "—" },
    };
  }

  let distanceKm: number;
  let distance: { fr: string; en: string };

  if (system.id === "sol") {
    // Distance à l'approche la plus proche (opposition), en supposant des
    // orbites circulaires et coplanaires — simplification volontaire.
    const planetAU = planet.pl_orbsmax ?? 1;
    const closestAU = Math.abs(planetAU - 1);
    distanceKm = closestAU * AU_KM;
    distance = {
      fr: `≈ ${closestAU.toFixed(2)} UA au plus proche (opposition, orbites circulaires simplifiées)`,
      en: `≈ ${closestAU.toFixed(2)} AU at closest approach (opposition, simplified circular orbits)`,
    };
  } else {
    const distancePc = system.star.sy_dist ?? 0;
    const distanceLy = distancePc * 3.26156;
    distanceKm = distanceLy * LY_KM;
    distance = {
      fr: `≈ ${distanceLy.toFixed(1)} années-lumière (${distancePc.toFixed(1)} pc)`,
      en: `≈ ${distanceLy.toFixed(1)} light-years (${distancePc.toFixed(1)} pc)`,
    };
  }

  return { distance, travelTime: travelTimeForKm(distanceKm) };
}
