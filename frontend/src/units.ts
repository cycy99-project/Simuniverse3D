export type TempUnit = "K" | "C" | "F";

const STORAGE_KEY = "universe3d.tempUnit";

let currentUnit: TempUnit = (localStorage.getItem(STORAGE_KEY) as TempUnit | null) ?? "K";

const listeners = new Set<() => void>();

export function getTempUnit(): TempUnit {
  return currentUnit;
}

export function setTempUnit(unit: TempUnit): void {
  if (unit === currentUnit) return;
  currentUnit = unit;
  localStorage.setItem(STORAGE_KEY, unit);
  listeners.forEach((cb) => cb());
}

export function onTempUnitChange(cb: () => void): void {
  listeners.add(cb);
}

export function formatTemp(kelvin: number | null): string {
  if (kelvin === null) return "?";
  switch (currentUnit) {
    case "C":
      return `${(kelvin - 273.15).toFixed(0)} °C`;
    case "F":
      return `${((kelvin - 273.15) * 1.8 + 32).toFixed(0)} °F`;
    default:
      return `${kelvin.toFixed(0)} K`;
  }
}
