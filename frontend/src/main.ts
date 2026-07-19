import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { loadSeedData } from "./data/loader";
import type { SeedData, SystemData, PlanetData, MoonData, AtmosphereSource } from "./data/types";
import { buildGalaxyScene, applyGalaxyReveal, type RevealableSystem, type SunLine } from "./scenes/galaxy";
import { buildSystemScene, STAR_CLICK_ID } from "./scenes/system";
import { buildAtmosphereScene } from "./scenes/atmosphere";
import { buildMoonFocusScene } from "./scenes/moonFocus";
import { buildMoonSurfaceScene } from "./scenes/moonSurface";
import { buildStarScene, type StarCompareTarget } from "./scenes/star";
import { VOYAGER_1, VOYAGER_2, currentDistanceAU, currentDistanceKm, type VoyagerInfo } from "./voyager";
import type { Spinnable } from "./spin";
import { computeEarthDistance, computeGalaxyViewDistance } from "./distance";
import { t, getLang, setLang, onLangChange, type Lang } from "./i18n";
import { formatTemp, getTempUnit, setTempUnit, onTempUnitChange, type TempUnit } from "./units";
import { localizeName } from "./nameTranslations";
import { photoLinksFor } from "./photoLinks";
import { loadPhotoManifest, photosFor, type PhotoEntry } from "./photoGallery";
import { gravityAnecdote } from "./gravityAnecdotes";
import { classifyStar } from "./starClassification";
import { createSelectionMarker, fitSelectionMarker } from "./selectionMarker";

type AppState =
  | { view: "galaxy" }
  | { view: "system"; systemId: string }
  | { view: "star"; systemId: string }
  | { view: "atmosphere"; systemId: string; planetName: string };

// Cible d'une sélection en attente de confirmation ("Nouvelle Navigation") :
// un clic sur un système/une étoile/une planète ne fait plus basculer l'état
// (AppState) immédiatement — il désigne juste cette cible, affichée via le
// losange 3D + l'encart "Explorer" (cf. selectPending/updateSelectionCard
// plus bas). Seul le clic sur "Explorer" déclenche réellement setState(...).
type PendingTarget =
  | { kind: "system"; systemId: string }
  | { kind: "star"; systemId: string }
  | { kind: "planet"; systemId: string; planetName: string };

interface PendingSelection {
  target: PendingTarget;
  // Clé dans la map `clickable` courante correspondant à l'astre sélectionné
  // (pas une référence directe à l'Object3D : celui-ci est détruit et
  // recréé à chaque render(), y compris pour des re-rendus sans rapport avec
  // la sélection en cours, ex. bascule d'un toggle — cf. resolvePendingObject).
  id: string;
}

const SOURCE_LABEL_KEYS: Record<AtmosphereSource, Parameters<typeof t>[0]> = {
  known: "sourceKnown",
  jwst_spectroscopy: "sourceJwst",
  no_detection: "sourceNoDetection",
  no_data: "sourceNoData",
};

const canvas = document.getElementById("scene-canvas") as HTMLCanvasElement;
const breadcrumbEl = document.getElementById("breadcrumb")!;
const infoPanelEl = document.getElementById("info-panel")!;
const hintEl = document.getElementById("hint")!;
const langToggleEl = document.getElementById("lang-toggle")!;
const unitToggleEl = document.getElementById("unit-toggle")!;
const compareToggleEl = document.getElementById("compare-toggle")!;
const orbitPlaneToggleEl = document.getElementById("orbit-plane-toggle") as HTMLButtonElement;
const habitableZoneToggleEl = document.getElementById("habitable-zone-toggle") as HTMLButtonElement;
const moonScaleToggleEl = document.getElementById("moon-scale-toggle") as HTMLButtonElement;
const moonSurfaceToggleEl = document.getElementById("moon-surface-toggle") as HTMLButtonElement;
const dayNightToggleEl = document.getElementById("day-night-toggle") as HTMLButtonElement;
const sciInterpToggleEl = document.getElementById("sci-interp-toggle") as HTMLButtonElement;
const studentModeToggleEl = document.getElementById("student-mode-toggle") as HTMLButtonElement;
const musicToggleEl = document.getElementById("music-toggle") as HTMLButtonElement;
const pauseToggleEl = document.getElementById("pause-toggle") as HTMLButtonElement;
const bgMusicEl = document.getElementById("bg-music") as HTMLAudioElement;
const searchInputEl = document.getElementById("search-input") as HTMLInputElement;
const searchDatalistEl = document.getElementById("search-datalist") as HTMLDataListElement;
const lightboxEl = document.getElementById("lightbox")!;
const lightboxImgEl = document.getElementById("lightbox-img") as HTMLImageElement;
const lightboxCaptionEl = document.getElementById("lightbox-caption")!;
const lightboxCloseEl = document.getElementById("lightbox-close")!;
const lightboxPrevEl = document.getElementById("lightbox-prev")!;
const lightboxNextEl = document.getElementById("lightbox-next")!;
const selectionCardEl = document.getElementById("selection-card")!;
const selectionCardLabelEl = document.getElementById("selection-card-label")!;
const selectionCardTypeEl = document.getElementById("selection-card-type")!;
const selectionCardExploreEl = document.getElementById("selection-card-explore") as HTMLButtonElement;
const distanceHudEl = document.getElementById("distance-hud")!;
const distanceHudValueEl = document.getElementById("distance-hud-value")!;
const distanceHudTravelEl = document.getElementById("distance-hud-travel")!;

const MUSIC_MUTED_KEY = "universe3d.musicMuted";
let musicMuted = localStorage.getItem(MUSIC_MUTED_KEY) === "true";
bgMusicEl.volume = 0.35;
bgMusicEl.muted = musicMuted;

function renderMusicToggle() {
  musicToggleEl.textContent = musicMuted ? "🔇 Musique" : "🔊 Musique";
  musicToggleEl.classList.toggle("muted", musicMuted);
}
renderMusicToggle();

musicToggleEl.onclick = () => {
  musicMuted = !musicMuted;
  bgMusicEl.muted = musicMuted;
  localStorage.setItem(MUSIC_MUTED_KEY, String(musicMuted));
  if (!musicMuted) bgMusicEl.play().catch(() => {});
  renderMusicToggle();
};

// Les navigateurs bloquent l'autoplay avec son avant toute interaction : on
// tente immédiatement, puis on retente au premier geste utilisateur si besoin.
bgMusicEl.play().catch(() => {
  const resumeOnInteraction = () => {
    if (!musicMuted) bgMusicEl.play().catch(() => {});
    document.removeEventListener("pointerdown", resumeOnInteraction);
    document.removeEventListener("keydown", resumeOnInteraction);
  };
  document.addEventListener("pointerdown", resumeOnInteraction, { once: true });
  document.addEventListener("keydown", resumeOnInteraction, { once: true });
});

