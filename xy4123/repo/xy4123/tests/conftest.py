import pytest_asyncio
from datetime import date, timedelta
from decimal import Decimal
from typing import AsyncGenerator

from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

from hazardous_gate.models.database import Base
from hazardous_gate.main import app
from hazardous_gate.storage.database import get_async_session


TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def test_engine():
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def test_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    TestingSessionLocal = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with TestingSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client(test_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_async_session():
        yield test_session

    app.dependency_overrides[get_async_session] = override_get_async_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def sample_reagent_data() -> dict:
    return {
        "name": "盐酸",
        "cas_number": "7647-01-0",
        "english_name": "Hydrochloric acid",
        "molecular_formula": "HCl",
        "molecular_weight": 36.46,
        "hazard_level": "中危",
        "storage_group": "酸类",
        "cabinet_type": "酸柜",
        "min_authorization_level": 2,
        "safety_info": "强腐蚀性，避免接触皮肤",
    }


@pytest_asyncio.fixture
async def sample_batch_data() -> dict:
    today = date.today()
    return {
        "reagent_id": 1,
        "batch_number": "HC-2026-001",
        "manufacturer": "国药集团",
        "purity": "AR",
        "concentration": Decimal("37.5"),
        "concentration_unit": "%",
        "package_unit": "ml",
        "initial_quantity": Decimal("500.0"),
        "current_quantity": Decimal("500.0"),
        "expiry_date": today + timedelta(days=365),
        "production_date": today - timedelta(days=30),
        "storage_location": "A区1排",
        "cabinet_number": "AC-001",
    }


@pytest_asyncio.fixture
async def expired_batch_data() -> dict:
    today = date.today()
    return {
        "reagent_id": 1,
        "batch_number": "HC-2025-EXPIRED",
        "manufacturer": "国药集团",
        "purity": "AR",
        "concentration": Decimal("37.5"),
        "concentration_unit": "%",
        "package_unit": "ml",
        "initial_quantity": Decimal("500.0"),
        "current_quantity": Decimal("100.0"),
        "expiry_date": today - timedelta(days=30),
        "production_date": today - timedelta(days=400),
        "storage_location": "A区1排",
        "cabinet_number": "AC-001",
    }
