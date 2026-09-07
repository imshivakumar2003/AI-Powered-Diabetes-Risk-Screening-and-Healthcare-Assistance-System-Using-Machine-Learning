"""
init_db.py
-----------
Creates all database tables if they do not already exist. Safe to run
multiple times — it never drops or alters existing tables or data.

Usage:
    python init_db.py

This uses SQLAlchemy's metadata.create_all(), so it works identically
whether DATABASE_URL points to SQLite, MySQL, or PostgreSQL.
"""

from database import engine, init_engine_tables, DATABASE_URL
import models  # noqa: F401  (registers all models with Base.metadata)


def main():
    print(f"Connecting to: {DATABASE_URL}")
    init_engine_tables()

    # List the tables that now exist, as confirmation.
    from sqlalchemy import inspect
    inspector = inspect(engine)
    tables = inspector.get_table_names()

    print("Database ready. Tables present:")
    for t in sorted(tables):
        print(f"  - {t}")


if __name__ == "__main__":
    main()
