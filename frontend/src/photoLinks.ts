import { englishName } from "./nameTranslations";

export interface PhotoLinks {
  nasaImages: string;
  wikipedia: string;
}

// Liens vers de vraies banques d'images externes (pas de photo hébergée
// localement ici) : le nom anglais donne de bien meilleurs résultats que
// l'accentué français sur ces deux moteurs de recherche.
// - images.nasa.gov/search?q=... est le point d'entrée de recherche public et
//   documenté de la médiathèque officielle NASA.
// - Wikipedia Special:Search est le point d'entrée de recherche natif du
//   site (plus fiable qu'un lien direct vers un titre d'article deviné, qui
//   peut ne pas correspondre exactement, ex. désambiguïsation "Triton (moon)").
export function photoLinksFor(name: string): PhotoLinks {
  const query = encodeURIComponent(englishName(name));
  return {
    nasaImages: `https://images.nasa.gov/search?q=${query}`,
    wikipedia: `https://en.wikipedia.org/wiki/Special:Search?search=${query}`,
  };
}
