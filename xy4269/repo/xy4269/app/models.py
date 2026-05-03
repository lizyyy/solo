from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import enum

class ApprovalStatus(str, enum.Enum):
    DRAFT = "草稿"
    PENDING = "待审核"
    APPROVED = "已审签"
    REJECTED = "已驳回"
    CANCELLED = "已撤销"

class ConflictType(str, enum.Enum):
    TRACK_CONFLICT = "轨行区重复占用"
    POWER_CONFLICT = "停电窗口不匹配"
    TRAIN_CONFLICT = "作业车相向冲突"
    QUALIFICATION_CONFLICT = "人员资质过期"
    TIME_OVERLAP = "时间窗口重叠"

class ImportStatus(str, enum.Enum):
    PENDING = "待处理"
    SUCCESS = "已成功"
    FAILED = "已失败"
    PARTIAL = "部分成功"

class ImportRecord(Base):
    __tablename__ = "import_records"
    
    id = Column(Integer, primary_key=True, index=True)
    file_type = Column(String(50), nullable=False)  # construction, topology, power, train, personnel
    file_name = Column(String(255), nullable=False)
    import_time = Column(DateTime, default=datetime.utcnow)
    status = Column(SQLEnum(ImportStatus), default=ImportStatus.PENDING)
    total_records = Column(Integer, default=0)
    success_records = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    operator = Column(String(100), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ConstructionPlan(Base):
    __tablename__ = "construction_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    import_record_id = Column(Integer, ForeignKey("import_records.id"), nullable=True)
    
    plan_no = Column(String(100), unique=True, nullable=False)
    plan_name = Column(String(255), nullable=False)
    line = Column(String(50), nullable=False)
    track_section = Column(String(255), nullable=False)
    
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    
    work_type = Column(String(100), nullable=True)
    work_content = Column(Text, nullable=True)
    
    construction_unit = Column(String(255), nullable=True)
    responsible_person = Column(String(100), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    
    power_requirement = Column(String(255), nullable=True)
    work_train_required = Column(Boolean, default=False)
    
    status = Column(SQLEnum(ApprovalStatus), default=ApprovalStatus.DRAFT)
    current_approver = Column(String(100), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    approvals = relationship("ApprovalRecord", back_populates="plan")
    conflicts = relationship("ConflictCheck", back_populates="plan")

class TrackSection(Base):
    __tablename__ = "track_sections"
    
    id = Column(Integer, primary_key=True, index=True)
    import_record_id = Column(Integer, ForeignKey("import_records.id"), nullable=True)
    
    section_id = Column(String(100), unique=True, nullable=False)
    section_name = Column(String(255), nullable=False)
    line = Column(String(50), nullable=False)
    
    start_mileage = Column(Float, nullable=True)
    end_mileage = Column(Float, nullable=True)
    
    adjacent_sections = Column(Text, nullable=True)  # JSON 存储相邻区段列表
    power_section = Column(String(100), nullable=True)  # 所属供电区段
    is_double_track = Column(Boolean, default=False)
    direction = Column(String(50), nullable=True)  # 上行/下行/双向
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class PowerWindow(Base):
    __tablename__ = "power_windows"
    
    id = Column(Integer, primary_key=True, index=True)
    import_record_id = Column(Integer, ForeignKey("import_records.id"), nullable=True)
    
    window_id = Column(String(100), unique=True, nullable=False)
    power_section = Column(String(100), nullable=False)
    line = Column(String(50), nullable=False)
    
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    
    voltage = Column(String(50), nullable=True)
    substation = Column(String(100), nullable=True)
    feeder = Column(String(100), nullable=True)
    
    status = Column(String(50), default="计划")  # 计划/执行中/已完成/取消
    actual_start_time = Column(DateTime, nullable=True)
    actual_end_time = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class WorkTrain(Base):
    __tablename__ = "work_trains"
    
    id = Column(Integer, primary_key=True, index=True)
    import_record_id = Column(Integer, ForeignKey("import_records.id"), nullable=True)
    
    train_id = Column(String(100), unique=True, nullable=False)
    train_type = Column(String(100), nullable=True)
    line = Column(String(50), nullable=False)
    
    plan_id = Column(Integer, ForeignKey("construction_plans.id"), nullable=True)
    
    start_section = Column(String(100), nullable=False)
    end_section = Column(String(100), nullable=False)
    direction = Column(String(50), nullable=False)  # 上行/下行
    
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    
    operator = Column(String(100), nullable=True)
    status = Column(String(50), default="待发车")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class PersonnelQualification(Base):
    __tablename__ = "personnel_qualifications"
    
    id = Column(Integer, primary_key=True, index=True)
    import_record_id = Column(Integer, ForeignKey("import_records.id"), nullable=True)
    
    employee_id = Column(String(100), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    department = Column(String(255), nullable=True)
    
    qualification_type = Column(String(100), nullable=False)  # 作业负责人/安全员/司机等
    qualification_level = Column(String(50), nullable=True)
    certificate_no = Column(String(100), unique=True, nullable=False)
    
    issue_date = Column(DateTime, nullable=True)
    expiry_date = Column(DateTime, nullable=False)
    
    is_active = Column(Boolean, default=True)
    last_audit_date = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class PlanPersonnel(Base):
    __tablename__ = "plan_personnel"
    
    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("construction_plans.id"), nullable=False)
    personnel_id = Column(Integer, ForeignKey("personnel_qualifications.id"), nullable=False)
    role = Column(String(100), nullable=True)  # 在计划中的角色
    
    created_at = Column(DateTime, default=datetime.utcnow)

class ConflictCheck(Base):
    __tablename__ = "conflict_checks"
    
    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("construction_plans.id"), nullable=False)
    conflict_type = Column(SQLEnum(ConflictType), nullable=False)
    
    related_plan_id = Column(Integer, ForeignKey("construction_plans.id"), nullable=True)
    related_train_id = Column(Integer, ForeignKey("work_trains.id"), nullable=True)
    related_power_id = Column(Integer, ForeignKey("power_windows.id"), nullable=True)
    related_personnel_id = Column(Integer, ForeignKey("personnel_qualifications.id"), nullable=True)
    
    description = Column(Text, nullable=False)
    risk_level = Column(String(20), default="中风险")  # 低/中/高/严重
    is_resolved = Column(Boolean, default=False)
    resolved_by = Column(String(100), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    
    check_time = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    plan = relationship("ConstructionPlan", foreign_keys=[plan_id], back_populates="conflicts")

class ApprovalRecord(Base):
    __tablename__ = "approval_records"
    
    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("construction_plans.id"), nullable=False)
    
    approval_order = Column(Integer, default=1)  # 审批顺序
    approver = Column(String(100), nullable=False)
    action = Column(String(50), nullable=False)  # 审签/驳回/撤销
    comments = Column(Text, nullable=True)
    
    previous_status = Column(SQLEnum(ApprovalStatus), nullable=True)
    new_status = Column(SQLEnum(ApprovalStatus), nullable=True)
    
    approval_time = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    plan = relationship("ConstructionPlan", back_populates="approvals")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    operation_type = Column(String(100), nullable=False)  # 导入/冲突检查/审签/驳回/撤销/查询/导出
    operator = Column(String(100), nullable=True)
    
    target_type = Column(String(50), nullable=True)  # plan/train/power/personnel
    target_id = Column(Integer, nullable=True)
    
    details = Column(Text, nullable=True)  # JSON 存储详细信息
    ip_address = Column(String(50), nullable=True)
    
    operation_time = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
