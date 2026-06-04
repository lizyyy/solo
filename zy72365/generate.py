#!/usr/bin/env python3
"""Generator script: writes all thermal_calibrator module files."""

import os

BASE = os.path.dirname(os.path.abspath(__file__))

FILES = {}

FILES["thermal_calibrator/models/calibration_record.py"] = """from __future__ import annotations

import enum
from dataclasses import dataclass, field
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
    CONVERT_TO_CELSIUS = "convert_to_celsius"
    CONVERT_TO_KELVIN = "convert_to_kelvin"
    NEEDS_COACH_REVIEW = "needs_coach_review"


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
"""

FILES["thermal_calibrator/rules/boundary_rules.py"] = """from __future__ import annotations

import re
from typing import Optional

from thermal_calibrator.models.calibration_record import (
    TemperatureUnit,
    UnitConflictAction,
    UnitConflictRecord,
)


_ABSOLUTE_ZERO_C = -273.15
_THERMAL_IMAGER_MIN_C = -40.0
_THERMAL_IMAGER_MAX_C = 2000.0

_CELSIUS_PATTERNS = [
    re.compile(r"\\u00b0C", re.IGNORECASE),
    re.compile(r"deg\\s*C", re.IGNORECASE),
    re.compile(r"celsius", re.IGNORECASE),
    re.compile(r"centigrade", re.IGNORECASE),
]

_KELVIN_PATTERNS = [
    re.compile(r"\\bK\\b"),
    re.compile(r"kelvin", re.IGNORECASE),
]


def detect_unit(text: str) -> list[TemperatureUnit]:
    found: list[TemperatureUnit] = []
    for pat in _CELSIUS_PATTERNS:
        if pat.search(text):
            found.append(TemperatureUnit.CELSIUS)
            break
    for pat in _KELVIN_PATTERNS:
        if pat.search(text):
            found.append(TemperatureUnit.KELVIN)
            break
    if not found:
        found.append(TemperatureUnit.CELSIUS)
    return found


def is_unit_conflict(units: list[TemperatureUnit]) -> bool:
    return TemperatureUnit.CELSIUS in units and TemperatureUnit.KELVIN in units


def is_value_plausible_for_unit(value: float, unit: TemperatureUnit) -> bool:
    if unit == TemperatureUnit.CELSIUS:
        return _THERMAL_IMAGER_MIN_C <= value <= _THERMAL_IMAGER_MAX_C
    value_c = value - 273.15
    return _THERMAL_IMAGER_MIN_C <= value_c <= _THERMAL_IMAGER_MAX_C


def celsius_to_kelvin(c: float) -> float:
    return c + 273.15


def kelvin_to_celsius(k: float) -> float:
    return k - 273.15


def judge_conflict(
    line_number: int,
    raw_text: str,
    detected_units: list[TemperatureUnit],
    value: Optional[float] = None,
) -> UnitConflictRecord:
    if not is_unit_conflict(detected_units):
        primary = detected_units[0] if detected_units else TemperatureUnit.CELSIUS
        return UnitConflictRecord(
            line_number=line_number,
            detected_units=detected_units,
            action_taken=UnitConflictAction.KEEP_ORIGINAL,
            original_raw=raw_text,
            resolved_value=value,
            resolved_unit=primary,
            needs_coach_review=False,
        )

    if value is not None:
        plausible_c = is_value_plausible_for_unit(value, TemperatureUnit.CELSIUS)
        plausible_k = is_value_plausible_for_unit(value, TemperatureUnit.KELVIN)

        if plausible_c and not plausible_k:
            return UnitConflictRecord(
                line_number=line_number,
                detected_units=detected_units,
                action_taken=UnitConflictAction.CONVERT_TO_CELSIUS,
                original_raw=raw_text,
                resolved_value=value,
                resolved_unit=TemperatureUnit.CELSIUS,
                needs_coach_review=False,
            )

        if plausible_k and not plausible_c:
            converted = kelvin_to_celsius(value)
            return UnitConflictRecord(
                line_number=line_number,
                detected_units=detected_units,
                action_taken=UnitConflictAction.CONVERT_TO_CELSIUS,
                original_raw=raw_text,
                resolved_value=converted,
                resolved_unit=TemperatureUnit.CELSIUS,
                needs_coach_review=False,
            )

    return UnitConflictRecord(
        line_number=line_number,
        detected_units=detected_units,
        action_taken=UnitConflictAction.NEEDS_COACH_REVIEW,
        original_raw=raw_text,
        resolved_value=value,
        resolved_unit=None,
        needs_coach_review=True,
    )


def rollback_conflict(conflict: UnitConflictRecord) -> UnitConflictRecord:
    return UnitConflictRecord(
        line_number=conflict.line_number,
        detected_units=conflict.detected_units,
        action_taken=UnitConflictAction.KEEP_ORIGINAL,
        original_raw=conflict.original_raw,
        resolved_value=None,
        resolved_unit=None,
        needs_coach_review=True,
        coach_review_note=(conflict.coach_review_note or "") + " [\\u5df2\\u56de\\u6eda\\uff0c\\u7b49\\u5f85\\u6559\\u7ec3\\u590d\\u6838]",
    )


def coach_resolve_conflict(
    conflict: UnitConflictRecord,
    resolved_value: float,
    resolved_unit: TemperatureUnit,
    coach_note: str,
) -> UnitConflictRecord:
    return UnitConflictRecord(
        line_number=conflict.line_number,
        detected_units=conflict.detected_units,
        action_taken=(
            UnitConflictAction.CONVERT_TO_CELSIUS
            if resolved_unit == TemperatureUnit.CELSIUS
            else UnitConflictAction.CONVERT_TO_KELVIN
        ),
        original_raw=conflict.original_raw,
        resolved_value=resolved_value,
        resolved_unit=resolved_unit,
        needs_coach_review=False,
        coach_review_note=coach_note,
    )
"""

