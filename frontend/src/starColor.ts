// Couleur approximative associée à la classe spectrale (loi de Wien /
// température de couleur) — un fait astrophysique standard (tableau de
// classification de Harvard), pas une simulation propre à un système donné.
export function deriveStarColor(spectype: string | null): string {
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
      return "#ffcc6f";
    default:
      return "#fff2c9"; // repli neutre si type spectral inconnu
  }
}
