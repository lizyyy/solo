from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from auto_chain_reconcile.db import Base


class ReconcileBatch(Base):
    """一次上传形成的批次，用于幂等与追溯。"""

    __tablename__ = "reconcile_batch"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    batch_key: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    source_summary: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(16), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    results: Mapped[list["ReconcileResult"]] = relationship(back_populates="batch")


class Package(Base):
    """客户购买的套餐（来自 CSV）。"""

    __tablename__ = "package"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    package_id: Mapped[str] = mapped_column(String(64), index=True)
    customer_id: Mapped[str] = mapped_column(String(64), index=True)
    customer_name: Mapped[str] = mapped_column(String(128), default="")
    item_code: Mapped[str] = mapped_column(String(64))
    item_name: Mapped[str] = mapped_column(String(128), default="")
    allowed_store: Mapped[str] = mapped_column(String(64), default="*")
    total_qty: Mapped[int] = mapped_column(Integer, default=1)
    used_qty: Mapped[int] = mapped_column(Integer, default=0)
    batch_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("reconcile_batch.id"), nullable=True
    )
    raw: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_pkg_customer_item", "customer_id", "item_code"),
    )


class WorkOrder(Base):
    """到店工单（来自 JSON）。"""

    __tablename__ = "work_order"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    customer_id: Mapped[str] = mapped_column(String(64), index=True)
    store_id: Mapped[str] = mapped_column(String(64), index=True)
    item_code: Mapped[str] = mapped_column(String(64))
    item_name: Mapped[str] = mapped_column(String(128), default="")
    qty: Mapped[int] = mapped_column(Integer, default=1)
    parts: Mapped[str] = mapped_column(Text, default="[]")  # JSON 字符串
    batch_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("reconcile_batch.id"), nullable=True
    )
    raw: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class InventoryBatch(Base):
    """配件库存批次，可追溯来源。"""

    __tablename__ = "inventory_batch"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    part_code: Mapped[str] = mapped_column(String(64), index=True)
    part_name: Mapped[str] = mapped_column(String(128), default="")
    batch_no: Mapped[str] = mapped_column(String(64), index=True)
    supplier: Mapped[str] = mapped_column(String(128), default="")
    inbound_date: Mapped[str] = mapped_column(String(32), default="")
    store_id: Mapped[str] = mapped_column(String(64), index=True)
    initial_qty: Mapped[int] = mapped_column(Integer, default=0)
    remaining_qty: Mapped[int] = mapped_column(Integer, default=0)
    batch_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("reconcile_batch.id"), nullable=True
    )
    raw: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("part_code", "batch_no", "store_id", name="uq_part_batch_store"),
    )


class ReconcileResult(Base):
    """每条核销的判定结果。"""

    __tablename__ = "reconcile_result"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    batch_id: Mapped[int] = mapped_column(Integer, ForeignKey("reconcile_batch.id"))
    order_id: Mapped[str] = mapped_column(String(64), index=True)
    package_id: Mapped[str] = mapped_column(String(64), default="")
    status: Mapped[str] = mapped_column(String(16))  # normal / pending / failed
    reason: Mapped[str] = mapped_column(Text, default="")
    suggestion: Mapped[str] = mapped_column(Text, default="")
    raw: Mapped[str] = mapped_column(Text, default="")  # 原始字段 JSON
    rules: Mapped[str] = mapped_column(Text, default="[]")  # 命中规则
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    batch: Mapped[ReconcileBatch] = relationship(back_populates="results")

    __table_args__ = (
        Index("ix_result_batch_status", "batch_id", "status"),
    )
