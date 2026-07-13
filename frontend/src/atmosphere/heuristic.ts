export interface AtmosphereVisual {
  skyColor: string;
  hazeColor: string;
  cloudDensity: number; // 0..1
  description: { fr: string; en: string };
}

const has = (molecules: string[], m: string) => molecules.includes(m);

/**
 * Traduit une liste de molécules détectées + une température d'équilibre en
 * un rendu visuel plausible. Règles heuristiques simples, pas de ML — voir
 * SPECS.md pour le rationnel. Calibrée sur le Système Solaire (vérité
 * connue) avant d'être appliquée aux exoplanètes.
 */
export function deriveAtmosphere(
  molecules: string[],
  eqTempK: number | null,
): AtmosphereVisual {
  const temp = eqTempK ?? 288;

  if (molecules.length === 0) {
    // Corps sans atmosphère détectée : couleur dérivée de la température
    // d'équilibre (proxy du type de surface probable), pas un gris quasi
    // noir uniforme — l'albédo réel des corps rocheux airless connus (Lune
    // ~0,14, Mercure ~0,09) reste gris moyen, jamais proche du noir, et un
    // rendu trop sombre rendait la planète quasi invisible en vue système.
    if (temp >= 500) {
      return {
        skyColor: "#4a4038",
        hazeColor: "#5a4f45",
        cloudDensity: 0,
        description: {
          fr: "Aucune molécule détectée, température extrême : rocher nu probablement assombri par l'irradiation (analogie Mercure côté jour).",
          en: "No molecules detected, extreme temperature: bare rock likely darkened by irradiation (Mercury dayside analogy).",
        },
      };
    }
    if (temp <= 220) {
      return {
        skyColor: "#9aa5ad",
        hazeColor: "#aab4bb",
        cloudDensity: 0,
        description: {
          fr: "Aucune molécule détectée, température basse : rocher nu, surface possiblement givrée (analogie corps glacés airless).",
          en: "No molecules detected, low temperature: bare rock, surface possibly frosted (icy airless body analogy).",
        },
      };
    }
    return {
      skyColor: "#7d7568",
      hazeColor: "#8d8577",
      cloudDensity: 0,
      description: {
        fr: "Aucune molécule détectée, température tempérée : rocher nu (analogie Lune/Mercure).",
        en: "No molecules detected, temperate: bare rock (Moon/Mercury analogy).",
      },
    };
  }

  const hasCO2 = has(molecules, "CO2");
  const hasSO2 = has(molecules, "SO2");
  const hasH2O = has(molecules, "H2O");
  const hasN2 = has(molecules, "N2");
  const hasO2 = has(molecules, "O2");
  const hasH2He = has(molecules, "H2") && has(molecules, "He");
  const hasCH4 = has(molecules, "CH4");

  // Terre : N2/O2 dominant + vapeur d'eau -> ciel bleu, nuages modérés.
  if (hasN2 && hasO2) {
    return {
      skyColor: "#6fa8dc",
      hazeColor: "#ffffff",
      cloudDensity: 0.4,
      description: {
        fr: "N2/O2 dominant + H2O : ciel bleu, nuages d'eau modérés (référence Terre).",
        en: "N2/O2 dominant + H2O: blue sky, moderate water clouds (Earth reference case).",
      },
    };
  }

  // Vénus : CO2 dense + SO2 + température extrême -> nuages opaques d'acide sulfurique.
  if (hasCO2 && hasSO2 && temp > 600) {
    return {
      skyColor: "#e8d9a0",
      hazeColor: "#f5ecc9",
      cloudDensity: 0.95,
      description: {
        fr: "CO2 dense + SO2 + température extrême : nuages opaques (analogie Vénus, acide sulfurique).",
        en: "Dense CO2 + SO2 + extreme temperature: opaque clouds (Venus analogy, sulfuric acid).",
      },
    };
  }

  // Mars : CO2 seul, température modérée à froide -> atmosphère fine, peu de nuages.
  if (hasCO2 && !hasSO2 && temp < 320) {
    return {
      skyColor: "#c1440e",
      hazeColor: "#e0a080",
      cloudDensity: 0.15,
      description: {
        fr: "CO2 fin sans photochimie marquée : atmosphère ténue (analogie Mars).",
        en: "Thin CO2 with no marked photochemistry: tenuous atmosphere (Mars analogy).",
      },
    };
  }

  // Chaud + SO2 : photochimie active -> brume orangée (ex. WASP-39 b).
  if (hasSO2 && temp >= 320) {
    return {
      skyColor: "#d98844",
      hazeColor: "#f2b878",
      cloudDensity: 0.6,
      description: {
        fr: "SO2 détecté à haute température : signature de photochimie active, brume orangée.",
        en: "SO2 detected at high temperature: sign of active photochemistry, orange haze.",
      },
    };
  }

  // Géante gazeuse : H2/He + CH4. En dessous de ~110K (Uranus/Neptune),
  // la coloration bleu-vert du méthane domine ; au-dessus (Jupiter/Saturne),
  // les nuages d'ammoniac donnent une teinte tan/orangée.
  if (hasH2He && hasCH4) {
    if (temp < 110) {
      return {
        skyColor: "#4fd0c5",
        hazeColor: "#a0f0e5",
        cloudDensity: 0.5,
        description: {
          fr: "H2/He + CH4, très froid : teinte bleu-vert (analogie Uranus/Neptune).",
          en: "H2/He + CH4, very cold: blue-green tint (Uranus/Neptune analogy).",
        },
      };
    }
    return {
      skyColor: "#d8b877",
      hazeColor: "#f0dcae",
      cloudDensity: 0.7,
      description: {
        fr: "H2/He + CH4, température modérée : bandes tan/orangées (analogie Jupiter/Saturne).",
        en: "H2/He + CH4, moderate temperature: tan/orange bands (Jupiter/Saturn analogy).",
      },
    };
  }

  // Candidate "hycéenne" : CH4 + CO2 sans photochimie marquée, température tempérée.
  if (hasCH4 && hasCO2 && !hasSO2 && temp >= 150 && temp <= 350) {
    return {
      skyColor: "#2f6f8f",
      hazeColor: "#5fb0c9",
      cloudDensity: 0.5,
      description: {
        fr: "CH4/CO2 sans photochimie marquée, température tempérée : hypothèse 'hycéenne' (océan sous atmosphère riche en H2).",
        en: "CH4/CO2 with no marked photochemistry, temperate: 'hycean' hypothesis (ocean under a H2-rich atmosphere).",
      },
    };
  }

  // Combinaison non couverte par une règle spécifique.
  return {
    skyColor: hasH2O ? "#7fa8c9" : "#8a8a8a",
    hazeColor: "#c9c9c9",
    cloudDensity: 0.3,
    description: {
      fr: "Molécules détectées, combinaison non couverte par une règle spécifique : rendu générique.",
      en: "Molecules detected, combination not covered by a specific rule: generic rendering.",
    },
  };
}