function renderLangToggle() {
  const lang = getLang();
  langToggleEl.innerHTML = "";
  (["fr", "en"] as Lang[]).forEach((l) => {
    const btn = document.createElement("button");
    btn.textContent = l.toUpperCase();
    btn.className = l === lang ? "active" : "";
    btn.onclick = () => setLang(l);
    langToggleEl.appendChild(btn);
  });
}
renderLangToggle();
onLangChange(() => {
  renderLangToggle();
  renderSciInterpToggle();
  renderStudentModeToggle();
  render();
});

function renderUnitToggle() {
  const unit = getTempUnit();
  unitToggleEl.innerHTML = "";
  (["K", "C", "F"] as TempUnit[]).forEach((u) => {
    const btn = document.createElement("button");
    btn.textContent = u === "K" ? "K" : `°${u}`;
    btn.className = u === unit ? "active" : "";
    btn.onclick = () => setTempUnit(u);
    unitToggleEl.appendChild(btn);
  });
}
renderUnitToggle();
onTempUnitChange(() => {
  renderUnitToggle();
  render();
});

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
// Pas de tone mapping HDR : toute la scène est en couleurs plates non
// éclairées (MeshBasicMaterial), sans bloom ni éclairage physique — une
// courbe filmique (ACES) désaturait à tort les couleurs saturées (ex. la
// couleur corps-noir d'une naine rouge, proche du blanc sur son canal rouge)
// vers un jaune-blanc, la rendant visuellement indiscernable du Soleil.
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Vue surface d'un satellite (moonSurface.ts) : position caméra FIXE (on est
// debout au même endroit), on ne peut que regarder autour de soi (souris),
// pas zoomer/reculer/s'élever — remplace OrbitControls (qui déplacerait la
// caméra) par une simple rotation yaw/pitch appliquée directement à la caméra.
let lookAroundActive = false;
let lookYaw = 0;
let lookPitch = 0;
let lookDragLastPos: { x: number; y: number } | null = null;
const LOOK_SENSITIVITY = 0.0025;
const LOOK_MAX_PITCH = Math.PI / 2 - 0.05;

function applyLookRotation() {
  camera.rotation.order = "YXZ";
  camera.rotation.set(lookPitch, lookYaw, 0);
}

function setLookDirection(from: THREE.Vector3, to: THREE.Vector3) {
  const dir = to.clone().sub(from).normalize();
  lookPitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
  lookYaw = Math.atan2(dir.x, -dir.z);
  applyLookRotation();
}

let scene = new THREE.Scene();
let clickable = new Map<THREE.Object3D, string>();
let seed: SeedData;
let state: AppState = { view: "galaxy" };
let compareWithEarth = false;
let moonSurfaceView = false;
let dayMode = true;
let starCompareMode: StarCompareTarget = null;
let selectedMoon: string | null = null;
let selectedVoyager: VoyagerInfo | null = null;
let pendingSelection: PendingSelection | null = null;
let selectionMarkerSprite: THREE.Sprite | null = null;
// Photos actuellement affichées dans le panneau d'info (mis à jour à chaque
// rendu de galerie) : permet à la lightbox de naviguer précédent/suivant sans
// devoir re-résoudre le corps céleste concerné.
let currentGalleryPhotos: PhotoEntry[] = [];
let lightboxIndex = 0;
let spinGroups: Spinnable[] = [];
// Révélation progressive + traits Soleil→système de la vue galaxie (cf.
// scenes/galaxy.ts::applyGalaxyReveal), recalculés à chaque frame pendant que
// cette vue est active — vidés comme spinGroups à chaque changement de vue.
let galaxyRevealables: RevealableSystem[] = [];
let galaxySunLines: SunLine[] = [];
// Permet de figer les orbites (planète + satellites) pour cliquer précisément
// sur un satellite en mouvement ; ne réinitialise pas la sélection en cours.
let animationPaused = false;
// Préférence d'affichage globale (persiste entre navigations, comme la
// langue/l'unité) : n'a d'effet visible que pour le Système Solaire, seul
// système où l'on dispose de vraies inclinaisons orbitales (cf. types.ts).
let showRealOrbitalPlanes = false;
let showHabitableZone = false;

// Universel (toutes vues/systèmes/planètes), persisté comme musicMuted : par
// défaut ON pour préserver le comportement historique (couleur heuristique
// déjà affichée par défaut faute de photo réelle) ; désactivable pour un
// rendu neutre "donnée insuffisante" quand on veut distinguer strictement le
// connu de l'interprété.
const SCI_INTERP_KEY = "universe3d.showScientificInterpretation";
let showScientificInterpretation = localStorage.getItem(SCI_INTERP_KEY) !== "false";

function renderSciInterpToggle() {
  sciInterpToggleEl.classList.toggle("active", showScientificInterpretation);
  sciInterpToggleEl.textContent = showScientificInterpretation ? t("sciInterpOn") : t("sciInterpOff");
  sciInterpToggleEl.title = t("sciInterpNote");
}
renderSciInterpToggle();

sciInterpToggleEl.onclick = () => {
  showScientificInterpretation = !showScientificInterpretation;
  localStorage.setItem(SCI_INTERP_KEY, String(showScientificInterpretation));
  renderSciInterpToggle();
  render();
};

// Universel (toutes vues), persisté comme showScientificInterpretation :
// simplifie les cartouches et ajoute des anecdotes ludiques pour un public
// plus jeune, sans dupliquer les données (mêmes valeurs, présentation
// différente).
const STUDENT_MODE_KEY = "universe3d.studentMode";
let studentMode = localStorage.getItem(STUDENT_MODE_KEY) === "true";

function renderStudentModeToggle() {
  studentModeToggleEl.classList.toggle("active", studentMode);
  studentModeToggleEl.textContent = studentMode ? t("studentModeOn") : t("studentModeOff");
  studentModeToggleEl.title = t("studentModeNote");
}
renderStudentModeToggle();

studentModeToggleEl.onclick = () => {
  studentMode = !studentMode;
  localStorage.setItem(STUDENT_MODE_KEY, String(studentMode));
  renderStudentModeToggle();
  render();
};

// Universel (toutes vues/systèmes/planètes), persisté comme showScientificInterpretation :
// par défaut ON — la taille réelle (rayon lune / rayon planète) est la valeur
// honnête par défaut ; l'étirement visuel min-max de moonSizes() (moons.ts)
// devient l'option pour qui préfère la lisibilité au réalisme.
const REAL_MOON_SCALE_KEY = "universe3d.realMoonScale";
let realMoonScale = localStorage.getItem(REAL_MOON_SCALE_KEY) !== "false";

function formatRotationPeriod(rotationHours: number | null): string | null {
  if (rotationHours === null) return null;
  const hours = Math.abs(rotationHours);
  const value = hours >= 48 ? `${(hours / 24).toFixed(1)} j` : `${hours.toFixed(1)} h`;
  return rotationHours < 0 ? `${value} (${t("retrograde")})` : value;
}

const EARTH_SURFACE_GRAVITY = 9.80665; // m/s², valeur standard = référence de comparaison

