from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy import create_engine, event, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from hazardous_gate.config import get_settings
from hazardous_gate.models.database import Base

settings = get_settings()


def get_sync_engine():
    sync_url = settings.DATABASE_URL
    if sync_url.startswith("sqlite+aiosqlite://"):
        sync_url = sync_url.replace("sqlite+aiosqlite://", "sqlite:///")
    elif sync_url.startswith("sqlite://"):
        pass
    return create_engine(
        sync_url,
        echo=settings.DEBUG,
        connect_args={"check_same_thread": False} if "sqlite" in sync_url else {},
    )


def get_async_engine():
    url = settings.DATABASE_URL
    if url.startswith("sqlite://") and not url.startswith("sqlite+aiosqlite://"):
        url = url.replace("sqlite:///", "sqlite+aiosqlite:///")
    return create_async_engine(
        url,
        echo=settings.DEBUG,
        connect_args={"check_same_thread": False} if "sqlite" in url else {},
    )


async_engine = get_async_engine()
AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@event.listens_for(get_sync_engine(), "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


async def init_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def drop_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


async def get_async_session() -> AsyncGenerator[AsyncSession, Any]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
