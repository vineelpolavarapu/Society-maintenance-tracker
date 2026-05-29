from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_treasurer
from app.database import get_db
from app.models import Unit, User
from app.schemas import UnitCreate, UnitOut

router = APIRouter(prefix="/units", tags=["units"])


@router.get("/public")
def list_units_public(db: Session = Depends(get_db)):
    """Public endpoint used by the registration page to populate the unit dropdown.
    Returns only the safe fields needed for selection."""
    rows = db.query(Unit).order_by(Unit.identifier).all()
    return [{"id": u.id, "identifier": u.identifier, "type": u.type.value} for u in rows]


@router.get("", response_model=list[UnitOut])
def list_units(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Unit).order_by(Unit.identifier).all()


@router.post("", response_model=UnitOut, status_code=status.HTTP_201_CREATED)
def create_unit(
    body: UnitCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_treasurer),
):
    if db.query(Unit).filter(Unit.identifier == body.identifier).first():
        raise HTTPException(status_code=400, detail="Unit identifier already exists")
    unit = Unit(**body.model_dump())
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return unit


@router.get("/{unit_id}/dues")
def unit_dues(
    unit_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")

    from decimal import Decimal
    from sqlalchemy import func
    from app.models import Charge, Payment

    charges = (
        db.query(Charge)
        .filter(Charge.unit_id == unit_id)
        .order_by(Charge.cycle.desc())
        .all()
    )
    history = []
    for charge in charges:
        paid = db.query(func.coalesce(func.sum(Payment.amount), Decimal("0"))).filter(
            Payment.charge_id == charge.id
        ).scalar() or Decimal("0")
        if paid >= charge.amount:
            st = "paid"
        elif paid > 0:
            st = "partial"
        else:
            st = "unpaid"
        history.append({
            "cycle": charge.cycle,
            "charge_id": charge.id,
            "charge_amount": str(charge.amount),
            "paid_amount": str(paid),
            "status": st,
        })
    return {"unit_id": unit_id, "unit_identifier": unit.identifier, "history": history}


@router.get("/{unit_id}/history")
def unit_history(
    unit_id: int,
    months: int = 24,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return per-cycle payment status for the last N months (for drawer grid)."""
    from datetime import date
    from decimal import Decimal
    from sqlalchemy import func
    from app.models import Charge, Payment

    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")

    today = date.today()
    cycles = []
    yr, mo = today.year, today.month
    for _ in range(months):
        cycles.append(f"{yr}-{mo:02d}")
        mo -= 1
        if mo == 0:
            mo = 12
            yr -= 1

    charges_map = {
        c.cycle: c
        for c in db.query(Charge).filter(
            Charge.unit_id == unit_id,
            Charge.cycle.in_(cycles),
        ).all()
    }

    rows = []
    for cycle in reversed(cycles):
        charge = charges_map.get(cycle)
        if charge is None:
            rows.append({"cycle": cycle, "status": "future"})
            continue
        paid = db.query(func.coalesce(func.sum(Payment.amount), Decimal("0"))).filter(
            Payment.charge_id == charge.id
        ).scalar() or Decimal("0")
        if paid >= charge.amount:
            st = "paid"
        elif paid > 0:
            st = "partial"
        else:
            st = "unpaid"
        rows.append({
            "cycle": cycle,
            "charge_id": charge.id,
            "charge_amount": str(charge.amount),
            "paid_amount": str(paid),
            "status": st,
        })

    paid_count = sum(1 for r in rows if r["status"] == "paid")
    total_pending = sum(
        Decimal(r.get("charge_amount", "0")) - Decimal(r.get("paid_amount", "0"))
        for r in rows
        if r["status"] in ("unpaid", "partial")
    )
    return {
        "unit_id": unit_id,
        "unit_identifier": unit.identifier,
        "unit_type": unit.type.value,
        "paid_count": paid_count,
        "pending_dues": str(total_pending),
        "history": rows,
    }