// g = G*M/R² s'écrit, en unités relatives à la Terre (M et R en masses/rayons
// terrestres), g = g_terre * masse / rayon² — pas de constante G ni de
// conversion d'unités nécessaire puisque pl_bmasse/pl_rade sont déjà
// exprimés en unités terrestres.
function planetGravityMs2(planet: PlanetData): number | null {
  if (planet.pl_bmasse == null || planet.pl_rade == null || planet.pl_rade === 0) return null;
  return EARTH_SURFACE_GRAVITY * (planet.pl_bmasse / (planet.pl_rade * planet.pl_rade));
}

function gravityLineHtml(gravityMs2: number | null): string {
  if (gravityMs2 == null) return `<p><em style="font-size: 11px; opacity: 0.7;">${t("gravityUnknown")}</em></p>`;
  const ratioPercent = (gravityMs2 / EARTH_SURFACE_GRAVITY) * 100;
  const weightFor100kg = Math.round(ratioPercent);
  return `<p><strong>${t("gravity")} :</strong> ${gravityMs2.toFixed(2)} m/s² — ${ratioPercent.toFixed(0)} % ${t("gravityOfEarth")} (${t("gravityWeightPrefix")} ${weightFor100kg} ${t("gravityWeightSuffix")})</p>`;
}

