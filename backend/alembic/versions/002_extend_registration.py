"""Extend registration with password/flat_no/building_name + add secretary/president roles

Revision ID: 002
Revises: 001
Create Date: 2026-05-29
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    # Extend userrole enum with new values (idempotent)
    for new_value in ("secretary", "president"):
        bind.execute(sa.text(f"""
            DO $$ BEGIN
                ALTER TYPE userrole ADD VALUE IF NOT EXISTS '{new_value}';
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        """))

    # Add columns to users
    op.add_column("users", sa.Column("flat_no", sa.String(50), nullable=True))
    op.add_column("users", sa.Column("building_name", sa.String(150), nullable=True))

    # Add columns to registration_requests
    op.add_column("registration_requests", sa.Column("email", sa.String(254), nullable=True))
    op.add_column("registration_requests", sa.Column("phone", sa.String(20), nullable=True))
    op.add_column("registration_requests", sa.Column("password_hash", sa.String(255), nullable=True))
    op.add_column("registration_requests", sa.Column("flat_no", sa.String(50), nullable=True))
    op.add_column("registration_requests", sa.Column("building_name", sa.String(150), nullable=True))


def downgrade() -> None:
    op.drop_column("registration_requests", "building_name")
    op.drop_column("registration_requests", "flat_no")
    op.drop_column("registration_requests", "password_hash")
    op.drop_column("registration_requests", "phone")
    op.drop_column("registration_requests", "email")
    op.drop_column("users", "building_name")
    op.drop_column("users", "flat_no")
    # Note: Postgres cannot remove enum values without recreating the type.
    # Leaving 'secretary' and 'president' in the enum is harmless.
