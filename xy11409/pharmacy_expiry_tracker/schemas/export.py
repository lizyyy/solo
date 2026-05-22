from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date


class ExportRequest(BaseModel):
    region: Optional[str] = Field(None, description="区域筛选")
    town: Optional[str] = Field(None, description="乡镇筛选")
    pharmacy_code: Optional[str] = Field(None, description="药房编码筛选")
    status: Optional[str] = Field(None, description="状态筛选")
    start_date: Optional[date] = Field(None, description="开始日期")
    end_date: Optional[date] = Field(None, description="结束日期")
    export_format: str = Field(default="excel", description="导出格式: excel/csv")
    is_masked: bool = Field(default=True, description="是否脱敏")
    exported_by: str = Field(..., description="导出人")
    user_role: str = Field(..., description="导出人角色")


class ExportResponse(BaseModel):
    export_id: str
    file_name: str
    file_size: int
    record_count: int
    exported_by: str
    exported_at: datetime
    is_masked: bool
    download_url: Optional[str] = None


class ExportAuditLogResponse(BaseModel):
    id: int
    export_id: str
    exported_by: str
    user_role: Optional[str] = None
    exported_at: datetime
    record_count: int
    is_masked: bool
    file_name: str
    filters_applied: Optional[str] = None

    class Config:
        from_attributes = True
