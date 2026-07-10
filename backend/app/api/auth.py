from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from app.core.database import get_db
from app.core.security import verify_password, create_access_token, hash_password, get_current_user
from app.models import User, UserActivity, UserRole

router = APIRouter()

ACCESS_MODULES = {
    "log-visualization",
    "missing-log-prediction",
    "ai-facies-classification",
    "ai-formation-tops",
    "ai-parameter-prediction",
    "ai-uncertainty",
    "auto-splicer",
    "seismic-frequency-enhancer",
    "production-intelligence",
    "ccus-screening",
    "geothermal-screening",
    "drake-slm-gpt",
    "drake-ocr",
}


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: UserRole = UserRole.petrophysicist


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class AdminUserRequest(BaseModel):
    username: str
    password: str | None = None
    full_name: str
    modules: list[str]
    active: bool = True


def serialize_user(user: User) -> dict:
    modules = user.access_modules or []
    if user.role == UserRole.admin:
        modules = sorted(ACCESS_MODULES)
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "avatar_initials": user.avatar_initials,
        "accessModules": modules,
        "is_active": user.is_active,
    }


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def validate_modules(modules: list[str]) -> list[str]:
    unique_modules = list(dict.fromkeys(modules))
    invalid_modules = [module for module in unique_modules if module not in ACCESS_MODULES]
    if invalid_modules:
        raise HTTPException(status_code=400, detail=f"Invalid module access: {', '.join(invalid_modules)}")
    return unique_modules


def initials_for(name: str) -> str:
    parts = [part for part in name.split() if part]
    return "".join(part[0].upper() for part in parts[:2]) or "U"


def log_user_activity(db: Session, user: User, action: str, request: Request) -> None:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    ip_address = forwarded_for.split(",")[0].strip() if forwarded_for else (request.client.host if request.client else None)
    activity = UserActivity(
        user_id=user.id,
        action=action,
        ip_address=ip_address,
        user_agent=request.headers.get("user-agent", "")[:500],
    )
    db.add(activity)
    db.commit()


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="User account is inactive")
    log_user_activity(db, user, "login", request)
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": serialize_user(user),
    }


@router.post("/logout")
def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log_user_activity(db, current_user, "logout", request)
    return {"message": "Logged out"}


@router.post("/register", status_code=201)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    initials = "".join(w[0].upper() for w in req.full_name.split()[:2])
    user = User(
        email=req.email,
        full_name=req.full_name,
        hashed_password=hash_password(req.password),
        role=req.role,
        avatar_initials=initials or "U",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "User created", "id": user.id}


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return serialize_user(current_user)


@router.get("/admin/users")
def list_managed_users(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = db.query(User).filter(User.role != UserRole.admin).order_by(User.created_at.desc()).all()
    return {"users": [serialize_user(user) for user in users]}


@router.get("/admin/activity")
def list_user_activity(
    user_id: int | None = None,
    limit: int = 200,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(UserActivity).join(User).filter(User.role != UserRole.admin)
    if user_id is not None:
        query = query.filter(UserActivity.user_id == user_id)
    activities = query.order_by(UserActivity.created_at.desc()).limit(min(max(limit, 1), 500)).all()
    return {
        "activities": [
            {
                "id": activity.id,
                "user_id": activity.user_id,
                "username": activity.user.email,
                "full_name": activity.user.full_name,
                "action": activity.action,
                "ip_address": activity.ip_address,
                "user_agent": activity.user_agent,
                "created_at": activity.created_at,
            }
            for activity in activities
        ]
    }


@router.post("/admin/users", status_code=201)
def create_managed_user(
    req: AdminUserRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    username = req.username.strip()
    full_name = req.full_name.strip() or username
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if not req.password:
        raise HTTPException(status_code=400, detail="Password is required")
    if db.query(User).filter(User.email == username).first():
        raise HTTPException(status_code=400, detail="Username already exists")

    user = User(
        email=username,
        full_name=full_name,
        hashed_password=hash_password(req.password),
        role=UserRole.viewer,
        avatar_initials=initials_for(full_name),
        is_active=req.active,
        access_modules=validate_modules(req.modules),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"user": serialize_user(user)}


@router.put("/admin/users/{user_id}")
def update_managed_user(
    user_id: int,
    req: AdminUserRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id, User.role != UserRole.admin).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    username = req.username.strip()
    full_name = req.full_name.strip() or username
    duplicate = db.query(User).filter(User.email == username, User.id != user_id).first()
    if duplicate:
        raise HTTPException(status_code=400, detail="Username already exists")

    user.email = username
    user.full_name = full_name
    user.avatar_initials = initials_for(full_name)
    user.is_active = req.active
    user.access_modules = validate_modules(req.modules)
    if req.password:
        user.hashed_password = hash_password(req.password)
    db.commit()
    db.refresh(user)
    return {"user": serialize_user(user)}


@router.patch("/admin/users/{user_id}/status")
def update_managed_user_status(
    user_id: int,
    active: bool,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id, User.role != UserRole.admin).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = active
    db.commit()
    db.refresh(user)
    return {"user": serialize_user(user)}


@router.delete("/admin/users/{user_id}", status_code=204)
def delete_managed_user(
    user_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id, User.role != UserRole.admin).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
