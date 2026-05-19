from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Enum, Float
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func
import enum

Base = declarative_base()


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    OPERATOR = "operator"
    ENGINEER = "engineer"
    AUDITOR = "auditor"


class EventStatus(str, enum.Enum):
    NORMAL = "normal"
    ABNORMAL = "abnormal"


class EventType(str, enum.Enum):
    DOOR_OPEN = "door_open"
    DOOR_CLOSE = "door_close"
    SCAN_SUCCESS = "scan_success"
    SCAN_FAIL = "scan_fail"
    BATTERY_IN = "battery_in"
    BATTERY_OUT = "battery_out"
    CABIN_STATUS = "cabin_status"


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    RECEIVED = "received"
    ATTRIBUTED = "attributed"
    DISPATCHED = "dispatched"
    PROCESSING = "processing"
    REVIEWED = "reviewed"
    CLOSED = "closed"


class IssueType(str, enum.Enum):
    DOOR_FAILURE = "door_failure"
    SCAN_FAILURE = "scan_failure"
    FALSE_EMPTY = "false_empty"
    OTHER = "other"


class IdempotentRecord(Base):
    __tablename__ = "idempotent_records"
    
    id = Column(Integer, primary_key=True, index=True)
    request_key = Column(String, unique=True, index=True, nullable=False)
    endpoint = Column(String, nullable=False)
    response_hash = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    phone = Column(String)
    role = Column(Enum(UserRole), default=UserRole.OPERATOR)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    created_orders = relationship("Order", back_populates="creator", foreign_keys="Order.created_by")
    dispatched_orders = relationship("Order", back_populates="dispatcher", foreign_keys="Order.dispatched_to")


class Device(Base):
    __tablename__ = "devices"
    
    id = Column(Integer, primary_key=True, index=True)
    device_code = Column(String, unique=True, index=True, nullable=False)
    device_name = Column(String)
    location = Column(String)
    cabin_count = Column(Integer, default=10)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    events = relationship("DeviceEvent", back_populates="device")
    orders = relationship("Order", back_populates="device")


class DeviceEvent(Base):
    __tablename__ = "device_events"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String, unique=True, index=True, nullable=False)
    device_id = Column(Integer, ForeignKey("devices.id"))
    event_type = Column(Enum(EventType), nullable=False)
    event_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(Enum(EventStatus), nullable=False)
    cabin_number = Column(Integer)
    battery_code = Column(String)
    user_phone = Column(String)
    error_code = Column(String)
    error_message = Column(Text)
    raw_data = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    device = relationship("Device", back_populates="events")


class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String, unique=True, index=True, nullable=False)
    device_id = Column(Integer, ForeignKey("devices.id"))
    event_id = Column(String, ForeignKey("device_events.event_id"))
    status = Column(Enum(OrderStatus), default=OrderStatus.PENDING)
    issue_type = Column(Enum(IssueType))
    issue_description = Column(Text)
    cabin_number = Column(Integer)
    
    created_by = Column(Integer, ForeignKey("users.id"))
    received_by = Column(Integer)
    attributed_by = Column(Integer)
    dispatched_to = Column(Integer, ForeignKey("users.id"))
    reviewed_by = Column(Integer)
    
    customer_phone = Column(String)
    customer_name = Column(String)
    
    received_at = Column(DateTime(timezone=True))
    attributed_at = Column(DateTime(timezone=True))
    dispatched_at = Column(DateTime(timezone=True))
    reviewed_at = Column(DateTime(timezone=True))
    closed_at = Column(DateTime(timezone=True))
    
    remark = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    device = relationship("Device", back_populates="orders")
    creator = relationship("User", back_populates="created_orders", foreign_keys=[created_by])
    dispatcher = relationship("User", back_populates="dispatched_orders", foreign_keys=[dispatched_to])
    logs = relationship("OrderLog", back_populates="order")


class OrderLog(Base):
    __tablename__ = "order_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    action = Column(String, nullable=False)
    operator_id = Column(Integer)
    operator_name = Column(String)
    detail = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    order = relationship("Order", back_populates="logs")