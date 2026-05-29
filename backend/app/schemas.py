from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator

from app.models import (
    RegistrationStatus, TransactionDirection, TransactionStatus,
    UnitType, UserRole, UserStatus,
)


# ── Units ──────────────────────────────────────────────────────────────────────

class UnitCreate(BaseModel):
    identifier: str
    type: UnitType
    charge_rate: Decimal

    @field_validator("charge_rate")
    @classmethod
    def positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("charge_rate must be positive")
        return v


class UnitOut(BaseModel):
    id: int
    identifier: str
    type: UnitType
    charge_rate: str
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("charge_rate", mode="before")
    @classmethod
    def decimal_to_str(cls, v):
        return str(v)


# ── Auth / Users ───────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: str
    confirm_password: str
    flat_no: Optional[str] = None
    building_name: Optional[str] = None
    claimed_unit_id: Optional[int] = None

    @field_validator("name")
    @classmethod
    def non_empty_name(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name is required")
        return v.strip()

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("password must be at least 6 characters")
        return v

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("passwords do not match")
        return v


class LoginRequest(BaseModel):
    contact: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    name: str
    email: Optional[str]
    phone: Optional[str]
    unit_id: Optional[int]
    flat_no: Optional[str] = None
    building_name: Optional[str] = None
    role: UserRole
    can_approve: bool
    status: UserStatus
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Registration Requests ──────────────────────────────────────────────────────

class RegistrationRequestOut(BaseModel):
    id: int
    name: str
    contact: str
    email: Optional[str] = None
    phone: Optional[str] = None
    flat_no: Optional[str] = None
    building_name: Optional[str] = None
    claimed_unit_id: Optional[int]
    status: RegistrationStatus
    decided_by: Optional[int]
    decided_at: Optional[datetime]
    created_at: datetime
    unit_identifier: Optional[str] = None

    model_config = {"from_attributes": True}


# ── Transactions ───────────────────────────────────────────────────────────────

class TransactionCreate(BaseModel):
    direction: TransactionDirection
    amount: Decimal
    txn_date: datetime
    description: str
    category: Optional[str] = None

    @field_validator("amount")
    @classmethod
    def positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v

    @field_validator("description")
    @classmethod
    def non_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("description is required")
        return v.strip()


class TransactionOut(BaseModel):
    id: int
    direction: TransactionDirection
    amount: str
    txn_date: datetime
    description: str
    category: Optional[str]
    recorded_by: int
    recorded_by_name: Optional[str] = None
    recorded_at: datetime
    reverses_transaction_id: Optional[int]
    status: TransactionStatus

    model_config = {"from_attributes": True}

    @field_validator("amount", mode="before")
    @classmethod
    def decimal_to_str(cls, v):
        return str(v)


# ── Charges ────────────────────────────────────────────────────────────────────

class ChargeBulkCreate(BaseModel):
    cycle: str  # YYYY-MM
    amount: Optional[Decimal] = None  # if None, uses each unit's charge_rate

    @field_validator("cycle")
    @classmethod
    def valid_cycle(cls, v: str) -> str:
        import re
        if not re.fullmatch(r"\d{4}-\d{2}", v):
            raise ValueError("cycle must be YYYY-MM")
        return v


class ChargeOut(BaseModel):
    id: int
    unit_id: int
    unit_identifier: Optional[str] = None
    cycle: str
    amount: str
    raised_by: int
    raised_at: datetime
    paid_amount: str = "0.00"
    status: str = "unpaid"

    model_config = {"from_attributes": True}

    @field_validator("amount", mode="before")
    @classmethod
    def decimal_to_str(cls, v):
        return str(v)


# ── Payments ───────────────────────────────────────────────────────────────────

class PaymentCreate(BaseModel):
    charge_id: int
    amount: Decimal
    method: str
    reference: Optional[str] = None
    txn_date: datetime

    @field_validator("amount")
    @classmethod
    def positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v


class PaymentOut(BaseModel):
    id: int
    charge_id: int
    unit_id: int
    amount: str
    method: str
    reference: Optional[str]
    transaction_id: int
    recorded_by: int
    recorded_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("amount", mode="before")
    @classmethod
    def decimal_to_str(cls, v):
        return str(v)


# ── Dashboard ──────────────────────────────────────────────────────────────────

class ExpenseDashboardOut(BaseModel):
    cycle: str
    open_balance: str
    collected: str
    spent: str
    close_balance: str
    transactions: list[TransactionOut]


class UnitDuesItem(BaseModel):
    unit_id: int
    unit_identifier: str
    unit_type: UnitType
    charge_id: Optional[int]
    charge_amount: str
    paid_amount: str
    status: str  # paid / partial / unpaid


class MaintenanceDashboardOut(BaseModel):
    cycle: str
    total_units: int
    units_paid: int
    collected: str
    outstanding: str
    rate_per_unit: str
    units: list[UnitDuesItem]


class UnitHistoryItem(BaseModel):
    cycle: str
    charge_id: Optional[int]
    charge_amount: str
    paid_amount: str
    status: str


class UnitDuesOut(BaseModel):
    unit_id: int
    unit_identifier: str
    history: list[UnitHistoryItem]
