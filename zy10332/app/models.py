from sqlalchemy import Column, String, Integer, DateTime, Boolean, Float, JSON
from sqlalchemy.sql import func
from app.database import Base
import uuid


def generate_uuid():
    return str(uuid.uuid4())


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(String)
    expected_frequency_seconds = Column(Integer, nullable=False)
    owner = Column(String)
    tags = Column(JSON)
    is_active = Column(Boolean, default=True)
    current_watermark = Column(String)
    latest_source_updated_at = Column(DateTime)
    latest_cache_updated_at = Column(DateTime)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class FreshnessRecord(Base):
    __tablename__ = "freshness_records"

    id = Column(String, primary_key=True, default=generate_uuid, index=True)
    dataset_id = Column(String, index=True, nullable=False)
    source_updated_at = Column(DateTime, nullable=False)
    cache_updated_at = Column(DateTime, nullable=False)
    sync_watermark = Column(String)
    query_consumer = Column(String)
    record_metadata = Column(JSON)
    is_fresh = Column(Boolean, nullable=False)
    freshness_score = Column(Float, nullable=False)
    is_expired = Column(Boolean, nullable=False)
    expiration_explanation = Column(String, nullable=False)
    request_id = Column(String, index=True)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class IdempotentRequest(Base):
    __tablename__ = "idempotent_requests"

    request_id = Column(String, primary_key=True, index=True)
    dataset_id = Column(String, index=True, nullable=False)
    operation_type = Column(String, nullable=False)
    response_data = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    dataset_id = Column(String, index=True, nullable=False)
    subscriber = Column(String, index=True, nullable=False)
    notification_channel = Column(String, default="api")
    threshold_score = Column(Float, default=0.5)
    notify_on_expired = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    subscription_id = Column(String, index=True, nullable=False)
    dataset_id = Column(String, index=True, nullable=False)
    subscriber = Column(String, index=True, nullable=False)
    notification_type = Column(String, nullable=False)
    message = Column(String, nullable=False)
    freshness_score = Column(Float, nullable=False)
    is_expired = Column(Boolean, nullable=False)
    is_sent = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
