from datetime import datetime
from sqlalchemy import Column, DateTime, Integer
from app.database import Base


class BaseModel(Base):
    """基础模型类，包含通用字段"""

    __abstract__ = True

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