FILES["thermal_calibrator/store/result_store.py"] = """from __future__ import annotations

import json
import os
from typing import Optional

from thermal_calibrator.models.calibration_record import CalibrationRecord


class ResultStore:
    def __init__(self, store_dir: str):
        self._store_dir = store_dir
        os.makedirs(store_dir, exist_ok=True)

    def _path(self, record_id: str) -> str:
        return os.path.join(self._store_dir, f"{record_id}.json")

    def save(self, record: CalibrationRecord) -> None:
        data = record.to_dict()
        with open(self._path(record.record_id), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load(self, record_id: str) -> Optional[CalibrationRecord]:
        path = self._path(record_id)
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return self._from_dict(data)

    def list_records(self) -> list[str]:
        if not os.path.exists(self._store_dir):
            return []
        return [
            f.replace(".json", "")
            for f in os.listdir(self._store_dir)
            if f.endswith(".json")
        ]

    def get_full_result(self, record_id: str) -> Optional[dict]:
        record = self.load(record_id)
        if record is None:
            return None
        return record.to_dict()

    def get_summary(self, record_id: str) -> Optional[dict]:
        record = self.load(record_id)
        if record is None:
            return None
        return {
            "record_id": record.record_id,
            "device_name": record.device_name,
            "status": record.status.value,
            "has_unit_conflicts": record.has_unit_conflicts(),
            "pending_coach_review_count": sum(
                1 for uc in record.unit_conflicts if uc.needs_coach_review
            ),
            "total_readings": len(record.temperature_readings),
            "total_intervals": len(record.sampling_intervals),
            "handover_report_updated": record.handover_report_updated,
        }

    def export_detail(self, record_id: str) -> Optional[str]:
        result = self.get_full_result(record_id)
        if result is None:
            return None
        return json.dumps(result, ensure_ascii=False, indent=2)

    def _from_dict(self, data: dict) -> CalibrationRecord:
        from thermal_calibrator.models.calibration_record import (
            ManualChange,
            RecordStatus,
            SamplingInterval,
            TemperatureReading,
            TemperatureUnit,
            UnitConflictAction,
            UnitConflictRecord,
        )

        intervals = []
        for si in data.get("sampling_intervals", []):
            mcs = [
                ManualChange(
                    changed_at=mc["changed_at"],
                    changed_by=mc["changed_by"],
                    field_name=mc["field_name"],
                    old_value=mc["old_value"],
                    new_value=mc["new_value"],
                    reason=mc["reason"],
                )
                for mc in si.get("manual_changes", [])
            ]
            intervals.append(
                SamplingInterval(
                    original_line_number=si["original_line_number"],
                    interval_seconds=si["interval_seconds"],
                    unit=TemperatureUnit(si["unit"]),
                    raw_text=si["raw_text"],
                    manual_changes=mcs,
                )
            )

        readings = []
        for tr in data.get("temperature_readings", []):
            mcs = [
                ManualChange(
                    changed_at=mc["changed_at"],
                    changed_by=mc["changed_by"],
                    field_name=mc["field_name"],
                    old_value=mc["old_value"],
                    new_value=mc["new_value"],
                    reason=mc["reason"],
                )
                for mc in tr.get("manual_changes", [])
            ]
            readings.append(
                TemperatureReading(
                    original_line_number=tr["original_line_number"],
                    value=tr["value"],
                    unit=TemperatureUnit(tr["unit"]),
                    raw_text=tr["raw_text"],
                    manual_changes=mcs,
                )
            )

        conflicts = []
        for uc in data.get("unit_conflicts", []):
            conflicts.append(
                UnitConflictRecord(
                    line_number=uc["line_number"],
                    detected_units=[TemperatureUnit(u) for u in uc["detected_units"]],
                    action_taken=UnitConflictAction(uc["action_taken"]),
                    original_raw=uc["original_raw"],
                    resolved_value=uc["resolved_value"],
                    resolved_unit=(
                        TemperatureUnit(uc["resolved_unit"])
                        if uc["resolved_unit"]
                        else None
                    ),
                    needs_coach_review=uc["needs_coach_review"],
                    coach_review_note=uc.get("coach_review_note"),
                )
            )

        changes = [
            ManualChange(
                changed_at=mc["changed_at"],
                changed_by=mc["changed_by"],
                field_name=mc["field_name"],
                old_value=mc["old_value"],
                new_value=mc["new_value"],
                reason=mc["reason"],
            )
            for mc in data.get("manual_changes", [])
        ]

        return CalibrationRecord(
            record_id=data["record_id"],
            device_name=data["device_name"],
            imported_at=data["imported_at"],
            status=RecordStatus(data["status"]),
            sampling_intervals=intervals,
            temperature_readings=readings,
            unit_conflicts=conflicts,
            manual_changes=changes,
            engineer_review_at=data.get("engineer_review_at"),
            engineer_review_by=data.get("engineer_review_by"),
            coach_review_at=data.get("coach_review_at"),
            coach_review_by=data.get("coach_review_by"),
            handover_report_updated=data.get("handover_report_updated", False),
        )
"""

