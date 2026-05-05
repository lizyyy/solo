from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime
from ..models.enums import TaskStatus, AnalysisType, SeverityLevel, ExportFormat


class TaskCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="任务名称")
    description: Optional[str] = Field(None, max_length=2000, description="任务描述")
    config: Optional[Dict[str, Any]] = Field(None, description="分析配置")


class TaskUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="任务名称")
    description: Optional[str] = Field(None, max_length=2000, description="任务描述")
    config: Optional[Dict[str, Any]] = Field(None, description="分析配置")


class InputSnapshotCreate(BaseModel):
    snapshot_type: str = Field(..., description="快照类型: db_profile, schema_sql, slow_sql_log, batch_write_sample")
    content: Optional[str] = Field(None, description="内容文本")
    metadata: Optional[Dict[str, Any]] = Field(None, description="元数据", alias="snapshot_metadata")

    class Config:
        populate_by_name = True


class InputSnapshotResponse(BaseModel):
    id: int
    task_id: int
    snapshot_type: str
    file_path: Optional[str]
    content_hash: Optional[str]
    metadata: Optional[Dict[str, Any]] = Field(..., validation_alias="snapshot_metadata")
    created_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True


class DiagnosisResultResponse(BaseModel):
    id: int
    task_id: int
    analysis_type: AnalysisType
    severity: SeverityLevel
    title: str
    description: Optional[str]
    findings: Optional[List[Dict[str, Any]]]
    recommendations: Optional[List[Dict[str, Any]]]
    metrics: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True


class ExportRecordResponse(BaseModel):
    id: int
    task_id: Optional[int]
    export_format: ExportFormat
    file_name: str
    file_size: int
    export_config: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True


class TaskResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    status: TaskStatus
    config: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    error_message: Optional[str]
    results: Optional[List[DiagnosisResultResponse]] = None
    export_records: Optional[List[ExportRecordResponse]] = None

    class Config:
        from_attributes = True


class TaskListResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    status: TaskStatus
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True
