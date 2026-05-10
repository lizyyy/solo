from sqlalchemy import Column, Integer, String, DateTime, Text, Enum, Float, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from ..database import Base


class LesionStatus(str, enum.Enum):
    PENDING = "待核验"
    VERIFYING = "核验中"
    CONFIRMED = "确认为病斑"
    FALSE_POSITIVE = "误报"
    REVERTED = "已回滚"


class LesionSource(str, enum.Enum):
    AI_DETECTION = "AI识别"
    MANUAL_MARK = "人工标注"
    SECONDARY_CHECK = "二次复核"


class LesionRecord(Base):
    __tablename__ = "lesion_records"
    
    id = Column(Integer, primary_key=True, index=True)
    
    lesion_code = Column(String(50), unique=True, nullable=False, index=True, comment="病斑编号")
    
    batch_id = Column(Integer, ForeignKey("image_batches.id"), nullable=False, comment="批次ID")
    batch = relationship("ImageBatch", back_populates="lesions")
    
    grid_id = Column(Integer, ForeignKey("farm_grids.id"), index=True, comment="地块ID")
    grid = relationship("FarmGrid", back_populates="lesions")
    
    grid_code = Column(String(50), index=True, comment="地块编号（冗余字段，用于快速查询）")
    grid_name = Column(String(200), comment="地块名称（冗余字段）")
    
    longitude = Column(Float, nullable=False, comment="经度")
    latitude = Column(Float, nullable=False, comment="纬度")
    
    pixel_x = Column(Integer, comment="影像像素X坐标")
    pixel_y = Column(Integer, comment="影像像素Y坐标")
    
    image_path = Column(String(500), comment="影像路径")
    image_name = Column(String(200), comment="影像文件名")
    
    lesion_type = Column(String(100), comment="病斑类型")
    confidence_score = Column(Float, default=0.0, comment="AI置信度")
    
    estimated_area_m2 = Column(Float, default=0.0, comment="预估面积(平方米)")
    severity_level = Column(String(20), comment="严重程度")
    
    source = Column(Enum(LesionSource), default=LesionSource.AI_DETECTION, comment="来源")
    status = Column(Enum(LesionStatus), default=LesionStatus.PENDING, comment="状态")
    
    match_rule_id = Column(Integer, ForeignKey("rule_definitions.id"), comment="匹配的规则ID")
    match_rule_name = Column(String(200), comment="匹配的规则名称")
    match_reason = Column(Text, comment="匹配原因")
    
    is_false_positive = Column(Boolean, default=False, comment="是否误报")
    is_reverted = Column(Boolean, default=False, comment="是否已回滚")
    revert_reason = Column(Text, comment="回滚原因")
    reverted_by = Column(String(100), comment="回滚人")
    reverted_at = Column(DateTime, comment="回滚时间")
    
    created_by = Column(String(100), nullable=False, comment="创建人")
    created_at = Column(DateTime, default=datetime.now, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment="更新时间")
    
    remark = Column(Text, comment="备注")
    
    verifications = relationship("VerificationRecord", back_populates="lesion", cascade="all, delete-orphan", order_by="VerificationRecord.created_at.desc()")
    
    def __repr__(self):
        return f"<LesionRecord {self.lesion_code} - {self.status}>"
