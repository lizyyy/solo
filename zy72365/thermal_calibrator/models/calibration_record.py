from __future__ import annotations

import enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional


class TemperatureUnit(enum.Enum):
    CELSIUS = "celsius"
    KELVIN = "kelvin"


class RecordStatus(enum.Enum):
    IMPORTED = "imported"
    REVIEWED_BY_ENGINEER = "reviewed_by_engineer"
    PENDING_COACH_REVIEW = "pending_coach_review"
    COACH_CONFIRMED = "coach_confirmed"
    ROLLED_BACK = "rolled_back"


class UnitConflictAction(enum.Enum):
    KEEP_ORIGINAL = "keep_original"
    AUTO_CONVERT_KELVIN_TO_CELSIUS = "auto_convert_kelvin_to_celsius"
    AUTO_CONVERT_CELSIUS_TO_KELVIN = "auto_convert_celsius_to_kelvin"
    PENDING_COACH_REVIEW = "pending_coach_review"
    COACH_RESOLVED = "coach_resolved"
    ROLLED_BACK = "rolled_back"


@dataclass
class ManualChange:
    changed_at: str
    changed_by: str
    field_name: str
    old_value: Any
    new_value: Any
    reason: str


@dataclass
class SamplingInterval:
    original_line_number: int
    interval_seconds: float
    unit: TemperatureUnit
    raw_text: str
    manual_changes: list[ManualChange] = field(default_factory=list)


@dataclass
class TemperatureReading:
    original_line_number: int
    value: float
    unit: TemperatureUnit
    raw_text: str
    manual_changes: list[ManualChange] = field(default_factory=list)


@dataclass
class UnitConflictRecord:
    line_number: int
    detected_units: list[TemperatureUnit]
    action_taken: UnitConflictAction
    original_raw: str
    resolved_value: Optional[float]
    resolved_unit: Optional[TemperatureUnit]
    needs_coach_review: bool
    coach_review_note: Optional[str] = None


@dataclass
class CalibrationRecord:
    record_id: str
    device_name: str
    imported_at: str
    status: RecordStatus
    sampling_intervals: list[SamplingInterval]
    temperature_readings: list[TemperatureReading]
    unit_conflicts: list[UnitConflictRecord]
    manual_changes: list[ManualChange] = field(default_factory=list)
    engineer_review_at: Optional[str] = None
    engineer_review_by: Optional[str] = None
    coach_review_at: Optional[str] = None
    coach_review_by: Optional[str] = None
    handover_report_updated: bool = False

    def has_unit_conflicts(self) -> bool:
        return len(self.unit_conflicts) > 0

    def has_pending_coach_review(self) -> bool:
        return any(uc.needs_coach_review for uc in self.unit_conflicts)

    def to_dict(self) -> dict:
        return {
            "record_id": self.record_id,
            "device_name": self.device_name,
            "imported_at": self.imported_at,
            "status": self.status.value,
            "sampling_intervals": [
                {
                    "original_line_number": si.original_line_number,
                    "interval_seconds": si.interval_seconds,
                    "unit": si.unit.value,
                    "raw_text": si.raw_text,
                    "manual_changes": [
                        {
                            "changed_at": mc.changed_at,
                            "changed_by": mc.changed_by,
                            "field_name": mc.field_name,
                            "old_value": mc.old_value,
                            "new_value": mc.new_value,
                            "reason": mc.reason,
                        }
                        for mc in si.manual_changes
                    ],
                }
                for si in self.sampling_intervals
            ],
            "temperature_readings": [
                {
                    "original_line_number": tr.original_line_number,
                    "value": tr.value,
                    "unit": tr.unit.value,
                    "raw_text": tr.raw_text,
                    "manual_changes": [
                        {
                            "changed_at": mc.changed_at,
                            "changed_by": mc.changed_by,
                            "field_name": mc.field_name,
                            "old_value": mc.old_value,
                            "new_value": mc.new_value,
                            "reason": mc.reason,
                        }
                        for mc in tr.manual_changes
                    ],
                }
                for tr in self.temperature_readings
            ],
            "unit_conflicts": [
                {
                    "line_number": uc.line_number,
                    "detected_units": [u.value for u in uc.detected_units],
                    "action_taken": uc.action_taken.value,
                    "original_raw": uc.original_raw,
                    "resolved_value": uc.resolved_value,
                    "resolved_unit": uc.resolved_unit.value if uc.resolved_unit else None,
                    "needs_coach_review": uc.needs_coach_review,
                    "coach_review_note": uc.coach_review_note,
                }
                for uc in self.unit_conflicts
            ],
            "manual_changes": [
                {
                    "changed_at": mc.changed_at,
                    "changed_by": mc.changed_by,
                    "field_name": mc.field_name,
                    "old_value": mc.old_value,
                    "new_value": mc.new_value,
                    "reason": mc.reason,
                }
                for mc in self.manual_changes
            ],
            "engineer_review_at": self.engineer_review_at,
            "engineer_review_by": self.engineer_review_by,
            "coach_review_at": self.coach_review_at,
            "coach_review_by": self.coach_review_by,
            "handover_report_updated": self.handover_report_updated,
        }
