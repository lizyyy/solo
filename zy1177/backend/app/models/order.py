from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base
import enum


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(String(50), unique=True, nullable=False)
    
    warehouse_map_id = Column(Integer, ForeignKey("warehouse_maps.id"), nullable=True)
    
    priority = Column(Integer, default=1)
    
    pickup_location_x = Column(Float, nullable=False)
    pickup_location_y = Column(Float, nullable=False)
    pickup_location_name = Column(String(100), nullable=True)
    
    dropoff_location_x = Column(Float, nullable=False)
    dropoff_location_y = Column(Float, nullable=False)
    dropoff_location_name = Column(String(100), nullable=True)
    
    cargo_type = Column(String(100), nullable=True)
    cargo_weight = Column(Float, default=0.0)
    cargo_volume = Column(Float, default=0.0)
    
    status = Column(Enum(OrderStatus), default=OrderStatus.PENDING)
    
    scheduled_start_time = Column(DateTime, nullable=True)
    actual_start_time = Column(DateTime, nullable=True)
    actual_end_time = Column(DateTime, nullable=True)
    
    deadline_time = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    warehouse_map = relationship("WarehouseMap", back_populates="orders")
    tasks = relationship("Task", back_populates="order")
    
    def __repr__(self):
        return f"<Order {self.order_id} - {self.status.value}>"
