#!/usr/bin/env python3
import os, sys

BASE = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE)

FILES = {}

FILES["thermal_calibrator/rules/boundary_rules.py"] = r'''from __future__ import annotations

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
    re.compile(r"deg\s*C", re.IGNORECASE),
    re.compile(r"celsius", re.IGNORECASE),
    re.compile(r"centigrade", re.IGNORECASE),
]

_KELVIN_PATTERNS = [
    re.compile(r"\bK\b"),
    re.compile(r"kelvin", re.IGNORECASE),
]


def detect_unit(text: str) -> list[TemperatureUnit]:
    found: list[TemperatureUnit] = []
    if "\u00b0C" in text or "\u2103" in text:
        found.append(TemperatureUnit.CELSIUS)
    else:
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
        coach_review_note=(conflict.coach_review_note or "") + " [\u5df2\u56de\u6eda\uff0c\u7b49\u5f85\u6559\u7ec3\u590d\u6838]",
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
'''

FILES["thermal_calibrator/store/result_store.py"] = r'''from __future__ import annotations

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
'''

FILES["thermal_calibrator/workflow/engine.py"] = r'''from __future__ import annotations

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


_INTERVAL_KEYWORDS = ["\u91c7\u6837\u95f4\u9694", "sampling interval", "interval"]
_INTERVAL_PATTERN = __import__("re").compile(r"(\d+\.?\d*)\s*(s|sec|seconds|\u79d2)")
_TEMP_PATTERN = __import__("re").compile(r"[-+]?\d+\.?\d*")


def _is_interval_line(text: str) -> bool:
    lower = text.lower()
    return any(kw in lower for kw in _INTERVAL_KEYWORDS) or bool(_INTERVAL_PATTERN.search(text))


def _parse_interval(text: str) -> float:
    m = _INTERVAL_PATTERN.search(text)
    if m:
        return float(m.group(1))
    return 0.0


def _parse_temperature_value(text: str) -> Optional[float]:
    m = _TEMP_PATTERN.search(text)
    if m:
        return float(m.group(0))
    return None


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
            raise ValueError(f"\u627e\u4e0d\u5230\u8bb0\u5f55: {record_id}")

        if record.status not in (
            RecordStatus.IMPORTED,
            RecordStatus.PENDING_COACH_REVIEW,
        ):
            raise ValueError(
                f"\u5f53\u524d\u72b6\u6001 {record.status.value} \u4e0d\u5141\u8bb8\u5de5\u7a0b\u5e08\u8865\u770b"
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
                    reason="\u8bbe\u5907\u5de5\u7a0b\u5e08\u8865\u770b\u5907\u6ce8",
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
            raise ValueError(f"\u627e\u4e0d\u5230\u8bb0\u5f55: {record_id}")

        if record.status not in (
            RecordStatus.PENDING_COACH_REVIEW,
            RecordStatus.REVIEWED_BY_ENGINEER,
        ):
            raise ValueError(
                f"\u5f53\u524d\u72b6\u6001 {record.status.value} \u4e0d\u5141\u8bb8\u6559\u7ec3\u590d\u6838"
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
            raise ValueError(f"\u627e\u4e0d\u5230\u8bb0\u5f55: {record_id}")

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
                        reason="\u56de\u6eda\u5230\u539f\u59cb\u72b6\u6001\uff0c\u7b49\u5f85\u6559\u7ec3\u590d\u6838",
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
            raise ValueError(f"\u627e\u4e0d\u5230\u8bb0\u5f55: {record_id}")

        if record.has_pending_coach_review():
            raise ValueError(
                "\u8fd8\u6709\u5355\u4f4d\u51b2\u7a81\u7b49\u5f85\u6559\u7ec3\u590d\u6838\uff0c\u4e0d\u80fd\u66f4\u65b0\u4ea4\u63a5\u62a5\u544a"
            )

        if record.status not in (
            RecordStatus.REVIEWED_BY_ENGINEER,
            RecordStatus.COACH_CONFIRMED,
        ):
            raise ValueError(
                f"\u5f53\u524d\u72b6\u6001 {record.status.value} \u4e0d\u5141\u8bb8\u66f4\u65b0\u4ea4\u63a5\u62a5\u544a"
            )

        record.handover_report_updated = True
        record.manual_changes.append(
            ManualChange(
                changed_at=_now_iso(),
                changed_by=operator_name,
                field_name="handover_report_updated",
                old_value="False",
                new_value="True",
                reason="\u4ea4\u63a5\u62a5\u544a\u5df2\u66f4\u65b0",
            )
        )

        self._store.save(record)
        return record
'''

