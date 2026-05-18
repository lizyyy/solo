from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, Date
from database import Base
from datetime import datetime

class CuttingQueue(Base):
    __tablename__ = "cutting_queue"
    
    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, index=True, nullable=False)
    customer_name = Column(String(100), nullable=False)
    store_name = Column(String(100), nullable=False)
    salesperson = Column(String(50), nullable=False)
    order_date = Column(Date, nullable=False)
    delivery_date = Column(Date, nullable=False)
    
    board_type = Column(String(50), nullable=False)
    board_color = Column(String(50), nullable=False)
    board_thickness = Column(Float, nullable=False)
    board_length = Column(Integer, nullable=False)
    board_width = Column(Integer, nullable=False)
    
    required_pieces = Column(Integer, nullable=False)
    cut_pieces = Column(Integer, default=0)
    remaining_pieces = Column(Integer, nullable=False)
    
    material_code = Column(String(50), nullable=False)
    material_batch = Column(String(50))
    material_location = Column(String(100))
    
    edge_banding = Column(String(100))
    drilling = Column(String(100))
    special_processing = Column(Text)
    
    priority = Column(Integer, default=5)
    status = Column(String(20), default="pending")
    assigned_to = Column(String(50))
    machine_no = Column(String(20))
    
    estimated_cutting_time = Column(Integer)
    actual_start_time = Column(DateTime)
    actual_end_time = Column(DateTime)
    
    remarks = Column(Text)
    is_urgent = Column(Boolean, default=False)
    has_remaining_material = Column(Boolean, default=False)
    remaining_material_info = Column(Text)
    
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String(50))
    updated_by = Column(String(50))
