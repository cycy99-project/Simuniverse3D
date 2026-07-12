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
}

export interface SystemData {
  id: string;
  name: string;
  star: StarData;
  planets: PlanetData[];
}

export interface SeedData {
  systems: SystemData[];
}
