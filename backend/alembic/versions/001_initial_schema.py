"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-05-27
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _enum(values, name):
    """Enum that won't auto-CREATE/DROP its type inside create_table."""
    return sa.Enum(*values, name=name, create_type=False)


def upgrade() -> None:
    bind = op.get_bind()

    # Create PG enum types — DO block silently skips if they already exist
    enum_defs = [
        ("unittype",           "'villa','bungalow','apartment','individual_house'"),
        ("userrole",           "'treasurer','committee','resident'"),
        ("userstatus",         "'active','pending','rejected'"),
        ("registrationstatus", "'pending','approved','rejected'"),
        ("transactiondirection", "'in','out'"),
        ("transactionstatus",  "'active','reversed'"),
    ]
    for type_name, values in enum_defs:
        bind.execute(sa.text(f"""
            DO $$ BEGIN
                CREATE TYPE {type_name} AS ENUM ({values});
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        """))

    op.create_table(
        "units",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("identifier", sa.String(100), nullable=False, unique=True),
        sa.Column("type", _enum(["villa","bungalow","apartment","individual_house"], "unittype"), nullable=False),
        sa.Column("charge_rate", sa.Numeric(12, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("email", sa.String(254), nullable=True, unique=True),
        sa.Column("phone", sa.String(20), nullable=True, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("unit_id", sa.Integer, sa.ForeignKey("units.id"), nullable=True),
        sa.Column("role", _enum(["treasurer","committee","resident"], "userrole"), nullable=False),
        sa.Column("can_approve", sa.Boolean, nullable=False, default=False),
        sa.Column("status", _enum(["active","pending","rejected"], "userstatus"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "registration_requests",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("contact", sa.String(254), nullable=False),
        sa.Column("claimed_unit_id", sa.Integer, sa.ForeignKey("units.id"), nullable=True),
        sa.Column("status", _enum(["pending","approved","rejected"], "registrationstatus"), nullable=False),
        sa.Column("decided_by", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "transactions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("direction", _enum(["in","out"], "transactiondirection"), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("txn_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("recorded_by", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("reverses_transaction_id", sa.Integer, sa.ForeignKey("transactions.id"), nullable=True, unique=True),
        sa.Column("status", _enum(["active","reversed"], "transactionstatus"), nullable=False),
        sa.CheckConstraint("amount > 0", name="ck_transactions_amount_positive"),
    )

    # Append-only guardrail
    op.execute("CREATE RULE no_update_transactions AS ON UPDATE TO transactions DO INSTEAD NOTHING")
    op.execute("CREATE RULE no_delete_transactions AS ON DELETE TO transactions DO INSTEAD NOTHING")

    op.create_table(
        "charges",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("unit_id", sa.Integer, sa.ForeignKey("units.id"), nullable=False),
        sa.Column("cycle", sa.String(7), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("raised_by", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("raised_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("amount > 0", name="ck_charges_amount_positive"),
        sa.UniqueConstraint("unit_id", "cycle", name="uq_charges_unit_cycle"),
    )

    op.create_table(
        "payments",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("charge_id", sa.Integer, sa.ForeignKey("charges.id"), nullable=False),
        sa.Column("unit_id", sa.Integer, sa.ForeignKey("units.id"), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("method", sa.String(50), nullable=False),
        sa.Column("reference", sa.String(200), nullable=True),
        sa.Column("transaction_id", sa.Integer, sa.ForeignKey("transactions.id"), nullable=False, unique=True),
        sa.Column("recorded_by", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("amount > 0", name="ck_payments_amount_positive"),
    )


def downgrade() -> None:
    op.drop_table("payments")
    op.drop_table("charges")
    op.execute("DROP RULE IF EXISTS no_update_transactions ON transactions")
    op.execute("DROP RULE IF EXISTS no_delete_transactions ON transactions")
    op.drop_table("transactions")
    op.drop_table("registration_requests")
    op.drop_table("users")
    op.drop_table("units")
    bind = op.get_bind()
    for t in ["transactionstatus","transactiondirection","registrationstatus","userstatus","userrole","unittype"]:
        bind.execute(sa.text(f"DROP TYPE IF EXISTS {t}"))
