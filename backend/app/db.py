"""Base SQLAlchemy — stats de fréquentation (page_views + résumé mensuel).
Fichier SQLite dédié, persistant via volume Docker (cf. deploy/hetzner).
"""
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DB_PATH = os.environ.get("DB_PATH", "/app/data/stats.db")

engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def init_db():
    from . import models  # noqa: F401 — enregistre les modèles sur Base
    Base.metadata.create_all(bind=engine)
