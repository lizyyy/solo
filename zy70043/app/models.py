from sqlalchemy import (
    Column, String, Integer, Float, DateTime, Text, Boolean, ForeignKey, Enum as SQLEnum, UniqueConstraint
)
from sqlalchemy.orm import relationship, DeclarativeBase, Mapped, mapped_column
from datetime import datetime
from enum import Enum


class Base(DeclarativeBase):
    pass


class SubstitutionStatus(str, Enum):
    DRAFT = "草稿"
    PENDING_APPROVAL = "待审批"
    QC_REVIEW = "质检复核"
    COST_REVIEW = "成本复核"
    FINAL_APPROVAL = "最终审批"
    APPROVED = "已通过"
    REJECTED = "已驳回"
    FROZEN = "已冻结"
    IMPLEMENTING = "执行中"
    PARTIAL_SUCCESS = "部分成功"
    FAILED = "执行失败"
    COMPLETED = "已完成"


class ApprovalLevel(str, Enum):
    QC = "质检审批"
    COST = "成本审批"
    FINAL = "最终审批"


class ApprovalResult(str, Enum):
    APPROVE = "通过"
    REJECT = "驳回"
    DEFER = "暂缓"


class RawMaterial(Base):
    __tablename__ = "raw_materials"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, comment="原料编码")
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="原料名称")
    unit: Mapped[str] = mapped_column(String(20), nullable=False, comment="单位")
    unit_price: Mapped[float] = mapped_column(Float, nullable=False, comment="单价")
    category: Mapped[str] = mapped_column(String(50), nullable=True, comment="分类")
    specification: Mapped[str] = mapped_column(String(200), nullable=True, comment="规格")
    stock_quantity: Mapped[float] = mapped_column(Float, default=0.0, comment="当前库存")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, comment="是否启用")
    created_at: Mapped[datetime] = mapped_column(default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.now, onupdate=datetime.now)


class Formula(Base):
    __tablename__ = "formulas"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, comment="配方编码")
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="配方名称")
    product_code: Mapped[str] = mapped_column(String(50), nullable=False, comment="产品编码")
    product_name: Mapped[str] = mapped_column(String(100), nullable=False, comment="产品名称")
    current_version: Mapped[int] = mapped_column(Integer, default=1, comment="当前版本号")
    status: Mapped[str] = mapped_column(String(20), default="active", comment="状态")
    description: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.now, onupdate=datetime.now)
    
    versions: Mapped[list["FormulaVersion"]] = relationship("FormulaVersion", back_populates="formula")


class FormulaVersion(Base):
    __tablename__ = "formula_versions"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    formula_id: Mapped[int] = mapped_column(ForeignKey("formulas.id"), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False, comment="版本号")
    is_effective: Mapped[bool] = mapped_column(Boolean, default=False, comment="是否生效")
    effective_from: Mapped[datetime] = mapped_column(DateTime, nullable=True, comment="生效开始时间")
    effective_to: Mapped[datetime] = mapped_column(DateTime, nullable=True, comment="生效结束时间")
    created_by: Mapped[str] = mapped_column(String(50), nullable=False, comment="创建人")
    reason: Mapped[str] = mapped_column(Text, nullable=False, comment="版本变更原因")
    substitution_id: Mapped[int] = mapped_column(ForeignKey("substitution_requests.id"), nullable=True, comment="关联替代申请")
    created_at: Mapped[datetime] = mapped_column(default=datetime.now)
    
    __table_args__ = (UniqueConstraint('formula_id', 'version_number', name='uq_formula_version'),)
    
    formula: Mapped["Formula"] = relationship("Formula", back_populates="versions")
    items: Mapped[list["FormulaItem"]] = relationship("FormulaItem", back_populates="version")
    substitution: Mapped["SubstitutionRequest"] = relationship("SubstitutionRequest", back_populates="formula_versions")


class FormulaItem(Base):
    __tablename__ = "formula_items"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    version_id: Mapped[int] = mapped_column(ForeignKey("formula_versions.id"), nullable=False)
    raw_material_id: Mapped[int] = mapped_column(ForeignKey("raw_materials.id"), nullable=False)
    raw_material_code: Mapped[str] = mapped_column(String(50), nullable=False)
    raw_material_name: Mapped[str] = mapped_column(String(100), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False, comment="用量")
    unit: Mapped[str] = mapped_column(String(20), nullable=False, comment="单位")
    unit_price: Mapped[float] = mapped_column(Float, nullable=False, comment="单价快照")
    is_substituted: Mapped[bool] = mapped_column(Boolean, default=False, comment="是否为替代原料")
    substitution_note: Mapped[str] = mapped_column(Text, nullable=True, comment="替代说明")
    
    version: Mapped["FormulaVersion"] = relationship("FormulaVersion", back_populates="items")
    raw_material: Mapped["RawMaterial"] = relationship("RawMaterial")


