"""One-shot ingestion: NASA Exoplanet Archive (TAP/ADQL) -> data/seed_systems.json

Interroge la table `ps` (Planetary Systems) pour les paramètres orbitaux,
physiques et stellaires réels des systèmes exoplanétaires "phares" du MVP.
Le Système Solaire n'est pas dans cette table (c'est une archive d'exoplanètes)
donc il est codé en dur avec des données connues, et sert de cas de
calibration pour l'heuristique d'atmosphère du frontend.

Les molécules atmosphériques détectées par JWST sont codées en dur à partir
de la littérature publiée (le schéma TAP exact de la table "Atmospheric
Spectroscopy" n'est pas documenté publiquement de façon fiable ; pour un MVP
mieux vaut des faits établis que des colonnes devinées).
"""
import json
import sys
from pathlib import Path
from urllib.parse import quote

import requests

TAP_URL = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"

HOSTNAMES = ["WASP-39", "K2-18", "HD 189733", "TRAPPIST-1"]

ADQL = """
SELECT pl_name, hostname, sy_dist, ra, dec, pl_orbsmax, pl_rade, pl_bmasse,
       pl_eqt, discoverymethod, disc_year, st_teff, st_rad, st_mass, st_spectype
FROM ps
WHERE default_flag = 1
AND hostname IN ({})
""".strip()

# Certains champs sont NULL sur la ligne default_flag=1 (bug de données connu
# côté archive, ex. TRAPPIST-1). Valeurs de repli issues de la littérature.
FALLBACK_SY_DIST_PC = {
    "TRAPPIST-1": 12.43,
}

# HD 189733 b : la ligne default_flag=1 de l'archive a pl_orbsmax et pl_eqt
# à NULL (solution de référence différente selon les publications RV).
# Valeurs de repli issues de la littérature (Bouchy et al. 2005 ; Charbonneau et al. 2008).
FALLBACK_PLANET_FIELDS = {
    "HD 189733 b": {"pl_orbsmax": 0.031, "pl_eqt": 1200},
}

# Molécules atmosphériques connues (littérature publiée), par planète.
KNOWN_ATMOSPHERES = {
    "WASP-39 b": {
        "source": "jwst_spectroscopy",
        "molecules": ["CO2", "H2O", "SO2", "CO"],
        "note": "Première détection nette de CO2 par JWST (2022) ; SO2 = signature de photochimie.",
        "note_en": "First clear CO2 detection by JWST (2022); SO2 is a signature of active photochemistry.",
        "spectrum_ref": "Ahrer et al. 2023, Nature — JWST NIRSpec/NIRISS",
    },
    "K2-18 b": {
        "source": "jwst_spectroscopy",
        "molecules": ["CH4", "CO2"],
        "note": "Candidate 'hycéenne' (océan sous atmosphère riche en H2). Détection DMS annoncée mais controversée/non confirmée.",
        "note_en": "'Hycean' candidate (ocean under a H2-rich atmosphere). A DMS detection was announced but remains controversial/unconfirmed.",
        "spectrum_ref": "Madhusudhan et al. 2023, ApJL — JWST NIRISS/NIRSpec",
    },
    "HD 189733 b": {
        "source": "jwst_spectroscopy",
        "molecules": ["H2O", "CO2", "SO2"],
        "note": "Jupiter chaud bleu (diffusion de Rayleigh, observée en lumière visible par Hubble).",
        "note_en": "Blue hot Jupiter (Rayleigh scattering, observed in visible light by Hubble).",
        "spectrum_ref": "Grillmair et al. / Fu et al. 2024 — Hubble + JWST MIRI",
    },
    # TRAPPIST-1 : plusieurs planètes sans atmosphère épaisse détectée (résultats notables par leur absence).
    "TRAPPIST-1 b": {
        "source": "no_detection",
        "molecules": [],
        "note": "Pas d'atmosphère significative détectée (JWST MIRI, 2023) : probablement un rocher nu.",
        "note_en": "No significant atmosphere detected (JWST MIRI, 2023): likely a bare rock.",
        "spectrum_ref": "Greene et al. 2023, Nature",
    },
    "TRAPPIST-1 c": {
        "source": "no_detection",
        "molecules": [],
        "note": "Pas d'atmosphère épaisse type CO2 détectée (JWST MIRI, 2023).",
        "note_en": "No thick CO2-type atmosphere detected (JWST MIRI, 2023).",
        "spectrum_ref": "Zieba et al. 2023, Nature",
    },
}

