"""审计包模型"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from .config import TransportConfig
from .issues import Issue
from .review import ReviewRecord
from .route import RouteBook
from .box import BoxInfo
from .photo import PhotoRecord


class SessionMetadata(BaseModel):
    """会话元数据"""
    session_id: str = Field(..., description="会话唯一标识")
    shipment_id: str = Field(..., description="运输批次编号")
    created_at: str = Field(..., description="创建时间，ISO 格式")
    updated_at: str = Field(..., description="更新时间，ISO 格式")
    processed_at: Optional[str] = Field(None, description="最后处理时间，ISO 格式")
    reviewed_at: Optional[str] = Field(None, description="最后复核时间，ISO 格式")
    exported_at: Optional[str] = Field(None, description="最后导出时间，ISO 格式")
    tool_version: str = Field(..., description="工具版本")
    operator: Optional[str] = Field(None, description="操作人员")
    notes: Optional[str] = Field(None, description="备注")


class AuditPackage(BaseModel):
    """审计包"""
    metadata: SessionMetadata = Field(..., description="会话元数据")
    config: Optional[TransportConfig] = Field(None, description="运输配置")
    route_book: Optional[RouteBook] = Field(None, description="路书")
    boxes: list[BoxInfo] = Field(default_factory=list, description="展箱列表")
    photos: list[PhotoRecord] = Field(default_factory=list, description="照片记录列表")
    sensor_record_count: int = Field(0, description="传感器记录总数")
    sensor_stats: Optional[dict] = Field(None, description="传感器统计信息")
    issues: list[Issue] = Field(default_factory=list, description="检测到的问题列表")
    reviews: list[ReviewRecord] = Field(default_factory=list, description="复核记录列表")
    import_files: dict[str, str] = Field(default_factory=dict, description="导入的文件映射")
    import_summary: Optional[dict] = Field(None, description="导入摘要")
    analysis_summary: Optional[dict] = Field(None, description="分析摘要")
