interface DailyPoint { date: string; count: number; }
interface CountryRow { country: string; country_code: string | null; count: number; }
interface MonthlyRow { year_month: string; view_count: number; distinct_countries: number; distinct_ips: number; }
interface RecentView {
  created_at: string | null;
  path: string | null;
  country: string | null;
  country_code: string | null;
  city: string | null;
  user_agent: string | null;
}
interface Stats {
  total: number;
  today: number;
  last7: number;
  last30: number;
  distinct_ips_30: number;
  daily: DailyPoint[];
  countries: CountryRow[];
  monthly: MonthlyRow[];
  recent: RecentView[];
}

function flagEmoji(countryCode: string | null): string {
  if (!countryCode || countryCode.length !== 2 || countryCode === "LO") return "🌐";
  const A = 0x1f1e6;
  const chars = countryCode.toUpperCase().split("").map((c) => A + (c.charCodeAt(0) - 65));
  if (chars.some((c) => c < A || c > A + 25)) return "🌐";
  return String.fromCodePoint(...chars);
}

function setView(state: "login" | "dashboard") {
  document.body.classList.toggle("state-login", state === "login");
  document.body.classList.toggle("state-dashboard", state === "dashboard");
}

async function checkSession(): Promise<boolean> {
  const r = await fetch("/api/admin/me", { credentials: "same-origin" });
  return r.ok;
}

async function login(password: string): Promise<boolean> {
  const r = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ password }),
  });
  return r.ok;
}

async function loadStats(): Promise<Stats | null> {
  const r = await fetch("/api/admin/stats", { credentials: "same-origin" });
  if (!r.ok) return null;
  return r.json();
}

function renderKpis(stats: Stats) {
  const grid = document.getElementById("kpi-grid")!;
  const items: [string, number][] = [
    ["Total (historique)", stats.total],
    ["Aujourd'hui", stats.today],
    ["7 derniers jours", stats.last7],
    ["30 derniers jours", stats.last30],
    ["Visiteurs distincts (30j)", stats.distinct_ips_30],
  ];
  grid.innerHTML = items
    .map(([label, value]) => `<div class="kpi-card"><div class="kpi-value">${value}</div><div class="kpi-label">${label}</div></div>`)
    .join("");
}

function renderDailyBars(daily: DailyPoint[]) {
  const container = document.getElementById("daily-bars")!;
  if (!daily.length) {
    container.innerHTML = `<div class="empty">Aucune donnée sur cette période.</div>`;
    return;
  }
  const max = Math.max(...daily.map((d) => d.count), 1);
  container.innerHTML = daily
    .map((d) => {
      const heightPct = Math.round((d.count / max) * 100);
      const label = d.date.slice(5); // MM-DD
      return `<div class="bar-col"><div class="bar" style="height:${heightPct}%" title="${d.date} : ${d.count}"></div><div class="bar-label">${label}</div></div>`;
    })
    .join("");
}

function renderCountries(countries: CountryRow[]) {
  const tbody = document.querySelector("#countries-table tbody")!;
  if (!countries.length) {
    tbody.innerHTML = `<tr><td colspan="2" class="empty">Aucune vue géolocalisée pour l'instant.</td></tr>`;
    return;
  }
  tbody.innerHTML = countries
    .map((c) => `<tr><td>${flagEmoji(c.country_code)} ${c.country}</td><td class="num">${c.count}</td></tr>`)
    .join("");
}

function renderRecent(recent: RecentView[]) {
  const tbody = document.querySelector("#recent-table tbody")!;
  if (!recent.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty">Aucune visite enregistrée.</td></tr>`;
    return;
  }
  tbody.innerHTML = recent
    .map((r) => {
      const date = r.created_at ? r.created_at.replace("T", " ").slice(0, 19) : "?";
      const loc = r.country ? `${flagEmoji(r.country_code)} ${r.city ? r.city + ", " : ""}${r.country}` : "—";
      return `<tr><td>${date}</td><td>${r.path ?? "—"}</td><td>${loc}</td><td class="ua-cell" title="${r.user_agent ?? ""}">${r.user_agent ?? "—"}</td></tr>`;
    })
    .join("");
}

function renderMonthly(monthly: MonthlyRow[]) {
  const tbody = document.querySelector("#monthly-table tbody")!;
  if (!monthly.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty">Pas encore d'historique archivé (agrégation après 30 jours).</td></tr>`;
    return;
  }
  tbody.innerHTML = monthly
    .map((m) => `<tr><td>${m.year_month}</td><td class="num">${m.view_count}</td><td class="num">${m.distinct_countries}</td><td class="num">${m.distinct_ips}</td></tr>`)
    .join("");
}

async function renderDashboard() {
  const stats = await loadStats();
  if (!stats) {
    setView("login");
    return;
  }
  renderKpis(stats);
  renderDailyBars(stats.daily);
  renderCountries(stats.countries);
  renderRecent(stats.recent);
  renderMonthly(stats.monthly);
  setView("dashboard");
}

function bindForm() {
  const form = document.getElementById("login-form") as HTMLFormElement;
  const input = document.getElementById("password-input") as HTMLInputElement;
  const submitBtn = document.getElementById("login-submit") as HTMLButtonElement;
  const errorEl = document.getElementById("login-error")!;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    submitBtn.disabled = true;
    try {
      const ok = await login(input.value);
      if (ok) {
        input.value = "";
        await renderDashboard();
      } else {
        errorEl.textContent = "Mot de passe incorrect.";
      }
    } catch {
      errorEl.textContent = "Erreur réseau — réessaie.";
    } finally {
      submitBtn.disabled = false;
    }
  });

  document.getElementById("logout-btn")!.addEventListener("click", async () => {
    await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" });
    setView("login");
  });
}

async function init() {
  bindForm();
  if (await checkSession()) {
    await renderDashboard();
  } else {
    setView("login");
  }
}

init();
