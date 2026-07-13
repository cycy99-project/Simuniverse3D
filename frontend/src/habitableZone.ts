// Limites de la zone habitable (UA), méthode Kopparapu et al. 2013/2014
// (ApJ 765:131 ; erratum/extension M-dwarfs). Polynôme Seff(Teff) = Seff_sun +
// a·T + b·T² + c·T³ + d·T⁴ avec T = Teff - 5780 K, calibré pour 2600-7200 K —
// TRAPPIST-1 (2566 K) est légèrement sous la borne basse mais l'extrapolation
// reste raisonnable pour un schéma pédagogique (le polynôme est lisse et
// continu, l'effet du dépassement de 34 K est marginal).
// Bornes "conservative" retenues : Runaway Greenhouse (interne) → Maximum
// Greenhouse (externe), les plus couramment citées comme "la" zone habitable
// (par opposition aux bornes "optimistic" Recent Venus/Early Mars, plus
// larges mais plus spéculatives).
const TSUN = 5780;
const SEFF_SUN = { runaway: 1.107, maxGreenhouse: 0.356 };
const A = { runaway: 1.332e-4, maxGreenhouse: 6.171e-5 };
const B = { runaway: 1.58e-8, maxGreenhouse: 1.698e-9 };
const C = { runaway: -8.308e-12, maxGreenhouse: -3.198e-12 };
const D = { runaway: -1.931e-15, maxGreenhouse: -5.575e-16 };

function seff(limit: "runaway" | "maxGreenhouse", teffK: number): number {
  const t = teffK - TSUN;
  return SEFF_SUN[limit] + A[limit] * t + B[limit] * t * t + C[limit] * t * t * t + D[limit] * t * t * t * t;
}

// Teff nominal IAU du Soleil (5772 K) pour le rapport de luminosité — proche
// mais distinct du 5780 K utilisé comme point de référence interne du
// polynôme Kopparapu (deux constantes différentes de la littérature, ne pas
// les confondre).
const SUN_TEFF_NOMINAL = 5772;

export interface HabitableZone {
  innerAU: number;
  outerAU: number;
}

// null si les données stellaires nécessaires (température, rayon) manquent —
// pas d'approximation fabriquée dans ce cas (ex. étoiles sans st_teff mesuré).
export function computeHabitableZone(teffK: number | null, radiusSolar: number | null): HabitableZone | null {
  if (teffK === null || radiusSolar === null) return null;
  const luminositySolar = radiusSolar * radiusSolar * Math.pow(teffK / SUN_TEFF_NOMINAL, 4);
  const innerAU = Math.sqrt(luminositySolar / seff("runaway", teffK));
  const outerAU = Math.sqrt(luminositySolar / seff("maxGreenhouse", teffK));
  return { innerAU, outerAU };
}
