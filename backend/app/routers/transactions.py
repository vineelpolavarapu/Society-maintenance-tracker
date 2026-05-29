from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_treasurer
from app.database import get_db
from app.models import Transaction, TransactionDirection, TransactionStatus, User
from app.schemas import TransactionCreate, TransactionOut

router = APIRouter(prefix="/transactions", tags=["transactions"])


def _build_out(txn: Transaction, db: Session) -> dict:
    recorded_by_name = txn.recorded_by_user.name if txn.recorded_by_user else None
    return TransactionOut(
        id=txn.id,
        direction=txn.direction,
        amount=str(txn.amount),
        txn_date=txn.txn_date,
        description=txn.description,
        category=txn.category,
        recorded_by=txn.recorded_by,
        recorded_by_name=recorded_by_name,
        recorded_at=txn.recorded_at,
        reverses_transaction_id=txn.reverses_transaction_id,
        status=txn.status,
    )


@router.get("", response_model=list[TransactionOut])
def list_transactions(
    cycle: str | None = Query(None, description="YYYY-MM to filter by month"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Transaction).order_by(Transaction.txn_date.desc(), Transaction.id.desc())
    if cycle:
        import re
        if not re.fullmatch(r"\d{4}-\d{2}", cycle):
            raise HTTPException(status_code=400, detail="cycle must be YYYY-MM")
        yr, mo = cycle.split("-")
        from sqlalchemy import extract
        q = q.filter(
            extract("year", Transaction.txn_date) == int(yr),
            extract("month", Transaction.txn_date) == int(mo),
        )
    txns = q.all()
    return [_build_out(t, db) for t in txns]


@router.post("", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
def create_transaction(
    body: TransactionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_treasurer),
):
    txn = Transaction(
        direction=body.direction,
        amount=body.amount,
        txn_date=body.txn_date,
        description=body.description,
        category=body.category,
        recorded_by=user.id,
        status=TransactionStatus.active,
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return _build_out(txn, db)


@router.post("/{txn_id}/reverse", response_model=list[TransactionOut], status_code=status.HTTP_201_CREATED)
def reverse_transaction(
    txn_id: int,
    correction: TransactionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_treasurer),
):
    original = db.query(Transaction).filter(Transaction.id == txn_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if original.status == TransactionStatus.reversed:
        raise HTTPException(status_code=400, detail="Transaction already reversed")
    if original.reverses_transaction_id is not None:
        raise HTTPException(status_code=400, detail="Cannot reverse a reversal entry")

    now = datetime.now(timezone.utc)

    # Reversal entry — mirrors the original
    reversal_direction = (
        TransactionDirection.out if original.direction == TransactionDirection.in_
        else TransactionDirection.in_
    )
    reversal = Transaction(
        direction=reversal_direction,
        amount=original.amount,
        txn_date=now,
        description=f"[REVERSAL] {original.description}",
        category=original.category,
        recorded_by=user.id,
        status=TransactionStatus.active,
    )
    db.add(reversal)
    db.flush()

    # Mark original as reversed
    original.status = TransactionStatus.reversed

    # Correction entry
    correction_txn = Transaction(
        direction=correction.direction,
        amount=correction.amount,
        txn_date=correction.txn_date,
        description=correction.description,
        category=correction.category,
        recorded_by=user.id,
        reverses_transaction_id=original.id,
        status=TransactionStatus.active,
    )
    db.add(correction_txn)
    db.commit()
    db.refresh(reversal)
    db.refresh(correction_txn)

    return [_build_out(reversal, db), _build_out(correction_txn, db)]