function gravityAnecdoteHtml(name: string, gravityMs2: number | null): string {
  const anecdote = gravityAnecdote(name);
  if (anecdote) return `<p class="anecdote">🎈 ${anecdote[getLang()]}</p>`;
  if (gravityMs2 == null) return "";
  const weightFor100kg = Math.round((gravityMs2 / EARTH_SURFACE_GRAVITY) * 100);
  return `<p class="anecdote">${t("gravityFunFactPrefix")} ${weightFor100kg} ${t("gravityFunFactSuffix")}</p>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function learnMoreHtml(text: string | null | undefined): string {
  if (!text) return "";
  return `<details class="learn-more"><summary>${t("learnMore")}</summary><p>${text}</p></details>`;
}

// Diaporama plein écran par-dessus la vue 3D en cours (le state/scène ne
// changent pas : on reste sur le corps affiché) — ouvert au clic sur une
// vignette, navigable au clavier ou aux flèches, refermable sans perdre la
// sélection courante.
function renderLightbox() {
  const photo = currentGalleryPhotos[lightboxIndex];
  if (!photo) return;
  lightboxImgEl.src = photo.file;
  lightboxImgEl.alt = photo.title;
  const sourceLink = photo.sourceUrl
    ? ` — <a href="${photo.sourceUrl}" target="_blank" rel="noopener noreferrer">${t("viewSource")}</a>`
    : "";
  lightboxCaptionEl.innerHTML = `${escapeHtml(photo.title)} — ${escapeHtml(photo.credit)} (${escapeHtml(photo.license)})${sourceLink}`;
  lightboxPrevEl.style.visibility = currentGalleryPhotos.length > 1 ? "visible" : "hidden";
  lightboxNextEl.style.visibility = currentGalleryPhotos.length > 1 ? "visible" : "hidden";
}

function openLightbox(index: number) {
  lightboxIndex = index;
  renderLightbox();
  lightboxEl.classList.add("visible");
}

function closeLightbox() {
  lightboxEl.classList.remove("visible");
}

function isLightboxOpen(): boolean {
  return lightboxEl.classList.contains("visible");
}

function shiftLightbox(delta: number) {
  const count = currentGalleryPhotos.length;
  if (count === 0) return;
  lightboxIndex = (lightboxIndex + delta + count) % count;
  renderLightbox();
}

infoPanelEl.addEventListener("click", (event) => {
  const btn = (event.target as HTMLElement).closest<HTMLElement>(".photo-thumb");
  if (!btn) return;
  openLightbox(Number(btn.dataset.index));
});

lightboxCloseEl.addEventListener("click", closeLightbox);
lightboxPrevEl.addEventListener("click", () => shiftLightbox(-1));
lightboxNextEl.addEventListener("click", () => shiftLightbox(1));
// Clic sur le fond (en dehors de l'image/légende/boutons) : ferme aussi,
// comportement standard de lightbox.
lightboxEl.addEventListener("click", (event) => {
  if (event.target === lightboxEl) closeLightbox();
});

function photoLinksHtml(name: string): string {
  const links = photoLinksFor(name);
  const photos = photosFor(name);
  currentGalleryPhotos = photos;
  const gallery = photos.length
    ? `<div class="photo-gallery">${photos
        .map((p, i) => {
          const titleAttr = `${escapeHtml(p.title)} — ${escapeHtml(p.credit)}`;
          return `<button type="button" class="photo-thumb" data-index="${i}" title="${titleAttr}">
            <img src="${p.file}" alt="${escapeHtml(p.title)}" loading="lazy">
          </button>`;
        })
        .join("")}</div>`
    : "";
  return `<p class="photo-links">
    ${gallery}
    <a href="${links.nasaImages}" target="_blank" rel="noopener noreferrer">${t("photosNasa")}</a><br>
    <a href="${links.wikipedia}" target="_blank" rel="noopener noreferrer">${t("photosWikipedia")}</a>
  </p>`;
}

function findEarthPlanet(data: SeedData): PlanetData {
  const sol = data.systems.find((s) => s.id === "sol")!;
  return sol.planets.find((p) => p.name === "Terre")!;
}

function resize() {
  const { innerWidth, innerHeight } = window;
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

function disposeScene(s: THREE.Scene) {
  s.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Sprite) {
      obj.geometry?.dispose?.();
      const material = obj.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose?.();
    }
  });
}

function findSystem(systemId: string): SystemData {
  const system = seed.systems.find((s) => s.id === systemId);
  if (!system) throw new Error(`Système inconnu : ${systemId}`);
  return system;
}

function findPlanet(system: SystemData, planetName: string): PlanetData {
  const planet = system.planets.find((p) => p.name === planetName);
  if (!planet) throw new Error(`Planète inconnue : ${planetName}`);
  return planet;
}

function setState(next: AppState) {
  state = next;
  compareWithEarth = false;
  starCompareMode = null;
  selectedMoon = null;
  selectedVoyager = null;
  pendingSelection = null;
  moonSurfaceView = false;
  dayMode = true;
  // animationPaused n'est PAS réinitialisé ici : c'est une préférence globale
  // qui doit survivre à la navigation (ex. mettre en pause le Système
  // Solaire, cliquer une planète, puis revenir doit rester en pause).
  // realMoonScale non plus : préférence persistée (comme showScientificInterpretation).
  render();
}

function render() {
  disposeScene(scene);
  scene = new THREE.Scene();
  clickable = new Map();

  spinGroups = [];
  galaxyRevealables = [];
  galaxySunLines = [];

  if (state.view === "galaxy") {
    const result = buildGalaxyScene(seed);
    scene.add(result.group);
    clickable = result.clickable;
    galaxyRevealables = result.revealables;
    galaxySunLines = result.sunLines;
    camera.position.copy(result.cameraPos);
    controls.target.set(0, 0, 0);
    renderBreadcrumb();
    if (selectedVoyager) {
      renderVoyagerInfoPanel(selectedVoyager);
    } else {
      renderInfoPanel(null);
    }
    renderCompareToggle(null, false);
    orbitPlaneToggleEl.style.display = "none";
    habitableZoneToggleEl.style.display = "none";
    moonScaleToggleEl.style.display = "none";
    moonSurfaceToggleEl.style.display = "none";
    dayNightToggleEl.style.display = "none";
    lookAroundActive = false;
    controls.enabled = true;
    renderPauseToggle(false);
    hintEl.textContent = t("hintGalaxy");
  } else if (state.view === "system") {
    const system = findSystem(state.systemId);
    const hasRealInclinations = system.planets.some((p) => p.orbit_inclination_deg != null);
    const result = buildSystemScene(
      system,
      showRealOrbitalPlanes && hasRealInclinations,
      showHabitableZone && system.id !== "sol",
      showScientificInterpretation,
    );
    scene.add(result.group);
    clickable = result.clickable;
    spinGroups = result.spinnables;
    camera.position.copy(result.cameraPos);
    controls.target.set(0, 0, 0);
    renderBreadcrumb(system);
    if (selectedVoyager) {
      renderVoyagerInfoPanel(selectedVoyager);
    } else {
      renderInfoPanel(system);
    }
    renderCompareToggle(null, false);
    renderOrbitPlaneToggle(hasRealInclinations);
    if (system.id === "sol") {
      habitableZoneToggleEl.style.display = "none";
    } else {
      renderHabitableZoneToggle(result.habitableZoneAvailable);
    }
    moonScaleToggleEl.style.display = "none";
    moonSurfaceToggleEl.style.display = "none";
    dayNightToggleEl.style.display = "none";
    lookAroundActive = false;
    controls.enabled = true;
    renderPauseToggle(true);
    hintEl.textContent = t("hintSystem");
  } else if (state.view === "star") {
    const system = findSystem(state.systemId);
    const isSun = system.id === "sol";
    const sun = findSystem("sol").star;
    const result = buildStarScene(system.star, isSun, starCompareMode, sun);
    scene.add(result.group);
    spinGroups = result.spinnables;
    camera.position.copy(result.cameraPos);
    controls.target.set(0, 0, 0);
    renderBreadcrumb(system, undefined, true);
    renderStarInfoPanel(system, isSun);
    renderStarCompareToggle(isSun);
    orbitPlaneToggleEl.style.display = "none";
    habitableZoneToggleEl.style.display = "none";
    moonScaleToggleEl.style.display = "none";
    moonSurfaceToggleEl.style.display = "none";
    dayNightToggleEl.style.display = "none";
    lookAroundActive = false;
    controls.enabled = true;
    renderPauseToggle(false);
    hintEl.textContent = t("hintStar");
  } else {
    const system = findSystem(state.systemId);
    const planet = findPlanet(system, state.planetName);
    const isEarth = system.id === "sol" && planet.name === "Terre";
    const moon = selectedMoon ? planet.moons.find((m) => m.name === selectedMoon) ?? null : null;

    if (moon && moonSurfaceView) {
      // Vue imaginée : debout à la surface du satellite, on regarde la
      // planète autour de laquelle il orbite (cf. moonSurface.ts). Caméra
      // figée (pas d'OrbitControls, qui déplacerait la position) : seule la
      // direction du regard (souris) peut changer, cf. lookAroundActive.
      const surfaceResult = buildMoonSurfaceScene(moon, planet, showScientificInterpretation, dayMode);
      scene.add(surfaceResult.group);
      clickable = new Map();
      camera.position.copy(surfaceResult.cameraPos);
      controls.enabled = false;
      lookAroundActive = true;
      setLookDirection(surfaceResult.cameraPos, surfaceResult.cameraTarget);
      renderBreadcrumb(system, planet, undefined, moon);
      renderMoonInfoPanel(moon, true);
      compareToggleEl.style.display = "none";
      orbitPlaneToggleEl.style.display = "none";
      habitableZoneToggleEl.style.display = "none";
      moonScaleToggleEl.style.display = "none";
      renderMoonSurfaceToggle(planet, true);
      renderDayNightToggle();
      renderPauseToggle(false);
      hintEl.textContent = moon.has_thick_atmosphere ? t("hintMoonSurfaceHazy") : t("hintMoonSurface");
    } else if (moon) {
      // Vue satellite dédiée : caméra recentrée sur la lune seule (et non
      // sur la planète avec la lune juste sélectionnée), pour un vrai
      // sentiment de "descendre" d'un niveau, cohérent avec le chemin de fil
      // d'Ariane (Voie Lactée › Système › Planète › Lune).
      const moonResult = buildMoonFocusScene(moon, compareWithEarth ? findEarthPlanet(seed) : null);
      scene.add(moonResult.group);
      clickable = new Map();
      spinGroups = moonResult.spinnables;
      camera.position.copy(moonResult.cameraPos);
      controls.target.set(0, 0, 0);
      controls.enabled = true;
      lookAroundActive = false;
      renderBreadcrumb(system, planet, undefined, moon);
      renderMoonInfoPanel(moon);
      compareToggleEl.style.display = "block";
      compareToggleEl.textContent = compareWithEarth ? t("compareHide") : t("compareShow");
      compareToggleEl.onclick = () => toggleCompare();
      orbitPlaneToggleEl.style.display = "none";
      habitableZoneToggleEl.style.display = "none";
      moonScaleToggleEl.style.display = "none";
      dayNightToggleEl.style.display = "none";
      renderMoonSurfaceToggle(planet, false);
      renderPauseToggle(false);
      hintEl.textContent = t("hintMoon");
    } else {
      const compareTarget = compareWithEarth && !isEarth ? findEarthPlanet(seed) : null;
      const result = buildAtmosphereScene(planet, compareTarget, showScientificInterpretation, realMoonScale);
      scene.add(result.group);
      clickable = result.clickable;
      spinGroups = result.spinnables;
      camera.position.copy(result.cameraPos);
      controls.target.set(0, 0, 0);
      controls.enabled = true;
      lookAroundActive = false;
      renderBreadcrumb(system, planet);
      renderInfoPanel(system, planet, showScientificInterpretation ? result.visual.description[getLang()] : undefined);
      renderCompareToggle(planet, isEarth);
      orbitPlaneToggleEl.style.display = "none";
      habitableZoneToggleEl.style.display = "none";
      moonSurfaceToggleEl.style.display = "none";
      dayNightToggleEl.style.display = "none";
      // Pas de sens en mode comparaison (les lunes n'y sont pas affichées).
      renderMoonScaleToggle(compareTarget ? [] : planet.moons);
      renderPauseToggle(planet.moons.length > 0);
      hintEl.textContent = t("hintAtmosphere");
    }
  }
  if (!lookAroundActive) controls.update();
  updateSelectionMarker();
  updateSelectionCard();
  distanceHudEl.classList.toggle("visible", state.view === "galaxy");
  if (state.view === "galaxy") updateDistanceHud();
}

// Repère de distance dynamique + temps de trajet (vue galaxie uniquement,
// cf. scenes/galaxy.ts::applyGalaxyReveal pour la révélation progressive des
// systèmes/traits qui l'accompagne) : distance caméra↔Soleil (origine de la
// scène), recalculée à chaque frame pendant que cette vue est active (cf.
// animate()).
function updateDistanceHud() {
  const cameraDistance = camera.position.length();
  const info = computeGalaxyViewDistance(cameraDistance);
  const lang = getLang();
  distanceHudValueEl.textContent = info.distance[lang];
  distanceHudTravelEl.textContent = `${t("distanceHudTravel")} : ${info.travelTime[lang]}`;

  const selectedSystemId = pendingSelection?.target.kind === "system" ? pendingSelection.target.systemId : null;
  applyGalaxyReveal(galaxyRevealables, galaxySunLines, cameraDistance, selectedSystemId);
}

// Recherche l'Object3D actuel correspondant à `pendingSelection.id` dans la
// map `clickable` fraîchement reconstruite par render() — jamais une
// référence Object3D gardée d'un render() précédent (disposée avec l'ancienne
// scène, cf. disposeScene). Les ids (system.id, STAR_CLICK_ID, planet.name)
// sont stables d'un rendu à l'autre pour une même vue, donc cette
// résolution retrouve le bon objet même après un re-rendu déclenché par un
// toggle sans rapport (ex. plans orbitaux) pendant qu'une sélection est en attente.
function resolvePendingObject(): THREE.Object3D | null {
  if (!pendingSelection) return null;
  for (const [obj, id] of clickable) {
    if (id === pendingSelection.id) return obj;
  }
  return null;
}

function updateSelectionMarker() {
  if (selectionMarkerSprite) {
    scene.remove(selectionMarkerSprite);
    selectionMarkerSprite = null;
  }
  const target = resolvePendingObject();
  if (!target) return;
  const marker = createSelectionMarker();
  fitSelectionMarker(marker, target);
  scene.add(marker);
  selectionMarkerSprite = marker;
}

function updateSelectionCard() {
  if (!pendingSelection) {
    selectionCardEl.classList.remove("visible");
    selectionCardExploreEl.onclick = null;
    return;
  }
  const target = pendingSelection.target;
  let label: string;
  let typeLabel: string;
  if (target.kind === "system") {
    label = localizeName(findSystem(target.systemId).name);
    typeLabel = t("selectionTypeSystem");
  } else if (target.kind === "star") {
    label = `☉ ${localizeName(findSystem(target.systemId).star.name)}`;
    typeLabel = t("selectionTypeStar");
  } else {
    label = localizeName(findPlanet(findSystem(target.systemId), target.planetName).name);
    typeLabel = t("selectionTypePlanet");
  }
  selectionCardLabelEl.textContent = label;
  selectionCardTypeEl.textContent = typeLabel;
  selectionCardExploreEl.textContent = t("selectionExplore");
  selectionCardExploreEl.onclick = () => {
    pendingSelection = null;
    if (target.kind === "system") setState({ view: "system", systemId: target.systemId });
    else if (target.kind === "star") setState({ view: "star", systemId: target.systemId });
    else setState({ view: "atmosphere", systemId: target.systemId, planetName: target.planetName });
  };
  selectionCardEl.classList.add("visible");
}

// Désigne `target` comme sélection en attente sans reconstruire la scène
// (pas de render() ici : ça réinitialiserait la caméra à la position par
// défaut de la vue, ce qui ferait perdre à l'utilisateur le cadrage qu'il a
// choisi juste pour prévisualiser un astre — cf. Nouvelle Navigation).
function selectPending(target: PendingTarget, id: string) {
  if (selectedVoyager) {
    selectedVoyager = null;
    renderInfoPanel(state.view === "system" ? findSystem(state.systemId) : null);
  }
  pendingSelection = { target, id };
  updateSelectionMarker();
  updateSelectionCard();
}

function clearPendingSelection() {
  pendingSelection = null;
  updateSelectionMarker();
  updateSelectionCard();
}

function toggleCompare() {
  compareWithEarth = !compareWithEarth;
  render();
}

function renderCompareToggle(planet: PlanetData | null, isEarth: boolean) {
  if (!planet || isEarth || planet.pl_rade == null) {
    compareToggleEl.style.display = "none";
    compareToggleEl.onclick = null;
    return;
  }
  compareToggleEl.style.display = "block";
  compareToggleEl.textContent = compareWithEarth ? t("compareHide") : t("compareShow");
  compareToggleEl.onclick = () => toggleCompare();
}

function renderOrbitPlaneToggle(hasRealInclinations: boolean) {
  orbitPlaneToggleEl.style.display = "block";
  orbitPlaneToggleEl.disabled = !hasRealInclinations;
  orbitPlaneToggleEl.title = hasRealInclinations ? "" : t("orbitPlanesUnavailable");
  orbitPlaneToggleEl.classList.toggle("active", showRealOrbitalPlanes && hasRealInclinations);
  orbitPlaneToggleEl.textContent = showRealOrbitalPlanes && hasRealInclinations ? t("orbitPlanesReal") : t("orbitPlanesSimplified");
  orbitPlaneToggleEl.onclick = hasRealInclinations
    ? () => {
        showRealOrbitalPlanes = !showRealOrbitalPlanes;
        render();
      }
    : null;
}

function renderHabitableZoneToggle(available: boolean) {
  habitableZoneToggleEl.style.display = "block";
  habitableZoneToggleEl.disabled = !available;
  habitableZoneToggleEl.title = available ? "" : t("habitableZoneUnavailable");
  habitableZoneToggleEl.classList.toggle("active", showHabitableZone && available);
  habitableZoneToggleEl.textContent = showHabitableZone && available ? t("habitableZoneHide") : t("habitableZoneShow");
  habitableZoneToggleEl.onclick = available
    ? () => {
        showHabitableZone = !showHabitableZone;
        render();
      }
    : null;
}

function renderMoonScaleToggle(moons: MoonData[]) {
  if (moons.length === 0) {
    moonScaleToggleEl.style.display = "none";
    moonScaleToggleEl.onclick = null;
    return;
  }
  moonScaleToggleEl.style.display = "block";
  moonScaleToggleEl.classList.toggle("active", realMoonScale);
  moonScaleToggleEl.textContent = realMoonScale ? t("moonScaleHide") : t("moonScaleShow");
  moonScaleToggleEl.title = realMoonScale ? t("moonScaleRealHint") : "";
  moonScaleToggleEl.onclick = () => {
    realMoonScale = !realMoonScale;
    localStorage.setItem(REAL_MOON_SCALE_KEY, String(realMoonScale));
    render();
  };
}

function renderMoonSurfaceToggle(planet: PlanetData, active: boolean) {
  moonSurfaceToggleEl.style.display = "block";
  moonSurfaceToggleEl.classList.toggle("active", active);
  moonSurfaceToggleEl.textContent = active
    ? t("moonSurfaceViewHide")
    : `${t("moonSurfaceViewPrefix")} ${localizeName(planet.name)}`;
  moonSurfaceToggleEl.onclick = () => {
    moonSurfaceView = !moonSurfaceView;
    render();
  };
}

function renderDayNightToggle() {
  dayNightToggleEl.style.display = "block";
  dayNightToggleEl.classList.toggle("active", !dayMode);
  dayNightToggleEl.textContent = dayMode ? t("daySwitchToNight") : t("daySwitchToDay");
  dayNightToggleEl.onclick = () => {
    dayMode = !dayMode;
    render();
  };
}

function renderPauseToggle(show: boolean) {
  if (!show) {
    pauseToggleEl.style.display = "none";
    pauseToggleEl.onclick = null;
    return;
  }
  pauseToggleEl.style.display = "block";
  pauseToggleEl.classList.toggle("active", animationPaused);
  pauseToggleEl.textContent = animationPaused ? t("resumeOrbits") : t("pauseOrbits");
  pauseToggleEl.onclick = () => {
    animationPaused = !animationPaused;
    renderPauseToggle(true);
  };
}

function cycleStarCompare(isSun: boolean) {
  // Le Soleil ne peut se comparer qu'à la Terre ; les autres étoiles cyclent
  // aussi via une comparaison au Soleil.
  if (isSun) {
    starCompareMode = starCompareMode === "earth" ? null : "earth";
  } else if (starCompareMode === null) {
    starCompareMode = "sun";
  } else if (starCompareMode === "sun") {
    starCompareMode = "earth";
  } else {
    starCompareMode = null;
  }
  render();
}

function renderStarCompareToggle(isSun: boolean) {
  compareToggleEl.style.display = "block";
  if (starCompareMode === null) {
    compareToggleEl.textContent = isSun ? t("compareShowEarthStar") : t("compareShowSun");
  } else if (starCompareMode === "sun") {
    compareToggleEl.textContent = t("compareShowEarthStar");
  } else {
    compareToggleEl.textContent = t("compareHide");
  }
  compareToggleEl.onclick = () => cycleStarCompare(isSun);
}

function renderStarInfoPanel(system: SystemData, isSun: boolean) {
  infoPanelEl.classList.add("visible");
  const star = system.star;
  const lang = getLang();
  const radiusKm = star.st_rad != null ? Math.round(star.st_rad * 695_700).toLocaleString(getLang()) : "?";
  const note = isSun ? t("starKnownNote") : t("starArchiveNote");
  const category = classifyStar(star.spectype, isSun);

  infoPanelEl.innerHTML = `
    <h2>☉ ${localizeName(star.name)}</h2>
    <p>${t("starCategory")} : ${lang === "fr" ? category.fr : category.en}</p>
    <p>${t("spectralType")} : ${star.spectype ?? t("unknown")}</p>
    <p>${t("temperature")} : ${formatTemp(star.st_teff)}</p>
    <p>${t("starRadius")} : ${star.st_rad ?? "?"} R☉ (${radiusKm} km)</p>
    <p>${t("distance")} : ${star.sy_dist ?? 0} pc</p>
    <p><strong>${t("starComposition")} :</strong> ${t("starCompositionText")}</p>
    <p><em style="font-size: 11px; opacity: 0.7;">${note}</em></p>
    ${learnMoreHtml(lang === "fr" ? star.learn_more : star.learn_more_en)}
    ${photoLinksHtml(star.name)}
  `;
}

function renderVoyagerInfoPanel(v: VoyagerInfo) {
  infoPanelEl.classList.add("visible");
  const lang = getLang();
  const distanceAU = currentDistanceAU(v);
  const distanceKm = Math.round(currentDistanceKm(v));

  const history = lang === "en" ? v.history_en : v.history;

  infoPanelEl.innerHTML = `
    <h2>${v.name}</h2>
    <img class="voyager-photo" src="${v.iconTexture}" alt="${escapeHtml(v.name)}">
    <p>${t("voyagerDistance")} : ${distanceAU.toFixed(2)} UA (${distanceKm.toLocaleString(lang)} km)</p>
    <p>${t("voyagerSpeed")} : ${v.speedKmS} km/s (${v.speedAUPerYear} UA/an)</p>
    <p>${history}</p>
    <p><em style="font-size: 11px; opacity: 0.7;">${t("voyagerNote")}</em></p>
  `;
}

function goBack() {
  if (state.view === "atmosphere") setState({ view: "system", systemId: state.systemId });
  else if (state.view === "star") setState({ view: "system", systemId: state.systemId });
  else if (state.view === "system") setState({ view: "galaxy" });
}

window.addEventListener("keydown", (event) => {
  if (isLightboxOpen()) {
    if (event.key === "Escape") closeLightbox();
    else if (event.key === "ArrowLeft") shiftLightbox(-1);
    else if (event.key === "ArrowRight") shiftLightbox(1);
    return;
  }
  if (event.key === "Escape") goBack();
});

function renderBreadcrumb(system?: SystemData, planet?: PlanetData, isStar?: boolean, moon?: MoonData) {
  breadcrumbEl.innerHTML = "";
  const galaxyBtn = document.createElement("button");
  galaxyBtn.textContent = t("breadcrumbGalaxy");
  galaxyBtn.onclick = () => setState({ view: "galaxy" });
  breadcrumbEl.appendChild(galaxyBtn);

  if (system) {
    breadcrumbEl.append(" › ");
    const systemBtn = document.createElement("button");
    systemBtn.textContent = localizeName(system.name);
    systemBtn.onclick = () => setState({ view: "system", systemId: system.id });
    breadcrumbEl.appendChild(systemBtn);
  }
  if (planet && system) {
    breadcrumbEl.append(" › ");
    if (moon) {
      // Depuis une lune, le nom de la planète doit permettre d'y revenir
      // directement (sans repasser par la vue système) — sinon le seul
      // chemin de retour visible est "Système Solaire".
      const planetBtn = document.createElement("button");
      planetBtn.textContent = localizeName(planet.name);
      planetBtn.onclick = () => setState({ view: "atmosphere", systemId: system.id, planetName: planet.name });
      breadcrumbEl.appendChild(planetBtn);
    } else {
      const span = document.createElement("span");
      span.textContent = localizeName(planet.name);
      breadcrumbEl.appendChild(span);
    }
  }
  if (isStar && system) {
    breadcrumbEl.append(" › ");
    const span = document.createElement("span");
    span.textContent = `☉ ${localizeName(system.star.name)}`;
    breadcrumbEl.appendChild(span);
  }
  if (moon) {
    breadcrumbEl.append(" › ");
    const span = document.createElement("span");
    span.textContent = localizeName(moon.name);
    breadcrumbEl.appendChild(span);
  }
}

function renderInfoPanel(system: SystemData | null, planet?: PlanetData, heuristicDescription?: string) {
  if (!system) {
    infoPanelEl.classList.remove("visible");
    infoPanelEl.innerHTML = "";
    return;
  }
  infoPanelEl.classList.add("visible");

  if (!planet) {
    const lang = getLang();
    const category = classifyStar(system.star.spectype, system.id === "sol");
    infoPanelEl.innerHTML = `
      <h2>${localizeName(system.name)}</h2>
      <p>${t("starCategory")} : ${lang === "fr" ? category.fr : category.en}</p>
      <p>${t("spectralType")} : ${system.star.spectype ?? t("unknown")}</p>
      <p>${t("temperature")} : ${formatTemp(system.star.st_teff)}</p>
      <p>${t("distance")} : ${system.star.sy_dist ?? 0} pc</p>
      <p>${system.planets.length} ${t("knownPlanetsCount")}</p>
    `;
    return;
  }

  const badgeClass = planet.source;
  const lang = getLang();
  const note = lang === "fr" ? planet.note : planet.note_en;
  const molecules = planet.molecules.length
    ? planet.molecules.map((m) => `<span class="molecule-tag">${m}</span>`).join("")
    : `<em>${t("noMoleculeDetected")}</em>`;
  const earthInfo = computeEarthDistance(system, planet);
  const rotationLine = formatRotationPeriod(planet.rotation_hours);
  const shownMoons = planet.moons.length;
  const knownMoons = planet.moons_count_known ?? shownMoons;
  const moonsLine = shownMoons
    ? `${planet.moons.map((m) => localizeName(m.name)).join(", ")}`
    : t("noSatellite");

  const gravityMs2 = planetGravityMs2(planet);

  infoPanelEl.innerHTML = `
    <h2>${localizeName(planet.name)}</h2>
    ${studentMode ? "" : `<span class="badge ${badgeClass}">${t(SOURCE_LABEL_KEYS[planet.source])}</span>`}
    ${planet.dwarf ? `<span class="badge dwarf">${t("dwarfPlanetBadge")}</span>` : ""}
    <p>${t("orbitRadiusMass")} : ${planet.pl_orbsmax ?? "?"} UA — ${t("radius")} : ${planet.pl_rade ?? "?"} R⊕ — ${t("mass")} : ${planet.pl_bmasse ?? "?"} M⊕</p>
    <p>${t("equilibriumTemp")} : ${formatTemp(planet.pl_eqt)}</p>
    ${planet.planet_type ? `<p><strong>${t("planetType")} :</strong> ${lang === "fr" ? planet.planet_type.fr : planet.planet_type.en}</p>` : ""}
    ${gravityLineHtml(gravityMs2)}
    ${studentMode ? gravityAnecdoteHtml(planet.name, gravityMs2) : ""}
    <p><strong>${t("molecules")} :</strong> ${molecules}</p>
    <p>${note}</p>
    ${!studentMode && planet.spectrum_ref ? `<p><em>${t("reference")} : ${planet.spectrum_ref}</em></p>` : ""}
    ${
      planet.extra_refs?.length
        ? `<p>${planet.extra_refs
            .map((r) => `<a href="${r.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.label)}</a>`)
            .join(" · ")}</p>`
        : ""
    }
    ${!studentMode && heuristicDescription ? `<p><strong>${t("visualRendering")} :</strong> ${heuristicDescription}</p>` : ""}
    ${rotationLine ? `<p>${t("rotationPeriod")} : ${rotationLine}</p>` : ""}
    <p><strong>${t("satellitesShown")} :</strong> ${shownMoons}${shownMoons ? ` (${moonsLine})` : ""}</p>
    ${studentMode ? "" : `<p><strong>${t("satellitesKnown")} :</strong> ${knownMoons}</p>`}
    <p><strong>${t("distanceFromEarth")} :</strong> ${earthInfo.distance[lang]}</p>
    <p><strong>${t("travelTime")} :</strong> ${earthInfo.travelTime[lang]}${studentMode ? "" : `<br><em style="font-size: 11px; opacity: 0.7;">${t("travelTimeCaption")}</em>`}</p>
    ${learnMoreHtml(lang === "fr" ? planet.learn_more : planet.learn_more_en)}
    ${photoLinksHtml(planet.name)}
  `;
}