class QCConstraint(Base):
    __tablename__ = "qc_constraints"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    raw_material_code: Mapped[str] = mapped_column(String(50), nullable=False, comment="原料编码")
    raw_material_name: Mapped[str] = mapped_column(String(100), nullable=False, comment="原料名称")
    constraint_type: Mapped[str] = mapped_column(String(50), nullable=False, comment="约束类型")
    constraint_value: Mapped[str] = mapped_column(String(200), nullable=False, comment="约束值")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now)


class SubstitutionRequest(Base):
    __tablename__ = "substitution_requests"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    request_no: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, comment="申请单号")
    status: Mapped[SubstitutionStatus] = mapped_column(SQLEnum(SubstitutionStatus), default=SubstitutionStatus.DRAFT)
    
    original_material_id: Mapped[int] = mapped_column(ForeignKey("raw_materials.id"), nullable=False)
    original_material_code: Mapped[str] = mapped_column(String(50), nullable=False)
    original_material_name: Mapped[str] = mapped_column(String(100), nullable=False)
    
    substitute_material_id: Mapped[int] = mapped_column(ForeignKey("raw_materials.id"), nullable=False)
    substitute_material_code: Mapped[str] = mapped_column(String(50), nullable=False)
    substitute_material_name: Mapped[str] = mapped_column(String(100), nullable=False)
    
    reason: Mapped[str] = mapped_column(Text, nullable=False, comment="替代原因")
    substitute_ratio: Mapped[float] = mapped_column(Float, default=1.0, comment="替代比例")
    is_temporary: Mapped[bool] = mapped_column(Boolean, default=True, comment="是否临时替代")
    
    original_cost: Mapped[float] = mapped_column(Float, nullable=False, comment="原成本")
    substitute_cost: Mapped[float] = mapped_column(Float, nullable=False, comment="替代后成本")
    cost_diff_amount: Mapped[float] = mapped_column(Float, nullable=False, comment="成本差额")
    cost_diff_percent: Mapped[float] = mapped_column(Float, nullable=False, comment="成本差异率")
    exceeds_threshold: Mapped[bool] = mapped_column(Boolean, default=False, comment="是否超出成本阈值")
    
    affected_formula_count: Mapped[int] = mapped_column(Integer, default=0, comment="受影响配方数量")
    
    created_by: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.now, onupdate=datetime.now)
    completed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    
    approvals: Mapped[list["ApprovalRecord"]] = relationship("ApprovalRecord", back_populates="request")
    formula_versions: Mapped[list["FormulaVersion"]] = relationship("FormulaVersion", back_populates="substitution")
    traces: Mapped[list["ExecutionTrace"]] = relationship("ExecutionTrace", back_populates="request")
    affected_formulas: Mapped[list["AffectedFormula"]] = relationship("AffectedFormula", back_populates="request")


class AffectedFormula(Base):
    __tablename__ = "affected_formulas"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    substitution_id: Mapped[int] = mapped_column(ForeignKey("substitution_requests.id"), nullable=False)
    formula_id: Mapped[int] = mapped_column(ForeignKey("formulas.id"), nullable=False)
    formula_code: Mapped[str] = mapped_column(String(50), nullable=False)
    formula_name: Mapped[str] = mapped_column(String(100), nullable=False)
    original_usage: Mapped[float] = mapped_column(Float, nullable=False)
    new_version_id: Mapped[int] = mapped_column(Integer, nullable=True)
    is_processed: Mapped[bool] = mapped_column(Boolean, default=False)
    processing_status: Mapped[str] = mapped_column(String(20), default="pending", comment="处理状态")
    error_message: Mapped[str] = mapped_column(Text, nullable=True)
    
    request: Mapped["SubstitutionRequest"] = relationship("SubstitutionRequest", back_populates="affected_formulas")


class ApprovalRecord(Base):
    __tablename__ = "approval_records"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    substitution_id: Mapped[int] = mapped_column(ForeignKey("substitution_requests.id"), nullable=False)
    approval_level: Mapped[ApprovalLevel] = mapped_column(SQLEnum(ApprovalLevel), nullable=False)
    result: Mapped[ApprovalResult] = mapped_column(SQLEnum(ApprovalResult), nullable=False)
    approver: Mapped[str] = mapped_column(String(50), nullable=False)
    comment: Mapped[str] = mapped_column(Text, nullable=True)
    approved_at: Mapped[datetime] = mapped_column(default=datetime.now)
    
    request: Mapped["SubstitutionRequest"] = relationship("SubstitutionRequest", back_populates="approvals")


class ExecutionTrace(Base):
    __tablename__ = "execution_traces"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    substitution_id: Mapped[int] = mapped_column(ForeignKey("substitution_requests.id"), nullable=False)
    step_name: Mapped[str] = mapped_column(String(100), nullable=False, comment="步骤名称")
    step_description: Mapped[str] = mapped_column(Text, nullable=True, comment="步骤描述")
    is_success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    error_message: Mapped[str] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, comment="重试次数")
    executed_at: Mapped[datetime] = mapped_column(default=datetime.now)
    
    request: Mapped["SubstitutionRequest"] = relationship("SubstitutionRequest", back_populates="traces")


class SystemConfig(Base):
    __tablename__ = "system_configs"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    config_key: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    config_value: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
