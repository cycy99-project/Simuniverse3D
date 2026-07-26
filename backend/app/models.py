from sqlalchemy import Column, DateTime, Float, Integer, String, UniqueConstraint, func

from .db import Base


class PageView(Base):
    """Trace d'une vue de page (purgée après 30 jours, agrégée en mensuel)."""
    __tablename__ = "page_views"

    id           = Column(Integer, primary_key=True)
    path         = Column(String(200), nullable=True)
    ip           = Column(String(64),  nullable=True)
    country      = Column(String(80),  nullable=True)
    country_code = Column(String(4),   nullable=True, index=True)
    city         = Column(String(120), nullable=True)
    lat          = Column(Float, nullable=True)
    lon          = Column(Float, nullable=True)
    user_agent   = Column(String(400), nullable=True)
    created_at   = Column(DateTime, server_default=func.now(), nullable=False, index=True)


class PageViewMonthlySummary(Base):
    """Résumé mensuel des vues (conservé indéfiniment, sans IP brute)."""
    __tablename__ = "page_view_monthly_summary"

    id                 = Column(Integer, primary_key=True)
    year_month         = Column(String(7), nullable=False, index=True)   # "2026-07"
    view_count         = Column(Integer, nullable=False, default=0)
    distinct_countries = Column(Integer, nullable=False, default=0)
    distinct_ips       = Column(Integer, nullable=False, default=0)
    created_at         = Column(DateTime, server_default=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint("year_month", name="uix_ym_pageview"),)
