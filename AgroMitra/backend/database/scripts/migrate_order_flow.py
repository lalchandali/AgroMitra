"""Apply additive order-flow and trust/report schema updates to PostgreSQL.

Run from the inner AgroMitra project directory after setting backend/.env:
    python -m backend.database.scripts.migrate_order_flow

The script preserves existing rows and can be safely rerun. Existing reviews
are recorded in a unique claim table so historical duplicate reviews remain
intact while additional reviews for those buyer/product pairs are blocked.
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import URL

ENUM_VALUES = {
    "paymentmethod": ("cash_on_delivery", "mock_bkash", "mock_nagad"),
    "paymentstatus": ("paid",),
    "verificationstatus": ("pending", "approved", "rejected"),
}


def _create_migration_engine():
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
    engine = _create_migration_engine()

    if engine.dialect.name != "postgresql":
        raise RuntimeError("The order-flow migration requires PostgreSQL.")

    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as connection:
        inspector = inspect(connection)
        if not all(inspector.has_table(table) for table in ("products", "orders", "users", "reviews")):
            raise RuntimeError("Create the AgroMitra database tables before running this migration.")

        connection.execute(text("""
            DO $$ BEGIN
                CREATE TYPE verificationstatus AS ENUM ('pending', 'approved', 'rejected');
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$
        """))
        existing_types = set(connection.execute(text(
            "SELECT typname FROM pg_type "
            "WHERE typname IN ('paymentmethod', 'paymentstatus', 'verificationstatus')"
        )).scalars())
        missing_types = set(ENUM_VALUES) - existing_types
        if missing_types:
            raise RuntimeError(
                f"Expected PostgreSQL enum type(s) not found: {', '.join(sorted(missing_types))}."
            )
        for type_name, values in ENUM_VALUES.items():
            for value in values:
                connection.execute(text(
                    f"ALTER TYPE {type_name} ADD VALUE IF NOT EXISTS '{value}'"
                ))

    with engine.begin() as connection:
        connection.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
            "verification_status verificationstatus NOT NULL DEFAULT 'pending'"
        ))
        connection.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_reference TEXT"
        ))
        connection.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_reason TEXT"
        ))
        connection.execute(text(
            "ALTER TABLE products ADD COLUMN IF NOT EXISTS "
            "low_stock_threshold_kg NUMERIC(10, 2) NOT NULL DEFAULT 5.00"
        ))
        order_columns = {column["name"] for column in inspect(connection).get_columns("orders")}
        if "delivery_type" in order_columns and "delivery_method" not in order_columns:
            connection.execute(text(
                "ALTER TABLE orders RENAME COLUMN delivery_type TO delivery_method"
            ))
        elif "delivery_method" not in order_columns:
            connection.execute(text(
                "ALTER TABLE orders ADD COLUMN delivery_method deliverytype "
                "NOT NULL DEFAULT 'pickup'"
            ))
        connection.execute(text(
            "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_note TEXT"
        ))
        connection.execute(text(
            "ALTER TABLE orders ALTER COLUMN payment_method SET DEFAULT 'cash_on_delivery'"
        ))
        connection.execute(text(
            "ALTER TABLE orders ALTER COLUMN payment_status SET DEFAULT 'pending'"
        ))
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS review_product_claims (
                buyer_id UUID NOT NULL REFERENCES users(user_id),
                product_id UUID NOT NULL REFERENCES products(product_id),
                PRIMARY KEY (buyer_id, product_id)
            )
        """))
        connection.execute(text("""
            INSERT INTO review_product_claims (buyer_id, product_id)
            SELECT DISTINCT buyer_id, product_id FROM reviews
            ON CONFLICT (buyer_id, product_id) DO NOTHING
        """))
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS user_reports (
                report_id UUID PRIMARY KEY,
                reporter_id UUID NOT NULL REFERENCES users(user_id),
                target_type VARCHAR(16) NOT NULL,
                target_product_id UUID REFERENCES products(product_id) ON DELETE SET NULL,
                target_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
                reason TEXT NOT NULL,
                status VARCHAR(16) NOT NULL DEFAULT 'open',
                admin_note TEXT,
                created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                resolved_at TIMESTAMP WITHOUT TIME ZONE,
                CONSTRAINT ck_user_report_single_target CHECK (
                    (target_type = 'listing' AND target_user_id IS NULL)
                    OR (target_type = 'user' AND target_product_id IS NULL)
                )
            )
        """))
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_user_reports_created_at ON user_reports (created_at)"
        ))


if __name__ == "__main__":
    migrate()
    print("Order-flow database migration completed.")
