"""Admin unique (Cyril) — session par cookie signé (pas de compte multi-utilisateurs,
UNIVERSE3D n'a qu'un seul admin, contrairement au système User complet de Cycymulator)."""
import os

from fastapi import HTTPException, Request, Response
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")

COOKIE_NAME = "u3d_admin"
MAX_AGE = 7 * 24 * 3600  # 7 jours

_serializer = URLSafeTimedSerializer(SECRET_KEY, salt="u3d-admin-session")


def create_session_cookie(response: Response) -> None:
    token = _serializer.dumps({"admin": True})
    response.set_cookie(
        COOKIE_NAME, token,
        max_age=MAX_AGE, httponly=True, secure=True, samesite="lax", path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


def require_admin(request: Request) -> None:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Non authentifié")
    try:
        data = _serializer.loads(token, max_age=MAX_AGE)
    except (BadSignature, SignatureExpired):
        raise HTTPException(status_code=401, detail="Session invalide ou expirée")
    if not data.get("admin"):
        raise HTTPException(status_code=401, detail="Non autorisé")
