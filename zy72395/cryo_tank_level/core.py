import uuid
from datetime import datetime
from typing import List, Optional, Tuple, Dict, Any
from .models import (
    Sensor,
    InspectionNote,
    SafetyThreshold,
    LevelConversionRecord,
    ChangeHistory,
    SensorMapping,
    ReviewStatus,
    WorkflowState,
)
from .storage import JsonStorage
from .errors import CryoTankError, error_message


class CryoTankLevelSystem:
    def __init__(self, storage: JsonStorage = None):
        self.storage = storage or JsonStorage()

    def register_sensor(self, sensor_id: str, physical_location: str, tank_name: str) -> Sensor:
        existing = self.storage.get_sensor(sensor_id)
        if existing:
            return existing
        sensor = Sensor(
            sensor_id=sensor_id,
            physical_location=physical_location,
            tank_name=tank_name,
        )
        self.storage.save_sensor(sensor)
        return sensor

    def _compute_batch_hash(self, notes_data: List[Dict[str, Any]]) -> str:
        sorted_notes = sorted(notes_data, key=lambda x: str(x.get("recorded_at", "")) + str(x.get("sensor_id", "")))
        content = "|".join(
            f"{n.get('sensor_id','')}:{n.get('level_reading','')}:{n.get('recorded_at','')}"
            for n in sorted_notes
        )
        return JsonStorage.compute_content_hash(content)

    def import_inspection_notes(
        self,
        batch_id: str,
        notes_data: List[Dict[str, Any]],
        imported_by: str = "老唐",
    ) -> Tuple[List[InspectionNote], List[LevelConversionRecord], List[SensorMapping]]:
        content_hash = self._compute_batch_hash(notes_data)
        existing_hash = self.storage.get_batch_hash(batch_id)
        if existing_hash and existing_hash == content_hash:
            raise CryoTankError(error_message("DUPLICATE_IMPORT"), code="DUPLICATE_IMPORT")
        if existing_hash and existing_hash != content_hash:
            pass

        notes = []
        records = []
        mappings = []

        for note_data in notes_data:
            note_id = note_data.get("note_id") or str(uuid.uuid4())
            sensor_id = note_data.get("sensor_id", "")
            level_reading = note_data.get("level_reading", 0.0)

            if not sensor_id:
                raise CryoTankError(
                    error_message("MISSING_REQUIRED_FIELD", field_name="传感器编号"),
                    code="MISSING_REQUIRED_FIELD",
                )

            if level_reading < 0 or level_reading > 100:
                raise CryoTankError(
                    error_message("INVALID_LEVEL_VALUE", value=level_reading),
                    code="INVALID_LEVEL_VALUE",
                )

            recorded_at = note_data.get("recorded_at")
            if isinstance(recorded_at, str):
                recorded_at = datetime.fromisoformat(recorded_at)
            elif recorded_at is None:
                recorded_at = datetime.now()

            note = InspectionNote(
                note_id=note_id,
                import_batch_id=batch_id,
                sensor_id=sensor_id,
                level_reading=float(level_reading),
                temperature=note_data.get("temperature"),
                pressure=note_data.get("pressure"),
                handwritten_note=note_data.get("handwritten_note", ""),
                recorded_at=recorded_at,
                imported_by=imported_by,
                content_hash=JsonStorage.compute_content_hash(str(note_data)),
            )
            notes.append(note)
            self.storage.save_inspection_note(note)

            mapping, status = self._detect_sensor_change(sensor_id, note)
            if mapping:
                mappings.append(mapping)

            record = self._create_conversion_record(note, mapping, status)
            records.append(record)

        self.storage.mark_batch_imported(batch_id, content_hash)
        return notes, records, mappings

    def _detect_sensor_change(
        self, sensor_id: str, note: InspectionNote
    ) -> Tuple[Optional[SensorMapping], ReviewStatus]:
        sensor = self.storage.get_sensor(sensor_id)
        if sensor:
            return None, ReviewStatus.NORMAL

        all_sensors = self.storage.get_all_sensors()
        if not all_sensors:
            return None, ReviewStatus.NORMAL

        best_match = None
        best_confidence = 0.0
        evidence = {}

        for existing in all_sensors:
            confidence = 0.0
            match_details = []

            recent_records = self.storage.get_level_records_by_sensor(existing.sensor_id)
            if recent_records:
                recent_record = recent_records[-1]
                level_diff = abs(recent_record.raw_level - note.level_reading)
                if level_diff < 5:
                    confidence += 0.5
                    match_details.append(f"液位值接近(差值{level_diff:.1f})")
                elif level_diff < 10:
                    confidence += 0.3
                    match_details.append(f"液位值相近(差值{level_diff:.1f})")

            if note.temperature is not None and len(recent_records) > 0:
                orig_note = self.storage.get_inspection_note(recent_records[-1].original_note_id)
                if orig_note and orig_note.temperature is not None:
                    temp_diff = abs(orig_note.temperature - note.temperature)
                    if temp_diff < 2:
                        confidence += 0.3
                        match_details.append(f"温度接近(差值{temp_diff:.1f}℃)")

            if confidence > best_confidence:
                best_confidence = confidence
                best_match = existing
                evidence = {"match_details": match_details, "confidence": confidence}

        if best_match and best_confidence >= 0.5:
            existing_mapping = self.storage.get_sensor_mapping(best_match.sensor_id, sensor_id)
            if existing_mapping:
                return existing_mapping, ReviewStatus.PENDING_REVIEW

            mapping = SensorMapping(
                old_sensor_id=best_match.sensor_id,
                new_sensor_id=sensor_id,
                confidence=best_confidence,
                evidence=evidence,
            )
            self.storage.save_sensor_mapping(mapping)
            return mapping, ReviewStatus.PENDING_REVIEW

        return None, ReviewStatus.NORMAL

    def _create_conversion_record(
        self,
        note: InspectionNote,
        mapping: Optional[SensorMapping],
        status: ReviewStatus,
    ) -> LevelConversionRecord:
        sensor = self.storage.get_sensor(note.sensor_id)
        tank_name = sensor.tank_name if sensor else "未知罐区"
        threshold = self.storage.get_threshold_by_tank(tank_name)

        converted_level = note.level_reading
        temp_compensation = 0.0
        if note.temperature is not None:
            temp_compensation = (note.temperature - 20) * 0.01
            converted_level = note.level_reading + temp_compensation
            converted_level = max(0.0, min(100.0, converted_level))

        record = LevelConversionRecord(
            record_id=str(uuid.uuid4()),
            sensor_id=note.sensor_id,
            original_note_id=note.note_id,
            threshold_id=threshold.threshold_id if threshold else "",
            raw_level=note.level_reading,
            converted_level=round(converted_level, 2),
            temperature_compensation=round(temp_compensation, 4),
            status=status,
            workflow_state=WorkflowState.STEP_1_NOTES_IMPORTED,
            sensor_mapping_id=f"{mapping.old_sensor_id}_{mapping.new_sensor_id}" if mapping else None,
        )
        self.storage.save_level_record(record)
        return record

    def update_single_note(
        self,
        note_id: str,
        updates: Dict[str, Any],
        changed_by: str = "老唐",
        change_reason: str = "",
    ) -> Tuple[InspectionNote, List[ChangeHistory]]:
        note = self.storage.get_inspection_note(note_id)
        if not note:
            raise CryoTankError(
                error_message("NOTE_NOT_FOUND", note_id=note_id),
                code="NOTE_NOT_FOUND",
            )

        record = None
        for r in self.storage.get_all_level_records():
            if r.original_note_id == note_id:
                record = r
                break

        if record and record.status == ReviewStatus.PENDING_REVIEW:
            raise CryoTankError(
                error_message("RECORD_UNDER_REVIEW"),
                code="RECORD_UNDER_REVIEW",
            )

        history_entries = []
        note_dict = note.to_dict()

        for field, new_value in updates.items():
            if field in note_dict and note_dict[field] != new_value:
                old_value = note_dict[field]
                history = ChangeHistory(
                    history_id=str(uuid.uuid4()),
                    record_id=note_id,
                    field_name=field,
                    old_value=old_value,
                    new_value=new_value,
                    changed_by=changed_by,
                    change_reason=change_reason,
                )
                self.storage.save_change_history(history)
                history_entries.append(history)
                setattr(note, field, new_value)

        self.storage.save_inspection_note(note)

        if record and "level_reading" in updates:
            converted = updates["level_reading"]
            if note.temperature is not None:
                temp_comp = (note.temperature - 20) * 0.01
                converted = updates["level_reading"] + temp_comp
                converted = max(0.0, min(100.0, converted))
            record.raw_level = updates["level_reading"]
            record.converted_level = round(converted, 2)
            record.updated_at = datetime.now()
            self.storage.save_level_record(record)

            level_history = ChangeHistory(
                history_id=str(uuid.uuid4()),
                record_id=record.record_id,
                field_name="converted_level",
                old_value=record.converted_level,
                new_value=round(converted, 2),
                changed_by=changed_by,
                change_reason=change_reason or "关联备注修改",
            )
            self.storage.save_change_history(level_history)

        return note, history_entries

    def get_change_history(self, record_id: str) -> List[ChangeHistory]:
        history = self.storage.get_history_for_record(record_id)
        if not history:
            note = self.storage.get_inspection_note(record_id)
            if note:
                history = self.storage.get_history_for_record(record_id)
        return history

    def review_sensor_mapping(
        self,
        old_sensor_id: str,
        new_sensor_id: str,
        approved: bool,
        reviewed_by: str = "安全员",
        review_notes: str = "",
    ) -> Optional[SensorMapping]:
        mapping = self.storage.get_sensor_mapping(old_sensor_id, new_sensor_id)
        if not mapping:
            return None

        mapping.review_status = ReviewStatus.REVIEWED if approved else ReviewStatus.REJECTED
        mapping.reviewed_by = reviewed_by
        mapping.reviewed_at = datetime.now()
        self.storage.save_sensor_mapping(mapping)

        if approved:
            old_sensor = self.storage.get_sensor(old_sensor_id)
            if old_sensor:
                old_sensor.is_active = False
                self.storage.save_sensor(old_sensor)

                new_sensor = Sensor(
                    sensor_id=new_sensor_id,
                    physical_location=old_sensor.physical_location,
                    tank_name=old_sensor.tank_name,
                )
                self.storage.save_sensor(new_sensor)

            for record in self.storage.get_level_records_by_sensor(new_sensor_id):
                record.status = ReviewStatus.NORMAL
                record.review_notes = review_notes
                record.updated_at = datetime.now()
                self.storage.save_level_record(record)

        return mapping

    def get_pending_mappings(self) -> List[SensorMapping]:
        return self.storage.get_sensor_mappings_pending()

    def rollback_record(self, record_id: str, reason: str = "") -> Optional[LevelConversionRecord]:
        record = self.storage.get_level_record(record_id)
        if not record:
            return None

        history = self.storage.get_history_for_record(record_id)
        if not history:
            raise CryoTankError(error_message("NO_HISTORY"), code="NO_HISTORY")

        for entry in history:
            if hasattr(entry, "change_reason") and "安全员确认" in str(entry.change_reason):
                raise CryoTankError(error_message("CANNOT_ROLLBACK"), code="CANNOT_ROLLBACK")

        last_change = history[0]
        if last_change.field_name in record.to_dict():
            setattr(record, last_change.field_name, last_change.old_value)

        record.updated_at = datetime.now()
        record.review_notes = f"回滚：{reason}" if reason else "回滚到上一版本"
        self.storage.save_level_record(record)

        rollback_history = ChangeHistory(
            history_id=str(uuid.uuid4()),
            record_id=record_id,
            field_name="rollback",
            old_value=last_change.new_value,
            new_value=last_change.old_value,
            changed_by="系统",
            change_reason=f"回滚操作: {reason}" if reason else "回滚操作",
        )
        self.storage.save_change_history(rollback_history)

        return record

    def get_record_with_context(self, record_id: str) -> Dict[str, Any]:
        record = self.storage.get_level_record(record_id)
        if not record:
            return {}

        note = self.storage.get_inspection_note(record.original_note_id)
        sensor = self.storage.get_sensor(record.sensor_id)
        threshold = None
        if record.threshold_id:
            threshold = self.storage.get_safety_threshold(record.threshold_id)

        mapping = None
        if record.sensor_mapping_id:
            parts = record.sensor_mapping_id.split("_", 1)
            if len(parts) == 2:
                mapping = self.storage.get_sensor_mapping(parts[0], parts[1])

        history = self.get_change_history(record_id)
        note_history = []
        if note:
            note_history = self.storage.get_history_for_record(note.note_id)

        return {
            "record": record,
            "note": note,
            "sensor": sensor,
            "threshold": threshold,
            "mapping": mapping,
            "history": history,
            "note_history": note_history,
        }