// Anecdote sous forme de question repliable, affichée uniquement dans la vue
// surface (inSurfaceView) : explique pourquoi le ciel apparaît noir (lunes
// sans atmosphère, cf. photos Apollo) ou, cas unique de Titan, pourquoi il ne
// l'est jamais (brume opaque confirmée par la sonde Huygens) — cf. moonSurface.ts.
function skyAnecdoteHtml(moon: MoonData): string {
  const question = moon.has_thick_atmosphere ? t("skyQuestionTitan") : t("skyQuestionAirless");
  const answer = moon.has_thick_atmosphere ? t("skyAnswerTitan") : t("skyAnswerAirless");
  return `<details class="learn-more"><summary>${question}</summary><p>${answer}</p></details>`;
}

function renderMoonInfoPanel(moon: MoonData, inSurfaceView = false) {
  infoPanelEl.classList.add("visible");
  const lang = getLang();
  const absPeriod = Math.abs(moon.period_days);
  const periodValue = absPeriod >= 2 ? `${absPeriod.toFixed(1)} j` : `${(absPeriod * 24).toFixed(1)} h`;
  const periodLine = moon.period_days < 0 ? `${periodValue} (${t("retrograde")})` : periodValue;
  const sourceNote = moon.texture ? t("moonPhotoNote") : t("moonColorNote");

  infoPanelEl.innerHTML = `
    <h2>${localizeName(moon.name)}</h2>
    <p>${t("moonRadius")} : ${moon.radius_km.toLocaleString(getLang())} km</p>
    <p>${t("moonOrbit")} : ${moon.orbit_km.toLocaleString(getLang())} km</p>
    <p>${t("moonPeriod")} : ${periodLine}</p>
    ${gravityLineHtml(moon.gravity_ms2 ?? null)}
    ${studentMode ? gravityAnecdoteHtml(moon.name, moon.gravity_ms2 ?? null) : ""}
    <p><em style="font-size: 11px; opacity: 0.7;">${sourceNote}</em></p>
    ${inSurfaceView ? skyAnecdoteHtml(moon) : ""}
    ${learnMoreHtml(lang === "fr" ? moon.learn_more : moon.learn_more_en)}
    ${photoLinksHtml(moon.name)}
  `;
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// OrbitControls tourne la caméra sur un drag souris ; on ne veut déclencher
// la navigation (sélection ou retour) que sur un vrai clic, pas en fin de
// rotation. On distingue les deux via la distance parcourue entre down/up.
let pointerDownPos: { x: number; y: number } | null = null;
const CLICK_MOVE_THRESHOLD = 5;

canvas.addEventListener("pointerdown", (event) => {
  pointerDownPos = { x: event.clientX, y: event.clientY };
  lookDragLastPos = { x: event.clientX, y: event.clientY };
});

// Vue surface (lookAroundActive) : rotation caméra libre à la souris, sans
// passer par OrbitControls (qui déplacerait la caméra plutôt que de la faire
// pivoter sur place) — cf. déclaration de lookAroundActive.
canvas.addEventListener("pointermove", (event) => {
  if (!lookAroundActive || !lookDragLastPos) return;
  const dx = event.clientX - lookDragLastPos.x;
  const dy = event.clientY - lookDragLastPos.y;
  lookDragLastPos = { x: event.clientX, y: event.clientY };
  lookYaw -= dx * LOOK_SENSITIVITY;
  lookPitch = THREE.MathUtils.clamp(lookPitch - dy * LOOK_SENSITIVITY, -LOOK_MAX_PITCH, LOOK_MAX_PITCH);
  applyLookRotation();
});

canvas.addEventListener("pointerup", () => {
  lookDragLastPos = null;
});
canvas.addEventListener("pointercancel", () => {
  lookDragLastPos = null;
});

canvas.addEventListener("click", (event) => {
  const down = pointerDownPos;
  pointerDownPos = null;
  if (down) {
    const dist = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    if (dist > CLICK_MOVE_THRESHOLD) return; // c'était un drag de rotation, pas un clic
  }

  if (state.view === "star") {
    // Vue "feuille" sans objet cliquable : un clic ramène directement au système.
    goBack();
    return;
  }

  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const targets = Array.from(clickable.keys());
  const intersects = raycaster.intersectObjects(targets, false);

  if (state.view === "atmosphere") {
    if (intersects.length > 0) {
      const id = clickable.get(intersects[0].object);
      if (id) {
        selectedMoon = id;
        render();
        return;
      }
    }
    // Clic dans le vide : désélectionner la lune affichée s'il y en a une.
    // Un clic dans le vide ne fait plus jamais sortir de la vue (Nouvelle
    // Navigation) — seul le bouton "Explorer" (pour système/étoile/planète)
    // ou le fil d'Ariane font revenir en arrière depuis ici.
    if (selectedMoon) {
      selectedMoon = null;
      moonSurfaceView = false;
      dayMode = true;
      render();
    }
    return;
  }

  if (intersects.length === 0) {
    // Clic dans le vide depuis la vue système ou galaxie : désélectionner une
    // sonde Voyager et/ou une sélection en attente (losange + encart
    // "Explorer") si affichées. Ne navigue plus jamais en arrière (cf.
    // Nouvelle Navigation) : seul "Explorer" ou le fil d'Ariane le font.
    if (selectedVoyager) {
      selectedVoyager = null;
      render();
    } else if (pendingSelection) {
      clearPendingSelection();
    }
    return;
  }

  const hit = intersects[0].object;
  const id = clickable.get(hit);
  if (!id) return;

  if (state.view === "galaxy") {
    if (id === VOYAGER_1.id || id === VOYAGER_2.id) {
      selectedVoyager = id === VOYAGER_1.id ? VOYAGER_1 : VOYAGER_2;
      render();
    } else {
      selectPending({ kind: "system", systemId: id }, id);
    }
  } else if (state.view === "system") {
    if (id === STAR_CLICK_ID) {
      selectPending({ kind: "star", systemId: state.systemId }, id);
    } else if (id === VOYAGER_1.id || id === VOYAGER_2.id) {
      selectedVoyager = id === VOYAGER_1.id ? VOYAGER_1 : VOYAGER_2;
      render();
    } else {
      selectPending({ kind: "planet", systemId: state.systemId, planetName: id }, id);
    }
  }
});

function animate() {
  requestAnimationFrame(animate);
  // Chaque planète tourne sur son propre axe (et non la scène entière),
  // sinon deux planètes en mode comparaison tourneraient l'une autour de
  // l'autre au lieu de tourner chacune sur elle-même. La vitesse dépend de
  // la vraie période de rotation sidérale (voir atmosphere.ts::spinSpeed).
  if (!animationPaused) spinGroups.forEach(({ group, speed }) => (group.rotation.y += speed));
  // La sélection en attente (losange + encart "Explorer") ne provoque pas de
  // render() — cf. selectPending — donc sans ceci le losange resterait figé
  // à la position où l'astre se trouvait au moment du clic, alors que sa
  // planète continue son orbite (spinGroups ci-dessus) : on recale juste sa
  // position/échelle à chaque frame, sans recréer le sprite.
  if (pendingSelection && selectionMarkerSprite) {
    const target = resolvePendingObject();
    if (target) fitSelectionMarker(selectionMarkerSprite, target);
  }
  // Repère de distance + révélation progressive : recalculés à chaque frame
  // (pas seulement à chaque render()) car la caméra bouge en continu via
  // OrbitControls (zoom/rotation) sans qu'aucun render() ne soit déclenché.
  if (state.view === "galaxy") updateDistanceHud();
  if (!lookAroundActive) controls.update();
  renderer.render(scene, camera);
}

interface SearchEntry {
  label: string;
  systemId: string;
  kind: "star" | "planet" | "moon";
  planetName?: string;
  moonName?: string;
}

let searchIndex: SearchEntry[] = [];

// Index à plat de tous les astres cherchables (étoiles, planètes, satellites)
// tous systèmes confondus — reconstruit à chaque changement de langue car les
// libellés affichés (localizeName) changent, mais la navigation elle-même
// utilise toujours les noms canoniques FR stockés dans les données.
function refreshSearchIndex() {
  if (!seed) return;
  searchIndex = [];
  for (const system of seed.systems) {
    searchIndex.push({ label: localizeName(system.star.name), systemId: system.id, kind: "star" });
    for (const planet of system.planets) {
      searchIndex.push({
        label: localizeName(planet.name),
        systemId: system.id,
        kind: "planet",
        planetName: planet.name,
      });
      for (const moon of planet.moons) {
        searchIndex.push({
          label: localizeName(moon.name),
          systemId: system.id,
          kind: "moon",
          planetName: planet.name,
          moonName: moon.name,
        });
      }
    }
  }
  searchDatalistEl.innerHTML = searchIndex.map((e) => `<option value="${escapeHtml(e.label)}"></option>`).join("");
}

function jumpToSearchResult(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return;
  const match =
    searchIndex.find((e) => e.label.toLowerCase() === q) ??
    searchIndex.find((e) => e.label.toLowerCase().startsWith(q));
  if (!match) {
    searchInputEl.classList.add("not-found");
    setTimeout(() => searchInputEl.classList.remove("not-found"), 500);
    return;
  }
  if (match.kind === "star") {
    setState({ view: "star", systemId: match.systemId });
  } else if (match.kind === "planet") {
    setState({ view: "atmosphere", systemId: match.systemId, planetName: match.planetName! });
  } else {
    setState({ view: "atmosphere", systemId: match.systemId, planetName: match.planetName! });
    selectedMoon = match.moonName!;
    render();
  }
  searchInputEl.value = "";
  searchInputEl.blur();
}

searchInputEl.placeholder = t("searchPlaceholder");
onLangChange(() => {
  searchInputEl.placeholder = t("searchPlaceholder");
  refreshSearchIndex();
});
searchInputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") jumpToSearchResult(searchInputEl.value);
});
searchInputEl.addEventListener("change", () => jumpToSearchResult(searchInputEl.value));

loadPhotoManifest();
// Les libellés 3D (labelSprite.ts, scenes/galaxy.ts) sont rasterisés une
// seule fois dans une texture canvas : si "Orbitron" n'est pas encore
// chargée au moment du premier dessin, le fallback système reste figé dans
// la texture pour de bon (pas de redessin automatique comme du texte DOM).
// On attend donc explicitement son chargement avant le premier render().
Promise.all([document.fonts.load('700 32px "Orbitron"'), loadSeedData()]).then(([, data]) => {
  seed = data;
  refreshSearchIndex();
  render();
  animate();
});
