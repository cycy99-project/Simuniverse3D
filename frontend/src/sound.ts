// Bip de confirmation synthétique (Web Audio, aucun fichier audio externe) :
// chirp montant (corps, triangle passé en passe-bas pour rester chaud plutôt
// que criard) + harmonique quinte discrète (shimmer) — pas de question de
// licence contrairement à un sample importé, cohérent avec le thème sci-fi de
// l'appli. Version délibérément plus simple qu'une itération précédente qui
// ajoutait un tick de bruit percussif + un écho : jugés trop agressifs par
// rapport à un premier jet plus sobre (sine deux-tons) — on revient vers ce
// premier caractère tout en gardant le shimmer, qui lui n'était pas en cause.
let sharedContext: AudioContext | null = null;

function getContext(): AudioContext {
  if (!sharedContext) sharedContext = new AudioContext();
  return sharedContext;
}

export function playSelectSound(): void {
  const ctx = getContext();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const now = ctx.currentTime;

  const master = ctx.createGain();
  master.gain.value = 0.22;
  master.connect(ctx.destination);

  // Filtre passe-bas doux sur tout le son : adoucit le triangle (plus riche
  // en harmoniques qu'un sine) sans le faire sonner comme un simple bip plat.
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 2600;
  lowpass.Q.value = 0.3;
  lowpass.connect(master);

  // Corps du son : sweep de fréquence montant, type confirmation HUD.
  const sweep = ctx.createOscillator();
  sweep.type = "triangle";
  sweep.frequency.setValueAtTime(680, now);
  sweep.frequency.exponentialRampToValueAtTime(1400, now + 0.09);
  const sweepGain = ctx.createGain();
  sweepGain.gain.setValueAtTime(0.0001, now);
  sweepGain.gain.linearRampToValueAtTime(1, now + 0.012);
  sweepGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  sweep.connect(sweepGain).connect(lowpass);
  sweep.start(now);
  sweep.stop(now + 0.24);

  // Harmonique (quinte au-dessus, discrète) : donne un léger shimmer sans
  // épaissir le son comme le ferait une simple octave.
  const shimmer = ctx.createOscillator();
  shimmer.type = "sine";
  shimmer.frequency.setValueAtTime(680 * 1.5, now);
  shimmer.frequency.exponentialRampToValueAtTime(1400 * 1.5, now + 0.09);
  const shimmerGain = ctx.createGain();
  shimmerGain.gain.setValueAtTime(0.0001, now);
  shimmerGain.gain.linearRampToValueAtTime(0.25, now + 0.012);
  shimmerGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  shimmer.connect(shimmerGain).connect(lowpass);
  shimmer.start(now);
  shimmer.stop(now + 0.2);
}
