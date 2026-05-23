from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class TestItem(Base):
    __tablename__ = 'test_items'

    id = Column(Integer, primary_key=True, index=True)
    sample_code = Column(String, ForeignKey('samples.sample_code'))
    item_name = Column(String)
    limit_value = Column(Float)
    test_value = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    sample = relationship('Sample')
