from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class SurveyChecklist(Base):
    __tablename__ = "survey_checklist"

    id = Column(Integer, primary_key=True, index=True)
    item_no = Column(String(50), unique=True, index=True, nullable=False)
    location = Column(String(200), nullable=False, comment="空间位置")
    description = Column(Text, comment="描述")
    model_ref = Column(String(200), comment="模型引用/坐标")
    has_anomaly = Column(Boolean, default=False, comment="是否异常")
    anomaly_level = Column(String(20), default="", comment="异常等级：高/中/低")
    anomaly_note = Column(Text, default="", comment="异常说明")
    status = Column(String(30), default="待处理", comment="状态：待处理/处理中/已闭环")
    coordinator = Column(String(50), default="", comment="BIM协调员")
    operator = Column(String(50), default="", comment="算法值班人")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    batch_id = Column(String(50), default="", comment="跑批ID")

    anomalies = relationship("AnomalyRecord", back_populates="checklist", cascade="all, delete-orphan")
    materials = relationship("MaterialSubmission", back_populates="checklist", cascade="all, delete-orphan")
    offsets = relationship("CoordinateOffset", back_populates="checklist", cascade="all, delete-orphan")
    history = relationship("ChangeHistory", back_populates="checklist", cascade="all, delete-orphan")


class AnomalyRecord(Base):
    __tablename__ = "anomaly_record"

    id = Column(Integer, primary_key=True, index=True)
    checklist_id = Column(Integer, ForeignKey("survey_checklist.id"), nullable=False)
    anomaly_type = Column(String(50), comment="异常类型")
    detail = Column(Text, comment="异常详情")
    source = Column(String(100), comment="来源：现场/模型/送审表")
    operator = Column(String(50), default="", comment="发现人")
    root_cause = Column(Text, default="", comment="根本原因")
    action = Column(Text, default="", comment="处理动作")
    resolved = Column(Boolean, default=False)
    resolved_by = Column(String(50), default="")
    resolved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    checklist = relationship("SurveyChecklist", back_populates="anomalies")
    traces = relationship("AnomalyTrace", back_populates="anomaly", cascade="all, delete-orphan")


class AnomalyTrace(Base):
    __tablename__ = "anomaly_trace"

    id = Column(Integer, primary_key=True, index=True)
    anomaly_id = Column(Integer, ForeignKey("anomaly_record.id"), nullable=False)
    step = Column(Integer, comment="追溯步骤序号")
    from_node = Column(String(100), comment="上一环节")
    to_node = Column(String(100), comment="下一环节")
    reason = Column(Text, comment="变动原因")
    operator = Column(String(50), default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    anomaly = relationship("AnomalyRecord", back_populates="traces")


class MaterialSubmission(Base):
    __tablename__ = "material_submission"

    id = Column(Integer, primary_key=True, index=True)
    checklist_id = Column(Integer, ForeignKey("survey_checklist.id"), nullable=False)
    material_name = Column(String(200), nullable=False)
    version = Column(Integer, default=1, comment="版本号")
    current_value = Column(String(500), default="", comment="当前值")
    remark = Column(Text, default="", comment="备注")
    screenshot_path = Column(String(500), default="", comment="旧版本截图路径")
    submitted_by = Column(String(50), default="")
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    is_current = Column(Boolean, default=True, comment="是否当前版本")

    checklist = relationship("SurveyChecklist", back_populates="materials")


class ChangeHistory(Base):
    __tablename__ = "change_history"

    id = Column(Integer, primary_key=True, index=True)
    checklist_id = Column(Integer, ForeignKey("survey_checklist.id"), nullable=False)
    field_name = Column(String(100), comment="变更字段")
    old_value = Column(Text, comment="旧值")
    new_value = Column(Text, comment="新值")
    remark = Column(Text, default="", comment="变更备注")
    screenshot_ref = Column(String(500), default="", comment="截图引用")
    changed_by = Column(String(50), default="")
    changed_at = Column(DateTime(timezone=True), server_default=func.now())

    checklist = relationship("SurveyChecklist", back_populates="history")


class CoordinateOffset(Base):
    __tablename__ = "coordinate_offset"

    id = Column(Integer, primary_key=True, index=True)
    checklist_id = Column(Integer, ForeignKey("survey_checklist.id"), nullable=False)
    offset_x = Column(Float, default=0.0)
    offset_y = Column(Float, default=0.0)
    offset_z = Column(Float, default=0.0)
    threshold = Column(Float, default=50.0, comment="容差(mm)")
    exceeds = Column(Boolean, default=False, comment="是否超限")
    action_owner = Column(String(50), default="", comment="处理责任人")
    action_item = Column(Text, default="", comment="可执行动作")
    action_status = Column(String(30), default="待指派", comment="待指派/处理中/已完成")
    detected_at = Column(DateTime(timezone=True), server_default=func.now())

    checklist = relationship("SurveyChecklist", back_populates="offsets")


class BatchRun(Base):
    __tablename__ = "batch_run"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(50), unique=True, index=True)
    run_by = Column(String(50), default="")
    standard_version = Column(String(50), default="", comment="跑批口径版本")
    standard_desc = Column(Text, default="", comment="跑批口径说明")
    total_items = Column(Integer, default=0)
    anomaly_count = Column(Integer, default=0)
    offset_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
