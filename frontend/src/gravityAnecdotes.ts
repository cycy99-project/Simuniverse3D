export interface Anecdote {
  fr: string;
  en: string;
}

// Anecdotes ludiques liées à la gravité de surface réelle de chaque corps —
// écrites pour le Mode Élève (cf. main.ts). Non exhaustif : seuls les corps
// où la gravité produit un effet marquant/amusant ont une entrée dédiée ;
// les autres retombent sur un repli générique calculé (voir gravityAnecdoteHtml
// dans main.ts).
const ANECDOTES: Record<string, Anecdote> = {
  Lune: {
    fr: "Sur la Lune, tu sauterais presque 6 fois plus haut que sur Terre ! Les astronautes d'Apollo bondissaient comme des kangourous.",
    en: "On the Moon, you'd jump almost 6 times higher than on Earth! Apollo astronauts bounced around like kangaroos.",
  },
  Mercure: {
    fr: "Mercure est minuscule, mais sa gravité ressemble presque à celle de Mars — tu ne t'y sentirais pas si léger que ça !",
    en: "Mercury is tiny, but its gravity is almost like Mars's — you wouldn't feel that light there!",
  },
  Vénus: {
    fr: "Sur Vénus, tu pèserais presque le même poids que sur Terre — mais la chaleur et la pression t'écraseraient bien avant la gravité !",
    en: "On Venus you'd weigh almost the same as on Earth — but the heat and pressure would crush you long before gravity did!",
  },
  Mars: {
    fr: "Sur Mars, un enfant de 30 kg n'en pèserait que 11 ! De quoi soulever facilement ses copains.",
    en: "On Mars, a 30 kg kid would only weigh 11 kg! Easy to lift up your friends there.",
  },
  Jupiter: {
    fr: "Jupiter est un géant : sa gravité est 2,5 fois celle de la Terre. Impossible d'y sauter — et de toute façon, il n'y a pas de sol solide pour atterrir !",
    en: "Jupiter is a giant: its gravity is 2.5 times Earth's. Jumping there would be impossible — and there's no solid ground to land on anyway!",
  },
  Saturne: {
    fr: "Saturne est énorme mais si peu dense qu'elle flotterait sur l'eau — pourtant sa gravité de surface ressemble beaucoup à celle de la Terre.",
    en: "Saturn is huge but so light it would float on water — yet its surface gravity is surprisingly close to Earth's.",
  },
  Uranus: {
    fr: "Sur Uranus, la gravité est un peu plus faible que sur Terre, malgré une planète bien plus grosse : elle est surtout faite de gaz léger.",
    en: "On Uranus, gravity is slightly weaker than Earth's despite the planet being much bigger — it's mostly made of light gas.",
  },
  Neptune: {
    fr: "Neptune a une gravité très proche de celle de la Terre, alors qu'elle est 4 fois plus large ! La masse compte autant que la taille.",
    en: "Neptune's gravity is very close to Earth's, even though it's 4 times wider! Mass matters as much as size.",
  },
  Pluton: {
    fr: "Sur Pluton, tu pèserais moins de 7 kg pour 100 kg sur Terre — tu pourrais presque voler d'un bond !",
    en: "On Pluto, you'd weigh less than 7 kg for every 100 kg on Earth — you could almost fly with a single jump!",
  },
  Europe: {
    fr: "Sous la glace d'Europe se cache un océan géant : avec une gravité si faible, les vagues y seraient étrangement lentes.",
    en: "Under Europa's ice hides a giant ocean — with such weak gravity, waves there would move strangely slowly.",
  },
  Io: {
    fr: "Io a des volcans géants, mais sa faible gravité fait que leurs jets de lave et de gaz montent à des centaines de kilomètres de haut !",
    en: "Io has giant volcanoes, but its weak gravity lets their lava and gas plumes shoot hundreds of kilometers high!",
  },
  Titan: {
    fr: "Sur Titan, la gravité est si faible et l'air si épais qu'un humain pourrait voler en battant simplement des bras munis d'ailes !",
    en: "On Titan, gravity is so weak and the air so thick that a human could fly just by flapping wing-like arms!",
  },
  Triton: {
    fr: "Triton tourne à l'envers autour de Neptune, et sa gravité est presque aussi faible que celle de la Lune — un monde de glace toute légère.",
    en: "Triton orbits Neptune backwards, and its gravity is almost as weak as the Moon's — a true world of light ice.",
  },
  Phobos: {
    fr: "Sur Phobos, la gravité est si faible qu'un saut un peu trop fort pourrait presque t'envoyer flotter dans l'espace !",
    en: "On Phobos, gravity is so weak that jumping a bit too hard could almost send you floating off into space!",
  },
};

export function gravityAnecdote(name: string): Anecdote | null {
  return ANECDOTES[name] ?? null;
}
