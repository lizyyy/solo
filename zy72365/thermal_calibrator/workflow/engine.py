from __future__ import annotations

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


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


_INTERVAL_KEYWORDS = ["采样间隔", "sampling interval", "interval"]
_INTERVAL_PATTERN = __import__("re").compile(r"(\d+\.?\d*)\s*(s|sec|seconds|秒)")
_TEMP_PATTERN = __import__("re").compile(r"[-+]?\d+\.?\d*")


def _is_interval_line(text):
    lower = text.lower()
    return any(kw in lower for kw in _INTERVAL_KEYWORDS) or bool(_INTERVAL_PATTERN.search(text))


def _parse_interval(text):
    m = _INTERVAL_PATTERN.search(text)
    if m:
        return float(m.group(1))
    return 0.0


def _parse_temperature_value(text):
    m = _TEMP_PATTERN.search(text)
    if m:
        return float(m.group(0))
    return None


class CalibrationWorkflow:
    STEP_IMPORT = "import"
    STEP_ENGINEER_REVIEW = "engineer_review"
    STEP_HANDOVER_UPDATE = "handover_update"

    def __init__(self, store):
        self._store = store

    def step_import(self, record_id, device_name, raw_lines):
        intervals = []
        readings = []
        conflicts = []

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

    def step_engineer_review(self, record_id, engineer_name, notes=None):
        record = self._store.load(record_id)
        if record is None:
            raise ValueError(f"找不到记录: {record_id}")

        if record.status not in (
            RecordStatus.IMPORTED,
            RecordStatus.PENDING_COACH_REVIEW,
        ):
            raise ValueError(
                f"当前状态 {record.status.value} 不允许工程师补看"
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
                    reason="设备工程师补看备注",
                )
            )

        if record.has_pending_coach_review():
            record.status = RecordStatus.PENDING_COACH_REVIEW
        else:
            record.status = RecordStatus.REVIEWED_BY_ENGINEER

        self._store.save(record)
        return record

    def step_coach_resolve_conflict(self, record_id, conflict_line_number, resolved_value, resolved_unit, coach_name, coach_note):
        from thermal_calibrator.rules.boundary_rules import coach_resolve_conflict

        record = self._store.load(record_id)
        if record is None:
            raise ValueError(f"找不到记录: {record_id}")

        if record.status not in (
            RecordStatus.PENDING_COACH_REVIEW,
            RecordStatus.REVIEWED_BY_ENGINEER,
        ):
            raise ValueError(
                f"当前状态 {record.status.value} 不允许教练复核"
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

    def step_rollback_conflict(self, record_id, conflict_line_number, operator_name):
        from thermal_calibrator.rules.boundary_rules import rollback_conflict

        record = self._store.load(record_id)
        if record is None:
            raise ValueError(f"找不到记录: {record_id}")

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
                        reason="回滚到原始状态，等待教练复核",
                    )
                )
                updated_conflicts.append(rolled)
            else:
                updated_conflicts.append(uc)

        record.unit_conflicts = updated_conflicts
        record.status = RecordStatus.ROLLED_BACK

        self._store.save(record)
        return record

    def step_handover_update(self, record_id, operator_name):
        record = self._store.load(record_id)
        if record is None:
            raise ValueError(f"找不到记录: {record_id}")

        if record.has_pending_coach_review():
            raise ValueError(
                "还有单位冲突等待教练复核，不能更新交接报告"
            )

        if record.status not in (
            RecordStatus.REVIEWED_BY_ENGINEER,
            RecordStatus.COACH_CONFIRMED,
        ):
            raise ValueError(
                f"当前状态 {record.status.value} 不允许更新交接报告"
            )

        record.handover_report_updated = True
        record.manual_changes.append(
            ManualChange(
                changed_at=_now_iso(),
                changed_by=operator_name,
                field_name="handover_report_updated",
                old_value="False",
                new_value="True",
                reason="交接报告已更新",
            )
        )

        self._store.save(record)
        return record
