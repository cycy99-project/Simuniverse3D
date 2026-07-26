import type { SeedData, ConstellationSkyData, ConstellationInfoMap } from "./types";

export async function loadSeedData(): Promise<SeedData> {
  const res = await fetch("/data/seed_systems.json");
  if (!res.ok) {
    throw new Error(`Impossible de charger seed_systems.json : ${res.status}`);
  }
  return res.json() as Promise<SeedData>;
}

export async function loadConstellationData(): Promise<ConstellationSkyData> {
  const res = await fetch("/data/constellations.json");
  if (!res.ok) {
    throw new Error(`Impossible de charger constellations.json : ${res.status}`);
  }
  return res.json() as Promise<ConstellationSkyData>;
}

export async function loadConstellationInfo(): Promise<ConstellationInfoMap> {
  const res = await fetch("/data/constellation_info.json");
  if (!res.ok) {
    throw new Error(`Impossible de charger constellation_info.json : ${res.status}`);
  }
  return res.json() as Promise<ConstellationInfoMap>;
}
