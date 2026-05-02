from sqlalchemy import create_engine, Column, String, Float, DateTime, Integer, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

DATABASE_URL = "sqlite:///./reconciliation.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Order(Base):
    __tablename__ = "orders"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True)
    cabinet_id = Column(String, index=True)
    slot_id = Column(String, index=True)
    start_time = Column(DateTime, index=True)
    end_time = Column(DateTime, index=True, nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    amount = Column(Float)
    status = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class CabinetEvent(Base):
    __tablename__ = "cabinet_events"

    id = Column(String, primary_key=True, index=True)
    cabinet_id = Column(String, index=True)
    slot_id = Column(String, index=True)
    event_type = Column(String, index=True)
    event_time = Column(DateTime, index=True)
    order_id = Column(String, nullable=True, index=True)
    raw_data = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class BillingRule(Base):
    __tablename__ = "billing_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, unique=True)
    hourly_rate = Column(Float)
    daily_cap = Column(Float, nullable=True)
    free_minutes = Column(Integer, default=0)
    config = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class Discrepancy(Base):
    __tablename__ = "discrepancies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    type = Column(String, index=True)
    order_id = Column(String, nullable=True, index=True)
    cabinet_id = Column(String, index=True)
    slot_id = Column(String, nullable=True, index=True)
    description = Column(Text)
    event_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
