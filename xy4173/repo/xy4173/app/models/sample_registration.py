from datetime import datetime, timedelta
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class SampleRegistration(Base):
    """样品登记"""
    __tablename__ = "sample_registrations"
    
    id = Column(Integer, primary_key=True, index=True)
    sample_code = Column(String(50), unique=True, index=True, nullable=False)
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    sample_type = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    
    registered_at = Column(DateTime, nullable=False)
    expected_pickup_at = Column(DateTime, nullable=True)
    actual_pickup_at = Column(DateTime, nullable=True)
    
    max_storage_hours = Column(Integer, default=72)
    is_overdue = Column(Boolean, default=False)
    
    status = Column(String(20), default="in_storage")
    
    notes = Column(Text, nullable=True)
    
    import_batch_id = Column(Integer, ForeignKey("import_batches.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    user = relationship("User", back_populates="samples")
    violations = relationship("Violation", back_populates="sample")
    import_batch = relationship("ImportBatch", back_populates="samples")
    
    @property
    def is_overdue_check(self) -> bool:
        if self.status == "picked_up":
            return False
        deadline = self.registered_at + timedelta(hours=self.max_storage_hours)
        if self.expected_pickup_at:
            deadline = min(deadline, self.expected_pickup_at)
        return datetime.now() > deadline
