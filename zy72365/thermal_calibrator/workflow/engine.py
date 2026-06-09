from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
import re

from thermal_calibrator.models.calibration_record import (
    CalibrationRecord,
    ManualChange,
    RecordStatus,
    SamplingInterval,
    TemperatureReading,
    TemperatureUnit,
    UnitConflictRecord,
)
from thermal_calibrator.rules.boundary_rules import (
    detect_unit,
    judge_conflict,
    kelvin_to_celsius,
)
from thermal_calibrator.store.result_store import ResultStore


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


_INTERVAL_KEYWORDS = ["采样间隔", "sampling interval", "interval"]
_INTERVAL_PATTERN = re.compile(r"(\d+\.?\d*)\s*(s|sec|seconds|秒)")
_TEMP_PATTERN = re.compile(r"[-+]?\d+\.?\d*")


def _is_interval_line(text: str) -> bool:
    lower = text.lower()
    return any(kw in lower for kw in _INTERVAL_KEYWORDS) or bool(
        _INTERVAL_PATTERN.search(text)
    )


def _parse_interval(text: str) -> float:
    m = _INTERVAL_PATTERN.search(text)
    return float(m.group(1)) if m else 0.0


def _parse_temperature_value(text: str) -> Optional[float]:
    m = _TEMP_PATTERN.search(text)
    return float(m.group(0)) if m else None


class CalibrationWorkflow:
    STEP_IMPORT = "import"
    STEP_ENGINEER_REVIEW = "engineer_review"
    STEP_HANDOVER_UPDATE = "handover_update"

    def __init__(self, store: ResultStore):
        self._store = store

    def _apply_conflict_to_reading(
        self,
        reading: TemperatureReading,
        conflict: UnitConflictRecord,
    ) -> None:
        if conflict.action_taken.value in (
            "auto_convert_kelvin_to_celsius",
            "coach_resolved",
        ) and conflict.resolved_unit is not None:
            old_unit = reading.unit.value
            old_value = reading.value
            reading.unit = conflict.resolved_unit
            reading.value = conflict.resolved_value if conflict.resolved_value is not None else reading.value
            reading.manual_changes.append(
                ManualChange(
                    changed_at=_now_iso(),
                    changed_by="system"
                    if conflict.action_taken.value == "auto_convert_kelvin_to_celsius"
                    else "workflow",
                    field_name="temperature_reading.value+unit",
                    old_value=f"{old_value} {old_unit}",
                    new_value=f"{reading.value} {reading.unit.value}",
                    reason=(
                        "按数值合理性自动换算（热像仪量程-40℃~2000℃）"
                        if conflict.action_taken.value == "auto_convert_kelvin_to_celsius"
                        else f"教练拍板：{conflict.coach_review_note or ''}"
                    ),
                )
            )

    def _apply_conflict_to_interval(
        self,
        interval: SamplingInterval,
        conflict: UnitConflictRecord,
    ) -> None:
        if conflict.action_taken.value in (
            "auto_convert_kelvin_to_celsius",
            "coach_resolved",
        ) and conflict.resolved_unit is not None:
            old_unit = interval.unit.value
            interval.unit = conflict.resolved_unit
            interval.manual_changes.append(
                ManualChange(
                    changed_at=_now_iso(),
                    changed_by="system"
                    if conflict.action_taken.value == "auto_convert_kelvin_to_celsius"
                    else "workflow",
                    field_name="sampling_interval.unit",
                    old_value=old_unit,
                    new_value=interval.unit.value,
                    reason=(
                        "按数值合理性自动换算（热像仪量程-40℃~2000℃）"
                        if conflict.action_taken.value == "auto_convert_kelvin_to_celsius"
                        else f"教练拍板：{conflict.coach_review_note or ''}"
                    ),
                )
            )

    def _restore_reading_from_raw(
        self,
        reading: TemperatureReading,
        operator_name: str,
        conflict_line: int,
    ) -> None:
        old_value = reading.value
        old_unit = reading.unit.value
        parsed_val = _parse_temperature_value(reading.raw_text)
        if parsed_val is not None:
            reading.value = parsed_val
        detected = detect_unit(reading.raw_text)
        reading.unit = detected[0]
        reading.manual_changes.append(
            ManualChange(
                changed_at=_now_iso(),
                changed_by=operator_name,
                field_name=f"temperature_reading.value+unit_rollback_line_{conflict_line}",
                old_value=f"{old_value} {old_unit}",
                new_value=f"{reading.value} {reading.unit.value}",
                reason="回滚：恢复原始文本解析的数值和单位，等待教练复核",
            )
        )

    def _restore_interval_from_raw(
        self,
        interval: SamplingInterval,
        operator_name: str,
        conflict_line: int,
    ) -> None:
        old_unit = interval.unit.value
        detected = detect_unit(interval.raw_text)
        interval.unit = detected[0]
        interval.manual_changes.append(
            ManualChange(
                changed_at=_now_iso(),
                changed_by=operator_name,
                field_name=f"sampling_interval.unit_rollback_line_{conflict_line}",
                old_value=old_unit,
                new_value=interval.unit.value,
                reason="回滚：恢复原始文本解析的单位，等待教练复核",
            )
        )

    def step_import(
        self, record_id: str, device_name: str, raw_lines: list
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
                conflict = judge_conflict(i, stripped, detected)
                if (
                    conflict.needs_coach_review
                    or conflict.action_taken.value != "keep_original"
                ):
                    conflicts.append(conflict)
                    self._apply_conflict_to_interval(si, conflict)
                intervals.append(si)
            else:
                val = _parse_temperature_value(stripped)
                tr = TemperatureReading(
                    original_line_number=i,
                    value=val if val is not None else 0.0,
                    unit=detected[0],
                    raw_text=stripped,
                )
                conflict = judge_conflict(i, stripped, detected, val)
                if (
                    conflict.needs_coach_review
                    or conflict.action_taken.value != "keep_original"
                ):
                    conflicts.append(conflict)
                    self._apply_conflict_to_reading(tr, conflict)
                readings.append(tr)

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
                    reason="设备工程师补看温度校准记录备注",
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
            raise ValueError(f"找不到记录: {record_id}")

        if record.status not in (
            RecordStatus.PENDING_COACH_REVIEW,
            RecordStatus.REVIEWED_BY_ENGINEER,
            RecordStatus.ROLLED_BACK,
        ):
            raise ValueError(
                f"当前状态 {record.status.value} 不允许教练复核"
            )

        updated_conflicts: list[UnitConflictRecord] = []
        target_resolved = None
        for uc in record.unit_conflicts:
            if uc.line_number == conflict_line_number and uc.needs_coach_review:
                resolved = coach_resolve_conflict(
                    uc, resolved_value, resolved_unit, coach_note
                )
                target_resolved = resolved
                updated_conflicts.append(resolved)
            else:
                updated_conflicts.append(uc)

        if target_resolved is None:
            raise ValueError(
                f"在行号 {conflict_line_number} 找不到待教练复核的冲突记录"
            )

        record.manual_changes.append(
            ManualChange(
                changed_at=_now_iso(),
                changed_by=coach_name,
                field_name=f"unit_conflict_line_{conflict_line_number}",
                old_value=target_resolved.original_raw,
                new_value=f"{resolved_value} {resolved_unit.value}",
                reason=coach_note,
            )
        )

        for si in record.sampling_intervals:
            if si.original_line_number == conflict_line_number:
                self._apply_conflict_to_interval(si, target_resolved)

        for tr in record.temperature_readings:
            if tr.original_line_number == conflict_line_number:
                self._apply_conflict_to_reading(tr, target_resolved)

        record.unit_conflicts = updated_conflicts
        record.coach_review_at = _now_iso()
        record.coach_review_by = coach_name

        if not record.has_pending_coach_review():
            record.status = RecordStatus.COACH_CONFIRMED
            if record.handover_report_updated:
                record.manual_changes.append(
                    ManualChange(
                        changed_at=_now_iso(),
                        changed_by="workflow",
                        field_name="handover_report_invalidate",
                        old_value="已更新",
                        new_value="待重新更新",
                        reason="教练最新拍板与上一次交接报告版本不同，交接报告需重新更新",
                    )
                )
                record.handover_report_updated = False

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
            raise ValueError(f"找不到记录: {record_id}")

        updated_conflicts: list[UnitConflictRecord] = []
        found = False
        for uc in record.unit_conflicts:
            if uc.line_number == conflict_line_number:
                rolled = rollback_conflict(uc)
                found = True
                updated_conflicts.append(rolled)
            else:
                updated_conflicts.append(uc)

        if not found:
            raise ValueError(
                f"在行号 {conflict_line_number} 找不到冲突记录"
            )

        record.manual_changes.append(
            ManualChange(
                changed_at=_now_iso(),
                changed_by=operator_name,
                field_name=f"unit_conflict_line_{conflict_line_number}_rollback",
                old_value=f"已处理（见manual_changes历史）",
                new_value="rolled_back_to_raw",
                reason="回滚：冲突判定、温度读数、采样间隔、交接报告一并恢复原始版本",
            )
        )

        for si in record.sampling_intervals:
            if si.original_line_number == conflict_line_number:
                self._restore_interval_from_raw(si, operator_name, conflict_line_number)

        for tr in record.temperature_readings:
            if tr.original_line_number == conflict_line_number:
                self._restore_reading_from_raw(tr, operator_name, conflict_line_number)

        if record.handover_report_updated:
            old_updated_by = "最后操作人见 manual_changes"
            record.manual_changes.append(
                ManualChange(
                    changed_at=_now_iso(),
                    changed_by=operator_name,
                    field_name="handover_report_updated",
                    old_value=f"True（{old_updated_by}）",
                    new_value="False",
                    reason="回滚导致交接报告与明细不一致，自动取消报告已更新状态",
                )
            )
            record.handover_report_updated = False

        record.unit_conflicts = updated_conflicts
        record.status = RecordStatus.ROLLED_BACK

        self._store.save(record)
        return record

    def step_handover_update(
        self, record_id: str, operator_name: str
    ) -> CalibrationRecord:
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
                reason=(
                    "交接报告已更新，对应 ResultStore 中 temperature_readings、sampling_intervals、"
                    "unit_conflicts 快照，导出/页面/接口均读取此版本"
                ),
            )
        )

        self._store.save(record)
        return record
