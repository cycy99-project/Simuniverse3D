export type AtmosphereSource = "known" | "jwst_spectroscopy" | "no_detection" | "no_data";

export interface StarData {
  name: string;
  spectype: string | null;
  st_teff: number | null;
  st_rad: number | null; // rayons solaires ; 1.0 pour le Soleil
  sy_dist: number | null; // parsecs, 0 pour le Soleil
  ra: number | null; // degrés
  dec: number | null; // degrés
  texture?: string | null; // chemin de la texture réelle (Soleil uniquement) ; absent/null pour les autres étoiles
  // Texte long optionnel affiché repliable sous "En savoir plus" (Soleil
  // uniquement pour l'instant). Même convention que PlanetData.learn_more.
  learn_more?: string;
  learn_more_en?: string;
}

export interface MoonData {
  name: string;
  radius_km: number;
  orbit_km: number; // demi-grand axe autour de la planète
  period_days: number; // période orbitale sidérale ; négative = orbite rétrograde
  color: string;
  texture?: string | null;
  // Inclinaison réelle (degrés) du plan orbital par rapport à l'équateur de
  // la planète (magnitude 0-90 ; le sens rétrograde est déjà porté par le
  // signe de period_days, donc ceci n'encode que l'écart angulaire, pas la
  // direction). Ex. Japet ≈7,57°, Triton ≈23° (écart à 156,9° réels), la
  // plupart des lunes majeures <1-2°.
  inclination_deg?: number;
  // Rapport d'échelle [x,y,z] pour un corps triaxial irrégulier connu (ex.
  // Phobos, Deimos, Néréide) : ces lunes ne sont PAS sphériques (formes
  // réelles mesurées par imagerie ou, pour Néréide, estimation photométrique
  // de basse confiance faute d'imagerie rapprochée — voir commentaire dans
  // ingest.py). absent/undefined = sphère (cas par défaut, correct pour la
  // grande majorité des lunes majeures qui sont bien à l'équilibre hydrostatique).
  shape_ratio?: [number, number, number];
  // Gravité de surface réelle (m/s²) — valeur publiée connue, PAS dérivée
  // (la masse des lunes n'est pas un champ de ce jeu de données). Absente
  // pour Néréide : sa masse n'a jamais été mesurée directement (jamais
  // survolée de près), donc aucune valeur fiable à citer.
  gravity_ms2?: number | null;
  // Multiplicateur de luminosité PUREMENT visuel (pas une donnée physique) :
  // certaines lunes ont un albédo réel très faible (Phobos/Deimos ≈0,07,
  // presque noir charbon) et leur texture authentique devient quasi
  // invisible sur le fond noir du vide spatial en rendu non éclairé
  // (MeshBasicMaterial). absent/undefined = 1 (aucun changement).
  render_brightness_boost?: number;
  // Texte long optionnel affiché repliable sous "En savoir plus". Même
  // convention que PlanetData.learn_more.
  learn_more?: string;
  learn_more_en?: string;
  // Vraie atmosphère épaisse et opaque (pas juste des traces) : cas réel
  // unique dans ce jeu de données = Titan (azote/méthane, brume orange,
  // confirmée par l'atterrisseur Huygens en 2005). absent/undefined = lune
  // sans atmosphère significative (immense majorité des lunes réelles :
  // ciel noir même en plein jour, cf. observations Apollo sur la Lune).
  // Quand vrai, la vue surface (moonSurface.ts) affiche un ciel de brume
  // teinté par `color` au lieu du ciel noir étoilé, et masque la planète
  // dans le ciel (invisible depuis le sol à travers la brume, comme
  // constaté par Huygens : Saturne n'est pas visible depuis la surface).
  has_thick_atmosphere?: boolean;
}

export interface RingData {
  inner_radius_ratio: number; // relatif au rayon de la planète
  outer_radius_ratio: number;
  color: string;
  texture?: string | null;
}

