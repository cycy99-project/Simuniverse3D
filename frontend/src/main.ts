import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { loadSeedData, loadConstellationData, loadConstellationInfo } from "./data/loader";
import { playSelectSound } from "./sound";
import type {
  SeedData,
  SystemData,
  PlanetData,
  MoonData,
  ConstellationSkyData,
  ConstellationInfoMap,
} from "./data/types";
import { buildGalaxyScene, applyGalaxyReveal, makeStarfield, type RevealableSystem, type SunLine } from "./scenes/galaxy";
import {
  buildSky2dScene,
  formatConstellationName,
  findNearestZone,
  applyZoneSelection,
  SKY_ZONE_HIT_ID,
  type ConstellationZone,
} from "./scenes/sky2d";
import { buildSystemScene, STAR_CLICK_ID } from "./scenes/system";
import { buildAtmosphereScene } from "./scenes/atmosphere";
import { buildMoonFocusScene } from "./scenes/moonFocus";
import { buildMoonSurfaceScene } from "./scenes/moonSurface";
import { buildStarScene, type StarCompareTarget } from "./scenes/star";
import { VOYAGER_1, VOYAGER_2, currentDistanceAU, currentDistanceKm, type VoyagerInfo } from "./voyager";
import type { Spinnable } from "./spin";
import { computeEarthDistance, computeGalaxyViewDistance, computeHistoricalAnecdote } from "./distance";
import { t, getLang, setLang, onLangChange, type Lang } from "./i18n";
import { formatTemp, getTempUnit, setTempUnit, onTempUnitChange, type TempUnit } from "./units";
import { localizeName } from "./nameTranslations";
import { photoLinksFor } from "./photoLinks";
import { loadPhotoManifest, photosFor, type PhotoEntry } from "./photoGallery";
import { musicPlaylist, type MusicTrack } from "./musicPlaylist";
import { gravityAnecdote } from "./gravityAnecdotes";
import { classifyStar } from "./starClassification";
import { createSelectionMarker, fitSelectionMarker } from "./selectionMarker";
import { trackPageView } from "./track";
import { isMobile, onMobileChange } from "./responsive";

trackPageView();

type AppState =
  | { view: "home" }
  | { view: "galaxy" }
  | { view: "sky2d" }
  | { view: "system"; systemId: string }
  | { view: "star"; systemId: string }
  | { view: "atmosphere"; systemId: string; planetName: string }
  | { view: "exoSky"; systemId: string; planetName: string };

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

const canvas = document.getElementById("scene-canvas") as HTMLCanvasElement;
const homeBtnEl = document.getElementById("home-btn") as HTMLButtonElement;
const homeScreenEl = document.getElementById("home-screen")!;
const homeTitleEl = document.getElementById("home-title")!;
const homeSubtitleEl = document.getElementById("home-subtitle")!;
const homeChoiceGalaxyEl = document.getElementById("home-choice-galaxy") as HTMLButtonElement;
const homeChoiceGalaxyLabelEl = document.getElementById("home-choice-galaxy-label")!;
const homeChoiceGalaxyDescEl = document.getElementById("home-choice-galaxy-desc")!;
const homeChoiceSky2dEl = document.getElementById("home-choice-sky2d") as HTMLButtonElement;
const homeChoiceSky2dLabelEl = document.getElementById("home-choice-sky2d-label")!;
const homeChoiceSky2dDescEl = document.getElementById("home-choice-sky2d-desc")!;
const breadcrumbEl = document.getElementById("breadcrumb")!;
const infoPanelEl = document.getElementById("info-panel")!;
const hintEl = document.getElementById("hint")!;
const langToggleEl = document.getElementById("lang-toggle")!;
const unitToggleEl = document.getElementById("unit-toggle")!;
const compareToggleGroupEl = document.getElementById("compare-toggle-group")!;
const compareEarthToggleEl = document.getElementById("compare-earth-toggle") as HTMLButtonElement;
const compareSunToggleEl = document.getElementById("compare-sun-toggle") as HTMLButtonElement;
const orbitPlaneToggleEl = document.getElementById("orbit-plane-toggle") as HTMLButtonElement;
const habitableZoneToggleEl = document.getElementById("habitable-zone-toggle") as HTMLButtonElement;
const moonScaleToggleEl = document.getElementById("moon-scale-toggle") as HTMLButtonElement;
const moonDistanceToggleEl = document.getElementById("moon-distance-toggle") as HTMLButtonElement;
const moonSurfaceToggleEl = document.getElementById("moon-surface-toggle") as HTMLButtonElement;
const exoSkyToggleEl = document.getElementById("exo-sky-toggle") as HTMLButtonElement;
const sunLocatorToggleEl = document.getElementById("sun-locator-toggle") as HTMLButtonElement;
const dayNightToggleEl = document.getElementById("day-night-toggle") as HTMLButtonElement;
const sciInterpToggleEl = document.getElementById("sci-interp-toggle") as HTMLButtonElement;
const musicToggleEl = document.getElementById("music-toggle") as HTMLButtonElement;
const pauseToggleEl = document.getElementById("pause-toggle") as HTMLButtonElement;
const bgMusicEl = document.getElementById("bg-music") as HTMLAudioElement;
const creditsMusicTitleEl = document.getElementById("credits-music-title")!;
const creditsMusicAuthorEl = document.getElementById("credits-music-author")!;
const creditsTexturesLabelEl = document.getElementById("credits-textures-label")!;
const creditsConstellationsLabelEl = document.getElementById("credits-constellations-label")!;
const creditsMusicLabelEl = document.getElementById("credits-music-label")!;
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

