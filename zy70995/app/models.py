from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Index, JSON
)
from sqlalchemy.orm import declarative_base, relationship


Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(64), unique=True, nullable=False)
    role = Column(String(32), nullable=False, default="staff")
    created_at = Column(DateTime, default=datetime.utcnow)


class Submission(Base):
    """原始提交记录，承载学校食堂留餐补贴材料。

    关键字段：student_name, student_id, class_name, meal_days, subsidy_amount
    这些字段的任何修改都会在 FieldChange 中被追踪，以实现从原始输入
    到最终报告的可追溯性。
    """
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True)
    batch_no = Column(String(64), unique=True, nullable=False, index=True)
    submitted_by = Column(Integer, ForeignKey("users.id"), nullable=False)

    # 关键字段（会被追踪）
    student_name = Column(String(64), nullable=False)
    student_id = Column(String(32), nullable=False)
    class_name = Column(String(64), nullable=False)
    meal_days = Column(Integer, nullable=False)
    subsidy_amount = Column(Integer, nullable=False)  # 单位：分

    # 原始输入快照（JSON），永远不变，用于溯源
    raw_payload = Column(JSON, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    task = relationship("Task", back_populates="submission", uselist=False)
    field_changes = relationship("FieldChange", back_populates="submission")

    __table_args__ = (
        Index("ix_submissions_student", "student_id", "batch_no"),
    )


class Task(Base):
    """任务状态，持久化在数据库中。

    状态流转：
        processing  ->  review_pending / success / failed
        review_pending ->  success / failed / exported
        success     ->  exported
    """
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), unique=True, nullable=False, index=True)

    state = Column(String(32), nullable=False, default="processing", index=True)
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    submission = relationship("Submission", back_populates="task")
    classification = relationship("Classification", back_populates="task", uselist=False)


CATEGORY_NORMAL = "normal"
CATEGORY_PENDING = "pending_supplement"
CATEGORY_INTERCEPTED = "intercepted"


class Classification(Base):
    """分类结果：正常 / 待补充 / 已拦截。

    每个分类都有：
    - reason：系统/人工给出的原因说明
    - follow_up_action：后续应采取的动作（人类可读的行动项）
    """
    __tablename__ = "classifications"

    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), unique=True, nullable=False, index=True)

    category = Column(String(32), nullable=False, index=True)
    reason = Column(Text, nullable=False)
    follow_up_action = Column(Text, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    task = relationship("Task", back_populates="classification")


class ChangeLog(Base):
    """审计日志：记录每次结论修改。

    记录：谁改的、为什么改、改动前是什么、改动后是什么。
    """
    __tablename__ = "change_logs"

    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False, index=True)

    actor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    change_type = Column(String(32), nullable=False)  # category / state / field
    reason = Column(Text, nullable=False)

    before_value = Column(JSON, nullable=True)
    after_value = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        Index("ix_change_logs_task_time", "task_id", "created_at"),
    )


class FieldChange(Base):
    """字段级变更记录，实现从原始输入到最终报告的可追溯。

    每一次关键字段的修改都会记录 before_value / after_value，
    并在 raw_payload 中保留最初的值。
    """
    __tablename__ = "field_changes"

    id = Column(Integer, primary_key=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False, index=True)
    change_log_id = Column(Integer, ForeignKey("change_logs.id"), nullable=False, index=True)

    field_name = Column(String(64), nullable=False)
    before_value = Column(Text, nullable=True)
    after_value = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    submission = relationship("Submission", back_populates="field_changes")


class ExportReport(Base):
    """导出报告，记录最终输出，用于复盘溯源。"""
    __tablename__ = "export_reports"

    id = Column(Integer, primary_key=True)
    submission_id = Column(Integer, ForeignKey("submissions.id"), nullable=False, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False, index=True)

    report_payload = Column(JSON, nullable=False)
    exported_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    exported_at = Column(DateTime, default=datetime.utcnow)
