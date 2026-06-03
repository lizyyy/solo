"""
核心数据模型
============

除权日截图、税费率备注、合规抽检记录、机构简称映射、变更历史等
"""

from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean,
    ForeignKey, JSON, Enum
)
from sqlalchemy.orm import relationship

from .database import Base


class MaterialSource(PyEnum):
    """材料来源类型"""
    EX_DIVIDEND_SCREENSHOT = "ex_dividend_screenshot"
    TAX_RATE_REMARK = "tax_rate_remark"


class CheckStatus(PyEnum):
    """抽检状态"""
    PENDING = "pending"
    IMPORTED = "imported"
    REMARK_ADDED = "remark_added"
    REVIEW_REQUIRED = "review_required"
    REVIEWED = "reviewed"
    COMPLETED = "completed"
    REJECTED = "rejected"


class ChangeAction(PyEnum):
    """变更操作类型"""
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    ROLLBACK = "rollback"
    REVIEW_APPROVE = "review_approve"
    REVIEW_REJECT = "review_reject"


class InstitutionAlias(Base):
    """机构简称映射表 - 用于判定简称一致性

    边界规则：
    - 同一标准机构名可以有多个别名
    - 别名不区分大小写，但区分中英文
    - 别名为空字符串或None时判定为不一致
    """
    __tablename__ = "institution_aliases"

    id = Column(Integer, primary_key=True)
    standard_name = Column(String(255), nullable=False, index=True)
    alias = Column(String(255), nullable=False, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    def __repr__(self):
        return f"<InstitutionAlias {self.alias} -> {self.standard_name}>"


class ExDividendScreenshot(Base):
    """除权日截图 - 主材料

    去重规则：
    - 根据 source_file_hash + ex_dividend_date + institution_name 联合去重
    - 同一批次导入的相同记录只保留一份
    """
    __tablename__ = "ex_dividend_screenshots"

    id = Column(Integer, primary_key=True)
    source_file = Column(String(500), nullable=False)
    source_file_hash = Column(String(64), nullable=False, index=True)
    institution_name = Column(String(255), nullable=False, index=True)
    ex_dividend_date = Column(String(20), nullable=False, index=True)
    dividend_amount = Column(String(100))
    currency = Column(String(20))
    raw_content = Column(JSON)
    import_batch_id = Column(String(64), index=True)
    imported_by = Column(String(100), default="system")
    imported_at = Column(DateTime, default=datetime.now)

    spot_checks = relationship("ComplianceSpotCheck", back_populates="screenshot")

    __mapper_args__ = {
        "primary_key": [id]
    }


class TaxRateRemark(Base):
    """税费率备注 - 关键备注材料

    变更追踪：
    - 每条备注修改都会记录变更历史
    - 支持单条备注的前后对比
    """
    __tablename__ = "tax_rate_remarks"

    id = Column(Integer, primary_key=True)
    source_file = Column(String(500))
    institution_name = Column(String(255), nullable=False, index=True)
    tax_rate = Column(String(50))
    tax_type = Column(String(100))
    remark_content = Column(Text, nullable=False)
    effective_date = Column(String(20))
    added_by = Column(String(100), default="assistant")
    added_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    spot_checks = relationship("ComplianceSpotCheck", back_populates="remark")


class ComplianceSpotCheck(Base):
    """跨境汇款合规抽检记录 - 核心业务对象

    工作流状态：
    imported → remark_added → review_required → reviewed → completed
                            ↓
                        rejected (可回滚)

    机构简称不一致处理：
    - 检测到不一致时 status = review_required
    - 自动关联 review_task
    - 不自动归一化，等待财务复核
    """
    __tablename__ = "compliance_spot_checks"

    id = Column(Integer, primary_key=True)
    check_no = Column(String(50), unique=True, nullable=False, index=True)
    screenshot_id = Column(Integer, ForeignKey("ex_dividend_screenshots.id"))
    remark_id = Column(Integer, ForeignKey("tax_rate_remarks.id"))
    institution_name_from_screenshot = Column(String(255))
    institution_name_from_remark = Column(String(255))
    institution_name_consistent = Column(Boolean)
    status = Column(Enum(CheckStatus), default=CheckStatus.IMPORTED, index=True)
    check_result = Column(Text)
    reviewed_by = Column(String(100))
    reviewed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    screenshot = relationship("ExDividendScreenshot", back_populates="spot_checks")
    remark = relationship("TaxRateRemark", back_populates="spot_checks")
    change_histories = relationship("ChangeHistory", back_populates="spot_check")
    review_tasks = relationship("ReviewTask", back_populates="spot_check")


class ChangeHistory(Base):
    """变更历史 - 支持回滚和前后对比

    每次修改都会记录：
    - 修改前的值 (old_value)
    - 修改后的值 (new_value)
    - 修改人 (changed_by)
    - 修改字段 (field_name)
    - 回滚命令 (rollback_command)
    """
    __tablename__ = "change_histories"

    id = Column(Integer, primary_key=True)
    spot_check_id = Column(Integer, ForeignKey("compliance_spot_checks.id"))
    field_name = Column(String(100), nullable=False)
    old_value = Column(JSON)
    new_value = Column(JSON)
    action = Column(Enum(ChangeAction), nullable=False)
    changed_by = Column(String(100), nullable=False)
    change_reason = Column(Text)
    rollback_command = Column(String(500))
    created_at = Column(DateTime, default=datetime.now)

    spot_check = relationship("ComplianceSpotCheck", back_populates="change_histories")


class ReviewTask(Base):
    """财务复核任务

    当机构简称不一致时自动创建
    复核人可以：
    - approve: 确认正确，更新标准机构名
    - reject: 标记为错误，回退状态
    """
    __tablename__ = "review_tasks"

    id = Column(Integer, primary_key=True)
    spot_check_id = Column(Integer, ForeignKey("compliance_spot_checks.id"), index=True)
    issue_type = Column(String(100), nullable=False)
    issue_description = Column(Text, nullable=False)
    source_material_type = Column(Enum(MaterialSource), nullable=False)
    source_material_id = Column(Integer, nullable=False)
    assigned_to = Column(String(100), default="finance_reviewer")
    status = Column(String(20), default="pending")
    resolution = Column(Text)
    resolved_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.now)

    spot_check = relationship("ComplianceSpotCheck", back_populates="review_tasks")


class AuditLog(Base):
    """审计日志 - 用于复盘和生成可重跑命令

    记录所有关键操作，支持：
    - 按时间线复盘
    - 生成可重新执行的命令
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    operation = Column(String(100), nullable=False, index=True)
    operator = Column(String(100), nullable=False)
    parameters = Column(JSON)
    result_summary = Column(Text)
    rerun_command = Column(String(500))
    created_at = Column(DateTime, default=datetime.now, index=True)
