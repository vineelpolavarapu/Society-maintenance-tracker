from decimal import Decimal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.config import settings
from app.core.security import hash_password
from app.database import Base, SessionLocal, engine
from app.models import Unit, UnitType, User, UserRole, UserStatus
from app.routers import auth, charges, dashboard, payments, registrations, transactions, units


def _ensure_schema_upgrades() -> None:
    """Idempotently bring already-existing tables up to the current model.
    Safe to run on every startup. Uses Postgres `IF NOT EXISTS` so it's a no-op
    once the columns / enum values are in place."""
    # ALTER TYPE ... ADD VALUE cannot run inside a transaction block, so use AUTOCOMMIT.
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        for new_value in ("secretary", "president"):
            conn.execute(text(
                f"ALTER TYPE userrole ADD VALUE IF NOT EXISTS '{new_value}'"
            ))

    # Column additions can use a normal transaction.
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS flat_no VARCHAR(50)"))
        conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS building_name VARCHAR(150)"))

        conn.execute(text("ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS email VARCHAR(254)"))
        conn.execute(text("ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS phone VARCHAR(20)"))
        conn.execute(text("ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)"))
        conn.execute(text("ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS flat_no VARCHAR(50)"))
        conn.execute(text("ALTER TABLE registration_requests ADD COLUMN IF NOT EXISTS building_name VARCHAR(150)"))


_DEFAULT_UNITS = [
    # identifier, type, monthly maintenance rate
    ("Villa-01", UnitType.villa, Decimal("3500.00")),
    ("Villa-02", UnitType.villa, Decimal("3500.00")),
    ("Villa-03", UnitType.villa, Decimal("3500.00")),
    ("Villa-04", UnitType.villa, Decimal("3500.00")),
    ("Bungalow-A1", UnitType.bungalow, Decimal("3000.00")),
    ("Bungalow-A2", UnitType.bungalow, Decimal("3000.00")),
    ("Bungalow-B1", UnitType.bungalow, Decimal("3000.00")),
    ("Apt-101", UnitType.apartment, Decimal("2200.00")),
    ("Apt-102", UnitType.apartment, Decimal("2200.00")),
    ("Apt-103", UnitType.apartment, Decimal("2200.00")),
    ("Apt-201", UnitType.apartment, Decimal("2200.00")),
    ("Apt-202", UnitType.apartment, Decimal("2200.00")),
    ("Apt-203", UnitType.apartment, Decimal("2200.00")),
    ("Apt-301", UnitType.apartment, Decimal("2200.00")),
    ("Apt-302", UnitType.apartment, Decimal("2200.00")),
    ("Apt-303", UnitType.apartment, Decimal("2200.00")),
    ("House-12", UnitType.individual_house, Decimal("2800.00")),
    ("House-13", UnitType.individual_house, Decimal("2800.00")),
    ("House-14", UnitType.individual_house, Decimal("2800.00")),
    ("House-15", UnitType.individual_house, Decimal("2800.00")),
]


def _seed_default_units() -> None:
    """Seed a starter set of units so the registration dropdown isn't empty.
    Only inserts identifiers that don't already exist — safe on every boot."""
    with SessionLocal() as db:
        existing = {u.identifier for u in db.query(Unit).all()}
        added = 0
        for identifier, type_, rate in _DEFAULT_UNITS:
            if identifier in existing:
                continue
            db.add(Unit(identifier=identifier, type=type_, charge_rate=rate))
            added += 1
        if added:
            db.commit()


# Default staff accounts for development. Override via env or DB in production.
_DEFAULT_STAFF = [
    # (name, email, phone, password, role, can_approve)
    ("Admin Treasurer", "admin@arihant.local",     "9000000001", "Admin@123",     UserRole.treasurer, True),
    ("Society Secretary", "secretary@arihant.local","9000000002", "Secretary@123", UserRole.secretary, True),
    ("Society President", "president@arihant.local","9000000003", "President@123", UserRole.president, False),
]


def _seed_default_staff() -> None:
    """Seed default Admin / Secretary / President accounts so the role-specific
    login pages work out of the box. Only inserts if the email isn't already
    taken — safe on every boot."""
    with SessionLocal() as db:
        for name, email, phone, password, role, can_approve in _DEFAULT_STAFF:
            already = db.query(User).filter(
                (User.email == email) | (User.phone == phone) | (User.role == role)
            ).first()
            if already:
                continue
            db.add(User(
                name=name,
                email=email,
                phone=phone,
                password_hash=hash_password(password),
                role=role,
                can_approve=can_approve,
                status=UserStatus.active,
            ))
        db.commit()


# Auto-create all tables on startup (idempotent — only creates missing tables)
Base.metadata.create_all(bind=engine)

# Bring existing tables up to current model (idempotent ALTERs)
try:
    _ensure_schema_upgrades()
except SQLAlchemyError as ex:
    # Don't crash the app if the upgrade SQL fails (e.g. on a non-Postgres dev DB).
    # Surface it via the logs instead.
    import logging
    logging.getLogger(__name__).warning("Schema upgrade skipped: %s", ex)

# Seed sample units so the registration dropdown is usable out of the box
try:
    _seed_default_units()
except SQLAlchemyError as ex:
    import logging
    logging.getLogger(__name__).warning("Unit seeding skipped: %s", ex)

# Seed default Admin / Secretary / President accounts for immediate login
try:
    _seed_default_staff()
except SQLAlchemyError as ex:
    import logging
    logging.getLogger(__name__).warning("Staff seeding skipped: %s", ex)


app = FastAPI(
    title="Society Maintenance & Expense Tracker",
    version="1.0.0",
    description="Phase 1 — single society financial ledger",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(units.router)
app.include_router(transactions.router)
app.include_router(charges.router)
app.include_router(payments.router)
app.include_router(registrations.router)
app.include_router(dashboard.router)


@app.get("/health")
def health():
    return {"status": "ok"}