FILES["thermal_calibrator/workflow/engine.py"] = """from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from thermal_calibrator.models.calibration_record import (
    CalibrationRecord,
    ManualChange,
    RecordStatus,
    SamplingInterval,
    TemperatureReading,
    TemperatureUnit,
    UnitConflictRecord,
)
from thermal_calibrator.rules.boundary_rules import detect_unit, judge_conflict
from thermal_calibrator.store.result_store import ResultStore


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class CalibrationWorkflow:
    STEP_IMPORT = "import"
    STEP_ENGINEER_REVIEW = "engineer_review"
    STEP_HANDOVER_UPDATE = "handover_update"

    def __init__(self, store: ResultStore):
        self._store = store

    def step_import(
        self,
        record_id: str,
        device_name: str,
        raw_lines: list[str],
    ) -> CalibrationRecord:
        intervals: list[SamplingInterval] = []
        readings: list[TemperatureReading] = []
        conflicts: list[UnitConflictRecord] = []

        for i, line in enumerate(raw_lines, start=1):
            stripped = line.strip()
            if not stripped:
                continue

            detected = detect_unit(stripped)

            if _is_interval_line(stripped):
                interval_sec = _parse_interval(stripped)
                si = SamplingInterval(
                    original_line_number=i,
                    interval_seconds=interval_sec,
                    unit=detected[0],
                    raw_text=stripped,
                )
                intervals.append(si)
                conflict = judge_conflict(i, stripped, detected)
                if conflict.needs_coach_review or conflict.action_taken.value != "keep_original":
                    conflicts.append(conflict)
            else:
                val = _parse_temperature_value(stripped)
                tr = TemperatureReading(
                    original_line_number=i,
                    value=val if val is not None else 0.0,
                    unit=detected[0],
                    raw_text=stripped,
                )
                readings.append(tr)
                conflict = judge_conflict(i, stripped, detected, val)
                if conflict.needs_coach_review or conflict.action_taken.value != "keep_original":
                    conflicts.append(conflict)

        record = CalibrationRecord(
            record_id=record_id,
            device_name=device_name,
            imported_at=_now_iso(),
            status=RecordStatus.IMPORTED,
            sampling_intervals=intervals,
            temperature_readings=readings,
            unit_conflicts=conflicts,
        )

        if record.has_pending_coach_review():
            record.status = RecordStatus.PENDING_COACH_REVIEW

        self._store.save(record)
        return record

    def step_engineer_review(
        self,
        record_id: str,
        engineer_name: str,
        notes: Optional[str] = None,
    ) -> CalibrationRecord:
        record = self._store.load(record_id)
        if record is None:
            raise ValueError(f"\\u627e\\u4e0d\\u5230\\u8bb0\\u5f55: {record_id}")

        if record.status not in (
            RecordStatus.IMPORTED,
            RecordStatus.PENDING_COACH_REVIEW,
        ):
            raise ValueError(
                f"\\u5f53\\u524d\\u72b6\\u6001 {record.status.value} \\u4e0d\\u5141\\u8bb8\\u5de5\\u7a0b\\u5e08\\u8865\\u770b"
            )

        record.engineer_review_at = _now_iso()
        record.engineer_review_by = engineer_name

        if notes:
            record.manual_changes.append(
                ManualChange(
                    changed_at=_now_iso(),
                    changed_by=engineer_name,
                    field_name="engineer_review_notes",
                    old_value="",
                    new_value=notes,
                    reason="\\u8bbe\\u5907\\u5de5\\u7a0b\\u5e08\\u8865\\u770b\\u5907\\u6ce8",
                )
            )

        if record.has_pending_coach_review():
            record.status = RecordStatus.PENDING_COACH_REVIEW
        else:
            record.status = RecordStatus.REVIEWED_BY_ENGINEER

        self._store.save(record)
        return record

    def step_coach_resolve_conflict(
        self,
        record_id: str,
        conflict_line_number: int,
        resolved_value: float,
        resolved_unit: TemperatureUnit,
        coach_name: str,
        coach_note: str,
    ) -> CalibrationRecord:
        from thermal_calibrator.rules.boundary_rules import coach_resolve_conflict

        record = self._store.load(record_id)
        if record is None:
            raise ValueError(f"\\u627e\\u4e0d\\u5230\\u8bb0\\u5f55: {record_id}")

        if record.status not in (
            RecordStatus.PENDING_COACH_REVIEW,
            RecordStatus.REVIEWED_BY_ENGINEER,
        ):
            raise ValueError(
                f"\\u5f53\\u524d\\u72b6\\u6001 {record.status.value} \\u4e0d\\u5141\\u8bb8\\u6559\\u7ec3\\u590d\\u6838"
            )

        updated_conflicts = []
        for uc in record.unit_conflicts:
            if uc.line_number == conflict_line_number and uc.needs_coach_review:
                resolved = coach_resolve_conflict(uc, resolved_value, resolved_unit, coach_note)
                record.manual_changes.append(
                    ManualChange(
                        changed_at=_now_iso(),
                        changed_by=coach_name,
                        field_name=f"unit_conflict_line_{conflict_line_number}",
                        old_value=uc.original_raw,
                        new_value=f"{resolved_value} {resolved_unit.value}",
                        reason=coach_note,
                    )
                )
                updated_conflicts.append(resolved)
            else:
                updated_conflicts.append(uc)

        record.unit_conflicts = updated_conflicts
        record.coach_review_at = _now_iso()
        record.coach_review_by = coach_name

        if not record.has_pending_coach_review():
            record.status = RecordStatus.COACH_CONFIRMED

        self._store.save(record)
        return record

    def step_rollback_conflict(
        self,
        record_id: str,
        conflict_line_number: int,
        operator_name: str,
    ) -> CalibrationRecord:
        from thermal_calibrator.rules.boundary_rules import rollback_conflict

        record = self._store.load(record_id)
        if record is None:
            raise ValueError(f"\\u627e\\u4e0d\\u5230\\u8bb0\\u5f55: {record_id}")

        updated_conflicts = []
        for uc in record.unit_conflicts:
            if uc.line_number == conflict_line_number:
                rolled = rollback_conflict(uc)
                record.manual_changes.append(
                    ManualChange(
                        changed_at=_now_iso(),
                        changed_by=operator_name,
                        field_name=f"unit_conflict_line_{conflict_line_number}_rollback",
                        old_value=f"{uc.resolved_value} {uc.resolved_unit}",
                        new_value="rolled_back",
                        reason="\\u56de\\u6eda\\u5230\\u539f\\u59cb\\u72b6\\u6001\\uff0c\\u7b49\\u5f85\\u6559\\u7ec3\\u590d\\u6838",
                    )
                )
                updated_conflicts.append(rolled)
            else:
                updated_conflicts.append(uc)

        record.unit_conflicts = updated_conflicts
        record.status = RecordStatus.ROLLED_BACK

        self._store.save(record)
        return record

    def step_handover_update(
        self,
        record_id: str,
        operator_name: str,
    ) -> CalibrationRecord:
        record = self._store.load(record_id)
        if record is None:
            raise ValueError(f"\\u627e\\u4e0d\\u5230\\u8bb0\\u5f55: {record_id}")

        if record.has_pending_coach_review():
            raise ValueError(
                "\\u8fd8\\u6709\\u5355\\u4f4d\\u51b2\\u7a81\\u7b49\\u5f85\\u6559\\u7ec3\\u590d\\u6838\\uff0c\\u4e0d\\u80fd\\u66f4\\u65b0\\u4ea4\\u63a5\\u62a5\\u544a"
            )

        if record.status not in (
            RecordStatus.REVIEWED_BY_ENGINEER,
            RecordStatus.COACH_CONFIRMED,
        ):
            raise ValueError(
                f"\\u5f53\\u524d\\u72b6\\u6001 {record.status.value} \\u4e0d\\u5141\\u8bb8\\u66f4\\u65b0\\u4ea4\\u63a5\\u62a5\\u544a"
            )

        record.handover_report_updated = True
        record.manual_changes.append(
            ManualChange(
                changed_at=_now_iso(),
                changed_by=operator_name,
                field_name="handover_report_updated",
                old_value="False",
                new_value="True",
                reason="\\u4ea4\\u63a5\\u62a5\\u544a\\u5df2\\u66f4\\u65b0",
            )
        )

        self._store.save(record)
        return record


_INTERVAL_KEYWORDS = ["\\u91c7\\u6837\\u95f4\\u9694", "sampling interval", "interval"]
_INTERVAL_PATTERN = __import__("re").compile(r"(\\d+\\.?\\d*)\\s*(s|sec|seconds|\\u79d2)")


def _is_interval_line(text: str) -> bool:
    lower = text.lower()
    return any(kw in lower for kw in _INTERVAL_KEYWORDS) or bool(_INTERVAL_PATTERN.search(text))


def _parse_interval(text: str) -> float:
    m = _INTERVAL_PATTERN.search(text)
    if m:
        return float(m.group(1))
    return 0.0


_TEMP_PATTERN = __import__("re").compile(r"[-+]?\\d+\\.?\\d*")


def _parse_temperature_value(text: str) -> Optional[float]:
    m = _TEMP_PATTERN.search(text)
    if m:
        return float(m.group(0))
    return None
"""

