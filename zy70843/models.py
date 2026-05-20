from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Enum, Date, Boolean
from sqlalchemy.orm import relationship
from database import Base
import enum
from datetime import datetime


class MaterialStatus(str, enum.Enum):
    NORMAL = "正常"
    PENDING_SUPPLEMENT = "待补充"
    BLOCKED = "已拦截"


class DepositStatus(str, enum.Enum):
    UNPAID = "未缴纳"
    PAID = "已缴纳"
    REFUNDED = "已退还"


class BoothCertificate(Base):
    __tablename__ = "booth_certificates"

    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String, index=True, nullable=False, comment="材料批次号")
    booth_number = Column(String, index=True, nullable=False, comment="摊位编号")
    mall_name = Column(String, nullable=False, comment="商场名称")
    certificate_version = Column(String, nullable=False, comment="证照版本")
    
    schedule_start_date = Column(Date, nullable=True, comment="场地档期开始日期")
    schedule_end_date = Column(Date, nullable=True, comment="场地档期结束日期")
    entry_time = Column(DateTime, nullable=True, comment="进场时间")
    
    business_license = Column(String, nullable=True, comment="营业执照路径/编号")
    fire_safety_material = Column(String, nullable=True, comment="消防材料路径/编号")
    
    certificate_expiry_date = Column(Date, nullable=True, comment="证照过期日期")
    deposit_status = Column(Enum(DepositStatus), default=DepositStatus.UNPAID, comment="押金状态")
    
    status = Column(Enum(MaterialStatus), nullable=False, comment="处理状态")
    follow_up_action = Column(Text, nullable=True, comment="后续动作")
    reject_reason = Column(Text, nullable=True, comment="原因说明")
    
    error_details = Column(Text, nullable=True, comment="错误明细和原始材料位置")
    
    processor = Column(String, nullable=False, comment="最后处理人")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")
    
    is_duplicate = Column(Boolean, default=False, comment="是否重复提交")
    original_batch_id = Column(Integer, ForeignKey("booth_certificates.id"), nullable=True, comment="原始批次ID")
    
    original_record = relationship("BoothCertificate", remote_side=[id])
