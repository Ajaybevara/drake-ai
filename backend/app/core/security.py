from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
bearer_scheme = HTTPBearer()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = utc_now() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    from app.models import User, UserSession
    payload = decode_token(credentials.credentials)
    user_id: str = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    session_id: str | None = payload.get("sid")
    if session_id:
        session = db.query(UserSession).filter(
            UserSession.session_id == session_id,
            UserSession.user_id == user.id,
            UserSession.is_active == True,
        ).first()
        if not session:
            raise HTTPException(status_code=401, detail="Session expired or logged out")
        now = utc_now()
        if session.expires_at and as_utc(session.expires_at) < now:
            session.is_active = False
            session.logged_out_at = now
            db.commit()
            raise HTTPException(status_code=401, detail="Session expired or logged out")
        session.last_seen_at = now
        db.commit()
    return user
