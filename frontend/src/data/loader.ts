import type { SeedData } from "./types";

export async function loadSeedData(): Promise<SeedData> {
  const res = await fetch("/data/seed_systems.json");
  if (!res.ok) {
    throw new Error(`Impossible de charger seed_systems.json : ${res.status}`);
  }
  return res.json() as Promise<SeedData>;
}
