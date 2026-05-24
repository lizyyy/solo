from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import enum

SQLALCHEMY_DATABASE_URL = "sqlite:///./roof_inspection.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class LeakLevelEnum(str, enum.Enum):
    NONE = "无渗漏"
    MINOR = "轻微"
    MODERATE = "中度"
    SEVERE = "严重"
    CRITICAL = "危急"


class WorkOrderStatusEnum(str, enum.Enum):
    PENDING = "待判定"
    CONFIRMED = "已确认待维修"
    IN_PROGRESS = "维修中"
    PENDING_RETEST = "待复测"
    PASSED = "验收通过"
    REJECTED = "驳回需补证"
    CLOSED = "已结案"


class HandlerRoleEnum(str, enum.Enum):
    INSPECTOR = "巡检员"
    ENGINEER = "工程师"
    MAINTENANCE = "维修员"
    AUDITOR = "审核员"
    ADMIN = "管理员"


class RoofArea(Base):
    __tablename__ = "roof_areas"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    building = Column(String(100))
    floor = Column(String(50))
    area_size = Column(Float)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    is_active = Column(Boolean, default=True)
    inspection_points = relationship("InspectionPoint", back_populates="roof_area")


class InspectionPoint(Base):
    __tablename__ = "inspection_points"
    id = Column(Integer, primary_key=True, index=True)
    point_code = Column(String(50), unique=True, index=True)
    roof_area_id = Column(Integer, ForeignKey("roof_areas.id"))
    latitude = Column(Float)
    longitude = Column(Float)
    position_desc = Column(String(200))
    cluster_key = Column(String(100), index=True)
    merge_count = Column(Integer, default=1)
    first_detected_at = Column(DateTime, default=datetime.now)
    last_detected_at = Column(DateTime, default=datetime.now)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    roof_area = relationship("RoofArea", back_populates="inspection_points")
    raw_materials = relationship("RawMaterial", back_populates="inspection_point")
    work_orders = relationship("WorkOrder", back_populates="inspection_point")
    audit_logs = relationship("AuditLog", back_populates="inspection_point")


class RawMaterial(Base):
    __tablename__ = "raw_materials"
    id = Column(Integer, primary_key=True, index=True)
    material_code = Column(String(50), unique=True, index=True)
    inspection_point_id = Column(Integer, ForeignKey("inspection_points.id"))
    thermal_image_path = Column(String(500))
    visible_image_path = Column(String(500))
    leak_level = Column(Enum(LeakLevelEnum))
    temperature = Column(Float)
    humidity = Column(Float)
    inspector = Column(String(100))
    inspection_time = Column(DateTime)
    equipment_info = Column(String(200))
    weather = Column(String(100))
    notes = Column(Text)
    source_batch = Column(String(100))
    is_merged = Column(Boolean, default=False)
    merged_into_point_id = Column(Integer)
    created_at = Column(DateTime, default=datetime.now)
    inspection_point = relationship("InspectionPoint", back_populates="raw_materials")
    work_order_materials = relationship("WorkOrderMaterial", back_populates="raw_material")


class WorkOrder(Base):
    __tablename__ = "work_orders"
    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, index=True)
    inspection_point_id = Column(Integer, ForeignKey("inspection_points.id"))
    current_level = Column(Enum(LeakLevelEnum))
    status = Column(Enum(WorkOrderStatusEnum), default=WorkOrderStatusEnum.PENDING)
    handler_id = Column(Integer, ForeignKey("handlers.id"))
    assigned_to = Column(String(100))
    description = Column(Text)
    priority = Column(Integer, default=1)
    deadline = Column(DateTime)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    closed_at = Column(DateTime)
    final_conclusion = Column(Text)
    inspection_point = relationship("InspectionPoint", back_populates="work_orders")
    handler = relationship("Handler", back_populates="work_orders")
    materials = relationship("WorkOrderMaterial", back_populates="work_order")
    judgments = relationship("JudgmentRecord", back_populates="work_order")
    retests = relationship("RetestRecord", back_populates="work_order")
    status_transitions = relationship("StatusTransition", back_populates="work_order")


class WorkOrderMaterial(Base):
    __tablename__ = "work_order_materials"
    id = Column(Integer, primary_key=True, index=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id"))
    raw_material_id = Column(Integer, ForeignKey("raw_materials.id"))
    is_primary = Column(Boolean, default=False)
    added_at = Column(DateTime, default=datetime.now)
    added_by = Column(String(100))
    work_order = relationship("WorkOrder", back_populates="materials")
    raw_material = relationship("RawMaterial", back_populates="work_order_materials")


class JudgmentRecord(Base):
    __tablename__ = "judgment_records"
    id = Column(Integer, primary_key=True, index=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id"))
    judgment_type = Column(String(50))
    judged_level = Column(Enum(LeakLevelEnum))
    previous_level = Column(Enum(LeakLevelEnum))
    judge = Column(String(100))
    judgment_time = Column(DateTime, default=datetime.now)
    reason = Column(Text)
    evidence = Column(Text)
    work_order = relationship("WorkOrder", back_populates="judgments")


class RetestRecord(Base):
    __tablename__ = "retest_records"
    id = Column(Integer, primary_key=True, index=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id"))
    retest_no = Column(String(50))
    retest_time = Column(DateTime)
    retester = Column(String(100))
    thermal_image_path = Column(String(500))
    result = Column(String(50))
    temperature = Column(Float)
    humidity = Column(Float)
    description = Column(Text)
    is_passed = Column(Boolean)
    work_order = relationship("WorkOrder", back_populates="retests")


class StatusTransition(Base):
    __tablename__ = "status_transitions"
    id = Column(Integer, primary_key=True, index=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id"))
    from_status = Column(Enum(WorkOrderStatusEnum))
    to_status = Column(Enum(WorkOrderStatusEnum))
    transition_time = Column(DateTime, default=datetime.now)
    operator = Column(String(100))
    reason = Column(Text)
    work_order = relationship("WorkOrder", back_populates="status_transitions")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    inspection_point_id = Column(Integer, ForeignKey("inspection_points.id"))
    work_order_id = Column(Integer)
    action_type = Column(String(50))
    field_name = Column(String(100))
    old_value = Column(Text)
    new_value = Column(Text)
    operator = Column(String(100))
    operation_time = Column(DateTime, default=datetime.now)
    reason = Column(Text)
    inspection_point = relationship("InspectionPoint", back_populates="audit_logs")


class Handler(Base):
    __tablename__ = "handlers"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True)
    real_name = Column(String(100))
    role = Column(Enum(HandlerRoleEnum))
    phone = Column(String(20))
    email = Column(String(100))
    department = Column(String(100))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    work_orders = relationship("WorkOrder", back_populates="handler")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
