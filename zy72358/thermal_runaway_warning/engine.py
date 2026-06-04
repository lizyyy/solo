from __future__ import annotations

import hashlib
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from .models import (
    AuditEntry,
    ProcessingStatus,
    SensorRecord,
    ThresholdEvent,
    UnitConversionNote,
    WarningResult,
    WorkingConditionPhoto,
)

DEFAULT_THRESHOLDS: Dict[str, float] = {
    "temperature": 60.0,
    "voltage": 4.25,
    "current": 150.0,
    "smoke_density": 0.5,
}


class ThermalRunawayEngine:
    def __init__(
        self,
        thresholds: Optional[Dict[str, float]] = None,
        operator: str = "system",
    ):
        self.thresholds = thresholds or dict(DEFAULT_THRESHOLDS)
        self.operator = operator
        self.records: List[SensorRecord] = []
        self.threshold_events: List[ThresholdEvent] = []
        self.audit_log: List[AuditEntry] = []
        self.photos: List[WorkingConditionPhoto] = []
        self.unit_notes: List[UnitConversionNote] = []
        self._imported_hashes: Dict[str, str] = {}
        self._batch_counter: int = 0

    def _record_hash(self, sensor_id: str, original_row: int, timestamp: str, value: float) -> str:
        raw = f"{sensor_id}|{original_row}|{timestamp}|{value}"
        return hashlib.sha256(raw.encode()).hexdigest()

    def _add_audit(
        self,
        sensor_id: str,
        original_row: int,
        field_changed: str,
        old_value: Any,
        new_value: Any,
        reason: str = "",
    ) -> AuditEntry:
        entry = AuditEntry(
            timestamp=datetime.now().isoformat(),
            sensor_id=sensor_id,
            original_row=original_row,
            field_changed=field_changed,
            old_value=old_value,
            new_value=new_value,
            changed_by=self.operator,
            reason=reason,
        )
        self.audit_log.append(entry)
        return entry

    def import_records(
        self,
        rows: List[Dict[str, Any]],
        dedup: bool = True,
    ) -> Tuple[List[SensorRecord], List[str]]:
        self._batch_counter += 1
        batch_id = f"batch-{self._batch_counter}"
        imported: List[SensorRecord] = []
        skipped_reasons: List[str] = []

        for row in rows:
            sensor_id = str(row.get("sensor_id", ""))
            original_row = int(row.get("original_row", 0))
            timestamp = str(row.get("timestamp", ""))
            value = float(row.get("value", 0))
            unit = str(row.get("unit", ""))

            rec_hash = self._record_hash(sensor_id, original_row, timestamp, value)

            if dedup and rec_hash in self._imported_hashes:
                reason = (
                    f"传感器{sensor_id}第{original_row}行重复导入(值={value})，已跳过"
                )
                skipped_reasons.append(reason)
                self._add_audit(
                    sensor_id, original_row, "import", rec_hash, "skipped_duplicate", reason
                )
                continue

            record = SensorRecord(
                sensor_id=sensor_id,
                original_row=original_row,
                timestamp=timestamp,
                value=value,
                unit=unit,
                batch_id=batch_id,
            )

            over_threshold = self._check_threshold(record)
            if over_threshold:
                record.status = ProcessingStatus.THRESHOLD_EXCEEDED
                self._add_audit(
                    sensor_id,
                    original_row,
                    "status",
                    ProcessingStatus.PENDING.value,
                    ProcessingStatus.THRESHOLD_EXCEEDED.value,
                    f"值{value}超过阈值{over_threshold.threshold}",
                )
            else:
                record.status = ProcessingStatus.PENDING

            self.records.append(record)
            self._imported_hashes[rec_hash] = batch_id
            imported.append(record)

        return imported, skipped_reasons

    def _check_threshold(self, record: SensorRecord) -> Optional[ThresholdEvent]:
        unit_type = self._infer_unit_type(record.unit)
        threshold = self.thresholds.get(unit_type)
        if threshold is None:
            return None
        if record.value > threshold:
            event = ThresholdEvent(
                sensor_id=record.sensor_id,
                record_original_row=record.original_row,
                value=record.value,
                threshold=threshold,
                event_type=unit_type,
                status=ProcessingStatus.THRESHOLD_EXCEEDED,
            )
            self.threshold_events.append(event)
            return event
        return None

    def _infer_unit_type(self, unit: str) -> str:
        unit_lower = unit.lower().strip()
        mapping = {
            "°c": "temperature",
            "c": "temperature",
            "℃": "temperature",
            "v": "voltage",
            "mv": "voltage",
            "a": "current",
            "ma": "current",
            "%": "smoke_density",
            "mg/m3": "smoke_density",
            "ppm": "smoke_density",
        }
        return mapping.get(unit_lower, "")

    def compute_average_suppression_check(
        self, sensor_id: str
    ) -> List[Dict[str, Any]]:
        sensor_records = [r for r in self.records if r.sensor_id == sensor_id]
        if not sensor_records:
            return []

        avg_value = sum(r.value for r in sensor_records) / len(sensor_records)
        over_threshold_records = [
            r for r in sensor_records if r.status == ProcessingStatus.THRESHOLD_EXCEEDED
        ]

        results: List[Dict[str, Any]] = []
        for rec in over_threshold_records:
            unit_type = self._infer_unit_type(rec.unit)
            threshold = self.thresholds.get(unit_type, 0)
            if avg_value <= threshold:
                findings = {
                    "sensor_id": sensor_id,
                    "original_row": rec.original_row,
                    "raw_value": rec.value,
                    "average_value": avg_value,
                    "threshold": threshold,
                    "issue": "超阈值记录被平均值盖掉",
                    "action_required": True,
                    "detail": (
                        f"传感器{sensor_id}第{rec.original_row}行原始值{rec.value}超阈值{threshold}，"
                        f"但平均值{avg_value:.2f}低于阈值，原始超阈值记录不应被平均值掩盖"
                    ),
                }
                self._add_audit(
                    sensor_id,
                    rec.original_row,
                    "suppression_check",
                    "未检测",
                    "超阈值记录被平均值盖掉",
                    findings["detail"],
                )
                results.append(findings)

        return results

    def recalculate_after_supplement(
        self,
        supplement_rows: List[Dict[str, Any]],
    ) -> Tuple[List[SensorRecord], List[ThresholdEvent]]:
        imported, skipped = self.import_records(supplement_rows)

        new_events: List[ThresholdEvent] = []
        affected_sensors = set()

        for rec in imported:
            affected_sensors.add(rec.sensor_id)
            old_status = rec.status
            rec.status = ProcessingStatus.RECALCULATED
            self._add_audit(
                rec.sensor_id,
                rec.original_row,
                "status",
                old_status.value,
                ProcessingStatus.RECALCULATED.value,
                "补录后重新计算",
            )
            if old_status == ProcessingStatus.THRESHOLD_EXCEEDED:
                matching_events = [
                    e
                    for e in self.threshold_events
                    if e.sensor_id == rec.sensor_id
                    and e.record_original_row == rec.original_row
                ]
                new_events.extend(matching_events)

        for sid in affected_sensors:
            for existing in self.records:
                if existing.sensor_id == sid and existing.status not in (
                    ProcessingStatus.RECALCULATED,
                    ProcessingStatus.CONFIRMED_ABNORMAL,
                    ProcessingStatus.CONFIRMED_NORMAL,
                ):
                    old_st = existing.status
                    existing.status = ProcessingStatus.RECALCULATED
                    self._add_audit(
                        sid,
                        existing.original_row,
                        "status",
                        old_st.value,
                        ProcessingStatus.RECALCULATED.value,
                        "因补录数据触发重算",
                    )

        for sensor_id in affected_sensors:
            self.compute_average_suppression_check(sensor_id)

        return imported, new_events

    def attach_photo(
        self,
        sensor_id: str,
        photo_path: str,
        description: str = "",
        attached_by: str = "",
    ) -> WorkingConditionPhoto:
        photo = WorkingConditionPhoto(
            sensor_id=sensor_id,
            photo_path=photo_path,
            description=description,
            attached_by=attached_by or self.operator,
        )
        self.photos.append(photo)
        self._add_audit(
            sensor_id,
            0,
            "photo",
            "",
            photo_path,
            f"关联工况照片: {description}",
        )
        return photo

    def update_unit_conversion(
        self,
        from_unit: str,
        to_unit: str,
        factor: float,
        description: str = "",
        updated_by: str = "",
    ) -> UnitConversionNote:
        note = UnitConversionNote(
            from_unit=from_unit,
            to_unit=to_unit,
            factor=factor,
            description=description,
            updated_by=updated_by or self.operator,
        )
        self.unit_notes.append(note)
        self._add_audit(
            "",
            0,
            "unit_conversion",
            from_unit,
            to_unit,
            f"单位换算: {from_unit}->{to_unit}, 系数={factor}, {description}",
        )
        return note

    def manual_status_change(
        self,
        sensor_id: str,
        original_row: int,
        new_status: ProcessingStatus,
        reason: str = "",
    ) -> bool:
        record = None
        for r in self.records:
            if r.sensor_id == sensor_id and r.original_row == original_row:
                record = r
                break
        if record is None:
            return False

        old_status = record.status
        record.status = new_status
        self._add_audit(
            sensor_id,
            original_row,
            "status",
            old_status.value,
            new_status.value,
            reason,
        )

        for event in self.threshold_events:
            if event.sensor_id == sensor_id and event.record_original_row == original_row:
                event.status = new_status

        return True

    def get_records_by_sensor(self, sensor_id: str) -> List[SensorRecord]:
        return [r for r in self.records if r.sensor_id == sensor_id]

    def get_events_by_sensor(self, sensor_id: str) -> List[ThresholdEvent]:
        return [e for e in self.threshold_events if e.sensor_id == sensor_id]

    def get_photos_by_sensor(self, sensor_id: str) -> List[WorkingConditionPhoto]:
        return [p for p in self.photos if p.sensor_id == sensor_id]

    def get_audit_by_sensor(self, sensor_id: str) -> List[AuditEntry]:
        return [a for a in self.audit_log if a.sensor_id == sensor_id]

    def get_unit_conversions(self) -> List[UnitConversionNote]:
        return list(self.unit_notes)

    def build_warning_results(self) -> List[WarningResult]:
        results: List[WarningResult] = []
        conversion_map = {n.from_unit: n for n in self.unit_notes}

        for rec in self.records:
            events = [
                e
                for e in self.threshold_events
                if e.sensor_id == rec.sensor_id
                and e.record_original_row == rec.original_row
            ]
            is_over = any(
                e.status
                in (
                    ProcessingStatus.THRESHOLD_EXCEEDED,
                    ProcessingStatus.AWAITING_REVIEW,
                    ProcessingStatus.CONFIRMED_ABNORMAL,
                )
                for e in events
            )
            suppressed = any(
                e.status == ProcessingStatus.SUPPRESSED_BY_AVERAGE for e in events
            )
            threshold = events[0].threshold if events else 0

            photos = self.get_photos_by_sensor(rec.sensor_id)
            audit_trail = self.get_audit_by_sensor(rec.sensor_id)

            conv_note = conversion_map.get(rec.unit)
            display_value = rec.value
            if conv_note:
                display_value = rec.value * conv_note.factor

            result = WarningResult(
                sensor_id=rec.sensor_id,
                original_row=rec.original_row,
                timestamp=rec.timestamp,
                raw_value=rec.value,
                display_value=display_value,
                unit=rec.unit,
                threshold=threshold,
                status=rec.status,
                is_over_threshold=is_over,
                suppressed_by_average=suppressed,
                photos=photos,
                audit_trail=audit_trail,
                unit_conversion=conv_note if conv_note and conv_note.from_unit == rec.unit else None,
            )
            results.append(result)

        return results
