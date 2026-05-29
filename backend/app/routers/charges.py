from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_treasurer
from app.database import get_db
from app.models import Charge, Payment, Unit, User
from app.schemas import ChargeBulkCreate, ChargeOut

router = APIRouter(prefix="/charges", tags=["charges"])


def _enrich(charge: Charge, db: Session) -> ChargeOut:
    paid = db.query(func.coalesce(func.sum(Payment.amount), Decimal("0"))).filter(
        Payment.charge_id == charge.id
    ).scalar() or Decimal("0")
    if paid >= charge.amount:
        st = "paid"
    elif paid > 0:
        st = "partial"
    else:
        st = "unpaid"
    unit_id_val = charge.unit.identifier if charge.unit else None
    return ChargeOut(
        id=charge.id,
        unit_id=charge.unit_id,
        unit_identifier=unit_id_val,
        cycle=charge.cycle,
        amount=str(charge.amount),
        raised_by=charge.raised_by,
        raised_at=charge.raised_at,
        paid_amount=str(paid),
        status=st,
    )


@router.post("/bulk", status_code=status.HTTP_201_CREATED)
def raise_charges_bulk(
    body: ChargeBulkCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_treasurer),
):
    units = db.query(Unit).all()
    created = []
    skipped = []
    for unit in units:
        existing = db.query(Charge).filter(
            Charge.unit_id == unit.id, Charge.cycle == body.cycle
        ).first()
        if existing:
            skipped.append(unit.identifier)
            continue
        amount = body.amount if body.amount else unit.charge_rate
        charge = Charge(
            unit_id=unit.id,
            cycle=body.cycle,
            amount=amount,
            raised_by=user.id,
        )
        db.add(charge)
        created.append(unit.identifier)
    db.commit()
    return {"created": len(created), "skipped": len(skipped), "units_created": created, "units_skipped": skipped}


@router.get("", response_model=list[ChargeOut])
def list_charges(
    cycle: str | None = Query(None),
    unit_id: int | None = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Charge)
    if cycle:
        q = q.filter(Charge.cycle == cycle)
    if unit_id:
        q = q.filter(Charge.unit_id == unit_id)
    charges = q.order_by(Charge.cycle.desc(), Charge.unit_id).all()
    return [_enrich(c, db) for c in charges]
