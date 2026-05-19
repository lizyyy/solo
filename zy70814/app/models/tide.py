from sqlalchemy import Column, DateTime, Float, String, Integer
from app.models.base import BaseModel


class TideRecord(BaseModel):
    __tablename__ = "tide_records"

    record_date = Column(DateTime, nullable=False, index=True)
    tide_type = Column(String(20), nullable=False)
    height = Column(Float, nullable=False)
    
    timezone = Column(String(50), default="Asia/Shanghai")
    source_file = Column(String(255))
    batch_id = Column(String(100), index=True)
    
    class TideType:
        HIGH = "HIGH"
        LOW = "LOW"
