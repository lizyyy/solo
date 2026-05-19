import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import Base, get_db
from app.main import app
from app.models.models import (
    GrayBatch, MetricWindow, GapSegment, BackfillSource,
    BatchStatus, GapType, SourceType, OverrideStrategy
)

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    del app.dependency_overrides[get_db]


@pytest.fixture
def test_batch(db):
    batch = GrayBatch(
        batch_code="TEST-BATCH-001",
        batch_name="测试批次",
        description="测试用批次",
        created_by="test_user",
        status=BatchStatus.PENDING,
        override_strategy=OverrideStrategy.PROTECT,
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


@pytest.fixture
def test_metric_window(db, test_batch):
    now = datetime.now()
    window = MetricWindow(
        batch_id=test_batch.id,
        metric_name="test_latency_p99",
        window_start=now - timedelta(hours=2),
        window_end=now,
        tags='{"service": "test"}',
    )
    db.add(window)
    db.commit()
    db.refresh(window)
    return window


@pytest.fixture
def test_gap_segment(db, test_metric_window):
    now = datetime.now()
    gap = GapSegment(
        metric_window_id=test_metric_window.id,
        gap_type=GapType.MISSING,
        gap_start=now - timedelta(hours=1, minutes=30),
        gap_end=now - timedelta(hours=1),
        expected_points=60,
        actual_points=0,
        fill_rate=0.0,
        is_backfilled=False,
    )
    db.add(gap)
    db.commit()
    db.refresh(gap)
    return gap


@pytest.fixture
def test_backfill_source(db, test_gap_segment):
    source = BackfillSource(
        gap_segment_id=test_gap_segment.id,
        source_type=SourceType.LOG_REPLAY,
        source_name="测试回填源",
        data_hash="test_hash_12345",
        record_count=60,
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


@pytest.fixture
def complete_batch_setup(db, test_batch, test_metric_window, test_gap_segment, test_backfill_source):
    """创建完整的批次配置，可用于执行处理测试"""
    return {
        "batch": test_batch,
        "window": test_metric_window,
        "gap": test_gap_segment,
        "source": test_backfill_source,
    }