# Lunes principales du Système Solaire (données réelles, source Wikipedia/JPL) :
# rayon moyen (km), demi-grand axe autour de la planète (km), période orbitale
# sidérale en jours (négative = orbite rétrograde, ex. Triton). Limité aux
# lunes majeures/notables par planète (pas la totalité, ex. Jupiter en a 95)
# pour rester lisible ; couleurs approximatives d'après l'imagerie connue.
#
# inclination_deg : inclinaison RÉELLE (Wikipedia, tables NASA) du plan
# orbital par rapport à l'équateur de la planète — magnitude 0-90° (le sens
# rétrograde est déjà porté par le signe de period_days, donc pour Triton on
# stocke l'écart angulaire 180-156.885=23.115° plutôt que 156.885° brut, pour
# ne pas compter deux fois la même information). La plupart des grandes lunes
# sont à moins de 1-2° (accrétion depuis un disque équatorial), à l'exception
# notable de Japet (7.57°), Miranda (4.42°) et Triton (lune capturée, ~23°
# d'écart en plus d'être rétrograde).
MOONS = {
    "Terre": [
        {"name": "Lune", "radius_km": 1738, "orbit_km": 384_399, "period_days": 27.32,
         "color": "#a8a8a2", "texture": "/textures/2k_moon.jpg", "inclination_deg": 5.145},
    ],
    "Mars": [
        {"name": "Phobos", "radius_km": 11.3, "orbit_km": 9_380, "period_days": 0.32, "color": "#7a6f60",
         "inclination_deg": 1.093},
        {"name": "Deimos", "radius_km": 6.2, "orbit_km": 23_460, "period_days": 1.26, "color": "#8a8075",
         "inclination_deg": 0.93},
    ],
    "Jupiter": [
        {"name": "Io", "radius_km": 1821.6, "orbit_km": 421_800, "period_days": 1.77, "color": "#d9c36a",
         "texture": "/textures/2k_io.jpg", "inclination_deg": 0.05},
        {"name": "Europe", "radius_km": 1560.8, "orbit_km": 671_100, "period_days": 3.55, "color": "#d8cdb8",
         "texture": "/textures/2k_europa.jpg", "inclination_deg": 0.47},
        {"name": "Ganymède", "radius_km": 2634.1, "orbit_km": 1_070_400, "period_days": 7.16, "color": "#9c8f7a",
         "texture": "/textures/2k_ganymede.jpg", "inclination_deg": 0.2},
        {"name": "Callisto", "radius_km": 2410.3, "orbit_km": 1_882_700, "period_days": 16.69, "color": "#6e6258",
         "texture": "/textures/2k_callisto.jpg", "inclination_deg": 0.192},
    ],
    "Saturne": [
        {"name": "Mimas", "radius_km": 198, "orbit_km": 185_539, "period_days": 0.9, "color": "#9a958c",
         "inclination_deg": 1.53},
        {"name": "Encelade", "radius_km": 252, "orbit_km": 237_948, "period_days": 1.4, "color": "#eef2f5",
         "inclination_deg": 0.02},
        {"name": "Téthys", "radius_km": 531, "orbit_km": 294_619, "period_days": 1.9, "color": "#d8dbe0",
         "inclination_deg": 1.12},
        {"name": "Dioné", "radius_km": 561.5, "orbit_km": 377_396, "period_days": 2.7, "color": "#c9ccd1",
         "inclination_deg": 0.02},
        {"name": "Rhéa", "radius_km": 763.5, "orbit_km": 527_108, "period_days": 4.5, "color": "#cfd2d6",
         "inclination_deg": 0.33},
        {"name": "Titan", "radius_km": 2574.5, "orbit_km": 1_221_870, "period_days": 16, "color": "#d9a066",
         "inclination_deg": 0.31},
        {"name": "Japet", "radius_km": 735, "orbit_km": 3_560_820, "period_days": 79, "color": "#8a7d6e",
         "inclination_deg": 7.57},
    ],
    "Uranus": [
        {"name": "Miranda", "radius_km": 235.8, "orbit_km": 129_846, "period_days": 1.4135, "color": "#a8a29c",
         "inclination_deg": 4.42},
        {"name": "Ariel", "radius_km": 578.9, "orbit_km": 190_929, "period_days": 2.5204, "color": "#b8b6b0",
         "inclination_deg": 0.026},
        {"name": "Umbriel", "radius_km": 584.7, "orbit_km": 265_986, "period_days": 4.1442, "color": "#6b6862",
         "inclination_deg": 0.083},
        {"name": "Titania", "radius_km": 788.4, "orbit_km": 436_298, "period_days": 8.7059, "color": "#948d84",
         "inclination_deg": 0.114},
        {"name": "Obéron", "radius_km": 761.4, "orbit_km": 583_511, "period_days": 13.463, "color": "#8f887e",
         "inclination_deg": 0.125},
    ],
    "Neptune": [
        {"name": "Triton", "radius_km": 1352.5, "orbit_km": 354_759, "period_days": -5.876854, "color": "#e8d6d0",
         "inclination_deg": 23.115},
        {"name": "Néréide", "radius_km": 178.5, "orbit_km": 5_513_900, "period_days": 360.14, "color": "#9a978f",
         "inclination_deg": 7.09},
    ],
    "Pluton": [
        {"name": "Charon", "radius_km": 606, "orbit_km": 19_591, "period_days": 6.3872, "color": "#ab9c8f",
         "texture": "/textures/2k_charon.jpg", "inclination_deg": 0.08},
    ],
}

