// Present uniquement pour satisfaire les criteres d'installabilite (Chrome/
// Android "Ajouter a l'ecran d'accueil" exige un SW actif avec un handler
// fetch) - pas de cache ni de mode hors-ligne pour ce jalon : chaque requete
// part normalement au reseau.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
