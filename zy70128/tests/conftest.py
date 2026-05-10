import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.database import Base, get_db
from app.models import (
    Race,
    ResultVersion,
    ResultRecord,
    ChipData,
    ChipBatch,
    Appeal,
    Review,
    ExceptionRecord,
    BackgroundTask,
)
from app.main import app as main_app
from httpx import AsyncClient, ASGITransport

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def test_engine():
    """测试用数据库引擎"""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        future=True
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture
async def test_session(test_engine):
    """测试用数据库会话"""
    async_session = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False
    )

    async with async_session() as session:
        yield session


@pytest_asyncio.fixture
async def app(test_session):
    """测试用 FastAPI 应用"""

    async def override_get_db():
        yield test_session

    main_app.dependency_overrides[get_db] = override_get_db
    yield main_app
    main_app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client(app):
    """测试用 HTTP 客户端"""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as client:
        yield client
