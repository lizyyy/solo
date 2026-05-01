"""违规模型"""

from datetime import datetime
from enum import Enum
from typing import List, Optional, Any, Dict
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


class ViolationSeverity(str, Enum):
    """违规严重程度"""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class ViolationType(str, Enum):
    """违规类型"""

    CHANNEL_CONFLICT = "channel_conflict"
    CALL_SIGN_INVALID = "call_sign_invalid"
    POWER_EXCEEDED = "power_exceeded"
    REPEATER_SWITCH_MISSING = "repeater_switch_missing"
    FREQUENCY_OUT_OF_BAND = "frequency_out_of_band"
    TIME_OVERLAP = "time_overlap"
    DEVICE_NOT_FOUND = "device_not_found"
    CHANNEL_NOT_FOUND = "channel_not_found"
    INVALID_TIME_FORMAT = "invalid_time_format"
    INVALID_DATE_FORMAT = "invalid_date_format"
    DUPLICATE_ENTRY = "duplicate_entry"
    MISSING_REQUIRED_FIELD = "missing_required_field"
    OPERATOR_CONFLICT = "operator_conflict"


class ViolationEvidence(BaseModel):
    """违规证据"""

    field_name: Optional[str] = Field(default=None, description="字段名称")
    expected_value: Optional[Any] = Field(default=None, description="期望值")
    actual_value: Optional[Any] = Field(default=None, description="实际值")
    context: Optional[str] = Field(default=None, description="上下文描述")
    related_entries: List[Dict[str, Any]] = Field(default_factory=list, description="相关条目")

    class Config:
        validate_assignment = True


class Violation(BaseModel):
    """违规记录模型"""

    violation_id: str = Field(default_factory=lambda: str(uuid4()), description="违规唯一标识")
    violation_type: ViolationType = Field(description="违规类型")
    severity: ViolationSeverity = Field(default=ViolationSeverity.MEDIUM, description="严重程度")
    category: Optional[str] = Field(default=None, description="分类")
    message: str = Field(description="违规描述")
    evidence: Optional[ViolationEvidence] = Field(default=None, description="违规证据")

    source_file: Optional[str] = Field(default=None, description="来源文件名")
    line_number: Optional[int] = Field(default=None, description="源文件行号")
    entry_id: Optional[str] = Field(default=None, description="关联的条目ID")

    call_sign: Optional[str] = Field(default=None, description="关联的呼号")
    channel_id: Optional[str] = Field(default=None, description="关联的频道ID")
    date: Optional[str] = Field(default=None, description="关联日期")
    time_start: Optional[str] = Field(default=None, description="开始时间")
    time_end: Optional[str] = Field(default=None, description="结束时间")

    detected_at: datetime = Field(default_factory=datetime.now, description="检测时间")
    status: str = Field(default="open", description="状态: open, reviewed, dismissed, resolved")
    reviewed_by: Optional[str] = Field(default=None, description="复核人")
    reviewed_at: Optional[datetime] = Field(default=None, description="复核时间")
    review_notes: Optional[str] = Field(default=None, description="复核备注")
    review_decision: Optional[str] = Field(default=None, description="复核决定: confirm, dismiss, needs_more_info")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        """验证状态"""
        valid_statuses = ["open", "reviewed", "dismissed", "resolved"]
        if v.lower() not in valid_statuses:
            raise ValueError(f"无效的状态: {v}, 有效状态: {valid_statuses}")
        return v.lower()

    @field_validator("review_decision")
    @classmethod
    def validate_review_decision(cls, v: Optional[str]) -> Optional[str]:
        """验证复核决定"""
        if v is None:
            return None
        valid_decisions = ["confirm", "dismiss", "needs_more_info"]
        if v.lower() not in valid_decisions:
            raise ValueError(f"无效的复核决定: {v}, 有效决定: {valid_decisions}")
        return v.lower()

    class Config:
        validate_assignment = True
        use_enum_values = True


class ViolationSummary(BaseModel):
    """违规摘要"""

    total_count: int = Field(default=0, description="总违规数")
    critical_count: int = Field(default=0, description="严重违规数")
    high_count: int = Field(default=0, description="高优先级违规数")
    medium_count: int = Field(default=0, description="中优先级违规数")
    low_count: int = Field(default=0, description="低优先级违规数")
    open_count: int = Field(default=0, description="待处理数")
    reviewed_count: int = Field(default=0, description="已复核数")
    dismissed_count: int = Field(default=0, description="已忽略数")
    resolved_count: int = Field(default=0, description="已解决数")

    by_type: Dict[str, int] = Field(default_factory=dict, description="按类型统计")
    by_call_sign: Dict[str, int] = Field(default_factory=dict, description="按呼号统计")
    by_channel: Dict[str, int] = Field(default_factory=dict, description="按频道统计")
    by_date: Dict[str, int] = Field(default_factory=dict, description="按日期统计")

    class Config:
        validate_assignment = True
