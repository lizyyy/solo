from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base


class WarehouseMap(Base):
    __tablename__ = "warehouse_maps"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    width = Column(Integer, default=100)
    height = Column(Integer, default=100)
    grid_size = Column(Integer, default=1)
    
    map_data = Column(Text, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    robots = relationship("Robot", back_populates="warehouse_map")
    orders = relationship("Order", back_populates="warehouse_map")
    batches = relationship("SchedulingBatch", back_populates="warehouse_map")
    
    def __repr__(self):
        return f"<WarehouseMap {self.name}>"
