from sqlalchemy import Column, Integer, String, DateTime, Text, Enum, Float, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from ..database import Base


class VerificationResult(str, enum.Enum):
    CONFIRMED = "确认为病斑"
    FALSE_POSITIVE = "误报"
    NEED_RECHECK = "需复核"


class VerificationRecord(Base):
    __tablename__ = "verification_records"
    
    id = Column(Integer, primary_key=True, index=True)
    
    verification_code = Column(String(50), unique=True, nullable=False, index=True, comment="核验编号")
    
    lesion_id = Column(Integer, ForeignKey("lesion_records.id"), nullable=False, index=True, comment="病斑ID")
    lesion = relationship("LesionRecord", back_populates="verifications")
    
    lesion_code = Column(String(50), index=True, comment="病斑编号（冗余字段）")
    grid_code = Column(String(50), index=True, comment="地块编号（冗余字段）")
    grid_name = Column(String(200), comment="地块名称（冗余字段）")
    
    verification_round = Column(Integer, default=1, comment="核验轮次")
    result = Column(Enum(VerificationResult), nullable=False, comment="核验结论")
    
    actual_lesion_type = Column(String(100), comment="实际病斑类型")
    actual_area_m2 = Column(Float, comment="实际面积(平方米)")
    actual_severity = Column(String(20), comment="实际严重程度")
    
    false_positive_type = Column(String(100), comment="误报类型")
    false_positive_reason = Column(Text, comment="误报原因")
    
    verification_method = Column(String(50), comment="核验方式")
    verification_location = Column(String(200), comment="核验地点")
    
    photo_evidence = Column(String(500), comment="核验照片路径")
    video_evidence = Column(String(500), comment="核验视频路径")
    
    verified_by = Column(String(100), nullable=False, comment="核验人")
    verified_at = Column(DateTime, default=datetime.now, comment="核验时间")
    
    is_active = Column(Boolean, default=True, comment="是否有效")
    is_reverted = Column(Boolean, default=False, comment="是否已回滚")
    revert_reason = Column(Text, comment="回滚原因")
    reverted_by = Column(String(100), comment="回滚人")
    reverted_at = Column(DateTime, comment="回滚时间")
    
    remark = Column(Text, comment="备注")
    
    created_at = Column(DateTime, default=datetime.now, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment="更新时间")
    
    def __repr__(self):
        return f"<VerificationRecord {self.verification_code} - {self.result}>"
