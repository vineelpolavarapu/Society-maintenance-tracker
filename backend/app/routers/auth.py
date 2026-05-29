import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.models import RegistrationRequest, RegistrationStatus, User, UserRole, UserStatus
from app.schemas import LoginRequest, RegisterRequest, TokenOut, UserOut

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if not body.email and not body.phone:
        raise HTTPException(status_code=400, detail="Provide at least an email or a phone number")

    contact = body.email or body.phone

    # Reject if an active user already exists with this email/phone
    if body.email and db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    if body.phone and db.query(User).filter(User.phone == body.phone).first():
        raise HTTPException(status_code=409, detail="Phone already registered")

    # Reject if there's already a pending registration with the same contact
    existing = (
        db.query(RegistrationRequest)
        .filter(
            RegistrationRequest.contact == contact,
            RegistrationRequest.status == RegistrationStatus.pending,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="A pending registration with this contact already exists")

    req = RegistrationRequest(
        name=body.name,
        contact=contact,
        email=body.email,
        phone=body.phone,
        password_hash=hash_password(body.password),
        flat_no=body.flat_no,
        building_name=body.building_name,
        claimed_unit_id=body.claimed_unit_id,
        status=RegistrationStatus.pending,
    )
    try:
        db.add(req)
        db.commit()
        db.refresh(req)
    except SQLAlchemyError as ex:
        db.rollback()
        logger.exception("Registration insert failed")
        raise HTTPException(
            status_code=500,
            detail=f"Registration could not be saved: {ex.__class__.__name__}. "
                   "Please contact the administrator."
        )
    return {"id": req.id, "status": req.status, "message": "Registration submitted. The Secretary will review your request."}


@router.post("/setup-treasurer", status_code=status.HTTP_201_CREATED)
def setup_first_treasurer(
    name: str,
    contact: str,
    password: str,
    db: Session = Depends(get_db),
):
    """Bootstrap the first treasurer. Only works when no active treasurer exists."""
    if db.query(User).filter(User.role == UserRole.treasurer, User.status == UserStatus.active).first():
        raise HTTPException(status_code=400, detail="A treasurer already exists")

    is_email = "@" in contact
    user = User(
        name=name,
        email=contact if is_email else None,
        phone=None if is_email else contact,
        password_hash=hash_password(password),
        role=UserRole.treasurer,
        can_approve=False,
        status=UserStatus.active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "message": "Treasurer account created"}


@router.post("/login", response_model=TokenOut)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    is_email = "@" in body.contact
    if is_email:
        user = db.query(User).filter(User.email == body.contact).first()
    else:
        user = db.query(User).filter(User.phone == body.contact).first()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if user.status != UserStatus.active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Account not yet approved")

    token = create_access_token({
        "sub": str(user.id),
        "role": user.role.value,
        "can_approve": user.can_approve,
        "unit_id": user.unit_id,
    })
    return TokenOut(access_token=token)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