SOLAR_SYSTEM = {
    "id": "sol",
    "name": "Système Solaire",
    "star": {
        "name": "Soleil",
        "spectype": "G2V",
        "st_teff": 5778,
        "st_rad": 1.0,
        "sy_dist": 0.0,
        "ra": None,
        "dec": None,
        "texture": "/textures/2k_sun.jpg",
    },
    "planets": [
        {"name": "Mercure", "pl_orbsmax": 0.39, "pl_rade": 0.383, "pl_bmasse": 0.055, "pl_eqt": 440,
         "source": "known", "molecules": [], "color": "#9c9691", "texture": "/textures/2k_mercury.jpg",
         "rotation_hours": 1407.6, "orbit_inclination_deg": 7.005, "moons_count_known": 0,
         "note": "Exosphère quasi inexistante, pas d'atmosphère significative.",
         "note_en": "Virtually no exosphere, no significant atmosphere."},
        {"name": "Vénus", "pl_orbsmax": 0.72, "pl_rade": 0.949, "pl_bmasse": 0.815, "pl_eqt": 737,
         "source": "known", "molecules": ["CO2", "SO2"], "color": "#e8d9a0", "texture": "/textures/2k_venus_surface.jpg",
         "rotation_hours": -5832.5, "orbit_inclination_deg": 3.395, "moons_count_known": 0,
         "note": "Atmosphère dense de CO2, nuages d'acide sulfurique, effet de serre extrême.",
         "note_en": "Dense CO2 atmosphere, sulfuric acid clouds, extreme greenhouse effect."},
        {"name": "Terre", "pl_orbsmax": 1.0, "pl_rade": 1.0, "pl_bmasse": 1.0, "pl_eqt": 288,
         "source": "known", "molecules": ["N2", "O2", "H2O"], "color": "#4f83cc", "texture": "/textures/2k_earth_daymap.jpg",
         "rotation_hours": 23.93, "orbit_inclination_deg": 0.0, "moons_count_known": 1,
         "note": "Référence : azote/oxygène, vapeur d'eau, nuages variables.",
         "note_en": "Reference case: nitrogen/oxygen, water vapor, variable cloud cover."},
        {"name": "Mars", "pl_orbsmax": 1.52, "pl_rade": 0.532, "pl_bmasse": 0.107, "pl_eqt": 210,
         "source": "known", "molecules": ["CO2"], "color": "#b1440e", "texture": "/textures/2k_mars.jpg",
         "rotation_hours": 24.62, "orbit_inclination_deg": 1.850, "moons_count_known": 2,
         "note": "Atmosphère de CO2 très fine, peu de nuages.",
         "note_en": "Very thin CO2 atmosphere, few clouds."},
        {"name": "Cérès", "pl_orbsmax": 2.77, "pl_rade": 0.0737, "pl_bmasse": 0.00016, "pl_eqt": 172,
         "source": "known", "molecules": [], "color": "#8b8378", "texture": "/textures/2k_ceres.jpg",
         "rotation_hours": 9.074170, "dwarf": True, "orbit_inclination_deg": 10.59, "moons_count_known": 0,
         "note": "Planète naine, plus gros corps de la ceinture d'astéroïdes, pas d'atmosphère notable.",
         "note_en": "Dwarf planet, largest body in the asteroid belt, no notable atmosphere."},
        {"name": "Jupiter", "pl_orbsmax": 5.20, "pl_rade": 11.21, "pl_bmasse": 317.8, "pl_eqt": 165,
         "source": "known", "molecules": ["H2", "He", "CH4"], "color": "#c8a165", "texture": "/textures/2k_jupiter.jpg",
         "rotation_hours": 9.93, "orbit_inclination_deg": 1.303, "moons_count_known": 101,
         "note": "Géante gazeuse, bandes de nuages d'ammoniac.",
         "note_en": "Gas giant, banded ammonia cloud structure."},
        {"name": "Saturne", "pl_orbsmax": 9.58, "pl_rade": 9.45, "pl_bmasse": 95.2, "pl_eqt": 134,
         "source": "known", "molecules": ["H2", "He", "CH4"], "color": "#e3c98f", "texture": "/textures/2k_saturn.jpg",
         "rotation_hours": 10.66, "orbit_inclination_deg": 2.485, "moons_count_known": 292,
         "ring": {"inner_radius_ratio": 1.2, "outer_radius_ratio": 2.3, "color": "#c9b280",
                   "texture": "/textures/2k_saturn_ring_alpha.png"},
         "note": "Géante gazeuse, atmosphère similaire à Jupiter, plus pâle. Anneaux de glace/roche très étendus.",
         "note_en": "Gas giant, Jupiter-like atmosphere, paler tones. Extensive ice/rock ring system."},
        {"name": "Uranus", "pl_orbsmax": 19.2, "pl_rade": 4.01, "pl_bmasse": 14.5, "pl_eqt": 76,
         "source": "known", "molecules": ["H2", "He", "CH4"], "color": "#a6e1e0", "texture": "/textures/2k_uranus.jpg",
         "rotation_hours": -17.24, "orbit_inclination_deg": 0.773, "moons_count_known": 29,
         "ring": {"inner_radius_ratio": 1.6, "outer_radius_ratio": 2.0, "color": "#5c5850", "texture": None},
         "note": "Géante de glaces, CH4 donne la teinte bleu-vert. Anneaux fins et sombres (découverts en 1977).",
         "note_en": "Ice giant, CH4 gives it a pale cyan tint. Thin, dark rings (discovered in 1977)."},
        {"name": "Neptune", "pl_orbsmax": 30.1, "pl_rade": 3.88, "pl_bmasse": 17.1, "pl_eqt": 72,
         "source": "known", "molecules": ["H2", "He", "CH4"], "color": "#3457d5", "texture": "/textures/2k_neptune.jpg",
         "rotation_hours": 16.11, "orbit_inclination_deg": 1.770, "moons_count_known": 18,
         "note": "Géante de glaces, bleu plus soutenu qu'Uranus.",
         "note_en": "Ice giant, deeper blue than Uranus."},
        {"name": "Pluton", "pl_orbsmax": 39.482, "pl_rade": 0.1866, "pl_bmasse": 0.00218, "pl_eqt": 44,
         "source": "known", "molecules": ["N2", "CH4", "CO"], "color": "#c9b29b", "texture": "/textures/2k_pluto.jpg",
         "rotation_hours": -153.293, "dwarf": True, "orbit_inclination_deg": 17.16, "moons_count_known": 5,
         "note": "Planète naine, rotation rétrograde (inclinaison axiale 120°), fine atmosphère saisonnière d'azote.",
         "note_en": "Dwarf planet, retrograde rotation (120° axial tilt), thin seasonal nitrogen atmosphere."},
        {"name": "Éris", "pl_orbsmax": 67.69, "pl_rade": 0.1826, "pl_bmasse": 0.00274, "pl_eqt": 42,
         "source": "known", "molecules": ["N2", "CH4"], "color": "#e8e4dc", "texture": None,
         "rotation_hours": 378.864, "dwarf": True, "orbit_inclination_deg": 44.04, "moons_count_known": 1,
         "note": "Planète naine la plus massive connue, ceinture de Kuiper diffuse, albédo très élevé (surface quasi blanche).",
         "note_en": "Most massive known dwarf planet, scattered Kuiper belt object, very high albedo (near-white surface)."},
    ],
}

