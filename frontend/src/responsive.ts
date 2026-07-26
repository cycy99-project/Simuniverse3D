// Bascule desktop/mobile : basée sur la largeur de viewport (pas sur l'UA),
// réactive au redimensionnement/à la rotation d'écran. Source de vérité
// unique posée sur <html class="is-mobile"> — le CSS et main.ts la lisent
// tous les deux depuis cette classe plutôt que de dupliquer un breakpoint.
export const MOBILE_BREAKPOINT_PX = 768;

const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);
const listeners = new Set<(mobile: boolean) => void>();

export function isMobile(): boolean {
  return mql.matches;
}

export function onMobileChange(cb: (mobile: boolean) => void): void {
  listeners.add(cb);
}

function applyHtmlClass(mobile: boolean) {
  document.documentElement.classList.toggle("is-mobile", mobile);
}

applyHtmlClass(mql.matches);
mql.addEventListener("change", (event) => {
  applyHtmlClass(event.matches);
  listeners.forEach((cb) => cb(event.matches));
});
