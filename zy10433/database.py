from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./api_change_subscription.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Subscriber(Base):
    __tablename__ = "subscribers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    subscriptions = relationship("Subscription", back_populates="subscriber")


class ApiPath(Base):
    __tablename__ = "api_paths"

    id = Column(Integer, primary_key=True, index=True)
    path = Column(String(500), nullable=False, index=True)
    method = Column(String(20), nullable=False)
    service = Column(String(100))
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    subscriptions = relationship("Subscription", back_populates="api_path")


class ChangeType(Base):
    __tablename__ = "change_types"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), nullable=False, unique=True)
    name = Column(String(100), nullable=False)
    severity = Column(String(20), default="medium")
    description = Column(Text)

    subscriptions = relationship("Subscription", back_populates="change_type")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    subscriber_id = Column(Integer, ForeignKey("subscribers.id"), nullable=False)
    api_path_id = Column(Integer, ForeignKey("api_paths.id"), nullable=False)
    change_type_id = Column(Integer, ForeignKey("change_types.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    subscriber = relationship("Subscriber", back_populates="subscriptions")
    api_path = relationship("ApiPath", back_populates="subscriptions")
    change_type = relationship("ChangeType", back_populates="subscriptions")


class ApiChange(Base):
    __tablename__ = "api_changes"

    id = Column(Integer, primary_key=True, index=True)
    api_path_id = Column(Integer, ForeignKey("api_paths.id"), nullable=False)
    change_type_id = Column(Integer, ForeignKey("change_types.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    change_date = Column(DateTime, nullable=False)
    effective_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    raw_input = Column(Text)
    processing_result = Column(Text)
    is_processed = Column(Boolean, default=False)
    need_manual_correction = Column(Boolean, default=False)
    correction_note = Column(Text)


class NotificationBatch(Base):
    __tablename__ = "notification_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String(50), nullable=False, unique=True)
    api_change_id = Column(Integer, ForeignKey("api_changes.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(20), default="pending")
    retry_count = Column(Integer, default=0)
    last_retry_at = Column(DateTime)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("notification_batches.id"), nullable=False)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=False)
    subscriber_id = Column(Integer, ForeignKey("subscribers.id"), nullable=False)
    api_change_id = Column(Integer, ForeignKey("api_changes.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(20), default="pending")
    confirmed_at = Column(DateTime)
    confirm_deadline = Column(DateTime)
    confirmation_note = Column(Text)
    is_duplicate = Column(Boolean, default=False)
    raw_notes = Column(Text)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
