import * as THREE from "three";

// Données réelles vérifiées (sourcées sur Wikipédia/JPL) : distance héliocentrique
// à une date de référence connue + vitesse de récession héliocentrique réelle et
// quasi constante (les sondes ne sont plus freinées significativement par la
// gravité solaire à cette distance). La distance affichée est extrapolée en
// continu depuis ce point de référence à partir de l'heure système — ce n'est
// pas une simulation arbitraire : seule l'interpolation entre deux mesures
// réelles est calculée, la position de référence et la vitesse sont réelles.
export interface VoyagerInfo {
  id: string;
  name: string;
  refDistanceAU: number;
  refDate: string; // ISO, date de la mesure de référence
  speedAUPerYear: number;
  speedKmS: number;
  color: number;
  // Azimut schématique (pas la vraie ascension droite) utilisé uniquement pour
  // répartir les deux sondes de façon lisible à l'écran — mais l'élévation
  // (voir elevationDeg) est, elle, une donnée réelle vérifiée.
  angleDeg: number;
  // Latitude écliptique RÉELLE (Wikipédia) : Voyager 1 s'éloigne à ~35° au-dessus
  // du plan de l'écliptique (vers la constellation d'Ophiuchus) ; Voyager 2
  // à ~48° en dessous (vers Sagittaire/Paon). Les deux sondes ne sont donc pas
  // du tout dans le même plan — sans cette inclinaison, les deux marqueurs
  // finissaient à des angles exactement opposés (200°/20°) et paraissaient
  // alignés sur une seule et même ligne traversant le Soleil.
  elevationDeg: number;
  constellation: string;
}

export const VOYAGER_1: VoyagerInfo = {
  id: "__voyager1__",
  name: "Voyager 1",
  refDistanceAU: 172.59,
  refDate: "2026-03-01",
  speedAUPerYear: 3.57,
  speedKmS: 16.9,
  color: 0xe6d29b,
  angleDeg: 200,
  elevationDeg: 34.9,
  constellation: "Ophiuchus",
};

export const VOYAGER_2: VoyagerInfo = {
  id: "__voyager2__",
  name: "Voyager 2",
  refDistanceAU: 143.05,
  refDate: "2026-02-01",
  speedAUPerYear: 3.235,
  speedKmS: 15.341,
  color: 0x9bc1d6,
  angleDeg: 165,
  elevationDeg: -48,
  constellation: "Pavo",
};

// Position 3D dérivée de l'azimut schématique + de la vraie latitude
// écliptique — factorisée ici pour que la vue système (position exacte à
// l'échelle) et la vue galaxie (flèche directionnelle non à l'échelle,
// rayon = 1) utilisent la même direction réelle.
export function voyagerPosition(v: VoyagerInfo, radius: number): THREE.Vector3 {
  const angle = (v.angleDeg * Math.PI) / 180;
  const elevation = (v.elevationDeg * Math.PI) / 180;
  const horizontal = radius * Math.cos(elevation);
  return new THREE.Vector3(Math.cos(angle) * horizontal, radius * Math.sin(elevation), Math.sin(angle) * horizontal);
}

const AU_IN_KM = 149_597_870.7;
const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

export function currentDistanceAU(v: VoyagerInfo, now: Date = new Date()): number {
  const elapsedYears = (now.getTime() - new Date(v.refDate).getTime()) / MS_PER_YEAR;
  return v.refDistanceAU + v.speedAUPerYear * elapsedYears;
}

export function currentDistanceKm(v: VoyagerInfo, now: Date = new Date()): number {
  return currentDistanceAU(v, now) * AU_IN_KM;
}
