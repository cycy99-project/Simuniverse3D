import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { loadSeedData } from "./data/loader";
import type { SeedData, SystemData, PlanetData, MoonData, AtmosphereSource } from "./data/types";
import { buildGalaxyScene } from "./scenes/galaxy";
import { buildSystemScene, STAR_CLICK_ID } from "./scenes/system";
import { buildAtmosphereScene } from "./scenes/atmosphere";
import { buildStarScene, type StarCompareTarget } from "./scenes/star";
import { VOYAGER_1, VOYAGER_2, currentDistanceAU, currentDistanceKm, type VoyagerInfo } from "./voyager";
import type { Spinnable } from "./spin";
import { computeEarthDistance } from "./distance";
import { t, getLang, setLang, onLangChange, type Lang } from "./i18n";
import { formatTemp, getTempUnit, setTempUnit, onTempUnitChange, type TempUnit } from "./units";
import { localizeName } from "./nameTranslations";

type AppState =
  | { view: "galaxy" }
  | { view: "system"; systemId: string }
  | { view: "star"; systemId: string }
  | { view: "atmosphere"; systemId: string; planetName: string };

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
const musicToggleEl = document.getElementById("music-toggle") as HTMLButtonElement;
const pauseToggleEl = document.getElementById("pause-toggle") as HTMLButtonElement;
const bgMusicEl = document.getElementById("bg-music") as HTMLAudioElement;

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
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

let scene = new THREE.Scene();
let clickable = new Map<THREE.Object3D, string>();
let seed: SeedData;
let state: AppState = { view: "galaxy" };
let compareWithEarth = false;
let starCompareMode: StarCompareTarget = null;
let selectedMoon: string | null = null;
let selectedVoyager: VoyagerInfo | null = null;
let spinGroups: Spinnable[] = [];
// Permet de figer les orbites (planète + satellites) pour cliquer précisément
// sur un satellite en mouvement ; ne réinitialise pas la sélection en cours.
let animationPaused = false;
// Préférence d'affichage globale (persiste entre navigations, comme la
// langue/l'unité) : n'a d'effet visible que pour le Système Solaire, seul
// système où l'on dispose de vraies inclinaisons orbitales (cf. types.ts).
let showRealOrbitalPlanes = false;

function formatRotationPeriod(rotationHours: number | null): string | null {
  if (rotationHours === null) return null;
  const hours = Math.abs(rotationHours);
  const value = hours >= 48 ? `${(hours / 24).toFixed(1)} j` : `${hours.toFixed(1)} h`;
  return rotationHours < 0 ? `${value} (${t("retrograde")})` : value;
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
  animationPaused = false;
  render();
}

function render() {
  disposeScene(scene);
  scene = new THREE.Scene();
  clickable = new Map();

  spinGroups = [];

  if (state.view === "galaxy") {
    const result = buildGalaxyScene(seed);
    scene.add(result.group);
    clickable = result.clickable;
    camera.position.copy(result.cameraPos);
    controls.target.set(0, 0, 0);
    renderBreadcrumb();
    renderInfoPanel(null);
    renderCompareToggle(null, false);
    orbitPlaneToggleEl.style.display = "none";
    renderPauseToggle(false);
    hintEl.textContent = t("hintGalaxy");
  } else if (state.view === "system") {
    const system = findSystem(state.systemId);
    const hasRealInclinations = system.planets.some((p) => p.orbit_inclination_deg != null);
    const result = buildSystemScene(system, showRealOrbitalPlanes && hasRealInclinations);
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
    renderPauseToggle(false);
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
    renderPauseToggle(false);
    hintEl.textContent = t("hintStar");
  } else {
    const system = findSystem(state.systemId);
    const planet = findPlanet(system, state.planetName);
    const isEarth = system.id === "sol" && planet.name === "Terre";
    const result = buildAtmosphereScene(planet, compareWithEarth && !isEarth ? findEarthPlanet(seed) : null);
    scene.add(result.group);
    clickable = result.clickable;
    spinGroups = result.spinnables;
    camera.position.copy(result.cameraPos);
    controls.target.set(0, 0, 0);
    const moon = selectedMoon ? planet.moons.find((m) => m.name === selectedMoon) ?? null : null;
    renderBreadcrumb(system, planet, undefined, moon ?? undefined);
    if (moon) {
      renderMoonInfoPanel(moon);
    } else {
      renderInfoPanel(system, planet, result.visual.description[getLang()]);
    }
    renderCompareToggle(planet, isEarth);
    orbitPlaneToggleEl.style.display = "none";
    renderPauseToggle(planet.moons.length > 0);
    hintEl.textContent = moon ? t("hintMoon") : t("hintAtmosphere");
  }
  controls.update();
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
  const radiusKm = star.st_rad != null ? Math.round(star.st_rad * 695_700).toLocaleString(getLang()) : "?";
  const note = isSun ? t("starKnownNote") : t("starArchiveNote");

  infoPanelEl.innerHTML = `
    <h2>☉ ${localizeName(star.name)}</h2>
    <p>${t("spectralType")} : ${star.spectype ?? t("unknown")}</p>
    <p>${t("temperature")} : ${formatTemp(star.st_teff)}</p>
    <p>${t("starRadius")} : ${star.st_rad ?? "?"} R☉ (${radiusKm} km)</p>
    <p>${t("distance")} : ${star.sy_dist ?? 0} pc</p>
    <p><strong>${t("starComposition")} :</strong> ${t("starCompositionText")}</p>
    <p><em style="font-size: 11px; opacity: 0.7;">${note}</em></p>
  `;
}