for _planet in SOLAR_SYSTEM["planets"]:
    _planet["moons"] = MOONS.get(_planet["name"], [])
    _planet.setdefault("ring", None)


def fetch_exoplanet_systems() -> list[dict]:
    hostname_list = ", ".join(f"'{h}'" for h in HOSTNAMES)
    query = ADQL.format(hostname_list)
    resp = requests.get(TAP_URL, params={"query": query, "format": "json"}, timeout=30)
    resp.raise_for_status()
    rows = resp.json()
    if not rows:
        raise RuntimeError("La requête TAP n'a retourné aucune ligne — vérifier les hostnames ou l'ADQL.")

    systems_by_host: dict[str, dict] = {}
    for row in rows:
        host = row["hostname"]
        system = systems_by_host.setdefault(host, {
            "id": host.lower().replace(" ", "-"),
            "name": host,
            "star": {
                "name": host,
                "spectype": row.get("st_spectype"),
                "st_teff": row.get("st_teff"),
                "st_rad": row.get("st_rad"),
                "sy_dist": row.get("sy_dist") or FALLBACK_SY_DIST_PC.get(host),
                "ra": row.get("ra"),
                "dec": row.get("dec"),
            },
            "planets": [],
        })
        atmo = KNOWN_ATMOSPHERES.get(row["pl_name"], {
            "source": "no_data",
            "molecules": [],
            "note": "Aucune donnée de spectroscopie atmosphérique publique connue pour ce MVP.",
            "note_en": "No public atmospheric spectroscopy data known for this MVP.",
        })
        fallback = FALLBACK_PLANET_FIELDS.get(row["pl_name"], {})
        system["planets"].append({
            "name": row["pl_name"],
            "pl_orbsmax": row.get("pl_orbsmax") or fallback.get("pl_orbsmax"),
            "pl_rade": row.get("pl_rade"),
            "pl_bmasse": row.get("pl_bmasse"),
            "pl_eqt": row.get("pl_eqt") or fallback.get("pl_eqt"),
            "discoverymethod": row.get("discoverymethod"),
            "disc_year": row.get("disc_year"),
            "source": atmo["source"],
            "molecules": atmo["molecules"],
            "color": None,  # inconnu pour les exoplanètes : rendu dérivé de l'heuristique, jamais affirmé "exact"
            "texture": None,  # aucune image réelle disponible pour une exoplanète
            "rotation_hours": None,  # période de rotation non mesurée pour ces exoplanètes
            # Inclinaison orbitale MUTUELLE (par rapport au plan de référence du
            # système) non disponible : l'archive ne fournit que pl_orbincl, qui
            # est l'inclinaison par rapport à notre ligne de visée (proche de 90°
            # pour une planète en transit) — une notion différente qu'il serait
            # trompeur de réutiliser ici. Laissé à None : la vue "plans orbitaux
            # réels" reste donc coplanaire (honnête) pour les systèmes exoplanétaires.
            "orbit_inclination_deg": None,
            "moons": [],  # aucune exolune confirmée pour ces systèmes phares
            "ring": None,  # aucun anneau confirmé pour ces exoplanètes
            "note": atmo["note"],
            "note_en": atmo["note_en"],
            "spectrum_ref": atmo.get("spectrum_ref"),
        })

    # Trie les planètes par distance orbitale pour un affichage cohérent.
    for system in systems_by_host.values():
        system["planets"].sort(key=lambda p: (p["pl_orbsmax"] is None, p["pl_orbsmax"]))

    return list(systems_by_host.values())


def main() -> None:
    exoplanet_systems = fetch_exoplanet_systems()
    systems = [SOLAR_SYSTEM] + exoplanet_systems

    payload = json.dumps({"systems": systems}, indent=2, ensure_ascii=False)
    root = Path(__file__).resolve().parent.parent
    out_paths = [
        root / "data" / "seed_systems.json",  # copie canonique, committée
        root / "frontend" / "public" / "data" / "seed_systems.json",  # servie par Vite
    ]
    for out_path in out_paths:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(payload, encoding="utf-8")
    print(f"Écrit {len(systems)} systèmes dans {len(out_paths)} emplacements")
    for s in systems:
        print(f"  - {s['name']}: {len(s['planets'])} planète(s)")


if __name__ == "__main__":
    try:
        main()
    except requests.HTTPError as e:
        print(f"Erreur HTTP lors de la requête TAP : {e}", file=sys.stderr)
        sys.exit(1)
