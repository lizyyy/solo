import pytest
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def sample_dates():
    today = date(2026, 5, 9)
    return {
        "today": today,
        "tomorrow": today + timedelta(days=1),
        "in_3_days": today + timedelta(days=3),
        "in_7_days": today + timedelta(days=7),
        "yesterday": today - timedelta(days=1),
        "3_days_ago": today - timedelta(days=3),
        "7_days_ago": today - timedelta(days=7),
        "10_days_ago": today - timedelta(days=10),
        "sign_date": date(2026, 4, 1),
        "effective_date": date(2026, 4, 10),
        "expiry_date": date(2026, 12, 31),
    }
