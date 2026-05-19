from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class FaultType(str, Enum):
    DOOR_FAILURE = "door_failure"
    SCAN_FAILURE = "scan_failure"
    EMPTY_BAY_FALSE_ALARM = "empty_bay_false_alarm"
    BATTERY_ISSUE = "battery_issue"
    NETWORK_ISSUE = "network_issue"
    OTHER = "other"


class FaultStatus(str, Enum):
    PENDING_CLASSIFICATION = "pending_classification"
    PENDING_REVIEW = "pending_review"
    CONFIRMED = "confirmed"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class FaultSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class FaultClassification(BaseModel):
    fault_id: str = Field(..., description="故障ID")
    source_type: str = Field(..., description="来源类型: device_event或customer_service")
    source_id: str = Field(..., description="来源ID")
    station_id: str = Field(..., description="换电站ID")
    fault_type: FaultType = Field(default=FaultType.OTHER, description="故障类型")
    fault_description: str = Field(..., description="故障描述")
    status: FaultStatus = Field(default=FaultStatus.PENDING_CLASSIFICATION, description="故障状态")
    severity: FaultSeverity = Field(default=FaultSeverity.MEDIUM, description="严重程度")
    assignee: Optional[str] = Field(None, description="负责人")
    bay_number: Optional[int] = Field(None, description="仓号")
    event_time: datetime = Field(..., description="故障发生时间")
    confidence: float = Field(default=0.0, description="分类置信度")
    notes: Optional[str] = Field(None, description="备注")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    class Config:
        use_enum_values = True