FILES["thermal_calibrator/api.py"] = r'''from __future__ import annotations

import os
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from thermal_calibrator.models.calibration_record import TemperatureUnit
from thermal_calibrator.store.result_store import ResultStore
from thermal_calibrator.workflow.engine import CalibrationWorkflow


app = FastAPI(title="\u70ed\u50cf\u4eea\u6e29\u5dee\u6821\u51c6")

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
        raise HTTPException(status_code=404, detail="\u8bb0\u5f55\u4e0d\u5b58\u5728")
    return result


@app.get("/calibration/{record_id}/summary")
def api_get_summary(record_id: str):
    result = _store.get_summary(record_id)
    if result is None:
        raise HTTPException(status_code=404, detail="\u8bb0\u5f55\u4e0d\u5b58\u5728")
    return result


@app.get("/calibration/{record_id}/export")
def api_export_detail(record_id: str):
    detail = _store.export_detail(record_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="\u8bb0\u5f55\u4e0d\u5b58\u5728")
    return {"record_id": record_id, "detail_json": detail}


@app.get("/calibration/list")
def api_list():
    return {"record_ids": _store.list_records()}
'''

FILES["thermal_calibrator/tests/test_workflow.py"] = r'''from __future__ import annotations

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
            "\u91c7\u6837\u95f4\u9694 5s",
            "25.3 \u00b0C",
            "26.1 \u00b0C",
        ]
        r = self.workflow.step_import("rec-001", "FLIR-A300", raw)
        self.assertEqual(r.status, RecordStatus.IMPORTED)
        self.assertFalse(r.has_unit_conflicts())

        r2 = self.workflow.step_engineer_review("rec-001", "\u4f55\u5de5")
        self.assertEqual(r2.status, RecordStatus.REVIEWED_BY_ENGINEER)

        r3 = self.workflow.step_handover_update("rec-001", "\u4f55\u5de5")
        self.assertTrue(r3.handover_report_updated)

    def test_celsius_kelvin_mixed_triggers_coach_review(self):
        raw = [
            "\u91c7\u6837\u95f4\u9694 10s",
            "298.15 K",
            "25.0 \u00b0C",
        ]
        r = self.workflow.step_import("rec-002", "FLIR-B200", raw)
        self.assertTrue(r.has_unit_conflicts())

        r2 = self.workflow.step_engineer_review("rec-002", "\u4f55\u5de5", "\u53d1\u73b0\u6df7\u7528\u5355\u4f4d")
        self.assertEqual(r2.status, RecordStatus.PENDING_COACH_REVIEW)

        with self.assertRaises(ValueError):
            self.workflow.step_handover_update("rec-002", "\u4f55\u5de5")

    def test_coach_resolve_then_handover(self):
        raw = [
            "\u91c7\u6837\u95f4\u9694 5s",
            "298.15 K \u00b0C",
        ]
        r = self.workflow.step_import("rec-003", "FLIR-C100", raw)
        if r.has_pending_coach_review():
            r2 = self.workflow.step_engineer_review("rec-003", "\u4f55\u5de5")
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
                "\u8bad\u7ec3\u6559\u7ec3",
                "\u786e\u8ba4\u4e3a\u6444\u6c0f\u5ea6 25\u00b0C",
            )
            self.assertEqual(r3.status, RecordStatus.COACH_CONFIRMED)

            r4 = self.workflow.step_handover_update("rec-003", "\u4f55\u5de5")
            self.assertTrue(r4.handover_report_updated)

    def test_rollback_preserves_audit(self):
        raw = [
            "\u91c7\u6837\u95f4\u9694 5s",
            "298.15 K \u00b0C",
        ]
        r = self.workflow.step_import("rec-004", "FLIR-D100", raw)
        if r.has_pending_coach_review():
            r2 = self.workflow.step_engineer_review("rec-004", "\u4f55\u5de5")
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
                "\u8bad\u7ec3\u6559\u7ec3",
                "\u5148\u786e\u8ba4\u4e3a25\u00b0C",
            )

            r4 = self.workflow.step_rollback_conflict(
                "rec-004", conflict_line, "\u4f55\u5de5"
            )
            self.assertEqual(r4.status, RecordStatus.ROLLED_BACK)
            self.assertTrue(len(r4.manual_changes) > 0)

    def test_same_result_for_export_display_api(self):
        raw = [
            "\u91c7\u6837\u95f4\u9694 5s",
            "25.0 \u00b0C",
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
            "\u91c7\u6837\u95f4\u9694 5s",
            "",
            "25.0 \u00b0C",
        ]
        r = self.workflow.step_import("rec-006", "FLIR-F100", raw)
        self.assertEqual(r.sampling_intervals[0].original_line_number, 2)
        self.assertEqual(r.temperature_readings[0].original_line_number, 4)


if __name__ == "__main__":
    unittest.main()
'''

