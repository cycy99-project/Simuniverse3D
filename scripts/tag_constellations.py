"""One-shot post-traitement : ajoute/actualise le champ star.constellation dans
data/seed_systems.json (et sa copie frontend/public/data/) SANS repasser par
ingest.py::main() — ce dernier ne connaît que les 4 hôtes de HOSTNAMES, alors
que seed_systems.json committé contient 14 systèmes (les 10 en plus ont été
ajoutés directement au JSON, pas via une mise à jour de HOSTNAMES). Relancer
ingest.py écraserait ces systèmes ; ce script se contente de charger le JSON
existant, taguer chaque étoile, et réécrire au même endroit.

Constellation IAU officielle via astropy.coordinates.get_constellation() (à
partir de ra/dec) — null pour le Soleil (ra/dec absents, on est dedans).
"""
import json
from pathlib import Path

from astropy.coordinates import SkyCoord, get_constellation
import astropy.units as u


def constellation_for(ra, dec):
    if ra is None or dec is None:
        return None
    coord = SkyCoord(ra=ra * u.degree, dec=dec * u.degree, frame="icrs")
    return get_constellation(coord)


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    paths = [
        root / "data" / "seed_systems.json",
        root / "frontend" / "public" / "data" / "seed_systems.json",
    ]

    canonical = json.loads(paths[0].read_text(encoding="utf-8"))
    for system in canonical["systems"]:
        star = system["star"]
        star["constellation"] = constellation_for(star.get("ra"), star.get("dec"))
        print(f"  - {system['name']}: {star['constellation']}")

    payload = json.dumps(canonical, indent=2, ensure_ascii=False)
    for out_path in paths:
        out_path.write_text(payload, encoding="utf-8")
    print(f"Constellation ajoutée pour {len(canonical['systems'])} système(s), écrit dans {len(paths)} emplacement(s)")


if __name__ == "__main__":
    main()
