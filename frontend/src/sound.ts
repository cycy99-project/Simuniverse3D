// Bip de confirmation : sample importé (public/bips/, licence Floraphonic) —
// remplace l'ancien bip synthétisé Web Audio, jugé trop artificiel par Cyril
// (retour du 2026-08-02, cf. SPECS.md point 0). Joué à la sélection d'un
// astre/mode et à l'entrée dans un système/vue (cf. call sites main.ts).
// Un seul HTMLAudioElement réutilisé (pas de recréation à chaque appel) :
// remettre currentTime à 0 permet de rejouer immédiatement même si un appel
// précédent n'est pas terminé (clics rapprochés).
const selectSoundEl = new Audio("/bips/floraphonic-minimal-pop-click-ui-4-198304.mp3");
selectSoundEl.volume = 0.5;

export function playSelectSound(): void {
  selectSoundEl.currentTime = 0;
  selectSoundEl.play().catch(() => {});
}
