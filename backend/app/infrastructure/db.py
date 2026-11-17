"""Database configuration and session management using SQLAlchemy 2.x."""
from __future__ import annotations

import os
from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

DEFAULT_DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "dueping.db"))
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")

# For SQLite, ensure connect_args allows multi-threaded access in FastAPI
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args=connect_args,
)


def enable_sqlite_foreign_keys(target_engine) -> None:
    """Ensure SQLite enforces foreign key constraints on connect."""
    if str(target_engine.url).startswith("sqlite"):
        @event.listens_for(target_engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()


enable_sqlite_foreign_keys(engine)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base declarative class for all SQLAlchemy ORM models."""
    pass


def create_all() -> None:
    """Create all tables in the database."""
    # Import orm_models so all models are registered on Base.metadata
    import app.infrastructure.orm_models  # noqa: F401
    Base.metadata.create_all(bind=engine)


def drop_all() -> None:
    """Drop all tables in the database."""
    import app.infrastructure.orm_models  # noqa: F401
    Base.metadata.drop_all(bind=engine)


def get_session() -> Generator[Session, None, None]:
    """Dependency helper yielding a database session."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
