from sqlalchemy import Column, Integer, String, DateTime, Text, Enum, Float
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from ..database import Base


class BatchStatus(str, enum.Enum):
    CREATED = "已创建"
    PROCESSING = "处理中"
    COMPLETED = "已完成"
    ERROR = "异常"
    ARCHIVED = "已归档"


class ImageBatch(Base):
    __tablename__ = "image_batches"
    
    id = Column(Integer, primary_key=True, index=True)
    
    batch_code = Column(String(50), unique=True, nullable=False, index=True, comment="批次编号")
    batch_name = Column(String(200), nullable=False, comment="批次名称")
    
    flight_date = Column(DateTime, nullable=False, comment="无人机飞行日期")
    flight_area = Column(String(200), nullable=False, comment="飞行区域")
    drone_id = Column(String(50), comment="无人机ID")
    
    image_count = Column(Integer, default=0, comment="影像数量")
    total_area_km2 = Column(Float, default=0.0, comment="总面积(平方公里)")
    
    status = Column(Enum(BatchStatus), default=BatchStatus.CREATED, comment="批次状态")
    
    created_by = Column(String(100), nullable=False, comment="创建人")
    created_at = Column(DateTime, default=datetime.now, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment="更新时间")
    
    remark = Column(Text, comment="备注")
    
    lesions = relationship("LesionRecord", back_populates="batch", cascade="all, delete-orphan")
    reports = relationship("VerificationReport", back_populates="batch", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<ImageBatch {self.batch_code} - {self.batch_name}>"
