"""Suivi des vues de pages (DB stats.db) :
- Enregistre 1 ligne par vue (path, IP, UA)
- Enrichit géo (pays, ville, lat/lon) via ip-api.com en tâche de fond
- Purge les events > 30 jours et agrège vers résumé mensuel permanent
(même pattern que api/login_tracker.py côté Cycymulator)
"""
import json
import logging
import threading
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta

from .db import SessionLocal
from . import models

logger = logging.getLogger("universe3d.geo")


def _extract_client_ip(request) -> str:
    fwd = request.headers.get("x-forwarded-for", "") if request else ""
    if fwd:
        return fwd.split(",")[0].strip()
    if request and request.client:
        return request.client.host or ""
    return ""


def record_view(path, request) -> None:
    """Appelé depuis POST /api/track à chaque chargement de page."""
    try:
        ip = _extract_client_ip(request)
        ua = (request.headers.get("user-agent") if request else None) or ""
        ua = ua[:400]
        db = SessionLocal()
        try:
            db.add(models.PageView(
                path=((path or "")[:200]) or None,
                ip=ip or None,
                user_agent=ua or None,
            ))
            db.commit()
        finally:
            db.close()
    except Exception as e:
        logger.warning("record_view failed: %s", e)


def _lookup_geo(ip: str):
    """Retourne (country, country_code, city, lat, lon) ou (None,)*5."""
    if not ip:
        return (None, None, None, None, None)
    if ip.startswith(("192.168.", "10.", "127.", "169.254.")) or ip == "::1":
        return ("Local", "LOC", None, None, None)
    if ip.startswith("172."):
        try:
            second = int(ip.split(".")[1])
            if 16 <= second <= 31:
                return ("Local", "LOC", None, None, None)
        except (ValueError, IndexError):
            pass
    try:
        url = f"http://ip-api.com/json/{urllib.parse.quote(ip)}?fields=status,country,countryCode,city,lat,lon"
        req = urllib.request.Request(url, headers={"User-Agent": "Universe3D/1.0"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("status") == "success":
                return (
                    data.get("country") or None,
                    data.get("countryCode") or None,
                    data.get("city") or None,
                    data.get("lat"),
                    data.get("lon"),
                )
    except Exception as e:
        logger.debug("geo lookup fail %s: %s", ip, e)
    return (None, None, None, None, None)


def enrich_missing_geo(limit: int = 40) -> int:
    """Enrichit jusqu'à `limit` vues sans pays (rate limit 45/min respecté)."""
    db = SessionLocal()
    enriched = 0
    try:
        evs = db.query(models.PageView).filter(
            models.PageView.country_code.is_(None),
            models.PageView.ip.isnot(None),
            models.PageView.ip != "",
        ).limit(limit).all()
        for ev in evs:
            country, cc, city, lat, lon = _lookup_geo(ev.ip)
            ev.country = country
            ev.country_code = cc
            ev.city = city
            ev.lat = lat
            ev.lon = lon
            db.commit()
            enriched += 1
            time.sleep(1.5)
    except Exception as e:
        logger.error("enrich_missing_geo: %s", e)
        db.rollback()
    finally:
        db.close()
    return enriched


def purge_and_aggregate() -> tuple:
    """Agrège les vues > 30 jours dans PageViewMonthlySummary puis les supprime."""
    cutoff = datetime.utcnow() - timedelta(days=30)
    db = SessionLocal()
    try:
        old = db.query(models.PageView).filter(models.PageView.created_at < cutoff).all()
        if not old:
            return (0, 0)

        agg: dict = {}   # year_month -> {count, cc_set, ip_set}
        for ev in old:
            if not ev.created_at:
                continue
            ym = ev.created_at.strftime("%Y-%m")
            d = agg.setdefault(ym, {"count": 0, "cc": set(), "ip": set()})
            d["count"] += 1
            if ev.country_code:
                d["cc"].add(ev.country_code)
            if ev.ip:
                d["ip"].add(ev.ip)

        for ym, d in agg.items():
            existing = db.query(models.PageViewMonthlySummary).filter_by(year_month=ym).first()
            if existing:
                existing.view_count += d["count"]
                existing.distinct_countries = max(existing.distinct_countries, len(d["cc"]))
                existing.distinct_ips       = max(existing.distinct_ips,       len(d["ip"]))
            else:
                db.add(models.PageViewMonthlySummary(
                    year_month=ym,
                    view_count=d["count"],
                    distinct_countries=len(d["cc"]),
                    distinct_ips=len(d["ip"]),
                ))

        db.query(models.PageView).filter(
            models.PageView.created_at < cutoff
        ).delete(synchronize_session=False)
        db.commit()
        logger.info("Purgé %d vues, agrégé %d mois", len(old), len(agg))
        return (len(old), len(agg))
    except Exception as e:
        logger.error("purge_and_aggregate: %s", e)
        db.rollback()
        return (0, 0)
    finally:
        db.close()


def _loop():
    time.sleep(60)
    last_purge_ts = 0.0
    while True:
        try:
            enrich_missing_geo(limit=40)
        except Exception as e:
            logger.error("enrich loop: %s", e)
        try:
            now_ts = time.time()
            if now_ts - last_purge_ts > 86400:
                purge_and_aggregate()
                last_purge_ts = now_ts
        except Exception as e:
            logger.error("purge loop: %s", e)
        time.sleep(1800)


def start_background():
    t = threading.Thread(target=_loop, daemon=True, name="pageview-geo")
    t.start()
    logger.info("Thread pageview-geo démarré (daemon)")
    return t