export interface PlanetData {
  name: string;
  pl_orbsmax: number | null; // UA
  pl_rade: number | null; // rayons terrestres
  pl_bmasse: number | null; // masses terrestres
  pl_eqt: number | null; // Kelvin
  discoverymethod?: string | null;
  disc_year?: number | null;
  source: AtmosphereSource;
  molecules: string[];
  color: string | null; // couleur exacte connue (Système Solaire) ; null si dérivée par l'heuristique
  texture: string | null; // chemin de la texture réelle (Système Solaire) ; null si aucune image connue
  rotation_hours: number | null; // période de rotation sidérale réelle (h), signée (négatif = rétrograde) ; null si non mesurée
  moons: MoonData[];
  ring: RingData | null;
  note: string;
  note_en: string;
  // Classification usuelle (pas une taxonomie officielle IAU — les
  // exoplanètes n'en ont pas — mais les catégories informelles standard de la
  // littérature) : classe de taille/masse + classe thermique combinées (ex.
  // "Jupiter chaud", "Super-Terre tempérée"), et éventuellement une catégorie
  // spéciale reconnue (monde hycéen, planète gonflée...) si le corps l'a.
  // absent = pas encore classifié (Système Solaire notamment, où le nom
  // usuel suffit).
  planet_type?: { fr: string; en: string };
  spectrum_ref?: string | null;
  dwarf?: boolean; // planète naine (ex. Pluton, Cérès, Éris) — même structure de données, juste un badge distinct
  // Inclinaison RÉELLE de l'orbite par rapport au plan de l'écliptique (Système
  // Solaire uniquement — Wikipedia/NASA fact sheets). null/absent pour les
  // exoplanètes : la donnée équivalente (mutuelle, par rapport au système)
  // n'est pas mesurée/disponible dans notre pipeline, donc pas de simulation
  // possible sans fabriquer un chiffre — la vue "plans réels" reste coplanaire
  // pour ces systèmes.
  orbit_inclination_deg?: number | null;
  // Nombre RÉEL total de lunes confirmées (ex. Jupiter en a >100), distinct de
  // moons.length qui ne liste que les lunes majeures affichées — sans ce
  // champ le cartouche laisserait croire à tort que moons.length est le
  // total. null/absent pour les exoplanètes (aucune exolune confirmée dans
  // ce jeu de données).
  moons_count_known?: number | null;
  // Références externes ponctuelles (ex. vidéo/reel) ajoutées manuellement au
  // cas par cas pour un corps donné — distinct des liens de recherche
  // génériques NASA/Wikipedia (photoLinksFor) et de spectrum_ref (citation
  // scientifique). absent = aucune référence ponctuelle pour ce corps.
  extra_refs?: { label: string; url: string }[];
  // Texte long optionnel (contexte historique/scientifique détaillé), affiché
  // repliable sous un lien "En savoir plus" — distinct de note/note_en qui
  // reste une courte phrase toujours visible. absent = pas de section
  // dépliable pour ce corps.
  learn_more?: string;
  learn_more_en?: string;
  // Interprétation scientifique calibrée par une recherche dédiée à ce corps
  // précis (couleur, brume, densité de nuages + justification), utilisée à la
  // place de l'heuristique générique (atmosphere/heuristic.ts) quand
  // showScientificInterpretation est actif. Distinct de `color`/`texture`
  // (réservés à une donnée réelle connue, toujours affichée quel que soit ce
  // bouton) : ceci reste désactivable, car ça reste une interprétation et non
  // une observation directe. absent/null = repli sur l'heuristique générique.
  interpretation_override?: {
    skyColor: string;
    hazeColor: string;
    cloudDensity: number;
    description: { fr: string; en: string };
    // Style de rendu procédural (planetTexture.ts) : absent = déduit de
    // cloudDensity (repli générique, inchangé). "cloudy" = amas nuageux
    // organiques teintés par hazeColor (mondes océaniques/nuageux, ex.
    // TRAPPIST-1 d/e) ; "icyCracks" = réseau de fissures linéaires façon
    // banquise (ex. TRAPPIST-1 f) — distinct des bandes horizontales
    // "gasBands" utilisées par défaut pour les géantes gazeuses/mondes très
    // nuageux (ex. HD 189733 b).
    textureStyle?: "rocky" | "cloudy" | "icyCracks" | "gasBands" | "lava";
  } | null;
}

// Étoile compagne d'un système binaire/multiple gravitationnellement lié
// (distincte de l'étoile primaire SystemData.star). Cas réel unique dans ce
// jeu de données : 55 Cancri B, naine rouge M4.5V à ~1065 UA de 55 Cancri A —
// non modélisée comme un objet 3D séparé (échelle incompatible avec les
// orbites planétaires du système, de 0,01 à 5,6 UA) : données textuelles
// uniquement, exposées via learn_more.
export interface CompanionStarData extends StarData {
  separation_au: number; // séparation moyenne connue, UA
  // Estimation par la 3e loi de Kepler (a³/M_total) à partir de la séparation
  // et des masses combinées — PAS une période mesurée (l'orbite, large de
  // plusieurs dizaines de milliers d'années, n'a jamais été observée sur un
  // arc significatif). À traiter comme un ordre de grandeur, pas une donnée
  // précise.
  orbital_period_years_estimate: number;
}

export interface SystemData {
  id: string;
  name: string;
  star: StarData;
  companionStar?: CompanionStarData | null;
  planets: PlanetData[];
}

export interface SeedData {
  systems: SystemData[];
}
