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
