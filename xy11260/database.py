from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text, Boolean, ForeignKey, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import enum
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'hazard_management.db')}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class HazardStatus(str, enum.Enum):
    REGISTERED = "registered"
    ASSIGNED = "assigned"
    RECTIFIED = "rectified"
    RECHECKED = "rechecked"
    ARCHIVED = "archived"
    REJECTED = "rejected"


class RoleType(str, enum.Enum):
    SAFETY_OFFICER = "safety_officer"
    RECTIFIER = "rectifier"
    REVIEWER = "reviewer"
    ADMIN = "admin"


class OperationType(str, enum.Enum):
    REGISTER = "register"
    ASSIGN = "assign"
    RECTIFY = "rectify"
    RECHECK = "recheck"
    ARCHIVE = "archive"
    REJECT = "reject"
    UPDATE = "update"
    DELETE = "delete"


class Hazard(Base):
    __tablename__ = "hazards"

    id = Column(Integer, primary_key=True, index=True)
    hazard_no = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    location = Column(String, nullable=False)
    level = Column(String, nullable=False)
    status = Column(Enum(HazardStatus), default=HazardStatus.REGISTERED, nullable=False)

    photo_path = Column(String)
    photo_hash = Column(String)

    rectifier_id = Column(String, index=True)
    rectifier_name = Column(String)
    rectifier_phone = Column(String)
    rectifier_dept = Column(String)

    deadline = Column(DateTime)

    rectification_desc = Column(Text)
    rectification_photo_path = Column(String)
    rectification_time = Column(DateTime)

    recheck_result = Column(Boolean)
    recheck_opinion = Column(Text)
    recheck_photo_path = Column(String)
    recheck_time = Column(DateTime)

    registered_by_id = Column(String, nullable=False)
    registered_by_name = Column(String, nullable=False)
    registered_time = Column(DateTime, default=datetime.utcnow, nullable=False)

    assigned_by_id = Column(String)
    assigned_by_name = Column(String)
    assigned_time = Column(DateTime)

    rectified_by_id = Column(String)
    rectified_by_name = Column(String)

    rechecked_by_id = Column(String)
    rechecked_by_name = Column(String)

    archived_by_id = Column(String)
    archived_by_name = Column(String)
    archived_time = Column(DateTime)

    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    operation_logs = relationship("OperationLog", back_populates="hazard", cascade="all, delete-orphan")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    hazard_id = Column(Integer, ForeignKey("hazards.id"), nullable=False)
    operation_type = Column(Enum(OperationType), nullable=False)
    operator_id = Column(String, nullable=False)
    operator_name = Column(String, nullable=False)
    operator_role = Column(Enum(RoleType), nullable=False)
    operation_time = Column(DateTime, default=datetime.utcnow, nullable=False)
    remark = Column(Text)
    old_values = Column(Text)
    new_values = Column(Text)
    ip_address = Column(String)
    user_agent = Column(String)

    hazard = relationship("Hazard", back_populates="operation_logs")


class IdempotentRequest(Base):
    __tablename__ = "idempotent_requests"

    id = Column(Integer, primary_key=True, index=True)
    request_key = Column(String, unique=True, index=True, nullable=False)
    operation_type = Column(String, nullable=False)
    hazard_no = Column(String)
    operator_id = Column(String, nullable=False)
    request_time = Column(DateTime, default=datetime.utcnow, nullable=False)
    response_hash = Column(String, nullable=False)
    response_data = Column(Text, nullable=False)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, nullable=False)
    phone = Column(String)
    role = Column(Enum(RoleType), nullable=False)
    department = Column(String)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.user_id == "SA001").first():
            safety_officer = User(
                user_id="SA001",
                username="张安全",
                phone="13800138001",
                role=RoleType.SAFETY_OFFICER,
                department="安全部"
            )
            db.add(safety_officer)

        if not db.query(User).filter(User.user_id == "R001").first():
            rectifier = User(
                user_id="R001",
                username="李整改",
                phone="13800138002",
                role=RoleType.RECTIFIER,
                department="维修部"
            )
            db.add(rectifier)

        if not db.query(User).filter(User.user_id == "RV001").first():
            reviewer = User(
                user_id="RV001",
                username="王复查",
                phone="13800138003",
                role=RoleType.REVIEWER,
                department="质量部"
            )
            db.add(reviewer)

        if not db.query(User).filter(User.user_id == "ADMIN001").first():
            admin = User(
                user_id="ADMIN001",
                username="管理员",
                phone="13800138000",
                role=RoleType.ADMIN,
                department="综合部"
            )
            db.add(admin)

        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()
