from datetime import datetime
from enum import Enum as PyEnum
from typing import Any, Optional, Dict, List

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Boolean,
    ForeignKey,
    Enum,
    JSON,
    Float,
)
from sqlalchemy.orm import relationship, Mapped, mapped_column

from .database import Base


class ApprovalStatus(str, PyEnum):
    PENDING = "待审批"
    APPROVED = "已通过"
    REJECTED = "已拒绝"
    CANCELLED = "已取消"


class ExecutionStatus(str, PyEnum):
    PENDING = "待执行"
    RUNNING = "执行中"
    SUCCESS = "执行成功"
    FAILED = "执行失败"
    SKIPPED = "已跳过"
    RETRYING = "重试中"


class IdempotencyStatus(str, PyEnum):
    NEW = "新记录"
    PROCESSING = "处理中"
    SUCCESS = "成功"
    FAILED = "失败"


class MessageMetadata(Base):
    __tablename__ = "message_metadata"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    message_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)

    topic: Mapped[str] = mapped_column(String(128), nullable=False, comment="消息主题")
    partition: Mapped[Optional[int]] = mapped_column(Integer, comment="分区号")
    offset: Mapped[Optional[int]] = mapped_column(Integer, comment="偏移量")

    message_body: Mapped[str] = mapped_column(Text, nullable=False, comment="消息内容")
    headers: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, comment="消息头")

    business_key: Mapped[Optional[str]] = mapped_column(
        String(128), index=True, comment="业务主键，用于业务层面定位消息"
    )
    idempotency_key: Mapped[Optional[str]] = mapped_column(
        String(128), index=True, comment="幂等键，确保消息消费的幂等性"
    )
    business_type: Mapped[Optional[str]] = mapped_column(
        String(64), index=True, comment="业务类型"
    )
    business_id: Mapped[Optional[str]] = mapped_column(
        String(64), index=True, comment="业务ID"
    )

    amount: Mapped[Optional[Float]] = mapped_column(Float, comment="涉及金额")
    quantity: Mapped[Optional[Integer]] = mapped_column(Integer, comment="涉及数量")
    quota: Mapped[Optional[Integer]] = mapped_column(Integer, comment="涉及名额")

    source_timestamp: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, comment="消息产生时间"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    idempotency_records: Mapped[List["IdempotencyRecord"]] = relationship(
        back_populates="message", cascade="all, delete-orphan"
    )
    replay_executions: Mapped[List["ReplayExecution"]] = relationship(
        back_populates="message", cascade="all, delete-orphan"
    )


class ReplayRequest(Base):
    __tablename__ = "replay_request"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    request_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)

    requester: Mapped[str] = mapped_column(String(64), nullable=False, comment="申请人")
    reason: Mapped[str] = mapped_column(Text, nullable=False, comment="申请原因")

    scope_type: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        comment="重放范围类型: time_range, message_ids, business_keys",
    )
    scope_value: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, comment="范围值")

    target_topic: Mapped[Optional[str]] = mapped_column(String(128), comment="目标主题")
    target_environment: Mapped[str] = mapped_column(
        String(32), nullable=False, comment="目标环境: prod, staging, test"
    )

    rate_limit_per_second: Mapped[int] = mapped_column(Integer, default=10, comment="每秒速率限制")
    rate_limit_per_minute: Mapped[int] = mapped_column(Integer, default=300, comment="每分钟速率限制")
    rate_limit_per_hour: Mapped[int] = mapped_column(Integer, default=10000, comment="每小时速率限制")

    approval_status: Mapped[str] = mapped_column(
        Enum(ApprovalStatus), default=ApprovalStatus.PENDING, index=True
    )
    approver: Mapped[Optional[str]] = mapped_column(String(64), comment="审批人")
    approval_comment: Mapped[Optional[str]] = mapped_column(Text, comment="审批意见")
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, comment="审批时间")

    execution_status: Mapped[str] = mapped_column(
        Enum(ExecutionStatus), default=ExecutionStatus.PENDING, index=True
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, comment="开始执行时间")
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, comment="完成执行时间")

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    executions: Mapped[List["ReplayExecution"]] = relationship(
        back_populates="request", cascade="all, delete-orphan"
    )
    report: Mapped[Optional["ReplayReport"]] = relationship(
        back_populates="request", uselist=False, cascade="all, delete-orphan"
    )


class IdempotencyRecord(Base):
    __tablename__ = "idempotency_record"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    idempotency_key: Mapped[str] = mapped_column(
        String(128), unique=True, index=True, nullable=False
    )

    business_type: Mapped[Optional[str]] = mapped_column(String(64), index=True)
    business_id: Mapped[Optional[str]] = mapped_column(String(64), index=True)

    message_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("message_metadata.message_id"), index=True
    )
    request_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("replay_request.request_id"), index=True
    )

    status: Mapped[str] = mapped_column(
        Enum(IdempotencyStatus), default=IdempotencyStatus.NEW, index=True
    )
    result_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, comment="执行结果数据")
    error_message: Mapped[Optional[str]] = mapped_column(Text, comment="错误信息")

    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, comment="处理完成时间")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    message: Mapped[Optional["MessageMetadata"]] = relationship(
        back_populates="idempotency_records"
    )


class ReplayExecution(Base):
    __tablename__ = "replay_execution"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    execution_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)

    request_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("replay_request.request_id"), index=True, nullable=False
    )
    message_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("message_metadata.message_id"), index=True, nullable=False
    )

    execution_order: Mapped[int] = mapped_column(Integer, nullable=False, comment="执行顺序")
    status: Mapped[str] = mapped_column(
        Enum(ExecutionStatus), default=ExecutionStatus.PENDING, index=True
    )

    start_time: Mapped[Optional[datetime]] = mapped_column(DateTime)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer, comment="执行耗时(毫秒)")

    error_message: Mapped[Optional[str]] = mapped_column(Text, comment="错误信息")
    response_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, comment="响应数据")

    retry_count: Mapped[int] = mapped_column(Integer, default=0, comment="重试次数")
    max_retries: Mapped[int] = mapped_column(Integer, default=3, comment="最大重试次数")

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    request: Mapped["ReplayRequest"] = relationship(back_populates="executions")
    message: Mapped["MessageMetadata"] = relationship(back_populates="replay_executions")


class ReplayReport(Base):
    __tablename__ = "replay_report"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    report_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    request_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("replay_request.request_id"), unique=True, index=True
    )

    total_messages: Mapped[int] = mapped_column(Integer, default=0, comment="总消息数")
    success_count: Mapped[int] = mapped_column(Integer, default=0, comment="成功数")
    failed_count: Mapped[int] = mapped_column(Integer, default=0, comment="失败数")
    skipped_count: Mapped[int] = mapped_column(Integer, default=0, comment="跳过数")

    start_time: Mapped[Optional[datetime]] = mapped_column(DateTime)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime)
    total_duration_ms: Mapped[Optional[int]] = mapped_column(Integer, comment="总耗时(毫秒)")

    executor: Mapped[Optional[str]] = mapped_column(String(64), comment="执行人")
    summary: Mapped[Optional[str]] = mapped_column(Text, comment="执行摘要")

    total_amount: Mapped[Optional[Float]] = mapped_column(Float, comment="总涉及金额")
    total_quantity: Mapped[Optional[int]] = mapped_column(Integer, comment="总涉及数量")
    total_quota: Mapped[Optional[int]] = mapped_column(Integer, comment="总涉及名额")

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, index=True
    )

    request: Mapped["ReplayRequest"] = relationship(back_populates="report")
