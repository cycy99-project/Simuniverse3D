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
  // Illustration officielle NASA de la sonde (impression d'artiste, aucune
  // sonde n'a jamais été photographiée en plein vol) — utilisée en petite
  // icône sous le label dans la vue galaxie, et en grand dans le panneau
  // d'info une fois la sonde cliquée.
  iconTexture: string;
  // Historique réel vérifié (Wikipédia/JPL/NASA), affiché en grand dans le
  // panneau d'info au clic — pas une donnée en temps réel comme la distance/
  // vitesse ci-dessus, mais des faits fixes (dates de lancement, survols,
  // entrée en espace interstellaire).
  history: string;
  history_en: string;
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
  // Photo de Voyager 2 réutilisée ici : celle de Voyager 1 a un contour
  // visible qui ne se fond pas avec le fond de la scène (aucune des deux
  // images n'a de vraie transparence), alors que celle de Voyager 2 s'intègre
  // proprement — même sonde (design quasi identique), donc réutilisable.
  iconTexture: "/textures/voyager2.png",
  history:
    "Lancée le 5 septembre 1977, quelques jours après sa sonde jumelle Voyager 2. Elle a survolé Jupiter en 1979 puis Saturne en 1980, où sa trajectoire a été délibérément déviée pour un survol rapproché de Titan — sacrifiant ainsi toute chance de continuer vers Uranus et Neptune. C'est elle qui a pris en 1990, sur une suggestion de l'astronome Carl Sagan, la célèbre photo de la Terre « Pale Blue Dot » (« point bleu pâle »), depuis plus de 6 milliards de km. Le 25 août 2012, elle est devenue le premier objet construit par l'humain à atteindre l'espace interstellaire. Comme sa jumelle, elle transporte le Voyager Golden Record, un disque phonographique doré contenant des sons et images de la Terre, destiné à d'éventuelles civilisations extraterrestres.",
  history_en:
    "Launched on September 5, 1977, a few days after its twin probe Voyager 2. It flew by Jupiter in 1979 and Saturn in 1980, where its trajectory was deliberately bent for a close flyby of Titan — sacrificing any chance of continuing on to Uranus and Neptune. In 1990, at the suggestion of astronomer Carl Sagan, it took the famous \"Pale Blue Dot\" photo of Earth from over 6 billion km away. On August 25, 2012, it became the first human-made object to reach interstellar space. Like its twin, it carries the Voyager Golden Record, a gold-plated phonograph disc containing sounds and images of Earth, intended for any extraterrestrial civilizations that might find it.",
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
  iconTexture: "/textures/voyager2.png",
  history:
    "Lancée le 20 août 1977, seize jours avant Voyager 1, sur une trajectoire plus lente mais plus riche en survols. Elle demeure à ce jour la seule sonde à avoir survolé les quatre géantes gazeuses : Jupiter (1979), Saturne (1981), Uranus (1986) et Neptune (1989) — ce survol de Neptune reste le seul jamais réalisé de près. Le 5 novembre 2018, six ans après sa jumelle, elle est entrée à son tour dans l'espace interstellaire, mais dans une direction opposée, vers la constellation du Paon. Elle transporte elle aussi un exemplaire du Voyager Golden Record.",
  history_en:
    "Launched on August 20, 1977, sixteen days before Voyager 1, on a slower but flyby-richer trajectory. It remains to this day the only probe to have flown by all four giant planets: Jupiter (1979), Saturn (1981), Uranus (1986), and Neptune (1989) — that Neptune flyby remains the only close visit ever performed. On November 5, 2018, six years after its twin, it also entered interstellar space, but heading in the opposite direction, toward the constellation Pavo (the Peacock). It also carries a copy of the Voyager Golden Record.",
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
