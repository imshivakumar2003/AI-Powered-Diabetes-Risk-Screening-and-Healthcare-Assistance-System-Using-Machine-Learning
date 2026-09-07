"""
database.py
------------
Central database connection setup using SQLAlchemy.

By default this uses a local SQLite file (app.db) — zero setup required for
development. To move to MySQL or PostgreSQL later, you do NOT need to touch
any other file: just change DATABASE_URL in your .env file. Examples:

    SQLite (default):
        DATABASE_URL=sqlite:///app.db

    PostgreSQL:
        DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/diabetes_db

    MySQL:
        DATABASE_URL=mysql+pymysql://user:password@localhost:3306/diabetes_db

Everything else (models.py, app.py, init_db.py) is database-agnostic because
it talks to SQLAlchemy's ORM layer, not to SQLite directly.
"""

import os
from contextlib import contextmanager

from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SQLITE_PATH = os.path.join(BASE_DIR, "app.db")

DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{DEFAULT_SQLITE_PATH}")

# `check_same_thread=False` is only needed for SQLite (Flask handles
# requests across threads). `timeout=30` prevents "database is locked" 500 errors.
connect_args = {"check_same_thread": False, "timeout": 30} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,   # avoids "server has gone away" errors on MySQL/Postgres
    echo=False,
)

# Enforce foreign key constraints on SQLite (off by default in SQLite).
if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def init_engine_tables():
    """Create all tables if they don't already exist. Safe to call every
    app startup — it will not touch existing tables or data."""
    import models  # noqa: F401  (ensures models are registered on Base)
    Base.metadata.create_all(bind=engine)


@contextmanager
def get_session():
    """Context-managed DB session with automatic commit/rollback/close.

    Usage:
        with get_session() as db:
            db.add(obj)
    """
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