FILES["thermal_calibrator/api.py"] = """from __future__ import annotations

import os
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from thermal_calibrator.models.calibration_record import TemperatureUnit
from thermal_calibrator.store.result_store import ResultStore
from thermal_calibrator.workflow.engine import CalibrationWorkflow


app = FastAPI(title="\\u70ed\\u50cf\\u4eea\\u6e29\\u5dee\\u6821\\u51c6")

STORE_DIR = os.environ.get("CALIBRATOR_STORE_DIR", "/tmp/thermal_calibrator_store")
_store = ResultStore(STORE_DIR)
_workflow = CalibrationWorkflow(_store)


class ImportRequest(BaseModel):
    record_id: str
    device_name: str
    raw_lines: list[str]


class EngineerReviewRequest(BaseModel):
    record_id: str
    engineer_name: str
    notes: Optional[str] = None


class CoachResolveRequest(BaseModel):
    record_id: str
    conflict_line_number: int
    resolved_value: float
    resolved_unit: str
    coach_name: str
    coach_note: str


class RollbackRequest(BaseModel):
    record_id: str
    conflict_line_number: int
    operator_name: str


class HandoverUpdateRequest(BaseModel):
    record_id: str
    operator_name: str


@app.post("/calibration/import")
def api_import(req: ImportRequest):
    record = _workflow.step_import(req.record_id, req.device_name, req.raw_lines)
    return record.to_dict()


@app.post("/calibration/engineer-review")
def api_engineer_review(req: EngineerReviewRequest):
    try:
        record = _workflow.step_engineer_review(
            req.record_id, req.engineer_name, req.notes
        )
        return record.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calibration/coach-resolve")
def api_coach_resolve(req: CoachResolveRequest):
    try:
        unit = TemperatureUnit(req.resolved_unit)
        record = _workflow.step_coach_resolve_conflict(
            req.record_id,
            req.conflict_line_number,
            req.resolved_value,
            unit,
            req.coach_name,
            req.coach_note,
        )
        return record.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calibration/rollback")
def api_rollback(req: RollbackRequest):
    try:
        record = _workflow.step_rollback_conflict(
            req.record_id, req.conflict_line_number, req.operator_name
        )
        return record.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/calibration/handover-update")
def api_handover_update(req: HandoverUpdateRequest):
    try:
        record = _workflow.step_handover_update(req.record_id, req.operator_name)
        return record.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/calibration/{record_id}/full")
def api_get_full(record_id: str):
    result = _store.get_full_result(record_id)
    if result is None:
        raise HTTPException(status_code=404, detail="\\u8bb0\\u5f55\\u4e0d\\u5b58\\u5728")
    return result


@app.get("/calibration/{record_id}/summary")
def api_get_summary(record_id: str):
    result = _store.get_summary(record_id)
    if result is None:
        raise HTTPException(status_code=404, detail="\\u8bb0\\u5f55\\u4e0d\\u5b58\\u5728")
    return result


@app.get("/calibration/{record_id}/export")
def api_export_detail(record_id: str):
    detail = _store.export_detail(record_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="\\u8bb0\\u5f55\\u4e0d\\u5b58\\u5728")
    return {"record_id": record_id, "detail_json": detail}


@app.get("/calibration/list")
def api_list():
    return {"record_ids": _store.list_records()}
"""

