import json
import os
import hashlib
from typing import Dict, List, Optional, Any
from .models import (
    Sensor,
    InspectionNote,
    SafetyThreshold,
    LevelConversionRecord,
    ChangeHistory,
    SensorMapping,
)


class JsonStorage:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        os.makedirs(data_dir, exist_ok=True)
        self._files = {
            "sensors": os.path.join(data_dir, "sensors.json"),
            "inspection_notes": os.path.join(data_dir, "inspection_notes.json"),
            "safety_thresholds": os.path.join(data_dir, "safety_thresholds.json"),
            "level_records": os.path.join(data_dir, "level_records.json"),
            "change_history": os.path.join(data_dir, "change_history.json"),
            "sensor_mappings": os.path.join(data_dir, "sensor_mappings.json"),
            "batch_imports": os.path.join(data_dir, "batch_imports.json"),
        }
        self._init_files()

    def _init_files(self):
        for key, path in self._files.items():
            if not os.path.exists(path):
                with open(path, "w", encoding="utf-8") as f:
                    json.dump({}, f)

    def _load(self, key: str) -> Dict[str, Any]:
        with open(self._files[key], "r", encoding="utf-8") as f:
            return json.load(f)

    def _save(self, key: str, data: Dict[str, Any]):
        with open(self._files[key], "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def save_sensor(self, sensor: Sensor):
        data = self._load("sensors")
        data[sensor.sensor_id] = sensor.to_dict()
        self._save("sensors", data)

    def get_sensor(self, sensor_id: str) -> Optional[Sensor]:
        data = self._load("sensors")
        if sensor_id in data:
            return Sensor.from_dict(data[sensor_id])
        return None

    def get_all_sensors(self) -> List[Sensor]:
        data = self._load("sensors")
        return [Sensor.from_dict(v) for v in data.values()]

    def save_inspection_note(self, note: InspectionNote):
        data = self._load("inspection_notes")
        data[note.note_id] = note.to_dict()
        self._save("inspection_notes", data)

    def get_inspection_note(self, note_id: str) -> Optional[InspectionNote]:
        data = self._load("inspection_notes")
        if note_id in data:
            return InspectionNote.from_dict(data[note_id])
        return None

    def get_notes_by_batch(self, batch_id: str) -> List[InspectionNote]:
        data = self._load("inspection_notes")
        return [
            InspectionNote.from_dict(v)
            for v in data.values()
            if v["import_batch_id"] == batch_id
        ]

    def find_note_in_batch(self, batch_id: str, sensor_id: str, recorded_at: str) -> Optional[InspectionNote]:
        data = self._load("inspection_notes")
        for v in data.values():
            if v["import_batch_id"] == batch_id and v["sensor_id"] == sensor_id:
                note_ra = v.get("recorded_at", "")
                if note_ra == recorded_at:
                    return InspectionNote.from_dict(v)
        return None

    def find_record_by_note_id(self, note_id: str) -> Optional[LevelConversionRecord]:
        data = self._load("level_records")
        for v in data.values():
            if v["original_note_id"] == note_id:
                return LevelConversionRecord.from_dict(v)
        return None

    def delete_level_record(self, record_id: str):
        data = self._load("level_records")
        data.pop(record_id, None)
        self._save("level_records", data)

    def delete_inspection_note(self, note_id: str):
        data = self._load("inspection_notes")
        data.pop(note_id, None)
        self._save("inspection_notes", data)

    def is_batch_imported(self, batch_id: str) -> bool:
        data = self._load("batch_imports")
        return batch_id in data

    def mark_batch_imported(self, batch_id: str, content_hash: str):
        data = self._load("batch_imports")
        data[batch_id] = {
            "content_hash": content_hash,
            "imported_at": __import__("datetime").datetime.now().isoformat(),
        }
        self._save("batch_imports", data)

    def get_batch_hash(self, batch_id: str) -> Optional[str]:
        data = self._load("batch_imports")
        if batch_id in data:
            return data[batch_id]["content_hash"]
        return None

    def save_safety_threshold(self, threshold: SafetyThreshold):
        data = self._load("safety_thresholds")
        data[threshold.threshold_id] = threshold.to_dict()
        self._save("safety_thresholds", data)

    def get_safety_threshold(self, threshold_id: str) -> Optional[SafetyThreshold]:
        data = self._load("safety_thresholds")
        if threshold_id in data:
            return SafetyThreshold.from_dict(data[threshold_id])
        return None

    def get_threshold_by_tank(self, tank_name: str) -> Optional[SafetyThreshold]:
        data = self._load("safety_thresholds")
        for v in data.values():
            if v["tank_name"] == tank_name and v["is_active"]:
                return SafetyThreshold.from_dict(v)
        return None

    def save_level_record(self, record: LevelConversionRecord):
        data = self._load("level_records")
        data[record.record_id] = record.to_dict()
        self._save("level_records", data)

    def get_level_record(self, record_id: str) -> Optional[LevelConversionRecord]:
        data = self._load("level_records")
        if record_id in data:
            return LevelConversionRecord.from_dict(data[record_id])
        return None

    def get_level_records_by_sensor(self, sensor_id: str) -> List[LevelConversionRecord]:
        data = self._load("level_records")
        return [
            LevelConversionRecord.from_dict(v)
            for v in data.values()
            if v["sensor_id"] == sensor_id
        ]

    def get_all_level_records(self) -> List[LevelConversionRecord]:
        data = self._load("level_records")
        return [LevelConversionRecord.from_dict(v) for v in data.values()]

    def save_change_history(self, history: ChangeHistory):
        data = self._load("change_history")
        data[history.history_id] = history.to_dict()
        self._save("change_history", data)

    def get_history_for_record(self, record_id: str) -> List[ChangeHistory]:
        data = self._load("change_history")
        items = [
            ChangeHistory.from_dict(v)
            for v in data.values()
            if v["record_id"] == record_id
        ]
        items.sort(key=lambda x: x.changed_at, reverse=True)
        return items

    def save_sensor_mapping(self, mapping: SensorMapping):
        data = self._load("sensor_mappings")
        mapping_id = f"{mapping.old_sensor_id}_{mapping.new_sensor_id}"
        data[mapping_id] = mapping.to_dict()
        self._save("sensor_mappings", data)

    def get_sensor_mappings_pending(self) -> List[SensorMapping]:
        data = self._load("sensor_mappings")
        from .models import ReviewStatus
        return [
            SensorMapping.from_dict(v)
            for v in data.values()
            if v["review_status"] == ReviewStatus.PENDING_REVIEW
        ]

    def get_sensor_mapping(self, old_id: str, new_id: str) -> Optional[SensorMapping]:
        data = self._load("sensor_mappings")
        mapping_id = f"{old_id}_{new_id}"
        if mapping_id in data:
            return SensorMapping.from_dict(data[mapping_id])
        return None

    @staticmethod
    def compute_content_hash(content: str) -> str:
        return hashlib.sha256(content.encode("utf-8")).hexdigest()
