from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

from .common import ConsistencyCheckResult
from .materials import SoundMaterialResponse


class ExportPreviewRequest(BaseModel):
    filter_params: Dict[str, Any] = Field(default_factory=dict, description="筛选参数")
    columns: List[str] = Field(default_factory=list, description="导出列")


class ExportPreviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    data: List[SoundMaterialResponse] = Field(description="导出数据预览")
    total_count: int = Field(description="总数")
    consistency_check: ConsistencyCheckResult = Field(description="一致性检查结果")
    filter_hash: str = Field(description="筛选参数哈希")


class ExportRequest(BaseModel):
    filter_params: Dict[str, Any] = Field(default_factory=dict, description="筛选参数")
    columns: List[str] = Field(default_factory=list, description="导出列")
    format: str = Field(default="xlsx", description="导出格式: xlsx/csv")
    exported_by: str = Field(default="system", description="导出人")
    filter_hash: str = Field(description="筛选参数哈希")
    screen_count: int = Field(description="屏幕显示数量")


class ExportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    export_no: str = Field(description="导出编号")
    filename: str = Field(description="文件名")
    download_url: str = Field(description="下载链接")
    total_count: int = Field(description="导出总数")
    consistency_check: ConsistencyCheckResult = Field(description="一致性检查结果")


class ExportRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    export_no: str
    filename: str
    file_path: str
    total_count: int
    filter_params: Optional[Dict[str, Any]] = None
    filter_hash: str
    exported_by: str
    trace_id: str
    created_at: datetime
