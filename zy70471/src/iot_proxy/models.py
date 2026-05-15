from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, validator


class RecordStatus(str, Enum):
    NORMAL = "normal"
    ABNORMAL = "abnormal"
    FAILED = "failed"


class ReceiptType(str, Enum):
    TEMPERATURE = "temperature"
    HUMIDITY = "humidity"
    DOOR = "door"
    POWER = "power"


class IoTReceipt(BaseModel):
    device_id: str = Field(..., description="设备ID")
    receipt_id: str = Field(..., description="回执ID")
    receipt_type: ReceiptType = Field(..., description="回执类型")
    timestamp: str = Field(..., description="原始时间戳")
    parsed_time: Optional[datetime] = Field(None, description="解析后的时间")
    timezone_offset: Optional[int] = Field(None, description="时区偏移（分钟）")
    data: Dict[str, Any] = Field(default_factory=dict, description="回执数据")
    status: RecordStatus = Field(RecordStatus.NORMAL, description="记录状态")
    error_message: Optional[str] = Field(None, description="错误信息")


class ProcessResult(BaseModel):
    batch_id: str = Field(..., description="批次ID")
    total_count: int = Field(0, description="总记录数")
    normal_count: int = Field(0, description="正常记录数")
    abnormal_count: int = Field(0, description="异常记录数")
    failed_count: int = Field(0, description="失败记录数")
    processed_at: datetime = Field(default_factory=datetime.now)
    receipts: list[IoTReceipt] = Field(default_factory=list)
    is_cached: bool = Field(False, description="是否使用缓存结果")


class ChangeLog(BaseModel):
    change_id: str = Field(..., description="变更ID")
    resource_scope: str = Field(..., description="资源范围")
    change_reason: str = Field(..., description="变更理由")
    changed_at: datetime = Field(default_factory=datetime.now)
    changed_by: str = Field("system", description="变更人")
    extra: Dict[str, Any] = Field(default_factory=dict)
