from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class TemperatureUnit(str, Enum):
    CELSIUS = "C"
    FAHRENHEIT = "F"


class SampleStatus(str, Enum):
    PENDING = "pending"
    RECEIVED = "received"
    REVIEWED = "reviewed"
    REJECTED = "rejected"


class ResponsibilitySegment(str, Enum):
    COLLECTION = "采集点"
    TRANSPORT = "运输"
    LAB_RECEIVE = "实验室接收"
    UNKNOWN = "未知"


class Sample(BaseModel):
    sample_id: str
    box_id: str
    sample_type: str
    collection_time: datetime
    expected_temperature_min: float = -20.0
    expected_temperature_max: float = 8.0


class Box(BaseModel):
    box_id: str
    box_type: str = "冷链箱"
    created_at: datetime = Field(default_factory=datetime.now)


class HandoverRecord(BaseModel):
    box_id: str
    from_person: str
    to_person: str
    handover_time: datetime
    location: str
    signed: bool = False
    notes: Optional[str] = None


class TemperatureRecord(BaseModel):
    box_id: str
    timestamp: datetime
    temperature: float
    unit: TemperatureUnit = TemperatureUnit.CELSIUS
    device_id: Optional[str] = None
    source_file: Optional[str] = None


class RuleViolation(BaseModel):
    rule_name: str
    severity: str
    description: str
    affected_items: List[str]
    suggestion: Optional[str] = None


class CorrectionHistory(BaseModel):
    correction_id: str
    operator: str
    corrected_at: datetime
    field: str
    before_value: Any
    after_value: Any
    reason: str


class ProjectState(BaseModel):
    project_name: str
    created_at: datetime
    samples: Dict[str, Sample] = {}
    boxes: Dict[str, Box] = {}
    handover_records: List[HandoverRecord] = []
    temperature_records: List[TemperatureRecord] = []
    sample_statuses: Dict[str, SampleStatus] = {}
    responsibility_segments: Dict[str, ResponsibilitySegment] = {}
    violations: List[RuleViolation] = []
    corrections: List[CorrectionHistory] = []
    version: int = 1
