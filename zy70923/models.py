"""数据库模型"""
from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def _now():
    return datetime.now(timezone.utc)


# ── 核心实体 ────────────────────────────────────────────────
class Sample(db.Model):
    """农产品农残检测送样记录"""

    __tablename__ = "samples"

    id = db.Column(db.Integer, primary_key=True)
    sample_batch = db.Column(db.String(64), nullable=False, unique=True)  # 送样批次
    cooperative = db.Column(db.String(128), nullable=False)  # 合作社
    product_name = db.Column(db.String(128), nullable=False)  # 农产品名称
    product_type = db.Column(db.String(64))  # 品类
    origin = db.Column(db.String(128))  # 产地
    sample_weight = db.Column(db.String(32))  # 送样重量
    send_date = db.Column(db.String(32))  # 送样日期
    receiver = db.Column(db.String(64), nullable=False)  # 接样员
    testing_items = db.Column(db.Text, nullable=False)  # 检测项目（JSON 字符串）
    remark = db.Column(db.Text)  # 备注

    # 关联
    task = db.relationship("Task", back_populates="sample", uselist=False)
    classification = db.relationship(
        "Classification", back_populates="sample", uselist=False
    )
    rechecks = db.relationship(
        "RecheckRecord", back_populates="sample", cascade="all, delete-orphan"
    )

    created_at = db.Column(db.DateTime, default=_now)
    updated_at = db.Column(db.DateTime, default=_now, onupdate=_now)

    def to_dict(self):
        return {
            "id": self.id,
            "sample_batch": self.sample_batch,
            "cooperative": self.cooperative,
            "product_name": self.product_name,
            "product_type": self.product_type,
            "origin": self.origin,
            "sample_weight": self.sample_weight,
            "send_date": self.send_date,
            "receiver": self.receiver,
            "testing_items": self.testing_items,
            "remark": self.remark,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# ── 任务状态 ────────────────────────────────────────────────
class Task(db.Model):
    """处理任务，状态持久化"""

    __tablename__ = "tasks"

    STATUS_PROCESSING = "processing"    # 处理中
    STATUS_FAILED = "failed"            # 处理失败
    STATUS_MANUAL = "manual_confirm"    # 人工确认
    STATUS_EXPORTED = "exported"        # 已导出

    id = db.Column(db.Integer, primary_key=True)
    sample_id = db.Column(db.Integer, db.ForeignKey("samples.id"), nullable=False)
    status = db.Column(db.String(32), nullable=False, default=STATUS_PROCESSING)
    error_message = db.Column(db.Text)  # 失败原因
    last_handler = db.Column(db.String(64))  # 最后处理人
    exported_at = db.Column(db.DateTime)
    sample = db.relationship("Sample", back_populates="task")
    audit_logs = db.relationship(
        "AuditLog", back_populates="task", cascade="all, delete-orphan"
    )

    created_at = db.Column(db.DateTime, default=_now)
    updated_at = db.Column(db.DateTime, default=_now, onupdate=_now)

    def to_dict(self):
        return {
            "id": self.id,
            "sample_id": self.sample_id,
            "status": self.status,
            "error_message": self.error_message,
            "last_handler": self.last_handler,
            "exported_at": self.exported_at.isoformat() if self.exported_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# ── 分类结果 ────────────────────────────────────────────────
class Classification(db.Model):
    """分类结果：正常 / 待补充 / 已拦截"""

    __tablename__ = "classifications"

    CATEGORY_NORMAL = "normal"       # 正常
    CATEGORY_SUPPLEMENT = "supplement"  # 待补充
    CATEGORY_BLOCKED = "blocked"     # 已拦截

    id = db.Column(db.Integer, primary_key=True)
    sample_id = db.Column(db.Integer, db.ForeignKey("samples.id"), nullable=False)
    category = db.Column(db.String(32), nullable=False)
    reason = db.Column(db.Text, nullable=False)  # 分类原因
    action = db.Column(db.Text, nullable=False)  # 后续动作
    sample = db.relationship("Sample", back_populates="classification")

    created_at = db.Column(db.DateTime, default=_now)
    updated_at = db.Column(db.DateTime, default=_now, onupdate=_now)

    def to_dict(self):
        return {
            "id": self.id,
            "sample_id": self.sample_id,
            "category": self.category,
            "reason": self.reason,
            "action": self.action,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ── 复检记录 ────────────────────────────────────────────────
class RecheckRecord(db.Model):
    """不合格复检记录，可反复修改"""

    __tablename__ = "recheck_records"

    id = db.Column(db.Integer, primary_key=True)
    sample_id = db.Column(db.Integer, db.ForeignKey("samples.id"), nullable=False)
    item = db.Column(db.String(128), nullable=False)  # 复检项目
    original_result = db.Column(db.String(64))  # 初检结果
    recheck_result = db.Column(db.String(64))  # 复检结果
    final_result = db.Column(db.String(64))  # 最终结果（多次修改后）
    operator = db.Column(db.String(64))  # 操作人
    sample = db.relationship("Sample", back_populates="rechecks")

    created_at = db.Column(db.DateTime, default=_now)
    updated_at = db.Column(db.DateTime, default=_now, onupdate=_now)

    def to_dict(self):
        return {
            "id": self.id,
            "sample_id": self.sample_id,
            "item": self.item,
            "original_result": self.original_result,
            "recheck_result": self.recheck_result,
            "final_result": self.final_result,
            "operator": self.operator,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# ── 审计日志 ────────────────────────────────────────────────
class AuditLog(db.Model):
    """操作审计"""

    __tablename__ = "audit_logs"

    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.Integer, db.ForeignKey("tasks.id"), nullable=False)
    action = db.Column(db.String(64), nullable=False)
    detail = db.Column(db.Text)
    operator = db.Column(db.String(64), nullable=False)
    task = db.relationship("Task", back_populates="audit_logs")

    created_at = db.Column(db.DateTime, default=_now)

    def to_dict(self):
        return {
            "id": self.id,
            "task_id": self.task_id,
            "action": self.action,
            "detail": self.detail,
            "operator": self.operator,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
