from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_approver
from app.core.security import hash_password
from app.database import get_db
from app.models import RegistrationRequest, RegistrationStatus, User, UserRole, UserStatus
from app.schemas import RegistrationRequestOut

router = APIRouter(prefix="/registrations", tags=["registrations"])


def _enrich(req: RegistrationRequest) -> RegistrationRequestOut:
    return RegistrationRequestOut(
        id=req.id,
        name=req.name,
        contact=req.contact,
        email=req.email,
        phone=req.phone,
        flat_no=req.flat_no,
        building_name=req.building_name,
        claimed_unit_id=req.claimed_unit_id,
        status=req.status,
        decided_by=req.decided_by,
        decided_at=req.decided_at,
        created_at=req.created_at,
        unit_identifier=req.unit.identifier if req.unit else None,
    )


@router.get("", response_model=list[RegistrationRequestOut])
def list_registrations(
    db: Session = Depends(get_db),
    user: User = Depends(require_approver),
):
    reqs = (
        db.query(RegistrationRequest)
        .filter(RegistrationRequest.status == RegistrationStatus.pending)
        .order_by(RegistrationRequest.created_at.desc())
        .all()
    )
    return [_enrich(r) for r in reqs]


@router.post("/{reg_id}/approve", status_code=status.HTTP_200_OK)
def approve_registration(
    reg_id: int,
    password: str | None = None,
    role: UserRole = UserRole.resident,
    can_approve: bool = False,
    db: Session = Depends(get_db),
    approver: User = Depends(require_approver),
):
    req = db.query(RegistrationRequest).filter(RegistrationRequest.id == reg_id).first()
    if not req or req.status != RegistrationStatus.pending:
        raise HTTPException(status_code=404, detail="Pending registration not found")

    # Prefer the password the resident set during registration; allow override.
    password_hash = hash_password(password) if password else req.password_hash
    if not password_hash:
        raise HTTPException(status_code=400, detail="No password set on registration and none provided")

    is_email = bool(req.email) or ("@" in req.contact)
    email = req.email or (req.contact if is_email else None)
    phone = req.phone or (None if is_email else req.contact)

    new_user = User(
        name=req.name,
        email=email,
        phone=phone,
        password_hash=password_hash,
        unit_id=req.claimed_unit_id,
        flat_no=req.flat_no,
        building_name=req.building_name,
        role=role,
        can_approve=can_approve,
        status=UserStatus.active,
    )
    db.add(new_user)

    req.status = RegistrationStatus.approved
    req.decided_by = approver.id
    req.decided_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Approved", "user_id": new_user.id}


@router.post("/{reg_id}/reject", status_code=status.HTTP_200_OK)
def reject_registration(
    reg_id: int,
    db: Session = Depends(get_db),
    approver: User = Depends(require_approver),
):
    req = db.query(RegistrationRequest).filter(RegistrationRequest.id == reg_id).first()
    if not req or req.status != RegistrationStatus.pending:
        raise HTTPException(status_code=404, detail="Pending registration not found")

    req.status = RegistrationStatus.rejected
    req.decided_by = approver.id
    req.decided_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Rejected"}
