#!/usr/bin/env python3
"""Télécharge de vraies photos officielles NASA (domaine public, images-api.nasa.gov)
pour un corps céleste donné et les range dans img/<Systeme>/<Planete>/[<Satellite>/].

Usage (un corps à la fois, appelé en boucle par les agents) :
    python fetch_nasa_photos.py \
        --name "Io" --query "Io Jupiter moon volcano" \
        --system "Systeme_Solaire" --planet "Jupiter" --moon "Io" \
        --count 2 --out-fragment scratch/photos_Io.json

Écrit :
- les fichiers image dans img/<system>/<planet>/[<moon>/]
- une copie dans frontend/public/photos/<system>/<planet>/[<moon>/]
- un fragment JSON décrivant ce qui a été récupéré (title, credit, nasa_id,
  source_url, license="public domain (NASA)"), à fusionner ensuite dans le
  manifeste global.

Ne télécharge QUE depuis images-api.nasa.gov (recherche réelle par mots-clés,
pas d'URL devinée) : les images NASA sont domaine public, donc réhébergeables
sans risque de licence. Wikipedia reste un simple lien de recherche externe
(licences hétérogènes par fichier), pas une source de téléchargement ici.
"""
import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_ROOT = os.path.join(ROOT, "img")
PUBLIC_ROOT = os.path.join(ROOT, "frontend", "public", "photos")

BAD_TITLE_HINTS = (
    "illustration", "artist", "concept", "graphic", "chart", "diagram", "poster",
    "infographic", "map of", "temperature map", "spectromet", "detects", "plot",
    "model of", "radar", "schematic", "orbit diagram", "trajectory",
)


def search_nasa(query: str, count: int) -> list[dict]:
    url = "https://images-api.nasa.gov/search?" + urllib.parse.urlencode(
        {"q": query, "media_type": "image"}
    )
    with urllib.request.urlopen(url, timeout=30) as resp:
        data = json.load(resp)
    items = data.get("collection", {}).get("items", [])
    picked = []
    for item in items:
        meta = (item.get("data") or [{}])[0]
        title = meta.get("title", "")
        if any(h in title.lower() for h in BAD_TITLE_HINTS):
            continue
        links = item.get("links") or []
        orig = next((l["href"] for l in links if l.get("rel") == "canonical"), None)
        preview = next((l["href"] for l in links if l.get("rel") in ("preview", "alternate")), None)
        asset_url = orig or preview
        if not asset_url or not asset_url.lower().endswith((".jpg", ".jpeg", ".png")):
            continue
        picked.append({
            "title": title,
            "nasa_id": meta.get("nasa_id", ""),
            "date_created": meta.get("date_created", ""),
            "credit": meta.get("secondary_creator") or meta.get("center") or "NASA",
            "asset_url": asset_url,
            "source_url": f"https://images.nasa.gov/details/{meta.get('nasa_id', '')}",
        })
        if len(picked) >= count:
            break
    return picked


def safe_filename(nasa_id: str, url: str) -> str:
    ext = os.path.splitext(url)[1].lower() or ".jpg"
    base = re.sub(r"[^A-Za-z0-9_-]", "_", nasa_id) or "photo"
    return f"{base}{ext}"


def download(url: str, dest: str) -> int:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        content = resp.read()
    with open(dest, "wb") as f:
        f.write(content)
    return len(content)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True, help="Nom FR du corps (clé du manifeste)")
    ap.add_argument("--query", required=True, help="Requête de recherche images-api.nasa.gov")
    ap.add_argument("--system", required=True, help="Dossier système, ex: Systeme_Solaire")
    ap.add_argument("--planet", required=True, help="Dossier planète, ex: Jupiter")
    ap.add_argument("--moon", default=None, help="Dossier satellite si applicable, ex: Io")
    ap.add_argument("--count", type=int, default=2)
    ap.add_argument("--out-fragment", required=True, help="Chemin du fragment JSON de sortie")
    args = ap.parse_args()

    rel_parts = [args.system, args.planet] + ([args.moon] if args.moon else [])
    img_dir = os.path.join(IMG_ROOT, *rel_parts)
    public_dir = os.path.join(PUBLIC_ROOT, *rel_parts)
    os.makedirs(img_dir, exist_ok=True)
    os.makedirs(public_dir, exist_ok=True)

    results = search_nasa(args.query, args.count)
    entries = []
    for r in results:
        fname = safe_filename(r["nasa_id"], r["asset_url"])
        img_path = os.path.join(img_dir, fname)
        public_path = os.path.join(public_dir, fname)
        try:
            size = download(r["asset_url"], img_path)
            if size < 5000:
                os.remove(img_path)
                continue
            with open(img_path, "rb") as f:
                content = f.read()
            with open(public_path, "wb") as f:
                f.write(content)
        except Exception as e:
            print(f"[SKIP] {args.name} — {r['asset_url']} : {e}", file=sys.stderr)
            continue
        public_url = "/photos/" + "/".join(rel_parts) + "/" + fname
        entries.append({
            "file": public_url,
            "title": r["title"],
            "credit": r["credit"],
            "date": r["date_created"],
            "sourceUrl": r["source_url"],
            "license": "Domaine public (NASA)",
        })
        print(f"[OK] {args.name} <- {fname} ({size} o) — {r['title']}")

    with open(args.out_fragment, "w", encoding="utf-8") as f:
        json.dump({args.name: entries}, f, ensure_ascii=False, indent=2)

    if not entries:
        print(f"[VIDE] Aucune photo retenue pour {args.name} (query={args.query!r})", file=sys.stderr)


if __name__ == "__main__":
    main()
