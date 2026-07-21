import data from "./musicPlaylist.json";

export interface MusicTrack {
  file: string;
  title: string;
  author: string;
}

// Généré/mis à jour par scripts/sync_music.mjs (ne pas éditer musicPlaylist.json
// à la main : relancer le script après avoir déposé des fichiers dans sounds/).
export const musicPlaylist: MusicTrack[] = data;
