// Compteur public de visiteurs (page d'accueil, pas le dashboard admin) :
// heartbeat périodique par onglet ouvert pour alimenter le "en ligne" côté
// backend (cf. backend/app/main.py, stockage en mémoire, pas de DB).
const HEARTBEAT_INTERVAL_MS = 20_000;
const SESSION_KEY = "u3d_session_id";

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function sendHeartbeat(): void {
  try {
    fetch("/api/public/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: getSessionId() }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // silencieux — ne doit jamais impacter l'expérience utilisateur
  }
}

export function startPresenceHeartbeat(): void {
  sendHeartbeat();
  setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
}

export async function fetchVisitorCounter(): Promise<{ total: number; online: number } | null> {
  try {
    const res = await fetch("/api/public/counter");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
