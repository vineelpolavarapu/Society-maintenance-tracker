from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_treasurer
from app.database import get_db
from app.models import Charge, Payment, Transaction, TransactionDirection, TransactionStatus, User
from app.schemas import PaymentCreate, PaymentOut

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def record_payment(
    body: PaymentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_treasurer),
):
    charge = db.query(Charge).filter(Charge.id == body.charge_id).first()
    if not charge:
        raise HTTPException(status_code=404, detail="Charge not found")

    # Create the linked `in` transaction atomically
    txn = Transaction(
        direction=TransactionDirection.in_,
        amount=body.amount,
        txn_date=body.txn_date,
        description=f"Maintenance — {charge.unit.identifier}, {charge.cycle}",
        recorded_by=user.id,
        status=TransactionStatus.active,
    )
    db.add(txn)
    db.flush()

    payment = Payment(
        charge_id=charge.id,
        unit_id=charge.unit_id,
        amount=body.amount,
        method=body.method,
        reference=body.reference,
        transaction_id=txn.id,
        recorded_by=user.id,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment
