from enum import Enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, Boolean
from sqlalchemy.ext.declarative import declarative_base
from pydantic import BaseModel, Field
from typing import Optional, Dict, List

Base = declarative_base()

class PipelineStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    PAUSED = "paused"
    COMPENSATING = "compensating"

class ShardStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"

class Pipeline(Base):
    __tablename__ = "pipelines"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    pipeline_name = Column(String(255), unique=True, nullable=False)
    total_shards = Column(Integer, nullable=False)
    current_watermark = Column(Integer, default=0)
    status = Column(String(50), default=PipelineStatus.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_failure_reason = Column(Text, nullable=True)
    config = Column(JSON, default={})

class Shard(Base):
    __tablename__ = "shards"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    pipeline_id = Column(Integer, nullable=False)
    shard_index = Column(Integer, nullable=False)
    shard_range_start = Column(String(100), nullable=False)
    shard_range_end = Column(String(100), nullable=False)
    status = Column(String(50), default=ShardStatus.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    failure_reason = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    write_summary = Column(JSON, default={})
    raw_input = Column(JSON, default={})
    
    __table_args__ = ()

class PipelineHistory(Base):
    __tablename__ = "pipeline_history"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    pipeline_id = Column(Integer, nullable=False)
    shard_id = Column(Integer, nullable=True)
    action = Column(String(100), nullable=False)
    status_before = Column(String(50), nullable=True)
    status_after = Column(String(50), nullable=True)
    raw_input = Column(JSON, default={})
    conclusion = Column(Text, nullable=True)
    operator = Column(String(100), default="system")
    created_at = Column(DateTime, default=datetime.utcnow)

class WriteSummary(Base):
    __tablename__ = "write_summaries"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    pipeline_id = Column(Integer, nullable=False)
    shard_id = Column(Integer, nullable=False)
    records_written = Column(Integer, default=0)
    records_skipped = Column(Integer, default=0)
    records_failed = Column(Integer, default=0)
    details = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)

class PipelineCreateRequest(BaseModel):
    pipeline_name: str = Field(..., description="管道名称")
    total_shards: int = Field(..., ge=1, description="总分片数")
    shard_ranges: List[Dict[str, str]] = Field(..., description="分片范围列表")
    config: Optional[Dict] = Field(default={}, description="配置信息")

class PipelineResponse(BaseModel):
    id: int
    pipeline_name: str
    total_shards: int
    current_watermark: int
    status: PipelineStatus
    created_at: datetime
    updated_at: datetime
    last_failure_reason: Optional[str]
    config: Dict

class ShardResponse(BaseModel):
    id: int
    pipeline_id: int
    shard_index: int
    shard_range_start: str
    shard_range_end: str
    status: ShardStatus
    created_at: datetime
    updated_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    failure_reason: Optional[str]
    retry_count: int
    write_summary: Dict
    raw_input: Dict

class ResumeRequest(BaseModel):
    pipeline_id: int = Field(..., description="管道ID")
    force: Optional[bool] = Field(default=False, description="是否强制续跑，跳过校验")
    skip_shards: Optional[List[int]] = Field(default=None, description="指定续跑的分片索引")

class StatusUpdateRequest(BaseModel):
    status: PipelineStatus
    reason: Optional[str] = None

class ShardCompleteRequest(BaseModel):
    status: ShardStatus
    write_summary: Dict = Field(default={})
    failure_reason: Optional[str] = None

class ManualCorrectionRequest(BaseModel):
    shard_index: int
    new_status: ShardStatus
    reason: str
    write_summary: Optional[Dict] = None