// UI mobile (barre de navigation du bas + 3 tiroirs) — cf. responsive.ts et
// applyChromeMode()/setMobileSheet() plus bas. N'existe que dans le DOM ;
// visible uniquement sous <html class="is-mobile">.
const mnavHomeEl = document.getElementById("mnav-home") as HTMLButtonElement;
const mnavSearchEl = document.getElementById("mnav-search") as HTMLButtonElement;
const mnavInfoEl = document.getElementById("mnav-info") as HTMLButtonElement;
const mnavSettingsEl = document.getElementById("mnav-settings") as HTMLButtonElement;
const mnavHomeLabelEl = document.getElementById("mnav-home-label")!;
const mnavSearchLabelEl = document.getElementById("mnav-search-label")!;
const mnavInfoLabelEl = document.getElementById("mnav-info-label")!;
const mnavSettingsLabelEl = document.getElementById("mnav-settings-label")!;
const mobileSearchOverlayEl = document.getElementById("mobile-search-overlay")!;
const mobileSearchTitleEl = document.getElementById("mobile-search-title")!;
const mobileSearchSlotEl = document.getElementById("mobile-search-slot")!;
const mobileSearchCloseEl = document.getElementById("mobile-search-close")!;
const mobileInfoSheetEl = document.getElementById("mobile-info-sheet")!;
const mobileInfoTitleEl = document.getElementById("mobile-info-title")!;
const mobileInfoSlotEl = document.getElementById("mobile-info-slot")!;
const mobileInfoCloseEl = document.getElementById("mobile-info-close")!;
const mobileSettingsSheetEl = document.getElementById("mobile-settings-sheet")!;
const mobileSettingsTitleEl = document.getElementById("mobile-settings-title")!;
const mobileSettingsSlotEl = document.getElementById("mobile-settings-slot")!;
const mobileSettingsCloseEl = document.getElementById("mobile-settings-close")!;

const MUSIC_MUTED_KEY = "universe3d.musicMuted";
let musicMuted = localStorage.getItem(MUSIC_MUTED_KEY) === "true";
bgMusicEl.volume = 0.35;
bgMusicEl.muted = musicMuted;
bgMusicEl.loop = false;

