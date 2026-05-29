import enum
from decimal import Decimal

from sqlalchemy import (
    Boolean, CheckConstraint, Column, DateTime, Enum, ForeignKey,
    Integer, Numeric, String, Text, UniqueConstraint, func,
)
from sqlalchemy.orm import relationship

from app.database import Base


class UnitType(str, enum.Enum):
    villa = "villa"
    bungalow = "bungalow"
    apartment = "apartment"
    individual_house = "individual_house"


class UserRole(str, enum.Enum):
    treasurer = "treasurer"
    committee = "committee"
    secretary = "secretary"
    president = "president"
    resident = "resident"


class UserStatus(str, enum.Enum):
    active = "active"
    pending = "pending"
    rejected = "rejected"


class RegistrationStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class TransactionDirection(str, enum.Enum):
    in_ = "in"
    out = "out"


class TransactionStatus(str, enum.Enum):
    active = "active"
    reversed = "reversed"


class Unit(Base):
    __tablename__ = "units"

    id = Column(Integer, primary_key=True)
    identifier = Column(String(100), nullable=False, unique=True)
    type = Column(Enum(UnitType), nullable=False)
    charge_rate = Column(Numeric(12, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    users = relationship("User", back_populates="unit")
    charges = relationship("Charge", back_populates="unit")
    payments = relationship("Payment", back_populates="unit")
    registration_requests = relationship("RegistrationRequest", back_populates="unit")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    email = Column(String(254), nullable=True, unique=True)
    phone = Column(String(20), nullable=True, unique=True)
    password_hash = Column(String(255), nullable=False)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=True)
    flat_no = Column(String(50), nullable=True)
    building_name = Column(String(150), nullable=True)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.resident)
    can_approve = Column(Boolean, nullable=False, default=False)
    status = Column(Enum(UserStatus), nullable=False, default=UserStatus.pending)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    unit = relationship("Unit", back_populates="users")
    recorded_transactions = relationship("Transaction", back_populates="recorded_by_user",
                                         foreign_keys="Transaction.recorded_by")
    raised_charges = relationship("Charge", back_populates="raised_by_user")
    recorded_payments = relationship("Payment", back_populates="recorded_by_user")
    registration_decisions = relationship("RegistrationRequest", back_populates="decided_by_user")


class RegistrationRequest(Base):
    __tablename__ = "registration_requests"

    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    contact = Column(String(254), nullable=False)
    email = Column(String(254), nullable=True)
    phone = Column(String(20), nullable=True)
    password_hash = Column(String(255), nullable=True)
    flat_no = Column(String(50), nullable=True)
    building_name = Column(String(150), nullable=True)
    claimed_unit_id = Column(Integer, ForeignKey("units.id"), nullable=True)
    status = Column(Enum(RegistrationStatus), nullable=False, default=RegistrationStatus.pending)
    decided_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    decided_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    unit = relationship("Unit", back_populates="registration_requests")
    decided_by_user = relationship("User", back_populates="registration_decisions")


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_transactions_amount_positive"),
    )

    id = Column(Integer, primary_key=True)
    direction = Column(Enum(TransactionDirection), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    txn_date = Column(DateTime(timezone=True), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(100), nullable=True)
    recorded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    reverses_transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True, unique=True)
    status = Column(Enum(TransactionStatus), nullable=False, default=TransactionStatus.active)

    recorded_by_user = relationship("User", back_populates="recorded_transactions",
                                     foreign_keys=[recorded_by])
    original_transaction = relationship("Transaction", remote_side="Transaction.id",
                                         foreign_keys=[reverses_transaction_id])
    payment = relationship("Payment", back_populates="transaction", uselist=False)


class Charge(Base):
    __tablename__ = "charges"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_charges_amount_positive"),
        UniqueConstraint("unit_id", "cycle", name="uq_charges_unit_cycle"),
    )

    id = Column(Integer, primary_key=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False)
    cycle = Column(String(7), nullable=False)  # YYYY-MM
    amount = Column(Numeric(12, 2), nullable=False)
    raised_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    raised_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    unit = relationship("Unit", back_populates="charges")
    raised_by_user = relationship("User", back_populates="raised_charges")
    payments = relationship("Payment", back_populates="charge")


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_payments_amount_positive"),
    )

    id = Column(Integer, primary_key=True)
    charge_id = Column(Integer, ForeignKey("charges.id"), nullable=False)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    method = Column(String(50), nullable=False)
    reference = Column(String(200), nullable=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=False, unique=True)
    recorded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    charge = relationship("Charge", back_populates="payments")
    unit = relationship("Unit", back_populates="payments")
    transaction = relationship("Transaction", back_populates="payment")
    recorded_by_user = relationship("User", back_populates="recorded_payments",
                                     foreign_keys=[recorded_by])
