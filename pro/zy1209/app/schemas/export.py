from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from ..models.enums import ExportFormat, AnalysisType


class ExportRequest(BaseModel):
    task_id: int = Field(..., description="要导出的任务ID")
    format: ExportFormat = Field(ExportFormat.MARKDOWN, description="导出格式")
    analysis_types: Optional[List[AnalysisType]] = Field(None, description="指定要导出的分析类型，为空则导出全部")
    include_severities: Optional[List[str]] = Field(None, description="指定要导出的严重级别")
    include_raw_data: Optional[bool] = Field(False, description="是否包含原始数据")
    include_metrics: Optional[bool] = Field(True, description="是否包含指标数据")
    include_recommendations: Optional[bool] = Field(True, description="是否包含建议")
    template_name: Optional[str] = Field(None, description="模板名称")


class ExportResponse(BaseModel):
    export_id: int
    task_id: int
    file_name: str
    file_size: int
    format: ExportFormat
    download_url: Optional[str]
    created_at: datetime