function renderVoyagerInfoPanel(v: VoyagerInfo) {
  infoPanelEl.classList.add("visible");
  const lang = getLang();
  const distanceAU = currentDistanceAU(v);
  const distanceKm = Math.round(currentDistanceKm(v));

  infoPanelEl.innerHTML = `
    <h2>${v.name}</h2>
    <p>${t("voyagerDistance")} : ${distanceAU.toFixed(2)} UA (${distanceKm.toLocaleString(lang)} km)</p>
    <p>${t("voyagerSpeed")} : ${v.speedKmS} km/s (${v.speedAUPerYear} UA/an)</p>
    <p><em style="font-size: 11px; opacity: 0.7;">${t("voyagerNote")}</em></p>
  `;
}

function goBack() {
  if (state.view === "atmosphere") setState({ view: "system", systemId: state.systemId });
  else if (state.view === "star") setState({ view: "system", systemId: state.systemId });
  else if (state.view === "system") setState({ view: "galaxy" });
}

window.addEventListener("keydown", (event) => {
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
  if (planet) {
    breadcrumbEl.append(" › ");
    const span = document.createElement("span");
    span.textContent = localizeName(planet.name);
    breadcrumbEl.appendChild(span);
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
    infoPanelEl.innerHTML = `
      <h2>${localizeName(system.name)}</h2>
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

  infoPanelEl.innerHTML = `
    <h2>${localizeName(planet.name)}</h2>
    <span class="badge ${badgeClass}">${t(SOURCE_LABEL_KEYS[planet.source])}</span>
    ${planet.dwarf ? `<span class="badge dwarf">${t("dwarfPlanetBadge")}</span>` : ""}
    <p>${t("orbitRadiusMass")} : ${planet.pl_orbsmax ?? "?"} UA — ${t("radius")} : ${planet.pl_rade ?? "?"} R⊕ — ${t("mass")} : ${planet.pl_bmasse ?? "?"} M⊕</p>
    <p>${t("equilibriumTemp")} : ${formatTemp(planet.pl_eqt)}</p>
    <p><strong>${t("molecules")} :</strong> ${molecules}</p>
    <p>${note}</p>
    ${planet.spectrum_ref ? `<p><em>${t("reference")} : ${planet.spectrum_ref}</em></p>` : ""}
    ${heuristicDescription ? `<p><strong>${t("visualRendering")} :</strong> ${heuristicDescription}</p>` : ""}
    ${rotationLine ? `<p>${t("rotationPeriod")} : ${rotationLine}</p>` : ""}
    <p><strong>${t("satellitesShown")} :</strong> ${shownMoons}${shownMoons ? ` (${moonsLine})` : ""}</p>
    <p><strong>${t("satellitesKnown")} :</strong> ${knownMoons}</p>
    <p><strong>${t("distanceFromEarth")} :</strong> ${earthInfo.distance[lang]}</p>
    <p><strong>${t("travelTime")} :</strong> ${earthInfo.travelTime[lang]}<br><em style="font-size: 11px; opacity: 0.7;">${t("travelTimeCaption")}</em></p>
  `;
}

function renderMoonInfoPanel(moon: MoonData) {
  infoPanelEl.classList.add("visible");
  const absPeriod = Math.abs(moon.period_days);
  const periodValue = absPeriod >= 2 ? `${absPeriod.toFixed(1)} j` : `${(absPeriod * 24).toFixed(1)} h`;
  const periodLine = moon.period_days < 0 ? `${periodValue} (${t("retrograde")})` : periodValue;
  const sourceNote = moon.texture ? t("moonPhotoNote") : t("moonColorNote");

  infoPanelEl.innerHTML = `
    <h2>${localizeName(moon.name)}</h2>
    <p>${t("moonRadius")} : ${moon.radius_km.toLocaleString(getLang())} km</p>
    <p>${t("moonOrbit")} : ${moon.orbit_km.toLocaleString(getLang())} km</p>
    <p>${t("moonPeriod")} : ${periodLine}</p>
    <p><em style="font-size: 11px; opacity: 0.7;">${sourceNote}</em></p>
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
    // Clic dans le vide : d'abord désélectionner la lune affichée, sinon
    // revenir au système (un niveau de retour à la fois).
    if (selectedMoon) {
      selectedMoon = null;
      render();
      return;
    }
    goBack();
    return;
  }

  if (intersects.length === 0) {
    // Clic dans le vide depuis la vue système : d'abord désélectionner une
    // sonde Voyager affichée, sinon revenir à la galaxie.
    if (state.view === "system") {
      if (selectedVoyager) {
        selectedVoyager = null;
        render();
        return;
      }
      goBack();
    }
    return;
  }

  const hit = intersects[0].object;
  const id = clickable.get(hit);
  if (!id) return;

  if (state.view === "galaxy") {
    setState({ view: "system", systemId: id });
  } else if (state.view === "system") {
    if (id === STAR_CLICK_ID) {
      setState({ view: "star", systemId: state.systemId });
    } else if (id === VOYAGER_1.id || id === VOYAGER_2.id) {
      selectedVoyager = id === VOYAGER_1.id ? VOYAGER_1 : VOYAGER_2;
      render();
    } else {
      setState({ view: "atmosphere", systemId: state.systemId, planetName: id });
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
  controls.update();
  renderer.render(scene, camera);
}

loadSeedData().then((data) => {
  seed = data;
  render();
  animate();
});
