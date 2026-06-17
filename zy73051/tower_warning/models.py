from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class BlockReason(StrEnum):
    FORMULA = "formula"
    UNIT = "unit"
    THRESHOLD = "threshold"
    SAMPLING_GAP = "sampling_gap"


class ReportStatus(StrEnum):
    READY = "ready"
    SUSPENDED = "suspended"
    BLOCKED = "blocked"
    EXPORTED = "exported"


class EvidenceType(StrEnum):
    REPAIR_PHOTO = "repair_photo"
    OLD_SCREENSHOT = "old_screenshot"
    BACKFILL_REMARK = "backfill_remark"
    SENSOR_LOG = "sensor_log"


class SamplePoint(BaseModel):
    at: datetime
    value: float
    source: str = "sensor"
    missing: bool = False


class Evidence(BaseModel):
    evidence_id: str
    record_id: str
    evidence_type: EvidenceType
    version: str = Field(pattern=r"^v[0-9]+$")
    anomaly_link: str
    summary: str
    is_latest: bool = True
    is_backfill: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class IssuePacket(BaseModel):
    issue_type: BlockReason | Literal["masked_by_average"]
    suspicion: str
    source: str
    hold_reason: str
    required_materials: list[str]
    priority: Literal["high", "medium", "low"] = "medium"
    status: Literal["todo", "doing", "resolved"] = "todo"


class ExportDelta(BaseModel):
    record_id: str
    changed_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    before: dict[str, str]
    after: dict[str, str]
    changed_fields: list[str]
    explanation: str


class MaintenanceRecord(BaseModel):
    record_id: str
    crane_id: str
    work_date: datetime
    unit: str
    expected_unit: str
    threshold: float | None = None
    expected_sample_count: int = 60
    formula: Literal["average", "sum_over_count"] | None = "average"
    samples: list[SamplePoint] = Field(default_factory=list)
    evidence: list[Evidence] = Field(default_factory=list)
    issues: list[IssuePacket] = Field(default_factory=list)
    remarks: list[str] = Field(default_factory=list)
    status: ReportStatus = ReportStatus.BLOCKED
    block_reason: BlockReason | None = None
    average_value: float | None = None
    peak_value: float | None = None
    conclusion: str = "待录入数据"
    action_for_assistant: str = "补齐采样数据后再判断"

    @model_validator(mode="after")
    def ensure_record_ids(self) -> "MaintenanceRecord":
        for item in self.evidence:
            if item.record_id != self.record_id:
                raise ValueError("evidence.record_id must match maintenance record")
        return self


class RecordInput(BaseModel):
    record_id: str
    crane_id: str
    work_date: datetime
    unit: str
    expected_unit: str
    threshold: float | None = None
    expected_sample_count: int = 60
    formula: Literal["average", "sum_over_count"] | None = "average"
    samples: list[SamplePoint] = Field(default_factory=list)


class RemarkInput(BaseModel):
    text: str
    evidence_id: str | None = None
    anomaly_link: str = "补录备注影响报告结论"


class DashboardSummary(BaseModel):
    total: int
    ready: int
    suspended: int
    blocked: int
    missing_evidence: list[dict[str, str]]
