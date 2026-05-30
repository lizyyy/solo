from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, String, Boolean


class BaseModel:
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, nullable=False)
    created_by = Column(String(50), default="system")
    updated_by = Column(String(50), default="system")
    is_active = Column(Boolean, default=True)
