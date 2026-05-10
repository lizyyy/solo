from sqlalchemy import Column, Integer, String, DateTime, Text, Enum, Float, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from ..database import Base


class ReportStatus(str, enum.Enum):
    DRAFT = "草稿"
    GENERATING = "生成中"
    COMPLETED = "已完成"
    ARCHIVED = "已归档"


class VerificationReport(Base):
    __tablename__ = "verification_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    
    report_code = Column(String(50), unique=True, nullable=False, index=True, comment="报告编号")
    report_name = Column(String(200), nullable=False, comment="报告名称")
    
    batch_id = Column(Integer, ForeignKey("image_batches.id"), nullable=False, comment="批次ID")
    batch = relationship("ImageBatch", back_populates="reports")
    
    batch_code = Column(String(50), index=True, comment="批次编号（冗余字段）")
    flight_date = Column(DateTime, comment="飞行日期")
    flight_area = Column(String(200), comment="飞行区域")
    
    total_lesion_count = Column(Integer, default=0, comment="疑似病斑总数")
    confirmed_count = Column(Integer, default=0, comment="确认为病斑数量")
    false_positive_count = Column(Integer, default=0, comment="误报数量")
    pending_count = Column(Integer, default=0, comment="待核验数量")
    
    total_area_m2 = Column(Float, default=0.0, comment="病斑总面积(平方米)")
    confirmed_area_m2 = Column(Float, default=0.0, comment="确认病斑面积(平方米)")
    
    verification_rate = Column(Float, default=0.0, comment="核验完成率(%)")
    false_positive_rate = Column(Float, default=0.0, comment="误报率(%)")
    
    grid_summary = Column(JSON, comment="地块维度汇总")
    crop_type_summary = Column(JSON, comment="作物类型维度汇总")
    lesion_type_summary = Column(JSON, comment="病斑类型维度汇总")
    
    export_file_path = Column(String(500), comment="导出文件路径")
    export_file_name = Column(String(200), comment="导出文件名")
    export_format = Column(String(20), comment="导出格式")
    
    status = Column(Enum(ReportStatus), default=ReportStatus.DRAFT, comment="报告状态")
    
    generated_by = Column(String(100), nullable=False, comment="生成人")
    generated_at = Column(DateTime, default=datetime.now, comment="生成时间")
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment="更新时间")
    
    remark = Column(Text, comment="备注")
    
    def __repr__(self):
        return f"<VerificationReport {self.report_code} - {self.report_name}>"