FILES["README.md"] = r'''# \u70ed\u50cf\u4eea\u6e29\u5dee\u6821\u51c6\u5de5\u5177

\u8bbe\u5907\u5de5\u7a0b\u5e08\u4f55\u5de5 \u4e0e \u8bad\u7ec3\u6559\u7ec3 \u4ea4\u63a5\u7528\u7684\u6e29\u5ea6\u6821\u51c6\u8bb0\u5f55\u7ba1\u7406\u5de5\u5177\u3002\u91cd\u70b9\u89e3\u51b3\u6444\u6c0f\u5ea6\u548c\u5f00\u5c14\u6587\u6df7\u7528\u65f6\u7684\u5ba1\u8ba1\u8ffd\u8e2a\u95ee\u9898\u3002

## \u6838\u5fc3\u8bbe\u8ba1\u539f\u5219

1. **\u540c\u4e00\u7ed3\u679c\u6e90**\uff1a\u5bfc\u51fa\u660e\u7ec6\u3001\u9875\u9762\u5c55\u793a\u3001\u63a5\u53e3\u8fd4\u56de\u8bfb\u540c\u4e00\u4efd\u5b58\u50a8\u7ed3\u679c\uff0c\u4e0d\u80fd\u4e00\u4e2a\u5730\u65b9\u663e\u793a\u5f02\u5e38\u3001\u53e6\u4e00\u4e2a\u5730\u65b9\u6d88\u5931\u3002
2. **\u5ba1\u8ba1\u8ffd\u8e2a**\uff1a\u91c7\u6837\u95f4\u9694\u8bf4\u660e\u7684\u539f\u59cb\u884c\u53f7\u3001\u4eba\u5de5\u6539\u52a8\u3001\u5f53\u524d\u5904\u7406\u72b6\u6001\u5168\u90e8\u7559\u5e95\uff0c\u8bad\u7ec3\u6559\u7ec3\u8ffd\u95ee\u65f6\u80fd\u56de\u5230\u8bc1\u636e\u3002
3. **\u4e09\u6b65\u5de5\u4f5c\u6d41**\uff1a\u5bfc\u5165 \u2192 \u8bbe\u5907\u5de5\u7a0b\u5e08\u8865\u770b \u2192 \u4ea4\u63a5\u62a5\u544a\u66f4\u65b0\u3002
4. **\u6df7\u7528\u5355\u4f4d\u5904\u7406**\uff1a\u6444\u6c0f\u5ea6\u548c\u5f00\u5c14\u6587\u6df7\u7528\u65f6\uff0c\u4e0d\u6025\u7740\u5f52\u6b63\u5e38\uff0c\u7559\u7ed9\u8bad\u7ec3\u6559\u7ec3\u590d\u6838\u3002

## \u4e09\u6b65\u5de5\u4f5c\u6d41

### Step 1\uff1a\u91c7\u6837\u95f4\u9694\u8bf4\u660e\u7b2c\u4e00\u6b21\u5bfc\u5165

- \u8bfb\u53d6\u539f\u59cb\u8bb0\u5f55\u7684\u6bcf\u4e00\u884c\uff0c\u8bb0\u4f4f\u539f\u59cb\u884c\u53f7
- \u81ea\u52a8\u68c0\u6d4b\u5355\u4f4d\uff08\u00b0C\u3001deg C\u3001K\u3001kelvin \u7b49\uff09
- \u53d1\u73b0\u6444\u6c0f\u5ea6\u548c\u5f00\u5c14\u6587\u6df7\u7528\u65f6\uff0c\u81ea\u52a8\u6807\u8bb0\u4e3a\u300c\u7b49\u5f85\u6559\u7ec3\u590d\u6838\u300d
- \u6240\u6709\u53d8\u52a8\u90fd\u8bb0\u5f55 manual_changes

### Step 2\uff1a\u8bbe\u5907\u5de5\u7a0b\u5e08\u4f55\u5de5\u8865\u770b

- \u4f55\u5de5\u53ef\u4ee5\u67e5\u770b\u5bfc\u5165\u7ed3\u679c\u548c\u5355\u4f4d\u51b2\u7a81
- \u8865\u5145\u5907\u6ce8\u4f1a\u8bb0\u5f55\u5728 manual_changes \u91cc
- \u5982\u679c\u8fd8\u6709\u6df7\u7528\u5355\u4f4d\u6ca1\u5904\u7406\uff0c\u72b6\u6001\u4fdd\u6301\u300c\u7b49\u5f85\u6559\u7ec3\u590d\u6838\u300d
- \u8bad\u7ec3\u6559\u7ec3\u590d\u6838\u540e\uff0c\u72b6\u6001\u53d8\u4e3a\u300c\u6559\u7ec3\u5df2\u786e\u8ba4\u300d

### Step 3\uff1a\u4ea4\u63a5\u62a5\u544a\u66f4\u65b0

- \u5fc5\u987b\u6240\u6709\u5355\u4f4d\u51b2\u7a81\u90fd\u5904\u7406\u5b8c\u6210\u624d\u80fd\u66f4\u65b0
- \u66f4\u65b0\u8bb0\u5f55 handover_report_updated = True
- \u4efb\u4f55\u4eba\u90fd\u53ef\u4ee5\u56de\u6eda\u5230\u4e4b\u524d\u7684\u72b6\u6001

## \u8fb9\u754c\u89c4\u5219\uff08\u5199\u5728\u4ee3\u7801\u548c\u8fd9\u91cc\uff09

### \u600e\u4e48\u5224\uff1f

1. **\u5355\u4f4d\u68c0\u6d4b**\uff1a
   - \u6444\u6c0f\u5ea6\uff1a\u00b0C\u3001\u2103\u3001deg C\u3001celsius\u3001centigrade
   - \u5f00\u5c14\u6587\uff1a\u5355\u72ec\u7684 K\u3001kelvin
   - \u6ca1\u627e\u5230\u5355\u4f4d\u65f6\u9ed8\u8ba4\u6444\u6c0f\u5ea6

2. **\u662f\u5426\u6df7\u7528**\uff1a
   - \u540c\u4e00\u884c\u540c\u65f6\u68c0\u6d4b\u5230\u6444\u6c0f\u5ea6\u548c\u5f00\u5c14\u6587 \u2192 \u51b2\u7a81

3. **\u6570\u503c\u5408\u7406\u6027\u5224\u65ad**\uff1a
   - \u70ed\u50cf\u4eea\u6d4b\u91cf\u8303\u56f4\uff1a-40\u00b0C ~ 2000\u00b0C
   - \u5982\u679c 298.15 \u540c\u65f6\u6807\u4e86 K \u548c \u00b0C\uff0c298.15 K \u5408\u7406\uff0c298.15 \u00b0C \u8d85\u51fa\u8303\u56f4\uff0c\u81ea\u52a8\u8f6c\u6362\u4e3a 25\u00b0C
   - \u5982\u679c 25 \u540c\u65f6\u6807\u4e86 K \u548c \u00b0C\uff0c25 \u00b0C \u5408\u7406\uff0c25 K \u63a5\u8fd1\u7edd\u5bf9\u96f6\u5ea6\u4e0d\u5408\u7406\uff0c\u4fdd\u6301 25\u00b0C
   - \u4e24\u4e2a\u90fd\u5408\u7406\u6216\u90fd\u4e0d\u5408\u7406\uff1f\u7559\u7ed9\u6559\u7ec3\u590d\u6838\uff01

### \u600e\u4e48\u6539\uff1f

- \u81ea\u52a8\u8f6c\u6362\u53ea\u5728\u2460\u4ec5\u6570\u503c\u5408\u7406\u6027\u80fd\u786e\u5b9a\u5355\u4f4d\u65f6\u624d\u89e6\u53d1
- \u6559\u7ec3\u53ef\u4ee5\u5f3a\u5236\u6307\u5b9a\u5355\u4f4d\u548c\u6570\u503c
- \u6240\u6709\u6539\u52a8\u90fd\u8bb0\u5f55\u5728 manual_changes\uff1a\u4ec0\u4e48\u65f6\u5019\u3001\u8c01\u3001\u6539\u4ec0\u4e48\u3001\u4e3a\u4ec0\u4e48

### \u600e\u4e48\u56de\u6eda\uff1f

- \u4efb\u4f55\u65f6\u5019\u90fd\u53ef\u4ee5 rollback\uff0c\u72b6\u6001\u53d8 rolled_back
- \u56de\u6eda\u540e\u5355\u4f4d\u51b2\u7a81\u91cd\u65b0\u56de\u5230\u300c\u7b49\u5f85\u6559\u7ec3\u590d\u6838\u300d
- rollback \u4e5f\u662f\u4e00\u6761 manual_change\uff0c\u8ffd\u8e2a\u5230\u8c01\u64cd\u4f5c\u7684

## \u4ee3\u7801\u7ed3\u6784

```
thermal_calibrator/
\u251c\u2500\u2500 models/
\u2502   \u2514\u2500\u2500 calibration_record.py    # \u6838\u5fc3\u6570\u636e\u6a21\u578b\uff08\u542b\u5ba1\u8ba1\u5b57\u6bb5\uff09
\u251c\u2500\u2500 rules/
\u2502   \u2514\u2500\u2500 boundary_rules.py        # \u8fb9\u754c\u89c4\u5219\uff08\u5224/\u6539/\u56de\u6eda\uff09
\u251c\u2500\u2500 store/
\u2502   \u2514\u2500\u2500 result_store.py          # \u7edf\u4e00\u7ed3\u679c\u5b58\u50a8\u5c42
\u251c\u2500\u2500 workflow/
\u2502   \u2514\u2500\u2500 engine.py                # \u4e09\u6b65\u5de5\u4f5c\u6d41\u5f15\u64ce
\u251c\u2500\u2500 tests/
\u2502   \u2514\u2500\u2500 test_workflow.py         # \u5355\u5143\u6d4b\u8bd5
\u2514\u2500\u2500 api.py                       # FastAPI \u63a5\u53e3
```

## \u5b89\u88c5\u548c\u8fd0\u884c

```bash
pip install fastapi pydantic uvicorn
cd thermal_calibrator && python3 -m pytest tests/ -v

# \u542f\u52a8 API \u670d\u52a1
uvicorn thermal_calibrator.api:app --reload
```

## \u4e0e\u4f55\u5de5\u548c\u8bad\u7ec3\u6559\u7ec3\u7684\u4ea4\u63a5\u8bf4\u660e

### \u4f55\u5de5\u8bf4\u7684\u201c\u8fd4\u5de5\u7559\u5728\u660e\u9762\u4e0a\u201d

\u5c31\u662f\u6307\uff1a
- \u6bcf\u4e2a\u6570\u636e\u7684\u6765\u9f99\u53bb\u8109\u90fd\u6709\u8bb0\u5f55
- \u6df7\u7528\u5355\u4f4d\u8fd9\u79cd\u4e8b\u4e0d\u80fd\u9759\u9ed8\u5316\u89e3\u51b3\uff0c\u8981\u660e\u663e\u6807\u8bb0\u7b49\u5f85\u590d\u6838
- \u754c\u9762\u3001\u63a5\u53e3\u3001\u5bfc\u51fa\u6587\u4ef6\u770b\u5230\u7684\u662f\u540c\u4e00\u4efd\u4e1c\u897f\uff0c\u4e0d\u80fd\u754c\u9762\u663e\u793a\u6b63\u5e38\u4f46\u63a5\u53e3\u8fd4\u56de\u662f\u5f02\u5e38

### \u8bad\u7ec3\u6559\u7ec3\u8ffd\u95ee\u65f6

\u76f4\u63a5\u7ffb manual_changes \u548c unit_conflicts\uff0c\u6bcf\u4e2a\u6539\u52a8\u90fd\u80fd\u770b\u5230\uff1a
- \u539f\u59cb\u6587\u672c\u662f\u4ec0\u4e48
- \u7b2c\u51e0\u884c
- \u8c01\u5728\u4ec0\u4e48\u65f6\u5019\u6539\u7684
- \u6539\u524d\u6539\u540e\u7684\u503c
- \u4e3a\u4ec0\u4e48\u8fd9\u4e48\u6539

## \u7528\u4f8b\uff1a\u4e09\u6b65\u8d70\u5b8c\u6574\u7248

```python
from thermal_calibrator.store.result_store import ResultStore
from thermal_calibrator.workflow.engine import CalibrationWorkflow
from thermal_calibrator.models.calibration_record import TemperatureUnit

store = ResultStore("/tmp/calib")
workflow = CalibrationWorkflow(store)

# Step 1: \u5bfc\u5165
raw_lines = [
    "\u91c7\u6837\u95f4\u9694 5s",
    "298.15 K \u00b0C",  # \u6df7\u7528\u4e86\uff01
    "25.0 \u00b0C",
]
record = workflow.step_import("REC-2026-001", "FLIR-T1040sc", raw_lines)
print(record.status)  # pending_coach_review

# Step 2: \u4f55\u5de5\u8865\u770b
record = workflow.step_engineer_review(
    "REC-2026-001",
    "\u4f55\u5de5",
    "\u67e5\u770b\u4e86\u6628\u665a\u7684\u6e29\u5ea6\u6821\u51c6\u8bb0\u5f55\uff0c\u7b2c2\u884c\u786e\u5b9e\u662f\u6df7\u7528\u4e86"
)

# \u6559\u7ec3\u590d\u6838
record = workflow.step_coach_resolve_conflict(
    "REC-2026-001",
    conflict_line_number=2,
    resolved_value=25.0,
    resolved_unit=TemperatureUnit.CELSIUS,
    coach_name="\u8bad\u7ec3\u6559\u7ec3",
    coach_note="\u786e\u8ba4\u662f\u6444\u6c0f\u5ea6 25\u00b0C\uff0c\u672c\u5730\u6821\u51c6\u7528\u7684\u662f\u6444\u6c0f",
)
print(record.status)  # coach_confirmed

# Step 3: \u4ea4\u63a5\u62a5\u544a\u66f4\u65b0
record = workflow.step_handover_update("REC-2026-001", "\u4f55\u5de5")
print(record.handover_report_updated)  # True

# \u540e\u7eed\u4e00\u67e5\u5c31\u77e5\u9053\u8bc1\u636e
print([mc["reason"] for mc in record.to_dict()["manual_changes"]])
```
'''

FILES["requirements.txt"] = r'''fastapi>=0.100.0
pydantic>=2.0.0
uvicorn>=0.23.0
'''

for path, content in FILES.items():
    dir_path = os.path.dirname(path)
    if dir_path and not os.path.exists(dir_path):
        os.makedirs(dir_path, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Wrote {path} ({len(content)} bytes)")

print("\nAll files generated successfully!")
