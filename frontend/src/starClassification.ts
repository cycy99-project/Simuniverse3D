// Catégorie usuelle d'étoile (ex. "naine jaune" pour le Soleil) dérivée de la
// classification spectrale de Harvard (lettre O/B/A/F/G/K/M) et de la classe
// de luminosité MK (chiffre romain dans spectype, ex. "G2V", "M4.5 V") —
// classification astrophysique standard, pas une catégorie inventée pour ce
// projet. Le Système Solaire sert de calibrage : G2V => "naine jaune",
// cohérent avec le vocabulaire usuel (source : classification de Harvard).
//
// Attention terminologique : "naine blanche" est un terme déjà réservé, en
// français, à un résidu stellaire (étoile A ayant épuisé son carburant, pas
// une étoile A de la séquence principale) — jamais utilisé ici pour une
// étoile de type A "normale", afin d'éviter toute confusion. Les étoiles A de
// la séquence principale sont donc qualifiées d'"étoiles blanches", jamais de
// "naines blanches".
export interface StarCategory {
  fr: string;
  en: string;
}

interface ColorWord {
  fr: string;
  en: string;
}

// Mot de couleur par lettre spectrale (Harvard), combiné à la classe de
// luminosité pour former le libellé final (ex. "naine" + "jaune" pour G V,
// "géante" + "jaune" pour G III).
const COLOR_WORD: Record<string, ColorWord> = {
  O: { fr: "bleue", en: "blue" },
  B: { fr: "bleu-blanc", en: "blue-white" },
  A: { fr: "blanche", en: "white" },
  F: { fr: "jaune-blanc", en: "yellow-white" },
  G: { fr: "jaune", en: "yellow" },
  K: { fr: "orange", en: "orange" },
  M: { fr: "rouge", en: "red" },
};

function letterClass(spectype: string): string | null {
  const match = spectype.trim().toUpperCase().match(/^[OBAFGKM]/);
  return match ? match[0] : null;
}

// Classe de luminosité MK : cherche un chiffre romain isolé (I à VII) après la
// lettre/sous-classe, en ignorant le "V" qui pourrait apparaître ailleurs
// (aucun cas dans ce jeu de données, mais robuste si des géantes/
// supergéantes sont ajoutées plus tard, cf. SYSTEMS_TRACKER.md).
function luminosityClass(spectype: string): string | null {
  const match = spectype.toUpperCase().match(/\b(VII|VI|IV|III|II|I|V)\b/);
  return match ? match[1] : null;
}

/**
 * Détermine la catégorie usuelle d'une étoile à partir de son type spectral.
 * `isSun` force le libellé de calibrage connu (G2V => naine jaune) même si le
 * spectype exact diffère légèrement d'une source à l'autre.
 */
export function classifyStar(spectype: string | null, isSun: boolean): StarCategory {
  if (isSun) {
    return { fr: "Naine jaune (type G)", en: "Yellow dwarf (G-type)" };
  }
  if (!spectype) {
    return { fr: "Type indéterminé", en: "Undetermined type" };
  }

  // Résidu stellaire (naine blanche) : classification "D" (DA, DB...),
  // distincte de la séquence principale — aucun cas dans ce jeu de données
  // actuellement, mais géré pour éviter un futur mauvais libellé.
  if (/^D/.test(spectype.trim().toUpperCase())) {
    return { fr: "Naine blanche (résidu stellaire)", en: "White dwarf (stellar remnant)" };
  }

  const letter = letterClass(spectype);
  if (!letter) {
    return { fr: "Type indéterminé", en: "Undetermined type" };
  }
  const color = COLOR_WORD[letter];
  const lum = luminosityClass(spectype);

  if (lum === "III") {
    return { fr: `Géante ${color.fr} (type ${letter})`, en: `${capitalize(color.en)} giant (${letter}-type)` };
  }
  if (lum === "II") {
    return { fr: `Géante lumineuse ${color.fr} (type ${letter})`, en: `${capitalize(color.en)} bright giant (${letter}-type)` };
  }
  if (lum === "I") {
    return { fr: `Supergéante ${color.fr} (type ${letter})`, en: `${capitalize(color.en)} supergiant (${letter}-type)` };
  }
  if (lum === "IV") {
    return { fr: `Sous-géante ${color.fr} (type ${letter})`, en: `${capitalize(color.en)} subgiant (${letter}-type)` };
  }

  // V (séquence principale) ou classe absente du spectype (cas F4 par ex.) :
  // repli sur la séquence principale, la grande majorité des étoiles connues.
  if (letter === "A") {
    // "Naine blanche" étant déjà pris par le résidu stellaire, on évite tout
    // à fait le mot "naine" pour les étoiles A de la séquence principale.
    return { fr: "Étoile blanche (type A)", en: "White star (A-type)" };
  }
  return {
    fr: `Naine ${color.fr} (type ${letter})`,
    en: `${capitalize(color.en)} dwarf (${letter}-type)`,
  };
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}
