from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import enum

SQLALCHEMY_DATABASE_URL = "sqlite:///./community_points.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class TransactionType(enum.Enum):
    EARN = "earn"
    EXCHANGE = "exchange"
    ROLLBACK = "rollback"
    MERGE_IN = "merge_in"
    MERGE_OUT = "merge_out"
    ADJUST = "adjust"


class TransactionStatus(enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    ROLLBACKED = "rollbacked"


class Family(Base):
    __tablename__ = "families"

    id = Column(Integer, primary_key=True, index=True)
    family_number = Column(String, unique=True, index=True, nullable=False)
    family_name = Column(String, nullable=False)
    address = Column(String)
    contact_phone = Column(String)
    total_points = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    residents = relationship("Resident", back_populates="family")
    point_account = relationship("PointAccount", uselist=False, back_populates="family")


class Resident(Base):
    __tablename__ = "residents"

    id = Column(Integer, primary_key=True, index=True)
    resident_number = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    id_card = Column(String, unique=True, index=True)
    phone = Column(String)
    family_id = Column(Integer, ForeignKey("families.id"))
    total_points = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    family = relationship("Family", back_populates="residents")
    point_account = relationship("PointAccount", uselist=False, back_populates="resident")
    service_records = relationship("ServiceRecord", back_populates="resident")


class PointAccount(Base):
    __tablename__ = "point_accounts"

    id = Column(Integer, primary_key=True, index=True)
    account_number = Column(String, unique=True, index=True, nullable=False)
    resident_id = Column(Integer, ForeignKey("residents.id"), nullable=True)
    family_id = Column(Integer, ForeignKey("families.id"), nullable=True)
    balance = Column(Integer, default=0)
    frozen_balance = Column(Integer, default=0)
    total_earned = Column(Integer, default=0)
    total_exchanged = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    resident = relationship("Resident", back_populates="point_account")
    family = relationship("Family", back_populates="point_account")
    transactions = relationship("PointTransaction", back_populates="account")


class ServiceRecord(Base):
    __tablename__ = "service_records"

    id = Column(Integer, primary_key=True, index=True)
    record_number = Column(String, unique=True, index=True, nullable=False)
    resident_id = Column(Integer, ForeignKey("residents.id"), nullable=False)
    service_type = Column(String, nullable=False)
    service_date = Column(DateTime, nullable=False)
    service_hours = Column(Float, default=0)
    points_earned = Column(Integer, default=0)
    description = Column(Text)
    operator_id = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_revoked = Column(Boolean, default=False)
    revoked_at = Column(DateTime)
    revoked_reason = Column(Text)
    import_batch_id = Column(String, index=True)

    resident = relationship("Resident", back_populates="service_records")
    transaction = relationship("PointTransaction", uselist=False, back_populates="service_record")


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(Integer, primary_key=True, index=True)
    item_code = Column(String, unique=True, index=True, nullable=False)
    item_name = Column(String, nullable=False)
    category = Column(String)
    points_required = Column(Integer, nullable=False)
    stock_quantity = Column(Integer, default=0)
    unit = Column(String, default="份")
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    exchange_orders = relationship("ExchangeOrder", back_populates="item")


class ExchangeOrder(Base):
    __tablename__ = "exchange_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String, unique=True, index=True, nullable=False)
    account_id = Column(Integer, ForeignKey("point_accounts.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    points_used = Column(Integer, nullable=False)
    exchange_time = Column(DateTime, default=datetime.utcnow)
    operator_id = Column(String)
    is_revoked = Column(Boolean, default=False)
    revoked_at = Column(DateTime)
    revoked_reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    item = relationship("InventoryItem", back_populates="exchange_orders")
    transaction = relationship("PointTransaction", uselist=False, back_populates="exchange_order")


class PointTransaction(Base):
    __tablename__ = "point_transactions"

    id = Column(Integer, primary_key=True, index=True)
    transaction_number = Column(String, unique=True, index=True, nullable=False)
    account_id = Column(Integer, ForeignKey("point_accounts.id"), nullable=False)
    transaction_type = Column(Enum(TransactionType), nullable=False)
    amount = Column(Integer, nullable=False)
    balance_before = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)
    status = Column(Enum(TransactionStatus), default=TransactionStatus.CONFIRMED)
    service_record_id = Column(Integer, ForeignKey("service_records.id"), nullable=True)
    exchange_order_id = Column(Integer, ForeignKey("exchange_orders.id"), nullable=True)
    related_transaction_id = Column(Integer, ForeignKey("point_transactions.id"), nullable=True)
    description = Column(Text)
    operator_id = Column(String)
    needs_review = Column(Boolean, default=False)
    review_note = Column(Text)
    reviewed_by = Column(String)
    reviewed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    account = relationship("PointAccount", back_populates="transactions")
    service_record = relationship("ServiceRecord", back_populates="transaction")
    exchange_order = relationship("ExchangeOrder", back_populates="transaction")
    related_transaction = relationship("PointTransaction", remote_side=[id])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
