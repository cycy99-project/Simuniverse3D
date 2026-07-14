// Vraies photos officielles NASA (domaine public), téléchargées et hébergées
// localement (frontend/public/photos/, cf. scripts/fetch_nasa_photos.py) —
// distinct de photoLinks.ts qui ne fait que pointer vers des moteurs de
// recherche externes. Le manifeste est chargé une fois au démarrage ; absence
// de fichier/entrée pour un corps = pas grave, on retombe sur les liens de
// recherche externes seuls (aucune exoplanète n'a de photo réelle, cf. ingest.py).
export interface PhotoEntry {
  file: string;
  title: string;
  credit: string;
  // Absents pour les photos ajoutées manuellement (pas via l'API NASA Images,
  // cf. scripts/fetch_nasa_photos.py) quand la date exacte ou l'URL de la
  // fiche source ne sont pas connues avec certitude — on ne fabrique jamais
  // ces valeurs, l'absence est préférable à une donnée inventée.
  date?: string;
  sourceUrl?: string;
  license: string;
}

let manifest: Record<string, PhotoEntry[]> = {};

export async function loadPhotoManifest(): Promise<void> {
  try {
    const res = await fetch("/photos/manifest.json");
    if (!res.ok) return;
    manifest = await res.json();
  } catch {
    // Pas bloquant : l'appli fonctionne sans galerie locale.
  }
}

export function photosFor(name: string): PhotoEntry[] {
  return manifest[name] ?? [];
}