FILES["thermal_calibrator/tests/test_workflow.py"] = """from __future__ import annotations

import json
import os
import tempfile
import unittest

from thermal_calibrator.models.calibration_record import (
    RecordStatus,
    TemperatureUnit,
)
from thermal_calibrator.store.result_store import ResultStore
from thermal_calibrator.workflow.engine import CalibrationWorkflow


class TestThreeStepWorkflow(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.store = ResultStore(self.tmpdir)
        self.workflow = CalibrationWorkflow(self.store)

    def test_full_three_steps_no_conflict(self):
        raw = [
            "\\u91c7\\u6837\\u95f4\\u9694 5s",
            "25.3 \\u00b0C",
            "26.1 \\u00b0C",
        ]
        r = self.workflow.step_import("rec-001", "FLIR-A300", raw)
        self.assertEqual(r.status, RecordStatus.IMPORTED)
        self.assertFalse(r.has_unit_conflicts())

        r2 = self.workflow.step_engineer_review("rec-001", "\\u4f55\\u5de5")
        self.assertEqual(r2.status, RecordStatus.REVIEWED_BY_ENGINEER)

        r3 = self.workflow.step_handover_update("rec-001", "\\u4f55\\u5de5")
        self.assertTrue(r3.handover_report_updated)

    def test_celsius_kelvin_mixed_triggers_coach_review(self):
        raw = [
            "\\u91c7\\u6837\\u95f4\\u9694 10s",
            "298.15 K",
            "25.0 \\u00b0C",
        ]
        r = self.workflow.step_import("rec-002", "FLIR-B200", raw)
        self.assertTrue(r.has_unit_conflicts())

        r2 = self.workflow.step_engineer_review("rec-002", "\\u4f55\\u5de5", "\\u53d1\\u73b0\\u6df7\\u7528\\u5355\\u4f4d")
        self.assertEqual(r2.status, RecordStatus.PENDING_COACH_REVIEW)

        with self.assertRaises(ValueError):
            self.workflow.step_handover_update("rec-002", "\\u4f55\\u5de5")

    def test_coach_resolve_then_handover(self):
        raw = [
            "\\u91c7\\u6837\\u95f4\\u9694 5s",
            "298.15 K \\u00b0C",
        ]
        r = self.workflow.step_import("rec-003", "FLIR-C100", raw)
        if r.has_pending_coach_review():
            r2 = self.workflow.step_engineer_review("rec-003", "\\u4f55\\u5de5")
            self.assertEqual(r2.status, RecordStatus.PENDING_COACH_REVIEW)

            conflict_line = None
            for uc in r2.unit_conflicts:
                if uc.needs_coach_review:
                    conflict_line = uc.line_number
                    break

            self.assertIsNotNone(conflict_line)
            r3 = self.workflow.step_coach_resolve_conflict(
                "rec-003",
                conflict_line,
                25.0,
                TemperatureUnit.CELSIUS,
                "\\u8bad\\u7ec3\\u6559\\u7ec3",
                "\\u786e\\u8ba4\\u4e3a\\u6444\\u6c0f\\u5ea6 25\\u00b0C",
            )
            self.assertEqual(r3.status, RecordStatus.COACH_CONFIRMED)

            r4 = self.workflow.step_handover_update("rec-003", "\\u4f55\\u5de5")
            self.assertTrue(r4.handover_report_updated)

    def test_rollback_preserves_audit(self):
        raw = [
            "\\u91c7\\u6837\\u95f4\\u9694 5s",
            "298.15 K \\u00b0C",
        ]
        r = self.workflow.step_import("rec-004", "FLIR-D100", raw)
        if r.has_pending_coach_review():
            r2 = self.workflow.step_engineer_review("rec-004", "\\u4f55\\u5de5")
            conflict_line = None
            for uc in r2.unit_conflicts:
                if uc.needs_coach_review:
                    conflict_line = uc.line_number
                    break

            r3 = self.workflow.step_coach_resolve_conflict(
                "rec-004",
                conflict_line,
                25.0,
                TemperatureUnit.CELSIUS,
                "\\u8bad\\u7ec3\\u6559\\u7ec3",
                "\\u5148\\u786e\\u8ba4\\u4e3a25\\u00b0C",
            )

            r4 = self.workflow.step_rollback_conflict(
                "rec-004", conflict_line, "\\u4f55\\u5de5"
            )
            self.assertEqual(r4.status, RecordStatus.ROLLED_BACK)
            self.assertTrue(len(r4.manual_changes) > 0)

    def test_same_result_for_export_display_api(self):
        raw = [
            "\\u91c7\\u6837\\u95f4\\u9694 5s",
            "25.0 \\u00b0C",
        ]
        self.workflow.step_import("rec-005", "FLIR-E100", raw)

        full = self.store.get_full_result("rec-005")
        exported = json.loads(self.store.export_detail("rec-005"))
        self.assertEqual(full, exported)

        loaded = self.store.load("rec-005")
        self.assertIsNotNone(loaded)
        self.assertEqual(full, loaded.to_dict())

    def test_original_line_numbers_preserved(self):
        raw = [
            "",
            "\\u91c7\\u6837\\u95f4\\u9694 5s",
            "",
            "25.0 \\u00b0C",
        ]
        r = self.workflow.step_import("rec-006", "FLIR-F100", raw)
        self.assertEqual(r.sampling_intervals[0].original_line_number, 2)
        self.assertEqual(r.temperature_readings[0].original_line_number, 4)


if __name__ == "__main__":
    unittest.main()
"""


if __name__ == "__main__":
    for relpath, content in FILES.items():
        fpath = os.path.join(BASE, relpath)
        os.makedirs(os.path.dirname(fpath), exist_ok=True)
        with open(fpath, "w", encoding="utf-8") as f:
            f.write(content.lstrip("\n"))
        print(f"  wrote {relpath}")
    print("All files written.")
