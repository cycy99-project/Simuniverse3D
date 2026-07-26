// Beacon de fréquentation anonyme (path + IP + user-agent, géolocalisé côté
// backend) — cf. backend/app/geo.py. Best-effort : ne doit jamais bloquer ni
// faire échouer le chargement du site si l'API est indisponible.
export function trackPageView(): void {
  try {
    const payload = JSON.stringify({ path: window.location.pathname + window.location.search });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
    } else {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // silencieux — le tracking ne doit jamais impacter l'expérience utilisateur
  }
}
