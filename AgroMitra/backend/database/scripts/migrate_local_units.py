"""Add unit-aware product and order quantities without modifying existing stock.

Run from the inner AgroMitra directory after configuring backend/.env:
    python -m backend.database.scripts.migrate_local_units
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import URL


def _create_engine():
    database_url = os.getenv("DATABASE_URL", "").strip()
    if (
        database_url
        and "user:password" not in database_url
        and "host:port" not in database_url
        and "/dbname" not in database_url.lower()
    ):
        return create_engine(database_url)

    password = os.getenv("DB_ADMIN_PASSWORD", "")
    if not password:
        raise RuntimeError(
            "Set DATABASE_URL or DB_ADMIN_PASSWORD in backend/.env before running this migration."
        )

    return create_engine(URL.create(
        "postgresql+psycopg2",
        username=os.getenv("DB_ADMIN_USER", "postgres"),
        password=password,
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5432")),
        database="agromitra_db",
    ))


def migrate():
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    engine = _create_engine()
    if engine.dialect.name != "postgresql":
        raise RuntimeError("The local-units migration requires PostgreSQL.")

    with engine.begin() as connection:
        inspector = inspect(connection)
        if not inspector.has_table("products") or not inspector.has_table("order_items"):
            raise RuntimeError("Create the AgroMitra database tables before running this migration.")

        connection.execute(text(
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS "
            "sale_unit VARCHAR(16) NOT NULL DEFAULT 'kg'"
        ))
        connection.execute(text(
            "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS quantity NUMERIC(10, 2)"
        ))
        connection.execute(text(
            "ALTER TABLE order_items ADD COLUMN IF NOT EXISTS "
            "unit VARCHAR(16) NOT NULL DEFAULT 'kg'"
        ))
        connection.execute(text(
            "UPDATE order_items SET quantity = quantity_kg WHERE quantity IS NULL"
        ))
        connection.execute(text(
            "ALTER TABLE order_items ALTER COLUMN quantity SET NOT NULL"
        ))


if __name__ == "__main__":
    migrate()
    print("Local-units database migration completed.")
