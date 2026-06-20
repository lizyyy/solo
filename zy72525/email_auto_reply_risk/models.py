"""数据模型定义

核心设计原则：
1. 所有变更留痕：每次导入、改判、状态变更都有完整历史记录
2. 可追溯：每条风险记录都关联原始行号、模型版本、样本编号
3. 可复盘：支持按时间线回溯任意时刻的状态
"""

from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from sqlalchemy import (
    Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Index
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class RiskStatus(str, Enum):
    """风险处理状态
    
    状态流转：
    PENDING_IMPORT → PENDING_REVIEW → CONFIRMED_RISK / NORMAL / NEEDS_RECHECK
    """
    PENDING_IMPORT = "pending_import"      
    PENDING_REVIEW = "pending_review"      
    CONFIRMED_RISK = "confirmed_risk"      
    NORMAL = "normal"                      
    NEEDS_RECHECK = "needs_recheck"        


class ChangeType(str, Enum):
    """变更类型"""
    IMPORT = "import"                    
    MANUAL_EDIT = "manual_edit"          
    STATUS_CHANGE = "status_change"      
    REMARK_EDIT = "remark_edit"          
    ROLLBACK = "rollback"                
    REIMPORT_SAME_MODEL = "reimport_same_model"   
    MODEL_VERSION_CHANGE = "model_version_change"  


class ModelOutputFragment(Base):
    """模型输出片段原始记录
    
    保留模型输出的原始信息，用于后续追溯和核对
    
    关键字段说明：
    - processing_status: 当前处理状态（产品复盘直接读这个字段，不用倒推）
    - current_remark: 当前备注（周姐只改备注时存在这）
    - original_is_auto_reply_risk: 模型原始判断（永不改变，人工改判不覆盖）
    - is_auto_reply_risk: 当前生效的风险判断（可能被人工改判覆盖）
    """
    __tablename__ = "model_output_fragments"
    
    id = Column(Integer, primary_key=True)
    sample_id = Column(String(64), nullable=False, index=True)
    model_version = Column(String(64), nullable=False, index=True)
    original_line_number = Column(Integer, nullable=False)
    raw_content = Column(Text, nullable=False)
    original_is_auto_reply_risk = Column(Boolean, nullable=False)
    is_auto_reply_risk = Column(Boolean, nullable=False)
    risk_score = Column(Integer, nullable=True)
    processing_status = Column(String(32), nullable=False, default="pending_import")
    current_remark = Column(Text, nullable=True)
    import_batch_id = Column(String(64), nullable=False, index=True)
    imported_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_updated_by = Column(String(64), nullable=True)
    
    __table_args__ = (
        Index("idx_sample_model", "sample_id", "model_version"),
        Index("idx_status", "processing_status"),
    )
    
    change_history = relationship("RiskChangeLog", back_populates="fragment")
    manual_reviews = relationship("ManualReview", back_populates="fragment")


class ManualReview(Base):
    """人工改判记录
    
    记录标注负责人周姐等人工改判的详细信息
    """
    __tablename__ = "manual_reviews"
    
    id = Column(Integer, primary_key=True)
    fragment_id = Column(Integer, ForeignKey("model_output_fragments.id"), nullable=False)
    reviewer = Column(String(64), nullable=False)
    review_time = Column(DateTime, default=datetime.utcnow, nullable=False)
    original_is_risk = Column(Boolean, nullable=False)
    reviewed_is_risk = Column(Boolean, nullable=False)
    original_status = Column(String(32), nullable=False)
    reviewed_status = Column(String(32), nullable=False)
    remark = Column(Text, nullable=True)
    review_batch_id = Column(String(64), nullable=True)
    
    fragment = relationship("ModelOutputFragment", back_populates="manual_reviews")


class RiskChangeLog(Base):
    """风险变更历史日志
    
    每次变更都记录在此，用于：
    1. 运营复核人追问时回溯证据
    2. 产品复盘时查看完整时间线
    3. 支持回滚到任意历史状态
    """
    __tablename__ = "risk_change_logs"
    
    id = Column(Integer, primary_key=True)
    fragment_id = Column(Integer, ForeignKey("model_output_fragments.id"), nullable=False)
    change_type = Column(String(32), nullable=False)
    changed_by = Column(String(64), nullable=False)
    changed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    before_data = Column(Text, nullable=True)  
    after_data = Column(Text, nullable=True)   
    
    original_line_number = Column(Integer, nullable=True)
    model_version_before = Column(String(64), nullable=True)
    model_version_after = Column(String(64), nullable=True)
    is_risk_before = Column(Boolean, nullable=True)
    is_risk_after = Column(Boolean, nullable=True)
    status_before = Column(String(32), nullable=True)
    status_after = Column(String(32), nullable=True)
    remark = Column(Text, nullable=True)
    batch_id = Column(String(64), nullable=True)
    
    fragment = relationship("ModelOutputFragment", back_populates="change_history")


class RiskSummary(Base):
    """风险汇总表（按样本+模型版本维度）
    
    用于产品复盘页展示，保持数据一致性
    """
    __tablename__ = "risk_summaries"
    
    id = Column(Integer, primary_key=True)
    sample_id = Column(String(64), nullable=False, index=True)
    model_version = Column(String(64), nullable=False, index=True)
    total_fragments = Column(Integer, nullable=False, default=0)
    risk_count = Column(Integer, nullable=False, default=0)
    normal_count = Column(Integer, nullable=False, default=0)
    pending_count = Column(Integer, nullable=False, default=0)
    needs_recheck_count = Column(Integer, nullable=False, default=0)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_updated_by = Column(String(64), nullable=True)
    
    __table_args__ = (
        Index("idx_summary_unique", "sample_id", "model_version", unique=True),
    )


class ImportBatch(Base):
    """导入批次记录
    
    记录每次导入的元数据，支持重复导入检测
    """
    __tablename__ = "import_batches"
    
    id = Column(Integer, primary_key=True)
    batch_id = Column(String(64), nullable=False, unique=True, index=True)
    model_version = Column(String(64), nullable=False)
    imported_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    imported_by = Column(String(64), nullable=False)
    source_file = Column(String(256), nullable=True)
    total_records = Column(Integer, nullable=False, default=0)
    new_records = Column(Integer, nullable=False, default=0)
    updated_records = Column(Integer, nullable=False, default=0)
    duplicate_skipped = Column(Integer, nullable=False, default=0)
    remark = Column(Text, nullable=True)


class ReviewBatch(Base):
    """人工改判批次记录
    
    记录每次人工改判的元数据，支持复盘时生成可重跑命令
    """
    __tablename__ = "review_batches"
    
    id = Column(Integer, primary_key=True)
    review_batch_id = Column(String(64), nullable=False, unique=True, index=True)
    reviewer = Column(String(64), nullable=False)
    reviewed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    source_file = Column(String(256), nullable=True)
    total_items = Column(Integer, nullable=False, default=0)
    success_count = Column(Integer, nullable=False, default=0)
    skip_count = Column(Integer, nullable=False, default=0)
    remark = Column(Text, nullable=True)
