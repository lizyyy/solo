from __future__ import annotations

import csv
import hashlib
import io
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from .models import (
    AuditEntry,
    OVER_THRESHOLD_STATUSES,
    ProcessingStatus,
    ReviewDecision,
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

CSV_COLUMN_ALIASES: Dict[str, List[str]] = {
    "sensor_id": ["传感器编号", "传感器ID", "sensor_id", "sensorId", "id", "编号", "SN", "sn"],
    "original_row": ["原始行号", "行号", "row", "original_row", "originalRow", "序号"],
    "timestamp": ["时间戳", "采集时间", "时间", "timestamp", "time", "datetime", "date"],
    "value": ["值", "数值", "采集值", "测量值", "value", "val", "measurement", "读数", "检测值", "采样值"],
    "unit": ["单位", "unit", "计量单位", "uom"],
    "source": ["来源", "数据源", "source", "来源文件", "导入来源"],
}


def normalize_row(raw: Dict[str, Any]) -> Dict[str, Any]:
    normalized: Dict[str, Any] = {}
    raw_lower: Dict[str, Any] = {}
    for k, v in raw.items():
        raw_lower[str(k).strip().lower()] = (k, v)

    for field_name, aliases in CSV_COLUMN_ALIASES.items():
        found_key = None
        found_value = None
        for alias in aliases:
            alias_lower = alias.strip().lower()
            if alias_lower in raw_lower:
                found_key, found_value = raw_lower[alias_lower]
                break
        if found_key is None and field_name in raw:
            found_value = raw[field_name]
        if found_value is not None:
            normalized[field_name] = found_value

    for k, v in raw.items():
        if k not in CSV_COLUMN_ALIASES and k not in normalized:
            normalized[k] = v

    if "original_row" not in normalized or normalized.get("original_row") in (None, "", 0):
        normalized["original_row"] = normalized.get("__row__", 1)
    try:
        normalized["original_row"] = int(normalized["original_row"])
    except (TypeError, ValueError):
        normalized["original_row"] = int(normalized.get("__row__", 1))

    if "value" in normalized and normalized["value"] is not None and normalized["value"] != "":
        try:
            normalized["value"] = float(normalized["value"])
        except (TypeError, ValueError):
            normalized["value"] = 0.0

    for key in ("sensor_id", "timestamp", "unit", "source"):
        if key in normalized and normalized[key] is not None:
            normalized[key] = str(normalized[key]).strip()

    return normalized


def parse_csv_to_rows(csv_text: str, source_name: str = "") -> List[Dict[str, Any]]:
    reader = csv.DictReader(io.StringIO(csv_text))
    rows: List[Dict[str, Any]] = []
    for idx, raw in enumerate(reader, start=2):
        enriched = dict(raw)
        enriched["__row__"] = idx
        if source_name:
            enriched["source"] = source_name
        rows.append(normalize_row(enriched))
    return rows


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

    def _find_record(self, sensor_id: str, original_row: int) -> Optional[SensorRecord]:
        for r in self.records:
            if r.sensor_id == sensor_id and r.original_row == original_row:
                return r
        return None

    def _find_event(self, sensor_id: str, original_row: int) -> Optional[ThresholdEvent]:
        for e in self.threshold_events:
            if e.sensor_id == sensor_id and e.record_original_row == original_row:
                return e
        return None

    def import_records(
        self,
        rows: List[Dict[str, Any]],
        dedup: bool = True,
        source: str = "",
    ) -> Tuple[List[SensorRecord], List[str]]:
        self._batch_counter += 1
        batch_id = f"batch-{self._batch_counter}"
        imported: List[SensorRecord] = []
        skipped_reasons: List[str] = []

        for idx, raw_row in enumerate(rows):
            row = normalize_row(dict(raw_row))
            if source and "source" not in row:
                row["source"] = source

            sensor_id = str(row.get("sensor_id", ""))
            original_row = int(row.get("original_row", idx + 1))
            timestamp = str(row.get("timestamp", ""))
            value = float(row.get("value", 0))
            unit = str(row.get("unit", ""))
            src = str(row.get("source", source or ""))

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
                source=src,
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

    def import_csv(
        self,
        csv_text: str,
        source_name: str = "",
        dedup: bool = True,
    ) -> Tuple[List[SensorRecord], List[str]]:
        rows = parse_csv_to_rows(csv_text, source_name or "csv_import")
        return self.import_records(rows, dedup=dedup, source=source_name or "csv_import")

    def _check_threshold(self, record: SensorRecord) -> Optional[ThresholdEvent]:
        unit_type = self._infer_unit_type(record.unit)
        threshold = self.thresholds.get(unit_type)
        if threshold is None:
            return None
        if record.value > threshold:
            existing = self._find_event(record.sensor_id, record.original_row)
            if existing is not None:
                return existing
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
            "k": "temperature",
            "kelvin": "temperature",
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
            r
            for r in sensor_records
            if r.status
            in (
                ProcessingStatus.THRESHOLD_EXCEEDED,
                ProcessingStatus.SUPPRESSED_BY_AVERAGE,
                ProcessingStatus.RECALCULATED,
                ProcessingStatus.AWAITING_REVIEW,
            )
        ]

        results: List[Dict[str, Any]] = []
        for rec in over_threshold_records:
            unit_type = self._infer_unit_type(rec.unit)
            threshold = self.thresholds.get(unit_type, 0)
            if threshold == 0:
                continue
            original_over = rec.value > threshold
            if avg_value <= threshold and original_over:
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

                old_record_status = rec.status
                rec.status = ProcessingStatus.SUPPRESSED_BY_AVERAGE

                event = self._find_event(sensor_id, rec.original_row)
                old_event_status = None
                if event is not None:
                    old_event_status = event.status
                    event.status = ProcessingStatus.SUPPRESSED_BY_AVERAGE
                    event.average_value = avg_value
                    event.suppressed_by_avg = True
                    if not event.next_reviewer:
                        event.next_reviewer = "维修师傅"

                self._add_audit(
                    sensor_id,
                    rec.original_row,
                    "status",
                    old_record_status.value,
                    ProcessingStatus.SUPPRESSED_BY_AVERAGE.value,
                    findings["detail"],
                )
                if event is not None:
                    self._add_audit(
                        sensor_id,
                        rec.original_row,
                        "event.suppressed_by_avg",
                        "false" if old_event_status else "未设置",
                        f"true (avg={avg_value:.2f})",
                        "平均值掩盖检测结果写入事件",
                    )
                    self._add_audit(
                        sensor_id,
                        rec.original_row,
                        "next_reviewer",
                        "",
                        event.next_reviewer,
                        "超阈值记录被平均值盖掉，需维修师傅复核",
                    )

                results.append(findings)

        return results

    def run_all_suppression_checks(self) -> List[Dict[str, Any]]:
        all_findings: List[Dict[str, Any]] = []
        sensor_ids = sorted(set(r.sensor_id for r in self.records))
        for sid in sensor_ids:
            all_findings.extend(self.compute_average_suppression_check(sid))
        return all_findings

    def recalculate_after_supplement(
        self,
        supplement_rows: List[Dict[str, Any]],
    ) -> Tuple[List[SensorRecord], List[ThresholdEvent]]:
        imported, skipped = self.import_records(supplement_rows, source="supplement")

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
            event = self._find_event(rec.sensor_id, rec.original_row)
            if event is not None:
                event.status = ProcessingStatus.RECALCULATED
                new_events.append(event)

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
                    ev = self._find_event(sid, existing.original_row)
                    if ev is not None:
                        ev.status = ProcessingStatus.RECALCULATED

        self.run_all_suppression_checks()

        return imported, new_events

    def amend_sensor_value(
        self,
        sensor_id: str,
        original_row: int,
        new_value: float,
        amendment_note: str,
    ) -> bool:
        record = self._find_record(sensor_id, original_row)
        if record is None:
            return False

        old_value = record.value
        record.amended_value = new_value
        record.amendment_note = amendment_note
        record.value = new_value

        self._add_audit(
            sensor_id,
            original_row,
            "value",
            old_value,
            new_value,
            f"何工修正读数，原因为: {amendment_note}",
        )
        self._add_audit(
            sensor_id,
            original_row,
            "amendment_note",
            "",
            amendment_note,
            "设备工程师修正说明",
        )

        event = self._find_event(sensor_id, original_row)
        if event is not None:
            unit_type = self._infer_unit_type(record.unit)
            threshold = self.thresholds.get(unit_type, 0)
            if new_value > threshold:
                event.value = new_value
                event.status = ProcessingStatus.AWAITING_REVIEW
                record.status = ProcessingStatus.AWAITING_REVIEW
            else:
                event.value = new_value
                event.status = ProcessingStatus.AWAITING_REVIEW
                record.status = ProcessingStatus.AWAITING_REVIEW

            self._add_audit(
                sensor_id,
                original_row,
                "status",
                (
                    ProcessingStatus.SUPPRESSED_BY_AVERAGE.value
                    if event.status == ProcessingStatus.AWAITING_REVIEW
                    else record.status.value
                ),
                ProcessingStatus.AWAITING_REVIEW.value,
                "修正后等待维修师傅复核",
            )
            if not event.next_reviewer:
                event.next_reviewer = "维修师傅"

        return True

    def manual_review_decision(
        self,
        sensor_id: str,
        original_row: int,
        final_status: ProcessingStatus,
        original_statement: str,
        amended_reason: str,
        reviewer: str,
        next_reviewer: str = "",
        amended_value: Optional[float] = None,
    ) -> Optional[ReviewDecision]:
        record = self._find_record(sensor_id, original_row)
        event = self._find_event(sensor_id, original_row)
        if record is None:
            return None

        old_status = record.status
        record.status = final_status

        decision = ReviewDecision(
            sensor_id=sensor_id,
            original_row=original_row,
            original_value=record.original_import_value or record.value,
            amended_value=amended_value,
            original_statement=original_statement,
            amended_reason=amended_reason,
            next_reviewer=next_reviewer,
            decided_at=datetime.now().isoformat(),
            decided_by=reviewer,
        )

        if event is not None:
            event.status = final_status
            event.review_note = f"{original_statement} | {amended_reason}"
            event.reviewer = reviewer
            event.next_reviewer = next_reviewer
            event.review_decision = decision

        self._add_audit(
            sensor_id,
            original_row,
            "status",
            old_status.value,
            final_status.value,
            f"人工复核决定: {original_statement} → {amended_reason}",
        )
        self._add_audit(
            sensor_id,
            original_row,
            "reviewer",
            "",
            reviewer,
            "复核人",
        )
        if next_reviewer:
            self._add_audit(
                sensor_id,
                original_row,
                "next_reviewer",
                "",
                next_reviewer,
                "下一步处理人",
            )

        return decision

    def attach_photo(
        self,
        sensor_id: str,
        photo_path: str,
        description: str = "",
        attached_by: str = "",
        original_row: Optional[int] = None,
    ) -> WorkingConditionPhoto:
        photo = WorkingConditionPhoto(
            sensor_id=sensor_id,
            photo_path=photo_path,
            description=description,
            attached_by=attached_by or self.operator,
            attached_to_original_row=original_row,
        )
        self.photos.append(photo)
        row_text = f"第{original_row}行" if original_row else ""
        self._add_audit(
            sensor_id,
            original_row or 0,
            "photo",
            "",
            photo_path,
            f"关联{row_text}工况照片: {description}",
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
        record = self._find_record(sensor_id, original_row)
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

        event = self._find_event(sensor_id, original_row)
        if event is not None:
            event.status = new_status

        return True

    def get_records_by_sensor(self, sensor_id: str) -> List[SensorRecord]:
        return [r for r in self.records if r.sensor_id == sensor_id]

    def get_events_by_sensor(self, sensor_id: str) -> List[ThresholdEvent]:
        return [e for e in self.threshold_events if e.sensor_id == sensor_id]

    def get_photos_by_sensor(self, sensor_id: str) -> List[WorkingConditionPhoto]:
        return [p for p in self.photos if p.sensor_id == sensor_id]

    def get_photos_by_record(self, sensor_id: str, original_row: int) -> List[WorkingConditionPhoto]:
        result: List[WorkingConditionPhoto] = []
        for p in self.photos:
            if p.sensor_id != sensor_id:
                continue
            if p.attached_to_original_row in (original_row, None):
                result.append(p)
        return result

    def get_audit_by_sensor(self, sensor_id: str) -> List[AuditEntry]:
        return [a for a in self.audit_log if a.sensor_id == sensor_id]

    def get_audit_by_record(self, sensor_id: str, original_row: int) -> List[AuditEntry]:
        return [
            a
            for a in self.audit_log
            if a.sensor_id == sensor_id and a.original_row in (original_row, 0)
        ]

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

            is_over = any(e.status in OVER_THRESHOLD_STATUSES for e in events)
            if rec.status in OVER_THRESHOLD_STATUSES:
                is_over = True

            suppressed = any(
                e.status == ProcessingStatus.SUPPRESSED_BY_AVERAGE for e in events
            ) or rec.status == ProcessingStatus.SUPPRESSED_BY_AVERAGE or any(
                e.suppressed_by_avg for e in events
            )

            threshold = events[0].threshold if events else 0
            average_value = events[0].average_value if events else None
            next_reviewer = events[0].next_reviewer if events else ""
            review_decision = events[0].review_decision if events else None

            photos = self.get_photos_by_record(rec.sensor_id, rec.original_row)
            audit_trail = self.get_audit_by_record(rec.sensor_id, rec.original_row)

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
                average_value=average_value,
                original_import_value=rec.original_import_value,
                amended_value=rec.amended_value,
                amendment_note=rec.amendment_note,
                next_reviewer=next_reviewer,
                review_decision=review_decision,
                photos=photos,
                audit_trail=audit_trail,
                unit_conversion=conv_note if conv_note and conv_note.from_unit == rec.unit else None,
            )
            results.append(result)

        return results
