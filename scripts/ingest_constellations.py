"""One-shot ingestion : ciel complet des 88 constellations IAU -> data/constellations.json

Deux sources externes combinées :

1. Figures en traits (stick figures) : `constellation_lines_simplified.dat` du
   dépôt GPLv3 dcf21/constellation-stick-figures (Dominic Ford, 2015-2025).
   Chaque constellation est une liste de "polylignes" référençant des étoiles
   par leur numéro Hipparcos (HIP). Un HIP suivi de "*" dans le fichier source
   signifie que cette étoile appartient en réalité à une autre constellation
   que celle en cours de tracé (marqueur retiré ici, seul l'identifiant HIP
   est conservé pour le rendu).

2. Positions/magnitudes des étoiles référencées : requêtées par lots sur le
   service TAP de VizieR (catalogue Hipparcos, table I/239/hip_main), pour
   chaque HIP unique apparaissant dans les figures (~1500 étoiles).

Licence : les données de figures (constellation_lines_simplified.dat) sont
GPLv3, Copyright 2015-2025 Dominic Ford — attribution ajoutée dans le crédit
frontend (index.html #credits).
"""
import json
import re
from pathlib import Path

import requests

LINES_URL = "https://raw.githubusercontent.com/dcf21/constellation-stick-figures/master/constellation_lines_simplified.dat"
VIZIER_TAP_URL = "https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync"
CHUNK_SIZE = 300


def fetch_stick_figures() -> list[dict]:
    """Parse constellation_lines_simplified.dat -> [{name, lines: [[hip,...],...]}]."""
    text = requests.get(LINES_URL, timeout=30).text
    constellations = []
    current = None
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        header = re.match(r"^\*\s*(.+)$", line)
        if header:
            current = {"name": header.group(1).strip(), "lines": []}
            constellations.append(current)
            continue
        if line.startswith("["):
            hips = [tok.strip().strip('"').rstrip("*") for tok in line.strip("[]").split(",")]
            current["lines"].append(hips)
    return constellations


def collect_unique_hips(constellations: list[dict]) -> list[str]:
    seen: set[str] = set()
    for constellation in constellations:
        for polyline in constellation["lines"]:
            seen.update(polyline)
    return sorted(seen, key=int)


def fetch_star_positions(hips: list[str]) -> dict[str, dict]:
    """Requête VizieR TAP par lots -> {hip: {ra, dec, mag}}."""
    stars: dict[str, dict] = {}
    for i in range(0, len(hips), CHUNK_SIZE):
        chunk = hips[i : i + CHUNK_SIZE]
        query = (
            "SELECT HIP, RAICRS, DEICRS, Vmag FROM \"I/239/hip_main\" "
            f"WHERE HIP IN ({','.join(chunk)})"
        )
        resp = requests.post(
            VIZIER_TAP_URL,
            data={"request": "doQuery", "lang": "adql", "query": query, "format": "json"},
            timeout=60,
        )
        resp.raise_for_status()
        payload = resp.json()
        columns = [col["name"] for col in payload["metadata"]]
        for row in payload["data"]:
            record = dict(zip(columns, row))
            if record["RAICRS"] is None or record["DEICRS"] is None:
                # Solution astrométrique absente pour ce HIP dans ce catalogue
                # (ex. HIP 55203) : traité comme non résolu, au même titre
                # qu'un HIP totalement absent de la réponse — sinon le null
                # est coercé en 0 côté JS et l'étoile atterrit à une position
                # arbitraire (500,0,0), créant un trait parasite dans la figure.
                continue
            hip = str(int(record["HIP"]))
            stars[hip] = {
                "ra": record["RAICRS"],
                "dec": record["DEICRS"],
                "mag": record.get("Vmag"),
            }
        print(f"  lot {i // CHUNK_SIZE + 1} : {len(chunk)} HIP demandés, {len(payload['data'])} reçus")
    return stars


def main() -> None:
    print("Téléchargement des figures (constellation_lines_simplified.dat)...")
    constellations = fetch_stick_figures()
    print(f"{len(constellations)} constellations parsées")

    hips = collect_unique_hips(constellations)
    print(f"{len(hips)} étoiles HIP uniques référencées")

    print("Requête VizieR TAP (positions/magnitudes)...")
    stars = fetch_star_positions(hips)
    missing = [hip for hip in hips if hip not in stars]
    if missing:
        print(f"  ATTENTION : {len(missing)} HIP sans position trouvée (ignorés au rendu) : {missing[:20]}...")

    payload = {"stars": stars, "constellations": constellations}

    root = Path(__file__).resolve().parent.parent
    out_paths = [
        root / "data" / "constellations.json",
        root / "frontend" / "public" / "data" / "constellations.json",
    ]
    serialized = json.dumps(payload, indent=2, ensure_ascii=False)
    for out_path in out_paths:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(serialized, encoding="utf-8")
    print(f"Écrit {len(out_paths)} fichier(s) : {len(stars)} étoiles, {len(constellations)} constellations")


if __name__ == "__main__":
    main()
