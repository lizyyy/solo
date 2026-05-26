from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


QC_ITEM_STATUSES = [
    "pending",         # 刚导入，待处理
    "processing",      # 正在处理
    "returned",        # 退回修改（等待补材料/改正）
    "reviewed",        # 二次复核完成
    "approved",        # 放行 / 已结案
    "rejected",        # 驳回
]


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(256), nullable=False, unique=True)
    operator = Column(String(128), nullable=False)
    source = Column(String(64), nullable=False)        # csv / json / appeal
    meta = Column(JSON, nullable=True)                 # 批次原始头部/备注
    remark = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    items = relationship("QCItem", back_populates="batch")


class QCItem(Base):
    __tablename__ = "qc_items"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False, index=True)
    row_no = Column(Integer, nullable=False)                          # 批次内序号
    agent_id = Column(String(64), nullable=False, index=True)         # 坐席工号
    agent_name = Column(String(128), nullable=True)
    category = Column(String(128), nullable=True)
    deduction_item = Column(String(256), nullable=True, index=True)   # 扣分项
    deduction_score = Column(Float, nullable=False, default=0.0)      # 扣了多少分
    original_score = Column(Float, nullable=False, default=0.0)       # 原始成绩
    final_score = Column(Float, nullable=False, default=0.0)          # 最终成绩
    call_date = Column(String(32), nullable=True)
    call_id = Column(String(128), nullable=True)
    recording_summary = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default="pending", index=True)
    handler = Column(String(128), nullable=True)
    reviewed_by = Column(String(128), nullable=True, index=True)
    source_payload = Column(JSON, nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    batch = relationship("Batch", back_populates="items")
    events = relationship("QCEvent", back_populates="item", order_by="QCEvent.seq")
    appeals = relationship("Appeal", back_populates="item", order_by="Appeal.created_at")

    __table_args__ = (UniqueConstraint("batch_id", "row_no", name="uq_batch_row"),)


class QCEvent(Base):
    __tablename__ = "qc_events"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("qc_items.id"), nullable=False, index=True)
    seq = Column(Integer, nullable=False)              # 单条记录内事件序号
    action = Column(String(64), nullable=False)        # import / mark_processing / return / second_review / approve / reject / cancel_deduction / score_writeback
    actor = Column(String(128), nullable=False)
    reason = Column(Text, nullable=True)
    from_status = Column(String(32), nullable=True)
    to_status = Column(String(32), nullable=True)
    detail = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    item = relationship("QCItem", back_populates="events")


class Appeal(Base):
    __tablename__ = "appeals"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("qc_items.id"), nullable=False, index=True)
    appellant = Column(String(128), nullable=False)
    content = Column(Text, nullable=False)
    evidence = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    item = relationship("QCItem", back_populates="appeals")
