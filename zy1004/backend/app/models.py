from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base
import enum

class OrderStatus(str, enum.Enum):
    PENDING_CONFIRM = "待确认"
    CONFIRMED = "已预约"
    IN_PROGRESS = "维修中"
    AWAITING_PICKUP = "待取件"
    COMPLETED = "已完成"
    CANCELLED = "已取消"

class DeviceType(str, enum.Enum):
    RICE_COOKER = "电饭煲"
    AIR_FRYER = "空气炸锅"
    COFFEE_MACHINE = "咖啡机"
    REFRIGERATOR = "冰箱"
    WASHING_MACHINE = "洗衣机"
    MICROWAVE = "微波炉"
    OVEN = "烤箱"
    DISHWASHER = "洗碗机"
    OTHER = "其他"

class Technician(Base):
    __tablename__ = "technicians"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    repair_orders = relationship("RepairOrder", back_populates="technician")

class SparePart(Base):
    __tablename__ = "spare_parts"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    sku = Column(String(50), unique=True, index=True)
    category = Column(String(100))
    stock_quantity = Column(Integer, default=0)
    min_stock = Column(Integer, default=5)
    unit_price = Column(Float, default=0.0)
    unit = Column(String(20), default="个")
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    inventory_transactions = relationship("InventoryTransaction", back_populates="spare_part")

class RepairOrder(Base):
    __tablename__ = "repair_orders"
    
    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(20), unique=True, index=True, nullable=False)
    
    customer_name = Column(String(100), nullable=False)
    customer_phone = Column(String(20), nullable=False)
    customer_address = Column(Text)
    
    device_type = Column(String(100), nullable=False)
    device_brand = Column(String(100))
    device_model = Column(String(100))
    fault_description = Column(Text, nullable=False)
    
    estimated_cost = Column(Float, default=0.0)
    final_cost = Column(Float, default=0.0)
    discount = Column(Float, default=0.0)
    is_paid = Column(Boolean, default=False)
    paid_at = Column(DateTime)
    
    status = Column(String(50), default=OrderStatus.PENDING_CONFIRM.value)
    
    appointment_type = Column(String(20), default="到店")
    appointment_time = Column(DateTime)
    
    technician_id = Column(Integer, ForeignKey("technicians.id"))
    technician = relationship("Technician", back_populates="repair_orders")
    
    arrival_time = Column(DateTime)
    start_repair_time = Column(DateTime)
    complete_time = Column(DateTime)
    
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    communication_logs = relationship("CommunicationLog", back_populates="repair_order")
    status_histories = relationship("StatusHistory", back_populates="repair_order")
    inventory_transactions = relationship("InventoryTransaction", back_populates="repair_order")

class CommunicationLog(Base):
    __tablename__ = "communication_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    repair_order_id = Column(Integer, ForeignKey("repair_orders.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    repair_order = relationship("RepairOrder", back_populates="communication_logs")

class StatusHistory(Base):
    __tablename__ = "status_histories"
    
    id = Column(Integer, primary_key=True, index=True)
    repair_order_id = Column(Integer, ForeignKey("repair_orders.id"), nullable=False)
    from_status = Column(String(50))
    to_status = Column(String(50), nullable=False)
    reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    repair_order = relationship("RepairOrder", back_populates="status_histories")

class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    spare_part_id = Column(Integer, ForeignKey("spare_parts.id"), nullable=False)
    repair_order_id = Column(Integer, ForeignKey("repair_orders.id"))
    transaction_type = Column(String(20), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, default=0.0)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    spare_part = relationship("SparePart", back_populates="inventory_transactions")
    repair_order = relationship("RepairOrder", back_populates="inventory_transactions")
