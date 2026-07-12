import { getLang } from "./i18n";

// Les noms de corps célestes viennent de data/seed_systems.json en français
// uniquement (pas de champ name_en, contrairement à note/note_en). Plutôt que
// dupliquer chaque nom dans le JSON, une table de correspondance centralisée
// ici couvre les corps du Système Solaire ; les noms d'exoplanètes/étoiles
// (ex. "K2-18 b", "TRAPPIST-1") sont déjà identiques en français et en
// anglais et retombent donc sur le nom d'origine, inchangé.
const FR_TO_EN: Record<string, string> = {
  "Système Solaire": "Solar System",
  "Soleil": "Sun",
  "Mercure": "Mercury",
  "Vénus": "Venus",
  "Terre": "Earth",
  "Lune": "Moon",
  "Europe": "Europa",
  "Ganymède": "Ganymede",
  "Encelade": "Enceladus",
  "Téthys": "Tethys",
  "Dioné": "Dione",
  "Rhéa": "Rhea",
  "Japet": "Iapetus",
  "Obéron": "Oberon",
  "Néréide": "Nereid",
};

export function localizeName(name: string): string {
  if (getLang() !== "en") return name;
  return FR_TO_EN[name] ?? name;
}
