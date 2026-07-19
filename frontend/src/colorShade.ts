// Éclaircit/assombrit une couleur en travaillant sur la LUMINOSITÉ en espace
// HSL plutôt qu'en mélangeant linéairement vers blanc/noir en RGB : un simple
// lerp RGB vers blanc désature fortement une couleur saturée à canal
// dominant (ex. le rouge-orangé d'une naine rouge, R≈255/G≈65/B≈0) — le canal
// faible bondit vers blanc et la teinte perçue dérive vers le jaune/beige.
// Un ajustement de luminosité en HSL préserve la teinte (h) et la saturation
// (s), donc les taches de granulation restent visuellement la même couleur
// d'étoile/planète, juste plus claires ou plus sombres.
function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function shade(hex: string, amount: number): string {
  const [h, s, l] = hexToHsl(hex);
  const newL = amount >= 0 ? l + (1 - l) * amount : l * (1 + amount);
  return hslToHex(h, s, Math.max(0, Math.min(1, newL)));
}
