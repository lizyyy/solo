from sqlalchemy import create_engine, Column, Integer, String, DateTime, Float, ForeignKey, Text, Boolean, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import enum

SQLALCHEMY_DATABASE_URL = "sqlite:///./price_tag.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class ConfirmationType(str, enum.Enum):
    START = "start"
    END = "end"


class DiscrepancyStatus(str, enum.Enum):
    OPEN = "open"
    RESOLVED = "resolved"
    CLOSED = "closed"


class VersionStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    IN_PROGRESS = "in_progress"
    EXPIRED = "expired"
    CLOSED = "closed"


class Store(Base):
    __tablename__ = "stores"

    id = Column(Integer, primary_key=True, index=True)
    store_code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    region = Column(String)
    manager_email = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PriceTagItem(Base):
    __tablename__ = "price_tag_items"

    id = Column(Integer, primary_key=True, index=True)
    version_id = Column(Integer, ForeignKey("price_tag_versions.id"), nullable=False)
    barcode = Column(String, index=True, nullable=False)
    product_name = Column(String, nullable=False)
    original_price = Column(Float, nullable=False)
    promotion_price = Column(Float, nullable=False)
    unit = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    version = relationship("PriceTagVersion", back_populates="items")


class VersionStoreAssignment(Base):
    __tablename__ = "version_store_assignments"

    id = Column(Integer, primary_key=True, index=True)
    version_id = Column(Integer, ForeignKey("price_tag_versions.id"), nullable=False)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    assigned_at = Column(DateTime, default=datetime.utcnow)
    assigned_by = Column(String)

    version = relationship("PriceTagVersion", back_populates="store_assignments")
    store = relationship("Store")


class Confirmation(Base):
    __tablename__ = "confirmations"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    version_id = Column(Integer, ForeignKey("price_tag_versions.id"), nullable=False)
    confirmation_type = Column(Enum(ConfirmationType), nullable=False)
    confirmed_by = Column(String, nullable=False)
    confirmed_at = Column(DateTime, default=datetime.utcnow)
    photo_url = Column(String)
    notes = Column(Text)

    store = relationship("Store")
    version = relationship("PriceTagVersion", back_populates="confirmations")


class Discrepancy(Base):
    __tablename__ = "discrepancies"

    id = Column(Integer, primary_key=True, index=True)
    version_id = Column(Integer, ForeignKey("price_tag_versions.id"), nullable=False)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    discrepancy_type = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    original_input = Column(Text)
    status = Column(Enum(DiscrepancyStatus), default=DiscrepancyStatus.OPEN)
    detected_at = Column(DateTime, default=datetime.utcnow)
    detected_by = Column(String)
    resolved_at = Column(DateTime)
    resolved_by = Column(String)
    resolution = Column(Text)
    correct_action = Column(String)

    version = relationship("PriceTagVersion", back_populates="discrepancies")
    store = relationship("Store")


class VersionStatusHistory(Base):
    __tablename__ = "version_status_history"

    id = Column(Integer, primary_key=True, index=True)
    version_id = Column(Integer, ForeignKey("price_tag_versions.id"), nullable=False)
    previous_status = Column(Enum(VersionStatus), nullable=True)
    new_status = Column(Enum(VersionStatus), nullable=False)
    changed_by = Column(String, nullable=False)
    change_reason = Column(Text)
    changed_at = Column(DateTime, default=datetime.utcnow)

    version = relationship("PriceTagVersion", back_populates="status_history")


class PriceTagVersion(Base):
    __tablename__ = "price_tag_versions"
    __mapper_args__ = {"confirm_deleted_rows": False}

    id = Column(Integer, primary_key=True, index=True)
    version_code = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    status = Column(Enum(VersionStatus), default=VersionStatus.DRAFT)
    promotion_start = Column(DateTime, nullable=False)
    promotion_end = Column(DateTime, nullable=False)
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    closed_at = Column(DateTime)
    closed_by = Column(String)
    last_expiry_check = Column(DateTime)

    items = relationship("PriceTagItem", back_populates="version", cascade="all, delete-orphan")
    confirmations = relationship("Confirmation", back_populates="version", cascade="all, delete-orphan")
    discrepancies = relationship("Discrepancy", back_populates="version", cascade="all, delete-orphan")
    store_assignments = relationship("VersionStoreAssignment", back_populates="version", cascade="all, delete-orphan")
    status_history = relationship("VersionStatusHistory", back_populates="version", cascade="all, delete-orphan", order_by="VersionStatusHistory.changed_at")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
