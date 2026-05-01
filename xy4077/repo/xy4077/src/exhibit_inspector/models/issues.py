"""问题检测结果模型"""

from datetime import timedelta
from enum import Enum
from typing import Optional, Union

from pydantic import BaseModel, Field


class IssueType(str, Enum):
    """问题类型"""
    SHOCK_PEAK = "shock_peak"
    TEMPERATURE_OVER = "temperature_over"
    TEMPERATURE_UNDER = "temperature_under"
    HUMIDITY_OVER = "humidity_over"
    HUMIDITY_UNDER = "humidity_under"
    OPENBOX_MISMATCH = "openbox_mismatch"
    MISSING_PHOTO = "missing_photo"
    MISSING_EVIDENCE = "missing_evidence"
    MISSING_SAMPLE = "missing_sample"


class IssueSeverity(str, Enum):
    """问题严重程度"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Issue(BaseModel):
    """问题基类"""
    issue_id: str = Field(..., description="问题唯一标识")
    issue_type: IssueType = Field(..., description="问题类型")
    severity: IssueSeverity = Field(..., description="严重程度")
    box_id: Optional[str] = Field(None, description="关联的展箱编号")
    sensor_id: Optional[str] = Field(None, description="关联的传感器编号")
    route_node_id: Optional[str] = Field(None, description="关联的路书节点编号")
    start_time: Optional[str] = Field(None, description="问题开始时间")
    end_time: Optional[str] = Field(None, description="问题结束时间")
    description: str = Field(..., description="问题描述")
    detected_at: str = Field(..., description="检测时间，ISO 格式")
    source_data: Optional[dict] = Field(None, description="原始数据引用")
    notes: Optional[str] = Field(None, description="备注")


class ShockPeakIssue(Issue):
    """冲击峰值问题"""
    issue_type: IssueType = IssueType.SHOCK_PEAK
    peak_value_g: float = Field(..., description="冲击峰值，单位 g")
    threshold_g: float = Field(..., description="阈值，单位 g")
    duration_seconds: Optional[float] = Field(None, description="持续时间，秒")
    sample_count: Optional[int] = Field(None, description="涉及采样点数量")


class TemperatureIssue(Issue):
    """温度问题"""
    max_value_celsius: Optional[float] = Field(None, description="最高温度")
    min_value_celsius: Optional[float] = Field(None, description="最低温度")
    threshold_max_celsius: Optional[float] = Field(None, description="最高温度阈值")
    threshold_min_celsius: Optional[float] = Field(None, description="最低温度阈值")
    duration_minutes: float = Field(..., description="持续时间，分钟")
    sample_count: int = Field(..., description="涉及采样点数量")


class HumidityIssue(Issue):
    """湿度问题"""
    max_value_pct: Optional[float] = Field(None, description="最高湿度")
    min_value_pct: Optional[float] = Field(None, description="最低湿度")
    threshold_max_pct: Optional[float] = Field(None, description="最高湿度阈值")
    threshold_min_pct: Optional[float] = Field(None, description="最低湿度阈值")
    duration_minutes: float = Field(..., description="持续时间，分钟")
    sample_count: int = Field(..., description="涉及采样点数量")


class OpenBoxMismatchIssue(Issue):
    """开箱时段不一致问题"""
    issue_type: IssueType = IssueType.OPENBOX_MISMATCH
    expected_phase: str = Field(..., description="预期阶段")
    actual_phase: str = Field(..., description="实际阶段")
    expected_time_window: Optional[dict] = Field(None, description="预期时间窗口")
    actual_time: str = Field(..., description="实际时间")


class MissingPhotoIssue(Issue):
    """照片缺失问题"""
    issue_type: IssueType = IssueType.MISSING_PHOTO
    required_photo_types: list[str] = Field(..., description="需要的照片类型列表")
    available_photo_types: list[str] = Field(default_factory=list, description="已有的照片类型列表")
    missing_types: list[str] = Field(..., description="缺失的照片类型列表")


class MissingEvidenceIssue(Issue):
    """交接证据缺失问题"""
    issue_type: IssueType = IssueType.MISSING_EVIDENCE
    required_evidence: list[str] = Field(..., description="需要的证据类型列表")
    available_evidence: list[str] = Field(default_factory=list, description="已有的证据类型列表")
    missing_evidence: list[str] = Field(..., description="缺失的证据类型列表")


class MissingSampleIssue(Issue):
    """缺采样问题"""
    issue_type: IssueType = IssueType.MISSING_SAMPLE
    gap_start_time: str = Field(..., description="缺口开始时间")
    gap_end_time: str = Field(..., description="缺口结束时间")
    gap_duration_minutes: float = Field(..., description="缺口持续时间，分钟")
    expected_sample_count: int = Field(..., description="预期采样数")
    actual_sample_count: int = Field(..., description="实际采样数")
    missing_count: int = Field(..., description="缺失采样数")
