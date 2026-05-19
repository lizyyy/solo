from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean, Float, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    ENGINEER = "engineer"
    WORKER = "worker"
    VIEWER = "viewer"


class WorkOrderStatus(str, enum.Enum):
    CREATED = "created"
    ASSIGNED = "assigned"
    ARRIVED = "arrived"
    REINSPECTED = "reinspected"
    CLOSED = "closed"


class InspectionResult(str, enum.Enum):
    NORMAL = "normal"
    ABNORMAL = "abnormal"
    PENDING = "pending"


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    real_name = Column(String(50))
    phone = Column(String(20))
    email = Column(String(100))
    role = Column(Enum(UserRole), default=UserRole.WORKER)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    assigned_orders = relationship("WorkOrder", foreign_keys="WorkOrder.assigned_to", back_populates="assigned_user")
    created_orders = relationship("WorkOrder", foreign_keys="WorkOrder.created_by", back_populates="creator_user")
    inspection_records = relationship("InspectionRecord", back_populates="inspector")
    history_logs = relationship("HistoryLog", back_populates="user")


class PumpRoom(Base):
    __tablename__ = "pump_rooms"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    location = Column(String(255))
    building = Column(String(100))
    floor = Column(String(50))
    equipment_count = Column(Integer, default=0)
    manager_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String(20), default="active")
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    inspection_records = relationship("InspectionRecord", back_populates="pump_room")
    work_orders = relationship("WorkOrder", back_populates="pump_room")


class InspectionRecord(Base):
    __tablename__ = "inspection_records"
    
    id = Column(Integer, primary_key=True, index=True)
    record_no = Column(String(50), unique=True, index=True, nullable=False)
    pump_room_id = Column(Integer, ForeignKey("pump_rooms.id"), nullable=False)
    inspector_id = Column(Integer, ForeignKey("users.id"))
    inspection_time = Column(DateTime(timezone=True), nullable=False)
    
    water_pressure = Column(Float)
    water_level = Column(Float)
    pump_status = Column(String(50))
    valve_status = Column(String(50))
    pipe_status = Column(String(50))
    electrical_status = Column(String(50))
    
    temperature = Column(Float)
    humidity = Column(Float)
    noise_level = Column(Float)
    
    result = Column(Enum(InspectionResult), default=InspectionResult.PENDING)
    issues = Column(Text)
    remarks = Column(Text)
    
    import_id = Column(String(100), index=True)
    import_batch = Column(String(100), index=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    pump_room = relationship("PumpRoom", back_populates="inspection_records")
    inspector = relationship("User", back_populates="inspection_records")
    work_order = relationship("WorkOrder", back_populates="inspection_record", uselist=False)


class WorkOrder(Base):
    __tablename__ = "work_orders"
    
    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, index=True, nullable=False)
    inspection_record_id = Column(Integer, ForeignKey("inspection_records.id"))
    pump_room_id = Column(Integer, ForeignKey("pump_rooms.id"), nullable=False)
    
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_to = Column(Integer, ForeignKey("users.id"))
    
    title = Column(String(200), nullable=False)
    description = Column(Text)
    priority = Column(Integer, default=2)
    status = Column(Enum(WorkOrderStatus), default=WorkOrderStatus.CREATED)
    
    issue_type = Column(String(50))
    
    assigned_at = Column(DateTime(timezone=True))
    arrived_at = Column(DateTime(timezone=True))
    reinspected_at = Column(DateTime(timezone=True))
    closed_at = Column(DateTime(timezone=True))
    
    arrival_photo = Column(String(255))
    repair_description = Column(Text)
    reinspection_result = Column(String(200))
    
    close_reason = Column(Text)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    inspection_record = relationship("InspectionRecord", back_populates="work_order")
    pump_room = relationship("PumpRoom", back_populates="work_orders")
    assigned_user = relationship("User", foreign_keys=[assigned_to], back_populates="assigned_orders")
    creator_user = relationship("User", foreign_keys=[created_by], back_populates="created_orders")
    history_logs = relationship("HistoryLog", back_populates="work_order")


class HistoryLog(Base):
    __tablename__ = "history_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String(50), nullable=False)
    from_status = Column(String(50))
    to_status = Column(String(50))
    description = Column(Text)
    ip_address = Column(String(50))
    user_agent = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    work_order = relationship("WorkOrder", back_populates="history_logs")
    user = relationship("User", back_populates="history_logs")


class ImportRecord(Base):
    __tablename__ = "import_records"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(100), unique=True, index=True, nullable=False)
    file_name = Column(String(255))
    file_hash = Column(String(100), index=True)
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    duplicate_count = Column(Integer, default=0)
    import_by = Column(Integer, ForeignKey("users.id"))
    status = Column(String(20), default="processing")
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
