from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import enum


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED = "failed"


class FaultStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CANCELLED = "cancelled"


class RouteStatus(str, enum.Enum):
    PLANNED = "planned"
    DISPATCHED = "dispatched"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    PARTIALLY_COMPLETED = "partially_completed"
    CANCELLED = "cancelled"


class Machine(Base):
    __tablename__ = "machines"

    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    location = Column(String(200), nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    max_slots = Column(Integer, nullable=False, default=20)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    inventories = relationship("Inventory", back_populates="machine")
    tasks = relationship("RestockTask", back_populates="machine")
    faults = relationship("Fault", back_populates="machine")


class Product(Base):
    __tablename__ = "products"

    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    sku = Column(String(50), nullable=False, unique=True)
    category = Column(String(50), nullable=True)
    unit_volume = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    inventories = relationship("Inventory", back_populates="product")


class Inventory(Base):
    __tablename__ = "inventories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    machine_id = Column(String(50), ForeignKey("machines.id"), nullable=False)
    product_id = Column(String(50), ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=0)
    min_level = Column(Integer, nullable=False, default=5)
    max_level = Column(Integer, nullable=False, default=50)
    expiry_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    machine = relationship("Machine", back_populates="inventories")
    product = relationship("Product", back_populates="inventories")


class SalesForecast(Base):
    __tablename__ = "sales_forecasts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    machine_id = Column(String(50), ForeignKey("machines.id"), nullable=False)
    product_id = Column(String(50), ForeignKey("products.id"), nullable=False)
    forecast_date = Column(DateTime, nullable=False)
    predicted_quantity = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class RestockTask(Base):
    __tablename__ = "restock_tasks"

    id = Column(String(50), primary_key=True)
    machine_id = Column(String(50), ForeignKey("machines.id"), nullable=False)
    route_id = Column(String(50), ForeignKey("routes.id"), nullable=True)
    status = Column(SQLEnum(TaskStatus), default=TaskStatus.PENDING)
    priority = Column(Integer, default=0)
    notes = Column(Text, nullable=True)
    assigned_operator = Column(String(100), nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    failed_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    machine = relationship("Machine", back_populates="tasks")
    route = relationship("Route", back_populates="tasks")
    items = relationship("TaskItem", back_populates="task", cascade="all, delete-orphan")
    history = relationship("TaskHistory", back_populates="task", cascade="all, delete-orphan")


class TaskItem(Base):
    __tablename__ = "task_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(String(50), ForeignKey("restock_tasks.id"), nullable=False)
    product_id = Column(String(50), ForeignKey("products.id"), nullable=False)
    item_type = Column(String(20), nullable=False)
    requested_quantity = Column(Integer, nullable=False)
    actual_quantity = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("RestockTask", back_populates="items")


class TaskHistory(Base):
    __tablename__ = "task_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(String(50), ForeignKey("restock_tasks.id"), nullable=False)
    status_from = Column(String(50), nullable=True)
    status_to = Column(String(50), nullable=False)
    operator = Column(String(100), nullable=True)
    diff_before = Column(Text, nullable=True)
    diff_after = Column(Text, nullable=True)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("RestockTask", back_populates="history")


class Route(Base):
    __tablename__ = "routes"

    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    status = Column(SQLEnum(RouteStatus), default=RouteStatus.PLANNED)
    total_capacity = Column(Integer, nullable=False)
    used_capacity = Column(Integer, default=0)
    operator = Column(String(100), nullable=True)
    vehicle_id = Column(String(50), nullable=True)
    scheduled_date = Column(DateTime, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tasks = relationship("RestockTask", back_populates="route")
    history = relationship("RouteHistory", back_populates="route", cascade="all, delete-orphan")


class RouteHistory(Base):
    __tablename__ = "route_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    route_id = Column(String(50), ForeignKey("routes.id"), nullable=False)
    status_from = Column(String(50), nullable=True)
    status_to = Column(String(50), nullable=False)
    operator = Column(String(100), nullable=True)
    diff_before = Column(Text, nullable=True)
    diff_after = Column(Text, nullable=True)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    route = relationship("Route", back_populates="history")


class Fault(Base):
    __tablename__ = "faults"

    id = Column(String(50), primary_key=True)
    machine_id = Column(String(50), ForeignKey("machines.id"), nullable=False)
    fault_type = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(SQLEnum(FaultStatus), default=FaultStatus.OPEN)
    priority = Column(Integer, default=1)
    assigned_operator = Column(String(100), nullable=True)
    reported_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    machine = relationship("Machine", back_populates="faults")


class IdempotentRecord(Base):
    __tablename__ = "idempotent_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    idempotent_key = Column(String(100), nullable=False, unique=True)
    operation = Column(String(100), nullable=False)
    resource_id = Column(String(100), nullable=True)
    response_data = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