function renderMusicToggle() {
  musicToggleEl.textContent = musicMuted ? `🔇 ${t("musicToggleLabel")}` : `🔊 ${t("musicToggleLabel")}`;
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

// Lecture aléatoire des pistes de musicPlaylist.ts (public/sounds/) : un sac
// mélangé (Fisher-Yates) est reconstitué à chaque fois qu'il est épuisé, pour
// ne jamais rejouer un morceau avant d'avoir entendu tous les autres. À
// chaque nouveau morceau, titre + auteur sont réaffichés dans #credits.
let musicQueue: MusicTrack[] = [];

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function playNextTrack() {
  if (musicQueue.length === 0) musicQueue = shuffle(musicPlaylist);
  const track = musicQueue.shift()!;
  bgMusicEl.src = `/sounds/${track.file}`;
  creditsMusicTitleEl.textContent = track.title;
  creditsMusicAuthorEl.textContent = track.author;
  if (!musicMuted) bgMusicEl.play().catch(() => {});
}
bgMusicEl.addEventListener("ended", playNextTrack);
playNextTrack();

// Les navigateurs bloquent l'autoplay avec son avant toute interaction : on
// retente au premier geste utilisateur si besoin (même morceau déjà chargé).
const resumeOnInteraction = () => {
  if (!musicMuted) bgMusicEl.play().catch(() => {});
};
document.addEventListener("pointerdown", resumeOnInteraction, { once: true });
document.addEventListener("keydown", resumeOnInteraction, { once: true });

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

function renderHomeTexts() {
  homeBtnEl.textContent = t("homeButton");
  homeTitleEl.textContent = t("homeTitle");
  homeSubtitleEl.textContent = t("homeSubtitle");
  homeChoiceGalaxyLabelEl.textContent = t("homeChoiceGalaxyLabel");
  homeChoiceGalaxyDescEl.textContent = t("homeChoiceGalaxyDesc");
  homeChoiceSky2dLabelEl.textContent = t("homeChoiceSky2dLabel");
  homeChoiceSky2dDescEl.textContent = t("homeChoiceSky2dDesc");
}
renderHomeTexts();
homeBtnEl.onclick = () => setState({ view: "home" });
homeChoiceGalaxyEl.onclick = () => {
  if (!musicMuted) playSelectSound();
  setState({ view: "galaxy" });
};
homeChoiceSky2dEl.onclick = () => {
  if (!musicMuted) playSelectSound();
  setState({ view: "sky2d" });
};

// ---------------------------------------------------------------------------
// UI mobile : barre de navigation du bas + 3 tiroirs (Recherche/Infos/
// Réglages). Ne duplique aucune logique métier — les tiroirs sont de simples
// conteneurs vides dans lesquels les éléments desktop existants (#search-box,
// #info-panel, les toggles de #right-toggles) sont réellement déplacés
// (appendChild), pas recréés. Toutes les fonctions renderXToggle()/
// renderXInfoPanel() existantes continuent d'écrire dans les mêmes éléments,
// où qu'ils vivent dans le DOM à cet instant.
// ---------------------------------------------------------------------------

const desktopHomes = new Map<HTMLElement, { parent: Node; before: Node | null }>();

function moveTo(el: HTMLElement, target: HTMLElement, mobile: boolean) {
  if (mobile) {
    if (!desktopHomes.has(el)) desktopHomes.set(el, { parent: el.parentNode!, before: el.nextSibling });
    target.appendChild(el);
  } else {
    const home = desktopHomes.get(el);
    if (home) home.parent.insertBefore(el, home.before);
  }
}

function applyChromeMode(mobile: boolean) {
  moveTo(document.getElementById("search-box")!, mobileSearchSlotEl, mobile);
  moveTo(infoPanelEl as HTMLElement, mobileInfoSlotEl, mobile);
  [
    langToggleEl,
    unitToggleEl,
    sciInterpToggleEl,
    orbitPlaneToggleEl,
    habitableZoneToggleEl,
    moonScaleToggleEl,
    moonDistanceToggleEl,
    moonSurfaceToggleEl,
    exoSkyToggleEl,
    sunLocatorToggleEl,
    dayNightToggleEl,
    compareToggleGroupEl,
    pauseToggleEl,
    musicToggleEl,
  ].forEach((el) => moveTo(el as HTMLElement, mobileSettingsSlotEl, mobile));
}
applyChromeMode(isMobile());
onMobileChange(applyChromeMode);

type MobileSheet = "none" | "search" | "info" | "settings";
let activeMobileSheet: MobileSheet = "none";

function setMobileSheet(next: MobileSheet) {
  activeMobileSheet = next;
  mobileSearchOverlayEl.classList.toggle("open", next === "search");
  mobileInfoSheetEl.classList.toggle("open", next === "info");
  mobileSettingsSheetEl.classList.toggle("open", next === "settings");
  mnavSearchEl.classList.toggle("active", next === "search");
  mnavInfoEl.classList.toggle("active", next === "info");
  mnavSettingsEl.classList.toggle("active", next === "settings");
  if (next === "search") searchInputEl.focus();
}

mnavHomeEl.onclick = () => {
  setMobileSheet("none");
  setState({ view: "home" });
};
mnavSearchEl.onclick = () => setMobileSheet(activeMobileSheet === "search" ? "none" : "search");
mnavInfoEl.onclick = () => setMobileSheet(activeMobileSheet === "info" ? "none" : "info");
mnavSettingsEl.onclick = () => setMobileSheet(activeMobileSheet === "settings" ? "none" : "settings");
mobileSearchCloseEl.onclick = () => setMobileSheet("none");
mobileInfoCloseEl.onclick = () => setMobileSheet("none");
mobileSettingsCloseEl.onclick = () => setMobileSheet("none");

function renderMobileNavTexts() {
  mnavHomeLabelEl.textContent = t("mobileNavHome");
  mnavSearchLabelEl.textContent = t("mobileNavSearch");
  mnavInfoLabelEl.textContent = t("mobileNavInfo");
  mnavSettingsLabelEl.textContent = t("mobileNavSettings");
  mobileSearchTitleEl.textContent = t("mobileSearchTitle");
  mobileInfoTitleEl.textContent = t("mobileInfoTitle");
  mobileSettingsTitleEl.textContent = t("mobileSettingsTitle");
}
renderMobileNavTexts();

function renderCreditsAndA11yTexts() {
  creditsTexturesLabelEl.textContent = t("creditsTextures");
  creditsConstellationsLabelEl.textContent = t("creditsConstellations");
  creditsMusicLabelEl.textContent = t("creditsMusic");
  lightboxCloseEl.setAttribute("aria-label", t("lightboxClose"));
  lightboxPrevEl.setAttribute("aria-label", t("lightboxPrev"));
  lightboxNextEl.setAttribute("aria-label", t("lightboxNext"));
}
renderCreditsAndA11yTexts();

onLangChange(() => {
  renderLangToggle();
  renderSciInterpToggle();
  renderHomeTexts();
  renderCreditsAndA11yTexts();
  renderMusicToggle();
  renderMobileNavTexts();
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

// Zoom molette en vue "regarder autour de soi" (sky2d, surface de lune) :
// caméra fixe au point d'observation, donc pas de dolly possible — on change
// le champ de vision (comme un zoom optique) plutôt que la position. Remis à
// DEFAULT_FOV à chaque render() pour repartir sur une base connue à chaque
// changement de vue.
const DEFAULT_FOV = 60;
const LOOK_FOV_MIN = 22;
const LOOK_FOV_MAX = 100;
let lookFov = DEFAULT_FOV;

function applyLookRotation() {
  camera.rotation.order = "YXZ";
  camera.rotation.set(lookPitch, lookYaw, 0);
}

function setLookDirection(from: THREE.Vector3, to: THREE.Vector3) {
  const dir = to.clone().sub(from).normalize();
  lookPitch = Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1));
  // atan2(-dir.x, -dir.z), pas atan2(dir.x, -dir.z) : avec l'ordre d'Euler
  // "YXZ" utilisé par applyLookRotation, la composante X de la direction
  // caméra->cible est l'opposée de dir.x — sans ce signe, le cap calculé est
  // inversé (image en miroir gauche/droite) dès que dir.x est significatif,
  // ce qui pouvait faire complètement sortir la cible du champ de vision
  // (ex. bouton "Repérer le Soleil" qui ne recentrait pas réellement dessus).
  lookYaw = Math.atan2(-dir.x, -dir.z);
  applyLookRotation();
}

let scene = new THREE.Scene();
let clickable = new Map<THREE.Object3D, string>();
let seed: SeedData;
let constellationSky: ConstellationSkyData;
let constellationInfo: ConstellationInfoMap;
let state: AppState = { view: "home" };
let compareWithEarth = false;
let moonSurfaceView = false;
let dayMode = true;
let starCompareMode: StarCompareTarget = null;
// Distinct de compareWithEarth ci-dessus (utilisé par la vue lune) : la fiche
// planète a son propre état, mutuellement exclusif entre Terre et Soleil.
let planetCompareMode: StarCompareTarget = null;
let selectedMoon: string | null = null;
let selectedVoyager: VoyagerInfo | null = null;
let pendingSelection: PendingSelection | null = null;
// Sélection "par zone" en vue sky2d (cf. buildSky2dScene::zones) : le nom
// (brut, pas formaté) de la constellation actuellement mise en surbrillance,
// ou null si aucune. Contrairement à pendingSelection, il n'y a pas de
// confirmation "Explorer" — le panneau d'info s'affiche directement au clic.
let selectedConstellationName: string | null = null;
let sky2dZones: ConstellationZone[] = [];
let sky2dHighlightSprite: THREE.Sprite | null = null;
let sky2dNameSprite: THREE.Sprite | null = null;

// Distance réelle Soleil (années-lumière) telle que vue depuis l'exoplanète
// observée en mode "exoSky" — recalculée à chaque render(), utilisée par le
// clic de désélection (void-click) pour redessiner le panneau d'info sans
// reconstruire toute la scène.
let exoSkySunDistanceLy: number | undefined;

// Direction (dans le repère de la vue exoSky) vers le Soleil — permet au
// bouton "Repérer le Soleil" de recentrer le regard même après que
// l'utilisateur ait fait pivoter la caméra ailleurs dans le ciel.
let exoSkySunDirection: THREE.Vector3 | null = null;

// Halo du Soleil (mode exoSky) à faire scintiller frame après frame dans
// animate() — null en dehors de cette vue, pour ne pas laisser un pulse
// tourner dans le vide une fois la scène détruite.
let exoSkySunGlowSprite: THREE.Sprite | null = null;

// Nom localisé d'une constellation (FR/EN) tel qu'affiché en grand dans la
// zone (sky2d) et en tête du panneau d'info — nameFr/nameEn viennent du
// contenu documentaire du subagent (constellation_info.json) ; repli sur le
// nom brut espacé si une constellation n'y figurait pas.
function constellationDisplayName(rawName: string): string {
  const info = constellationInfo[rawName];
  if (!info) return formatConstellationName(rawName);
  return getLang() === "fr" ? info.nameFr : info.nameEn;
}
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

// Universel (toutes vues/systèmes/planètes), persisté comme showScientificInterpretation :
// par défaut ON — la taille réelle (rayon lune / rayon planète) est la valeur
// honnête par défaut ; l'étirement visuel min-max de moonSizes() (moons.ts)
// devient l'option pour qui préfère la lisibilité au réalisme.
const REAL_MOON_SCALE_KEY = "universe3d.realMoonScale";
let realMoonScale = localStorage.getItem(REAL_MOON_SCALE_KEY) !== "false";

// Universel (vues système et planète), persisté comme realMoonScale : par
// défaut OFF — la distance stylisée (compression racine carrée +
// anti-chevauchement, cf. moons.ts) reste le comportement historique par
// défaut ; la distance réelle (parfois énorme pour une lune irrégulière
// lointaine) est une option qui éloigne la caméra en conséquence.
const REAL_MOON_DISTANCE_KEY = "universe3d.realMoonDistance";
let realMoonDistance = localStorage.getItem(REAL_MOON_DISTANCE_KEY) === "true";

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
  setMobileSheet("none");
  state = next;
  compareWithEarth = false;
  starCompareMode = null;
  planetCompareMode = null;
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

  lookFov = DEFAULT_FOV;
  camera.fov = DEFAULT_FOV;
  camera.updateProjectionMatrix();

  spinGroups = [];
  galaxyRevealables = [];
  galaxySunLines = [];

  homeBtnEl.classList.toggle("visible", state.view !== "home");
  homeScreenEl.classList.toggle("visible", state.view === "home");

  if (state.view === "home") {
    // Fond étoilé discret en rotation lente (même helper que galaxy.ts),
    // caméra fixe — seul l'écran d'accueil (DOM, cf. #home-screen) est
    // interactif, aucun astre n'est cliquable ici.
    const starfield = makeStarfield(2000, 300);
    scene.add(starfield);
    spinGroups = [{ group: starfield, speed: 0.0002 }];
    camera.position.set(0, 0, 1);
    controls.target.set(0, 0, 0);
    controls.enabled = false;
    lookAroundActive = false;
    breadcrumbEl.innerHTML = "";
    infoPanelEl.classList.remove("visible");
    hideCompareToggles();
    orbitPlaneToggleEl.style.display = "none";
    habitableZoneToggleEl.style.display = "none";
    moonScaleToggleEl.style.display = "none";
    moonDistanceToggleEl.style.display = "none";
    moonSurfaceToggleEl.style.display = "none";
    exoSkyToggleEl.style.display = "none";
    sunLocatorToggleEl.style.display = "none";
    dayNightToggleEl.style.display = "none";
    renderPauseToggle(false);
    hintEl.textContent = "";
  } else if (state.view === "sky2d") {
    const result = buildSky2dScene(seed, constellationSky);
    scene.add(result.group);
    clickable = result.clickable;
    sky2dZones = result.zones;
    sky2dHighlightSprite = result.highlightSprite;
    sky2dNameSprite = result.nameSprite;
    selectedConstellationName = null;
    camera.position.set(0, 0, 0);
    controls.enabled = false;
    lookAroundActive = true;
    setLookDirection(new THREE.Vector3(0, 0, 0), result.initialLookTarget);
    breadcrumbEl.innerHTML = "";
    const sky2dLabel = document.createElement("span");
    sky2dLabel.textContent = t("breadcrumbSky2d");
    breadcrumbEl.appendChild(sky2dLabel);
    if (selectedVoyager) {
      renderVoyagerInfoPanel(selectedVoyager);
    } else {
      renderInfoPanel(null);
    }
    hideCompareToggles();
    orbitPlaneToggleEl.style.display = "none";
    habitableZoneToggleEl.style.display = "none";
    moonScaleToggleEl.style.display = "none";
    moonDistanceToggleEl.style.display = "none";
    moonSurfaceToggleEl.style.display = "none";
    exoSkyToggleEl.style.display = "none";
    sunLocatorToggleEl.style.display = "none";
    dayNightToggleEl.style.display = "none";
    renderPauseToggle(false);
    hintEl.textContent = t("hintSky2d");
  } else if (state.view === "exoSky") {
    const system = findSystem(state.systemId);
    const planet = findPlanet(system, state.planetName);
    const result = buildSky2dScene(seed, constellationSky, system.id);
    scene.add(result.group);
    clickable = result.clickable;
    sky2dZones = result.zones;
    sky2dHighlightSprite = result.highlightSprite;
    sky2dNameSprite = result.nameSprite;
    selectedConstellationName = null;
    exoSkySunDistanceLy = result.sunDistanceLy;
    exoSkySunDirection = result.initialLookTarget.clone();
    exoSkySunGlowSprite = result.sunGlowSprite ?? null;
    camera.position.set(0, 0, 0);
    controls.enabled = false;
    lookAroundActive = true;
    setLookDirection(new THREE.Vector3(0, 0, 0), result.initialLookTarget);
    renderBreadcrumb(system, planet, undefined, undefined, true);
    if (selectedVoyager) {
      renderVoyagerInfoPanel(selectedVoyager);
    } else {
      renderExoSkyInfoPanel(planet, exoSkySunDistanceLy);
    }
    hideCompareToggles();
    orbitPlaneToggleEl.style.display = "none";
    habitableZoneToggleEl.style.display = "none";
    moonScaleToggleEl.style.display = "none";
    moonDistanceToggleEl.style.display = "none";
    moonSurfaceToggleEl.style.display = "none";
    exoSkyToggleEl.style.display = "none";
    sunLocatorToggleEl.style.display = "block";
    sunLocatorToggleEl.textContent = t("sunLocatorLabel");
    sunLocatorToggleEl.onclick = () => {
      if (exoSkySunDirection) setLookDirection(new THREE.Vector3(0, 0, 0), exoSkySunDirection);
    };
    dayNightToggleEl.style.display = "none";
    renderPauseToggle(false);
    hintEl.textContent = t("hintExoSky");
  } else if (state.view === "galaxy") {
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
    hideCompareToggles();
    orbitPlaneToggleEl.style.display = "none";
    habitableZoneToggleEl.style.display = "none";
    moonScaleToggleEl.style.display = "none";
    moonDistanceToggleEl.style.display = "none";
    moonSurfaceToggleEl.style.display = "none";
    exoSkyToggleEl.style.display = "none";
    sunLocatorToggleEl.style.display = "none";
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
      realMoonDistance,
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
    hideCompareToggles();
    renderOrbitPlaneToggle(hasRealInclinations);
    if (system.id === "sol") {
      habitableZoneToggleEl.style.display = "none";
    } else {
      renderHabitableZoneToggle(result.habitableZoneAvailable);
    }
    moonScaleToggleEl.style.display = "none";
    renderMoonDistanceToggle(system.planets.flatMap((p) => p.moons));
    moonSurfaceToggleEl.style.display = "none";
    exoSkyToggleEl.style.display = "none";
    sunLocatorToggleEl.style.display = "none";
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
    renderStarCompareToggles(isSun);
    orbitPlaneToggleEl.style.display = "none";
    habitableZoneToggleEl.style.display = "none";
    moonScaleToggleEl.style.display = "none";
    moonDistanceToggleEl.style.display = "none";
    moonSurfaceToggleEl.style.display = "none";
    exoSkyToggleEl.style.display = "none";
    sunLocatorToggleEl.style.display = "none";
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
      hideCompareToggles();
      orbitPlaneToggleEl.style.display = "none";
      habitableZoneToggleEl.style.display = "none";
      moonScaleToggleEl.style.display = "none";
      moonDistanceToggleEl.style.display = "none";
      exoSkyToggleEl.style.display = "none";
    sunLocatorToggleEl.style.display = "none";
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
      renderMoonCompareToggle();
      orbitPlaneToggleEl.style.display = "none";
      habitableZoneToggleEl.style.display = "none";
      moonScaleToggleEl.style.display = "none";
      moonDistanceToggleEl.style.display = "none";
      dayNightToggleEl.style.display = "none";
      exoSkyToggleEl.style.display = "none";
    sunLocatorToggleEl.style.display = "none";
      renderMoonSurfaceToggle(planet, false);
      renderPauseToggle(false);
      hintEl.textContent = t("hintMoon");
    } else {
      const compareTarget = planetCompareMode === "earth" && !isEarth ? findEarthPlanet(seed) : null;
      const compareWithSunTarget = planetCompareMode === "sun" ? findSystem("sol").star : null;
      const result = buildAtmosphereScene(
        planet,
        compareTarget,
        showScientificInterpretation,
        realMoonScale,
        realMoonDistance,
        compareWithSunTarget,
      );
      scene.add(result.group);
      clickable = result.clickable;
      spinGroups = result.spinnables;
      camera.position.copy(result.cameraPos);
      controls.target.set(0, 0, 0);
      controls.enabled = true;
      lookAroundActive = false;
      renderBreadcrumb(system, planet);
      renderInfoPanel(system, planet);
      renderPlanetCompareToggles(planet, isEarth);
      orbitPlaneToggleEl.style.display = "none";
      habitableZoneToggleEl.style.display = "none";
      moonSurfaceToggleEl.style.display = "none";
      dayNightToggleEl.style.display = "none";
      // Pas de sens en mode comparaison (les lunes n'y sont pas affichées).
      const anyCompareActive = planetCompareMode !== null;
      renderMoonScaleToggle(anyCompareActive ? [] : planet.moons);
      renderMoonDistanceToggle(anyCompareActive ? [] : planet.moons);
      renderExoSkyToggle(system, planet);
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
    if (!musicMuted) playSelectSound();
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

// Cache les deux boutons de comparaison (galaxie, système, surface de lune :
// aucun sens dans ces vues).
function hideCompareToggles() {
  compareToggleGroupEl.style.display = "none";
  compareEarthToggleEl.onclick = null;
  compareSunToggleEl.onclick = null;
}

// Vue lune dédiée : un seul bouton (Terre), comportement inchangé d'avant le
// passage aux boutons persistants — comparer une lune au Soleil n'aurait pas
// de sens (écart de taille bien trop extrême pour être lisible).
function renderMoonCompareToggle() {
  compareToggleGroupEl.style.display = "flex";
  compareEarthToggleEl.style.display = "block";
  compareEarthToggleEl.classList.toggle("active", compareWithEarth);
  compareEarthToggleEl.textContent = t("compareEarthButton");
  compareEarthToggleEl.onclick = () => toggleCompare();
  compareSunToggleEl.style.display = "none";
  compareSunToggleEl.onclick = null;
}

// Fiche planète : deux boutons persistants Terre/Soleil, un seul comparatif
// actif à la fois (cliquer l'un désactive l'autre implicitement puisque
// planetCompareMode ne peut valoir qu'une chose à la fois).
function renderPlanetCompareToggles(planet: PlanetData, isEarth: boolean) {
  if (isEarth || planet.pl_rade == null) {
    hideCompareToggles();
    return;
  }
  compareToggleGroupEl.style.display = "flex";
  compareEarthToggleEl.style.display = "block";
  compareEarthToggleEl.classList.toggle("active", planetCompareMode === "earth");
  compareEarthToggleEl.textContent = t("compareEarthButton");
  compareEarthToggleEl.onclick = () => {
    planetCompareMode = planetCompareMode === "earth" ? null : "earth";
    render();
  };
  compareSunToggleEl.style.display = "block";
  compareSunToggleEl.classList.toggle("active", planetCompareMode === "sun");
  compareSunToggleEl.textContent = t("compareSunButton");
  compareSunToggleEl.onclick = () => {
    planetCompareMode = planetCompareMode === "sun" ? null : "sun";
    render();
  };
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

function renderMoonDistanceToggle(moons: MoonData[]) {
  if (moons.length === 0) {
    moonDistanceToggleEl.style.display = "none";
    moonDistanceToggleEl.onclick = null;
    return;
  }
  moonDistanceToggleEl.style.display = "block";
  moonDistanceToggleEl.classList.toggle("active", realMoonDistance);
  moonDistanceToggleEl.textContent = realMoonDistance ? t("moonDistanceHide") : t("moonDistanceShow");
  moonDistanceToggleEl.title = realMoonDistance ? t("moonDistanceRealHint") : t("moonDistanceStylizedHint");
  moonDistanceToggleEl.onclick = () => {
    realMoonDistance = !realMoonDistance;
    localStorage.setItem(REAL_MOON_DISTANCE_KEY, String(realMoonDistance));
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

function renderExoSkyToggle(system: SystemData, planet: PlanetData) {
  exoSkyToggleEl.style.display = "block";
  exoSkyToggleEl.textContent = t("exoSkyToggleShow");
  exoSkyToggleEl.onclick = () => {
    setState({ view: "exoSky", systemId: system.id, planetName: planet.name });
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

// Fiche étoile : deux boutons persistants Terre/Soleil, comme pour la fiche
// planète. Le Soleil ne peut pas se comparer à lui-même : bouton Soleil
// masqué dans ce cas (seule la comparaison à la Terre reste possible).
function renderStarCompareToggles(isSun: boolean) {
  compareToggleGroupEl.style.display = "flex";
  compareEarthToggleEl.style.display = "block";
  compareEarthToggleEl.classList.toggle("active", starCompareMode === "earth");
  compareEarthToggleEl.textContent = t("compareEarthButton");
  compareEarthToggleEl.onclick = () => {
    starCompareMode = starCompareMode === "earth" ? null : "earth";
    render();
  };
  if (isSun) {
    compareSunToggleEl.style.display = "none";
    compareSunToggleEl.onclick = null;
  } else {
    compareSunToggleEl.style.display = "block";
    compareSunToggleEl.classList.toggle("active", starCompareMode === "sun");
    compareSunToggleEl.textContent = t("compareSunButton");
    compareSunToggleEl.onclick = () => {
      starCompareMode = starCompareMode === "sun" ? null : "sun";
      render();
    };
  }
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
    ${star.constellation ? `<p>${t("constellation")} : ${star.constellation}</p>` : ""}
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

// Panneau d'info par défaut de la vue "exoSky" (ciel nocturne vu depuis une
// exoplanète) : distance du Soleil vu de là-bas (cf. sky2d.ts::sunDistanceLy)
// + rappel explicite que le fond d'étoiles/constellations reste approximatif
// (cf. commentaire buildSky2dScene). Réaffiché après une désélection de
// constellation (clic dans le vide), cf. le click handler du canvas.
function renderExoSkyInfoPanel(planet: PlanetData, sunDistanceLy?: number) {
  infoPanelEl.classList.add("visible");
  infoPanelEl.innerHTML = `
    <h2>${t("exoSkyTitle")}</h2>
    <p>${t("exoSkyViewedFrom")} ${escapeHtml(localizeName(planet.name))}</p>
    ${sunDistanceLy !== undefined ? `<p>${t("exoSkySunDistance")} ${sunDistanceLy.toFixed(1)} ${t("exoSkyLightYears")}</p>` : ""}
    <p><em style="font-size: 11px; opacity: 0.7;">${t("exoSkyApproxHint")}</em></p>
  `;
}

// Vue "regarder le ciel" uniquement (pas d'"Explorer" pour une constellation :
// ce n'est pas un astre, juste un regroupement visuel) — panneau d'info
// direct au clic, sur le même modèle que renderStarInfoPanel/
// renderVoyagerInfoPanel, avec la liste des systèmes du jeu de données qui en
// font partie (correspondance sur star.constellation, cf. seed_systems.json).
function renderConstellationInfoPanel(rawName: string) {
  infoPanelEl.classList.add("visible");
  const lang = getLang();
  // star.constellation (astropy get_constellation()) renvoie toujours le nom
  // IAU anglais espacé — distinct du nom affiché, qui doit suivre la langue
  // de l'UI (cf. retour utilisateur : FR en français, EN en anglais).
  const matchName = formatConstellationName(rawName);
  const displayName = constellationDisplayName(rawName);
  const info = constellationInfo[rawName];
  const matches = seed.systems.filter(
    (s) => s.star.constellation?.toLowerCase() === matchName.toLowerCase(),
  );

  const systemsHtml =
    matches.length > 0
      ? `<ul class="constellation-systems">${matches
          .map((s) => `<li><button class="link-button" data-system-id="${escapeHtml(s.id)}">${escapeHtml(localizeName(s.name))}</button></li>`)
          .join("")}</ul>`
      : `<p><em style="font-size: 11px; opacity: 0.7;">${t("constellationNoSystems")}</em></p>`;

  const infoHtml = info
    ? `
      <p>${escapeHtml(info.meaning[lang])}</p>
      <p>${escapeHtml(info.description[lang])}</p>
      <p>${t("constellationBrightestStar")} : ${escapeHtml(info.brightestStar.name)} (${t("magnitudeAbbr")} ${info.brightestStar.magnitude})</p>
      ${
        info.deepSkyObjects.length > 0
          ? `<p><strong>${t("constellationDeepSkyObjects")} :</strong> ${info.deepSkyObjects
              .map((o) => escapeHtml(`${o.name} (${o.type})`))
              .join(", ")}</p>`
          : ""
      }
      ${info.factoid ? `<p><em style="font-size: 12px; opacity: 0.85;">💡 ${escapeHtml(info.factoid[lang])}</em></p>` : ""}
    `
    : "";

  infoPanelEl.innerHTML = `
    <h2>${escapeHtml(displayName)}</h2>
    ${infoHtml}
    ${matches.length > 0 ? `<p>${t("constellationSystemsHere")}</p>` : ""}
    ${systemsHtml}
  `;

  infoPanelEl.querySelectorAll<HTMLButtonElement>("button[data-system-id]").forEach((btn) => {
    btn.onclick = () => setState({ view: "system", systemId: btn.dataset.systemId! });
  });
}

function goBack() {
  if (state.view === "exoSky") setState({ view: "atmosphere", systemId: state.systemId, planetName: state.planetName });
  else if (state.view === "atmosphere") setState({ view: "system", systemId: state.systemId });
  else if (state.view === "star") setState({ view: "system", systemId: state.systemId });
  else if (state.view === "system") setState({ view: "galaxy" });
  else if (state.view === "galaxy" || state.view === "sky2d") setState({ view: "home" });
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

function renderBreadcrumb(
  system?: SystemData,
  planet?: PlanetData,
  isStar?: boolean,
  moon?: MoonData,
  exoSky?: boolean,
) {
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
    if (moon || exoSky) {
      // Depuis une lune (ou le ciel nocturne), le nom de la planète doit
      // permettre d'y revenir directement (sans repasser par la vue
      // système) — sinon le seul chemin de retour visible est "Système
      // Solaire".
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
  if (exoSky) {
    breadcrumbEl.append(" › ");
    const span = document.createElement("span");
    span.textContent = t("breadcrumbExoSky");
    breadcrumbEl.appendChild(span);
  }
}

// Méthodes de détection telles que renvoyées par la NASA Exoplanet Archive
// (colonne discoverymethod) — traduction FR ; repli sur la valeur brute EN
// pour toute méthode plus rare non listée ici.
const DISCOVERY_METHOD_FR: Record<string, string> = {
  Transit: "transit (baisse de luminosité de l'étoile)",
  "Radial Velocity": "vitesse radiale (oscillation de l'étoile)",
  Imaging: "imagerie directe",
  Microlensing: "microlentille gravitationnelle",
  Astrometry: "astrométrie",
  "Transit Timing Variations": "variations du temps de transit",
};

function discoveryHtml(planet: PlanetData, lang: Lang): string {
  if (!planet.disc_year) return "";
  const method = planet.discoverymethod;
  const methodLabel = method ? (lang === "fr" ? (DISCOVERY_METHOD_FR[method] ?? method) : method) : t("unknown");
  return `<p><strong>${t("discoveryLabel")} :</strong> ${planet.disc_year} — ${methodLabel}</p>`;
}

// Anecdote "délai lumière" (cf. distance.ts::computeHistoricalAnecdote) :
// non applicable au Système Solaire (pas de distance réelle Terre↔Soleil
// vue depuis le Soleil lui-même), d'où le null renvoyé pour system.id==="sol".
function historicalAnecdoteHtml(system: SystemData, lang: Lang): string {
  const anecdote = computeHistoricalAnecdote(system);
  if (!anecdote) return "";
  const { yearSeen, event } = anecdote;
  const yearLabel = yearSeen < 0 ? `${Math.abs(yearSeen)} ${t("historicalAnecdoteBce")}` : `${yearSeen}`;
  const answer =
    lang === "fr"
      ? `On y verrait la Terre telle qu'elle était en ${yearLabel} : ${event.fr}.`
      : `We would see Earth as it was in ${yearLabel}: ${event.en}.`;
  return `<details class="learn-more"><summary>${t("historicalAnecdoteQuestion")}</summary><p>${answer}</p></details>`;
}

function renderInfoPanel(system: SystemData | null, planet?: PlanetData) {
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
      ${system.star.constellation ? `<p>${t("constellation")} : ${system.star.constellation}</p>` : ""}
      <p>${system.planets.length} ${t("knownPlanetsCount")}</p>
    `;
    return;
  }

  const lang = getLang();
  const note = lang === "fr" ? planet.note : planet.note_en;
  const molecules = planet.molecules.length
    ? planet.molecules.map((m) => `<span class="molecule-tag">${m}</span>`).join("")
    : `<em>${t("noMoleculeDetected")}</em>`;
  const earthInfo = computeEarthDistance(system, planet);
  const rotationLine = formatRotationPeriod(planet.rotation_hours);
  const shownMoons = planet.moons.length;
  const moonsLine = shownMoons
    ? `${planet.moons.map((m) => localizeName(m.name)).join(", ")}`
    : t("noSatellite");

  const gravityMs2 = planetGravityMs2(planet);

  infoPanelEl.innerHTML = `
    <h2>${localizeName(planet.name)}</h2>
    ${planet.dwarf ? `<span class="badge dwarf">${t("dwarfPlanetBadge")}</span>` : ""}
    <p>${t("orbitRadiusMass")} : ${planet.pl_orbsmax ?? "?"} UA — ${t("radius")} : ${planet.pl_rade ?? "?"} R⊕ — ${t("mass")} : ${planet.pl_bmasse ?? "?"} M⊕</p>
    <p>${t("equilibriumTemp")} : ${formatTemp(planet.pl_eqt)}</p>
    ${planet.planet_type ? `<p><strong>${t("planetType")} :</strong> ${lang === "fr" ? planet.planet_type.fr : planet.planet_type.en}</p>` : ""}
    ${gravityLineHtml(gravityMs2)}
    ${gravityAnecdoteHtml(planet.name, gravityMs2)}
    ${discoveryHtml(planet, lang)}
    <p><strong>${t("molecules")} :</strong> ${molecules}</p>
    <p>${note}</p>
    ${
      planet.extra_refs?.length
        ? `<p>${planet.extra_refs
            .map((r) => `<a href="${r.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.label)}</a>`)
            .join(" · ")}</p>`
        : ""
    }
    ${rotationLine ? `<p>${t("rotationPeriod")} : ${rotationLine}</p>` : ""}
    <p><strong>${t("satellitesShown")} :</strong> ${shownMoons}${shownMoons ? ` (${moonsLine})` : ""}</p>
    <p><strong>${t("distanceFromEarth")} :</strong> ${earthInfo.distance[lang]}</p>
    <p><strong>${t("travelTime")} :</strong> ${earthInfo.travelTime[lang]}</p>
    ${historicalAnecdoteHtml(system, lang)}
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
    ${gravityAnecdoteHtml(moon.name, moon.gravity_ms2 ?? null)}
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

// Zoom pincement tactile (mêmes 3 vues "regarder autour de soi" que le zoom
// molette ci-dessous) : les Pointer Events ne donnent que la position du
// doigt courant — on doit suivre nous-mêmes chaque contact actif (par
// pointerId) pour calculer l'écart entre deux doigts. N'interfère jamais
// avec le pinch-to-dolly natif d'OrbitControls (vues galaxie/système/étoile/
// lune) car controls.enabled est déjà à false dans ces 3 vues.
const activeTouches = new Map<number, { x: number; y: number }>();
let pinchStartDistance: number | null = null;
let pinchStartFov = DEFAULT_FOV;

function touchDistance(): number | null {
  if (activeTouches.size < 2) return null;
  const [a, b] = Array.from(activeTouches.values());
  return Math.hypot(a.x - b.x, a.y - b.y);
}

canvas.addEventListener("pointerdown", (event) => {
  pointerDownPos = { x: event.clientX, y: event.clientY };
  lookDragLastPos = { x: event.clientX, y: event.clientY };
  if (event.pointerType === "touch") {
    activeTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activeTouches.size === 2) {
      pinchStartDistance = touchDistance();
      pinchStartFov = lookFov;
      pointerDownPos = null; // évite qu'un "click" ne se déclenche juste après un pincement
    }
  }
});

// Vue surface (lookAroundActive) : rotation caméra libre à la souris, sans
// passer par OrbitControls (qui déplacerait la caméra plutôt que de la faire
// pivoter sur place) — cf. déclaration de lookAroundActive.
canvas.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch" && activeTouches.has(event.pointerId)) {
    activeTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (lookAroundActive && activeTouches.size >= 2 && pinchStartDistance !== null) {
      const distance = touchDistance();
      if (distance) {
        lookFov = THREE.MathUtils.clamp(pinchStartFov * (pinchStartDistance / distance), LOOK_FOV_MIN, LOOK_FOV_MAX);
        camera.fov = lookFov;
        camera.updateProjectionMatrix();
      }
      return; // un pincement à 2 doigts ne doit pas aussi faire tourner la caméra
    }
  }
  if (!lookAroundActive || !lookDragLastPos || activeTouches.size >= 2) return;
  const dx = event.clientX - lookDragLastPos.x;
  const dy = event.clientY - lookDragLastPos.y;
  lookDragLastPos = { x: event.clientX, y: event.clientY };
  lookYaw -= dx * LOOK_SENSITIVITY;
  lookPitch = THREE.MathUtils.clamp(lookPitch - dy * LOOK_SENSITIVITY, -LOOK_MAX_PITCH, LOOK_MAX_PITCH);
  applyLookRotation();
});

function releaseTouch(event: PointerEvent) {
  lookDragLastPos = null;
  if (event.pointerType === "touch") {
    activeTouches.delete(event.pointerId);
    if (activeTouches.size < 2) pinchStartDistance = null;
  }
}
canvas.addEventListener("pointerup", releaseTouch);
canvas.addEventListener("pointercancel", releaseTouch);

// Zoom molette (vues "regarder autour de soi" uniquement — cf. lookFov) :
// { passive: false } + preventDefault pour empêcher le scroll de la page
// pendant qu'on zoome dans la scène 3D.
canvas.addEventListener(
  "wheel",
  (event) => {
    if (!lookAroundActive) return;
    event.preventDefault();
    lookFov = THREE.MathUtils.clamp(lookFov + event.deltaY * 0.05, LOOK_FOV_MIN, LOOK_FOV_MAX);
    camera.fov = lookFov;
    camera.updateProjectionMatrix();
  },
  { passive: false },
);

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
    } else if ((state.view === "sky2d" || state.view === "exoSky") && selectedConstellationName) {
      // En pratique inatteignable tant que la sphère de picking des zones
      // couvre tout le ciel (cf. SKY_ZONE_HIT_ID) — gardé par cohérence si
      // cette couverture venait à changer.
      selectedConstellationName = null;
      if (sky2dHighlightSprite && sky2dNameSprite) applyZoneSelection(sky2dZones, sky2dHighlightSprite, sky2dNameSprite, null);
      if (state.view === "exoSky") {
        const system = findSystem(state.systemId);
        const planet = findPlanet(system, state.planetName);
        renderExoSkyInfoPanel(planet, exoSkySunDistanceLy);
      } else {
        infoPanelEl.classList.remove("visible");
        infoPanelEl.innerHTML = "";
      }
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
  } else if (state.view === "sky2d" || state.view === "exoSky") {
    if (id === SKY_ZONE_HIT_ID) {
      // Sélection "par zone" : la sphère de picking couvre tout le ciel sans
      // trou (cf. findNearestZone), donc un clic qui ne touche aucune étoile/
      // aucun système précis retombe forcément ici — on déduit la
      // constellation la plus proche du point cliqué plutôt que d'exiger un
      // clic pixel-parfait sur le nom (à peine visible).
      const zone = findNearestZone(sky2dZones, intersects[0].point);
      if (zone) {
        // Une constellation n'est pas un astre "explorable" : pas de losange
        // ni d'encart "Explorer", juste le panneau d'info + la surbrillance
        // directs — on referme d'abord une sélection en attente éventuelle
        // pour éviter que les deux UI ne s'affichent en même temps.
        if (pendingSelection) clearPendingSelection();
        selectedConstellationName = zone.name;
        if (sky2dHighlightSprite && sky2dNameSprite) {
          applyZoneSelection(sky2dZones, sky2dHighlightSprite, sky2dNameSprite, {
            rawName: zone.name,
            displayName: constellationDisplayName(zone.name),
          });
        }
        renderConstellationInfoPanel(zone.name);
      }
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
  // Scintillement du halo solaire (vue exoSky) : pulse de taille + opacité,
  // demandé explicitement ("faire scintiller le soleil en force") pour que
  // l'astre attire l'œil au lieu de se fondre dans le champ d'étoiles fixe.
  if (state.view === "exoSky" && exoSkySunGlowSprite) {
    const nowSec = performance.now() / 1000;
    const pulse = 0.85 + 0.3 * Math.sin(nowSec * 3.2) + 0.1 * Math.sin(nowSec * 7.7);
    exoSkySunGlowSprite.scale.set(150 * pulse, 150 * pulse, 1);
    (exoSkySunGlowSprite.material as THREE.SpriteMaterial).opacity = 0.75 + 0.25 * Math.sin(nowSec * 3.2 + 1.2);
  }
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
Promise.all([
  document.fonts.load('700 32px "Orbitron"'),
  loadSeedData(),
  loadConstellationData(),
  loadConstellationInfo(),
]).then(
  ([, data, sky, info]) => {
    seed = data;
    constellationSky = sky;
    constellationInfo = info;
    refreshSearchIndex();
    render();
    animate();
  },
);
