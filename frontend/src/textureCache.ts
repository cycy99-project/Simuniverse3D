import * as THREE from "three";

const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();

export function loadTexture(url: string): THREE.Texture {
  const cached = cache.get(url);
  if (cached) return cached;
  const texture = loader.load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  cache.set(url, texture);
  return texture;
}

const chromaKeyCache = new Map<string, THREE.Texture>();

// Certaines illustrations (icônes des sondes Voyager, cf. voyager.ts) sont de
// vraies photos/illustrations SANS transparence réelle malgré un format RGBA
// (fond noir opaque, alpha=255 partout — vérifié pixel par pixel). Affichées
// en sprite au milieu d'une autre scène 3D, ce fond noir rectangulaire devient
// un artefact très visible dès qu'il chevauche un autre astre (ex. le Soleil :
// on voit un carré noir découpant le disque solaire au lieu de la sonde seule
// détourée). On retraite donc l'image au chargement pour rendre transparent
// tout pixel proche du noir, avec un léger fondu (pas un seuil brutal) pour
// éviter un contour dentelé — sans toucher au fichier source.
export function loadChromaKeyedTexture(url: string, low = 20, high = 55): THREE.Texture {
  const cached = chromaKeyCache.get(url);
  if (cached) return cached;
  const texture = new THREE.Texture();
  texture.colorSpace = THREE.SRGBColorSpace;
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (lum <= low) {
        data[i + 3] = 0;
      } else if (lum < high) {
        data[i + 3] = Math.round(((lum - low) / (high - low)) * 255);
      }
    }
    ctx.putImageData(imageData, 0, 0);
    texture.image = canvas;
    texture.needsUpdate = true;
  };
  image.src = url;
  chromaKeyCache.set(url, texture);
  return texture;
}
