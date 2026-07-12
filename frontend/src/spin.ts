import * as THREE from "three";

// Objet à faire tourner (rotation.y) à chaque frame — utilisé aussi bien
// pour la rotation d'une planète sur elle-même que pour la révolution d'une
// lune autour de sa planète (pivot contenant la lune décalée en x).
export interface Spinnable {
  group: THREE.Object3D;
  speed: number; // radians / frame, signe = sens de rotation
}
