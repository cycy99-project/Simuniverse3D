function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

// Points d'ancrage température (K) -> couleur : l'ORDRE suit la vraie loi de
// Wien (froid = rouge, chaud = bleu, cf. classification de Harvard), mais
// l'intensité est volontairement exagérée par rapport à un rendu corps noir
// strict — un calcul physique pur (approximation de Tanner Helland) donne par
// ex. ~#ffa24c pour TRAPPIST-1 (M8V, 2566 K), un orange pâle visuellement trop
// proche du jaune-or artistique du Soleil (#ffd97a) pour se lire comme une
// naine rouge au premier coup d'oeil. Même logique de stylisation pédagogique
// que la compression d'échelle des orbites/rotations ailleurs dans l'app :
// l'ordre physique est respecté, le contraste est accentué pour la lisibilité.
const TEMP_COLOR_STOPS: Array<[number, string]> = [
  [2300, "#ff3300"], // naines M tardives (TRAPPIST-1 : 2566 K)
  [3200, "#ff6a00"],
  [3900, "#ffae42"], // limite K/M
  [5300, "#fff4ea"], // proche du Soleil (G)
  [6000, "#ffffff"],
  [7500, "#cad7ff"], // A
  [10000, "#aabfff"], // B
  [30000, "#9bb0ff"], // O
];

function temperatureColor(kelvin: number): string {
  const stops = TEMP_COLOR_STOPS;
  if (kelvin <= stops[0][0]) return stops[0][1];
  if (kelvin >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [k0, c0] = stops[i];
    const [k1, c1] = stops[i + 1];
    if (kelvin >= k0 && kelvin <= k1) {
      const t = (kelvin - k0) / (k1 - k0);
      const [r0, g0, b0] = hexToRgb(c0);
      const [r1, g1, b1] = hexToRgb(c1);
      return toHex(clamp255(lerp(r0, r1, t)), clamp255(lerp(g0, g1, t)), clamp255(lerp(b0, b1, t)));
    }
  }
  return stops[stops.length - 1][1];
}

// Repli par classe spectrale (lettre) quand la température mesurée est
// indisponible — tableau de classification de Harvard, fait astrophysique
// standard, pas une simulation propre à un système donné.
function colorFromSpectralClass(spectype: string | null): string {
  const cls = spectype?.trim()[0]?.toUpperCase();
  switch (cls) {
    case "O":
      return "#9bb0ff";
    case "B":
      return "#aabfff";
    case "A":
      return "#cad7ff";
    case "F":
      return "#f8f7ff";
    case "G":
      return "#fff4ea";
    case "K":
      return "#ffd2a1";
    case "M":
      return "#ff6a00";
    default:
      return "#fff2c9"; // repli neutre si type spectral inconnu
  }
}

// Couleur approximative de l'étoile : privilégie la vraie température mesurée
// (st_teff, plus précise et continue) quand disponible, sinon retombe sur la
// classe spectrale (lettre seule, plus grossière).
export function deriveStarColor(spectype: string | null, teffK?: number | null): string {
  if (teffK !== null && teffK !== undefined && teffK > 0) {
    return temperatureColor(teffK);
  }
  return colorFromSpectralClass(spectype);
}
