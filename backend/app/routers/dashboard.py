import re
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models import Charge, Payment, Transaction, TransactionDirection, TransactionStatus, Unit, User
from app.schemas import (
    ExpenseDashboardOut, MaintenanceDashboardOut, TransactionOut, UnitDuesItem,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

CYCLE_RE = re.compile(r"^(\d{4})-(\d{2})$")


def _parse_cycle(cycle: str):
    m = CYCLE_RE.match(cycle)
    if not m:
        raise HTTPException(status_code=400, detail="cycle must be YYYY-MM")
    return int(m.group(1)), int(m.group(2))


def _prev_cycle(yr: int, mo: int):
    mo -= 1
    if mo == 0:
        mo = 12
        yr -= 1
    return yr, mo


def _sum_txns(db: Session, yr: int, mo: int, direction: TransactionDirection) -> Decimal:
    val = (
        db.query(func.coalesce(func.sum(Transaction.amount), Decimal("0")))
        .filter(
            Transaction.direction == direction,
            Transaction.status == TransactionStatus.active,
            extract("year", Transaction.txn_date) == yr,
            extract("month", Transaction.txn_date) == mo,
        )
        .scalar()
    )
    return val or Decimal("0")


def _cumulative_balance(db: Session, before_yr: int, before_mo: int) -> Decimal:
    """Sum of all active in/out transactions strictly before the given month."""
    total_in = (
        db.query(func.coalesce(func.sum(Transaction.amount), Decimal("0")))
        .filter(
            Transaction.direction == TransactionDirection.in_,
            Transaction.status == TransactionStatus.active,
            (extract("year", Transaction.txn_date) * 100 + extract("month", Transaction.txn_date))
            < (before_yr * 100 + before_mo),
        )
        .scalar()
    ) or Decimal("0")
    total_out = (
        db.query(func.coalesce(func.sum(Transaction.amount), Decimal("0")))
        .filter(
            Transaction.direction == TransactionDirection.out,
            Transaction.status == TransactionStatus.active,
            (extract("year", Transaction.txn_date) * 100 + extract("month", Transaction.txn_date))
            < (before_yr * 100 + before_mo),
        )
        .scalar()
    ) or Decimal("0")
    return total_in - total_out


def _txn_out(txn: Transaction) -> TransactionOut:
    return TransactionOut(
        id=txn.id,
        direction=txn.direction,
        amount=str(txn.amount),
        txn_date=txn.txn_date,
        description=txn.description,
        category=txn.category,
        recorded_by=txn.recorded_by,
        recorded_by_name=txn.recorded_by_user.name if txn.recorded_by_user else None,
        recorded_at=txn.recorded_at,
        reverses_transaction_id=txn.reverses_transaction_id,
        status=txn.status,
    )


@router.get("/expenses", response_model=ExpenseDashboardOut)
def expenses_dashboard(
    cycle: str = Query(..., description="YYYY-MM"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    yr, mo = _parse_cycle(cycle)
    open_balance = _cumulative_balance(db, yr, mo)
    collected = _sum_txns(db, yr, mo, TransactionDirection.in_)
    spent = _sum_txns(db, yr, mo, TransactionDirection.out)
    close_balance = open_balance + collected - spent

    txns = (
        db.query(Transaction)
        .filter(
            extract("year", Transaction.txn_date) == yr,
            extract("month", Transaction.txn_date) == mo,
        )
        .order_by(Transaction.txn_date.desc(), Transaction.id.desc())
        .all()
    )
    return ExpenseDashboardOut(
        cycle=cycle,
        open_balance=str(open_balance),
        collected=str(collected),
        spent=str(spent),
        close_balance=str(close_balance),
        transactions=[_txn_out(t) for t in txns],
    )


@router.get("/maintenance", response_model=MaintenanceDashboardOut)
def maintenance_dashboard(
    cycle: str = Query(..., description="YYYY-MM"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    yr, mo = _parse_cycle(cycle)
    units = db.query(Unit).order_by(Unit.identifier).all()

    charges_map = {
        c.unit_id: c
        for c in db.query(Charge).filter(Charge.cycle == cycle).all()
    }
    payments_sum = {
        row[0]: row[1]
        for row in db.query(Payment.charge_id, func.sum(Payment.amount))
        .filter(Payment.charge_id.in_([c.id for c in charges_map.values()]))
        .group_by(Payment.charge_id)
        .all()
    } if charges_map else {}

    unit_rows = []
    total_collected = Decimal("0")
    total_outstanding = Decimal("0")
    units_paid_count = 0
    rates = [u.charge_rate for u in units]
    rate_per_unit = rates[0] if rates else Decimal("0")

    for unit in units:
        charge = charges_map.get(unit.id)
        if charge is None:
            unit_rows.append(UnitDuesItem(
                unit_id=unit.id,
                unit_identifier=unit.identifier,
                unit_type=unit.type,
                charge_id=None,
                charge_amount="0.00",
                paid_amount="0.00",
                status="unpaid",
            ))
            continue

        paid = payments_sum.get(charge.id, Decimal("0"))
        if paid >= charge.amount:
            st = "paid"
            units_paid_count += 1
        elif paid > 0:
            st = "partial"
        else:
            st = "unpaid"

        total_collected += paid
        outstanding = max(charge.amount - paid, Decimal("0"))
        total_outstanding += outstanding

        unit_rows.append(UnitDuesItem(
            unit_id=unit.id,
            unit_identifier=unit.identifier,
            unit_type=unit.type,
            charge_id=charge.id,
            charge_amount=str(charge.amount),
            paid_amount=str(paid),
            status=st,
        ))

    return MaintenanceDashboardOut(
        cycle=cycle,
        total_units=len(units),
        units_paid=units_paid_count,
        collected=str(total_collected),
        outstanding=str(total_outstanding),
        rate_per_unit=str(rate_per_unit),
        units=unit_rows,
    )
