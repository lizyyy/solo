from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator


class MonitoringSnapshotBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="快照名称")
    snapshot_type: str = Field(default="during_test", max_length=50, description="快照类型")
    snapshot_time: datetime = Field(..., description="快照时间")
    cpu_utilization_percent: Optional[float] = Field(None, ge=0, le=100, description="CPU利用率(%)")
    memory_utilization_percent: Optional[float] = Field(None, ge=0, le=100, description="内存利用率(%)")
    disk_utilization_percent: Optional[float] = Field(None, ge=0, le=100, description="磁盘利用率(%)")
    network_utilization_percent: Optional[float] = Field(None, ge=0, le=100, description="网络利用率(%)")
    gc_count: Optional[int] = Field(None, ge=0, description="GC次数")
    gc_time_ms: Optional[int] = Field(None, ge=0, description="GC耗时(ms)")
    database_connections: Optional[int] = Field(None, ge=0, description="数据库连接数")
    database_query_latency_ms: Optional[float] = Field(None, ge=0, description="数据库查询延迟(ms)")
    cache_hit_rate: Optional[float] = Field(None, ge=0, le=100, description="缓存命中率(%)")
    thread_count: Optional[int] = Field(None, ge=0, description="线程数")
    deadlock_count: Optional[int] = Field(None, ge=0, description="死锁数")
    custom_metrics: Optional[Dict[str, Any]] = Field(None, description="自定义指标")
    notes: Optional[str] = Field(None, description="备注")


class MonitoringSnapshotCreate(MonitoringSnapshotBase):
    project_id: int = Field(..., ge=1, description="项目ID")
    load_test_batch_id: Optional[int] = Field(None, ge=1, description="关联的压测批次ID")
    
    @validator('cpu_utilization_percent', 'memory_utilization_percent', 
               'disk_utilization_percent', 'network_utilization_percent',
               'cache_hit_rate')
    def percentage_valid(cls, v):
        if v is not None:
            if v < 0 or v > 100:
                raise ValueError('百分比值必须在0-100之间')
        return v


class MonitoringSnapshotUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    snapshot_type: Optional[str] = Field(None, max_length=50)
    snapshot_time: Optional[datetime] = None
    cpu_utilization_percent: Optional[float] = Field(None, ge=0, le=100)
    memory_utilization_percent: Optional[float] = Field(None, ge=0, le=100)
    disk_utilization_percent: Optional[float] = Field(None, ge=0, le=100)
    network_utilization_percent: Optional[float] = Field(None, ge=0, le=100)
    gc_count: Optional[int] = Field(None, ge=0)
    gc_time_ms: Optional[int] = Field(None, ge=0)
    database_connections: Optional[int] = Field(None, ge=0)
    database_query_latency_ms: Optional[float] = Field(None, ge=0)
    cache_hit_rate: Optional[float] = Field(None, ge=0, le=100)
    thread_count: Optional[int] = Field(None, ge=0)
    deadlock_count: Optional[int] = Field(None, ge=0)
    custom_metrics: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None


class MonitoringSnapshotInDBBase(MonitoringSnapshotBase):
    id: int
    project_id: int
    load_test_batch_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MonitoringSnapshot(MonitoringSnapshotInDBBase):
    pass


class MonitoringSnapshotList(BaseModel):
    total: int
    items: List[MonitoringSnapshot]
    page: int
    page_size: int


class MonitoringSnapshotImportRequest(BaseModel):
    project_id: int
    load_test_batch_id: Optional[int] = None
    snapshots: List[MonitoringSnapshotCreate]
