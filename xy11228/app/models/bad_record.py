from datetime import datetime
from enum import Enum
from typing import Optional, Any
from pydantic import BaseModel, Field


class ImportSource(str, Enum):
    DEVICE_EVENT_JSON = "device_event_json"
    CUSTOMER_SERVICE_CSV = "customer_service_csv"


class BadRecord(BaseModel):
    bad_record_id: str = Field(..., description="坏记录ID")
    source: ImportSource = Field(..., description="数据来源")
    file_name: str = Field(..., description="文件名")
    row_number: Optional[int] = Field(None, description="行号(CSV)")
    raw_data: str = Field(..., description="原始数据")
    error_message: str = Field(..., description="失败原因")
    suggestion: Optional[str] = Field(None, description="修改建议")
    status: str = Field(default="pending", description="处理状态: pending, fixed, ignored")
    created_at: datetime = Field(default_factory=datetime.now)

    class Config:
        use_enum_values = True
