// Petite frise chronologique d'événements marquants, utilisée pour
// l'anecdote "si on observait la Terre depuis cette exoplanète aujourd'hui,
// avec le délai lumière (= distance en années-lumière), quel événement de
// l'humanité serait théoriquement visible ?" (demandé par Cyril le
// 2026-07-21, cf. SPECS.md backlog). Volontairement une courte liste
// éditorialisée (pas une base de données exhaustive) : on cherche l'événement
// le plus proche de l'année cible, pas une couverture historique complète.
export interface HistoricalEvent {
  year: number; // négatif = avant J.-C.
  fr: string;
  en: string;
}

export const HISTORICAL_EVENTS: HistoricalEvent[] = [
  { year: -480, fr: "Bataille de Salamine", en: "Battle of Salamis" },
  { year: -44, fr: "Assassinat de Jules César", en: "Assassination of Julius Caesar" },
  { year: 79, fr: "Éruption du Vésuve, destruction de Pompéi", en: "Eruption of Vesuvius destroys Pompeii" },
  { year: 476, fr: "Chute de l'Empire romain d'Occident", en: "Fall of the Western Roman Empire" },
  { year: 800, fr: "Charlemagne couronné empereur", en: "Charlemagne crowned emperor" },
  { year: 1066, fr: "Bataille de Hastings", en: "Battle of Hastings" },
  { year: 1215, fr: "Signature de la Magna Carta", en: "Magna Carta is signed" },
  { year: 1347, fr: "Début de la peste noire en Europe", en: "The Black Death begins spreading in Europe" },
  { year: 1453, fr: "Chute de Constantinople", en: "Fall of Constantinople" },
  { year: 1492, fr: "Christophe Colomb atteint les Amériques", en: "Columbus reaches the Americas" },
  { year: 1517, fr: "Luther affiche ses 95 thèses", en: "Luther posts his 95 theses" },
  { year: 1610, fr: "Galilée pointe sa lunette vers le ciel", en: "Galileo turns his telescope to the sky" },
  { year: 1687, fr: "Newton publie les 'Principia'", en: "Newton publishes the 'Principia'" },
  { year: 1776, fr: "Indépendance des États-Unis", en: "US Declaration of Independence" },
  { year: 1789, fr: "Prise de la Bastille, Révolution française", en: "Storming of the Bastille, French Revolution" },
  { year: 1815, fr: "Bataille de Waterloo", en: "Battle of Waterloo" },
  { year: 1859, fr: "Darwin publie 'L'Origine des espèces'", en: "Darwin publishes 'On the Origin of Species'" },
  { year: 1876, fr: "Invention du téléphone", en: "Invention of the telephone" },
  { year: 1903, fr: "Premier vol motorisé des frères Wright", en: "The Wright brothers' first powered flight" },
  { year: 1912, fr: "Naufrage du Titanic", en: "Sinking of the Titanic" },
  { year: 1914, fr: "Début de la Première Guerre mondiale", en: "World War I begins" },
  { year: 1929, fr: "Krach boursier de Wall Street", en: "Wall Street stock market crash" },
  { year: 1939, fr: "Début de la Seconde Guerre mondiale", en: "World War II begins" },
  { year: 1945, fr: "Fin de la Seconde Guerre mondiale", en: "World War II ends" },
  { year: 1957, fr: "Lancement de Spoutnik 1", en: "Launch of Sputnik 1" },
  { year: 1961, fr: "Gagarine, premier humain dans l'espace", en: "Gagarin, first human in space" },
  { year: 1969, fr: "Premiers pas sur la Lune (Apollo 11)", en: "First steps on the Moon (Apollo 11)" },
  { year: 1986, fr: "Catastrophe de Tchernobyl", en: "Chernobyl nuclear disaster" },
  { year: 1989, fr: "Chute du mur de Berlin", en: "Fall of the Berlin Wall" },
  { year: 1991, fr: "Invention du World Wide Web", en: "Invention of the World Wide Web" },
  { year: 2001, fr: "Attentats du 11 septembre", en: "September 11 attacks" },
  { year: 2008, fr: "Crise financière mondiale", en: "Global financial crisis" },
  { year: 2020, fr: "Début de la pandémie de COVID-19", en: "COVID-19 pandemic begins" },
];

// Retourne l'événement le plus proche de l'année cible (distance absolue,
// l'antériorité la plus faible départageant les ex æquo) — pas forcément
// l'événement juste avant, car pour ces 4 systèmes du jeu de données l'écart
// reste de toute façon assez faible (quelques années à quelques décennies).
export function nearestHistoricalEvent(targetYear: number): HistoricalEvent {
  let best = HISTORICAL_EVENTS[0];
  let bestDiff = Math.abs(targetYear - best.year);
  for (const event of HISTORICAL_EVENTS) {
    const diff = Math.abs(targetYear - event.year);
    if (diff < bestDiff) {
      best = event;
      bestDiff = diff;
    }
  }
  return best;
}
