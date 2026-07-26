import csv
import io
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy import func

from . import models
from .auth import ADMIN_PASSWORD, clear_session_cookie, create_session_cookie, require_admin
from .db import SessionLocal, init_db
from .geo import record_view, start_background

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("universe3d.api")

app = FastAPI(title="UNIVERSE3D stats API")


@app.on_event("startup")
def _startup():
    init_db()
    if not ADMIN_PASSWORD:
        logger.warning("ADMIN_PASSWORD non défini — /api/admin/login refusera toute connexion.")
    start_background()


@app.get("/")
def health():
    return {"ok": True}


class TrackPayload(BaseModel):
    path: Optional[str] = None


@app.post("/api/track", status_code=204)
def track(payload: TrackPayload, request: Request):
    record_view(payload.path, request)
    return Response(status_code=204)


class LoginPayload(BaseModel):
    password: str


@app.post("/api/admin/login")
def admin_login(payload: LoginPayload, response: Response):
    if not ADMIN_PASSWORD or payload.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Mot de passe incorrect")
    create_session_cookie(response)
    return {"ok": True}


@app.post("/api/admin/logout")
def admin_logout(response: Response):
    clear_session_cookie(response)
    return {"ok": True}


@app.get("/api/admin/me")
def admin_me(_: None = Depends(require_admin)):
    return {"ok": True}


@app.get("/api/admin/stats")
def admin_stats(_: None = Depends(require_admin)):
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        today_start = datetime(now.year, now.month, now.day)
        d7 = now - timedelta(days=7)
        d14 = now - timedelta(days=14)
        d30 = now - timedelta(days=30)

        total = db.query(func.count(models.PageView.id)).scalar() or 0
        today = db.query(func.count(models.PageView.id)).filter(
            models.PageView.created_at >= today_start
        ).scalar() or 0
        last7 = db.query(func.count(models.PageView.id)).filter(
            models.PageView.created_at >= d7
        ).scalar() or 0
        last30 = db.query(func.count(models.PageView.id)).filter(
            models.PageView.created_at >= d30
        ).scalar() or 0
        distinct_ips_30 = db.query(func.count(func.distinct(models.PageView.ip))).filter(
            models.PageView.created_at >= d30,
            models.PageView.ip.isnot(None),
            models.PageView.ip != "",
        ).scalar() or 0

        by_day: dict = {}
        for (created_at,) in db.query(models.PageView.created_at).filter(
            models.PageView.created_at >= d14
        ).all():
            key = created_at.strftime("%Y-%m-%d")
            by_day[key] = by_day.get(key, 0) + 1
        daily = [{"date": k, "count": v} for k, v in sorted(by_day.items())]

        country_rows = db.query(
            models.PageView.country, models.PageView.country_code, func.count(models.PageView.id)
        ).filter(models.PageView.created_at >= d30).group_by(
            models.PageView.country, models.PageView.country_code
        ).order_by(func.count(models.PageView.id).desc()).all()
        countries = [
            {"country": c or "Inconnu", "country_code": cc, "count": n}
            for c, cc, n in country_rows
        ]

        monthly = [
            {
                "year_month": m.year_month,
                "view_count": m.view_count,
                "distinct_countries": m.distinct_countries,
                "distinct_ips": m.distinct_ips,
            }
            for m in db.query(models.PageViewMonthlySummary).order_by(
                models.PageViewMonthlySummary.year_month.desc()
            ).all()
        ]

        recent = [
            {
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "path": r.path,
                "country": r.country,
                "country_code": r.country_code,
                "city": r.city,
                "user_agent": r.user_agent,
            }
            for r in db.query(models.PageView).order_by(
                models.PageView.created_at.desc()
            ).limit(30).all()
        ]

        return {
            "total": total,
            "today": today,
            "last7": last7,
            "last30": last30,
            "distinct_ips_30": distinct_ips_30,
            "daily": daily,
            "countries": countries,
            "monthly": monthly,
            "recent": recent,
        }
    finally:
        db.close()


@app.get("/api/admin/views.csv")
def admin_views_csv(_: None = Depends(require_admin)):
    db = SessionLocal()
    try:
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["created_at", "path", "ip", "country", "country_code", "city", "lat", "lon", "user_agent"])
        for r in db.query(models.PageView).order_by(models.PageView.created_at.desc()).all():
            writer.writerow([
                r.created_at.isoformat() if r.created_at else "",
                r.path or "", r.ip or "", r.country or "", r.country_code or "",
                r.city or "", r.lat if r.lat is not None else "", r.lon if r.lon is not None else "",
                r.user_agent or "",
            ])
        for m in db.query(models.PageViewMonthlySummary).order_by(
            models.PageViewMonthlySummary.year_month.desc()
        ).all():
            writer.writerow([])
            writer.writerow(["--- résumé mensuel ---"])
            writer.writerow(["year_month", "view_count", "distinct_countries", "distinct_ips"])
            writer.writerow([m.year_month, m.view_count, m.distinct_countries, m.distinct_ips])
        return PlainTextResponse(buf.getvalue(), media_type="text/csv")
    finally:
        db.close()
