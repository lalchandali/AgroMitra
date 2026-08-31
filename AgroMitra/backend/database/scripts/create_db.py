import os

import psycopg2
from dotenv import load_dotenv
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# ── .env থেকে DB password লোড করো — source-এ hardcode করা হয় না ──
load_dotenv()

DB_PARAMS = dict(
    dbname='postgres',
    user=os.getenv('DB_ADMIN_USER', 'postgres'),
    password=os.getenv('DB_ADMIN_PASSWORD'),
    host=os.getenv('DB_HOST', 'localhost'),
    port=os.getenv('DB_PORT', 5432),
)

if __name__ == '__main__':
    if not DB_PARAMS['password']:
        raise SystemExit(
            "ERROR: DB_ADMIN_PASSWORD পাওয়া যায়নি। backend/.env-এ "
            "DB_ADMIN_PASSWORD=<your_postgres_password> যোগ করুন।"
        )
    try:
        conn = psycopg2.connect(**DB_PARAMS)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM pg_database WHERE datname='agromitra_db'")
        if cur.fetchone():
            print('Database agromitra_db already exists')
        else:
            cur.execute('CREATE DATABASE agromitra_db')
            print('Database agromitra_db created')
        cur.close()
        conn.close()
    except Exception as e:
        print('ERROR:', e)
        raise
