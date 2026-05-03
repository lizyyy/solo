import json
import os
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path

from src.models import Sample, Fridge, Rack, HandoverRecord, Alert, DutyNote, SampleType, HandoverStatus, AlertType


class DataStore:
    
    def __init__(self, data_dir: Optional[str] = None):
        if data_dir is None:
            data_dir = os.path.join(str(Path.home()), ".fridge_handover")
        self.data_dir = data_dir
        self._ensure_data_dir()
        
        self.samples: List[Sample] = []
        self.fridges: List[Fridge] = []
        self.racks: List[Rack] = []
        self.handovers: List[HandoverRecord] = []
        self.alerts: List[Alert] = []
        self.duty_notes: List[DutyNote] = []
        self.temperature_records: List[Dict[str, Any]] = []
        
        self._load_all()
    
    def _ensure_data_dir(self):
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)
    
    def _serialize_datetime(self, dt: Any) -> Optional[str]:
        if isinstance(dt, datetime):
            return dt.isoformat()
        return dt
    
    def _deserialize_datetime(self, s: Any) -> Optional[datetime]:
        if isinstance(s, str):
            try:
                return datetime.fromisoformat(s)
            except ValueError:
                return None
        return s
    
    def _sample_to_dict(self, sample: Sample) -> Dict[str, Any]:
        return {
            "sample_id": sample.sample_id,
            "sample_type": sample.sample_type.value,
            "rack_id": sample.rack_id,
            "position": sample.position,
            "scan_time": self._serialize_datetime(sample.scan_time),
            "in_fridge_time": self._serialize_datetime(sample.in_fridge_time),
            "out_fridge_time": self._serialize_datetime(sample.out_fridge_time),
            "status": sample.status,
            "metadata": sample.metadata
        }
    
    def _dict_to_sample(self, data: Dict[str, Any]) -> Sample:
        sample_type = SampleType(data.get("sample_type", "其他"))
        return Sample(
            sample_id=data["sample_id"],
            sample_type=sample_type,
            rack_id=data.get("rack_id", ""),
            position=data.get("position", ""),
            scan_time=self._deserialize_datetime(data.get("scan_time")) or datetime.now(),
            in_fridge_time=self._deserialize_datetime(data.get("in_fridge_time")),
            out_fridge_time=self._deserialize_datetime(data.get("out_fridge_time")),
            status=data.get("status", "在柜"),
            metadata=data.get("metadata", {})
        )
    
    def _fridge_to_dict(self, fridge: Fridge) -> Dict[str, Any]:
        return {
            "fridge_id": fridge.fridge_id,
            "name": fridge.name,
            "min_temp": fridge.min_temp,
            "max_temp": fridge.max_temp,
            "current_temp": fridge.current_temp,
            "last_temp_time": self._serialize_datetime(fridge.last_temp_time),
            "racks": fridge.racks
        }
    
    def _dict_to_fridge(self, data: Dict[str, Any]) -> Fridge:
        return Fridge(
            fridge_id=data["fridge_id"],
            name=data.get("name", data["fridge_id"]),
            min_temp=data.get("min_temp", 2.0),
            max_temp=data.get("max_temp", 8.0),
            current_temp=data.get("current_temp"),
            last_temp_time=self._deserialize_datetime(data.get("last_temp_time")),
            racks=data.get("racks", [])
        )
    
    def _rack_to_dict(self, rack: Rack) -> Dict[str, Any]:
        return {
            "rack_id": rack.rack_id,
            "fridge_id": rack.fridge_id,
            "capacity": rack.capacity,
            "occupied_positions": rack.occupied_positions
        }
    
    def _dict_to_rack(self, data: Dict[str, Any]) -> Rack:
        return Rack(
            rack_id=data["rack_id"],
            fridge_id=data.get("fridge_id", ""),
            capacity=data.get("capacity", 20),
            occupied_positions=data.get("occupied_positions", {})
        )
    
    def _handover_to_dict(self, record: HandoverRecord) -> Dict[str, Any]:
        return {
            "record_id": record.record_id,
            "sample_id": record.sample_id,
            "from_operator": record.from_operator,
            "to_operator": record.to_operator,
            "handover_time": self._serialize_datetime(record.handover_time),
            "status": record.status.value,
            "notes": record.notes,
            "metadata": record.metadata
        }
    
    def _dict_to_handover(self, data: Dict[str, Any]) -> HandoverRecord:
        status = HandoverStatus(data.get("status", "待交接"))
        return HandoverRecord(
            record_id=data["record_id"],
            sample_id=data.get("sample_id", ""),
            from_operator=data.get("from_operator", ""),
            to_operator=data.get("to_operator", ""),
            handover_time=self._deserialize_datetime(data.get("handover_time")) or datetime.now(),
            status=status,
            notes=data.get("notes", ""),
            metadata=data.get("metadata", {})
        )
    
    def _alert_to_dict(self, alert: Alert) -> Dict[str, Any]:
        return {
            "alert_id": alert.alert_id,
            "alert_type": alert.alert_type.value,
            "related_id": alert.related_id,
            "related_type": alert.related_type,
            "message": alert.message,
            "timestamp": self._serialize_datetime(alert.timestamp),
            "is_resolved": alert.is_resolved,
            "resolved_time": self._serialize_datetime(alert.resolved_time),
            "resolver": alert.resolver,
            "notes": alert.notes
        }
    
    def _dict_to_alert(self, data: Dict[str, Any]) -> Alert:
        alert_type = AlertType(data.get("alert_type", "超时离柜"))
        return Alert(
            alert_id=data["alert_id"],
            alert_type=alert_type,
            related_id=data.get("related_id", ""),
            related_type=data.get("related_type", ""),
            message=data.get("message", ""),
            timestamp=self._deserialize_datetime(data.get("timestamp")) or datetime.now(),
            is_resolved=data.get("is_resolved", False),
            resolved_time=self._deserialize_datetime(data.get("resolved_time")),
            resolver=data.get("resolver", ""),
            notes=data.get("notes", "")
        )
    
    def _duty_note_to_dict(self, note: DutyNote) -> Dict[str, Any]:
        return {
            "note_id": note.note_id,
            "shift_date": self._serialize_datetime(note.shift_date),
            "operator_name": note.operator_name,
            "content": note.content,
            "created_time": self._serialize_datetime(note.created_time),
            "updated_time": self._serialize_datetime(note.updated_time),
            "is_important": note.is_important
        }
    
    def _dict_to_duty_note(self, data: Dict[str, Any]) -> DutyNote:
        return DutyNote(
            note_id=data["note_id"],
            shift_date=self._deserialize_datetime(data.get("shift_date")) or datetime.now(),
            operator_name=data.get("operator_name", ""),
            content=data.get("content", ""),
            created_time=self._deserialize_datetime(data.get("created_time")) or datetime.now(),
            updated_time=self._deserialize_datetime(data.get("updated_time")),
            is_important=data.get("is_important", False)
        )
    
    def _get_file_path(self, name: str) -> str:
        return os.path.join(self.data_dir, f"{name}.json")
    
    def _save_list(self, name: str, items: List[Any], converter):
        file_path = self._get_file_path(name)
        data = [converter(item) for item in items]
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def _load_list(self, name: str, converter) -> List[Any]:
        file_path = self._get_file_path(name)
        if not os.path.exists(file_path):
            return []
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return [converter(item) for item in data]
    
    def _save_temp_records(self):
        file_path = self._get_file_path("temperature_records")
        processed = []
        for record in self.temperature_records:
            processed_record = {}
            for k, v in record.items():
                processed_record[k] = self._serialize_datetime(v) if k == "timestamp" else v
            processed.append(processed_record)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(processed, f, ensure_ascii=False, indent=2)
    
    def _load_temp_records(self):
        file_path = self._get_file_path("temperature_records")
        if not os.path.exists(file_path):
            return []
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        processed = []
        for record in data:
            processed_record = {}
            for k, v in record.items():
                processed_record[k] = self._deserialize_datetime(v) if k == "timestamp" else v
            processed.append(processed_record)
        return processed
    
    def _load_all(self):
        self.samples = self._load_list("samples", self._dict_to_sample)
        self.fridges = self._load_list("fridges", self._dict_to_fridge)
        self.racks = self._load_list("racks", self._dict_to_rack)
        self.handovers = self._load_list("handovers", self._dict_to_handover)
        self.alerts = self._load_list("alerts", self._dict_to_alert)
        self.duty_notes = self._load_list("duty_notes", self._dict_to_duty_note)
        self.temperature_records = self._load_temp_records()
    
    def save_all(self):
        self._save_list("samples", self.samples, self._sample_to_dict)
        self._save_list("fridges", self.fridges, self._fridge_to_dict)
        self._save_list("racks", self.racks, self._rack_to_dict)
        self._save_list("handovers", self.handovers, self._handover_to_dict)
        self._save_list("alerts", self.alerts, self._alert_to_dict)
        self._save_list("duty_notes", self.duty_notes, self._duty_note_to_dict)
        self._save_temp_records()
    
    def add_sample(self, sample: Sample) -> bool:
        existing = next((s for s in self.samples if s.sample_id == sample.sample_id), None)
        if existing:
            return False
        self.samples.append(sample)
        return True
    
    def update_sample(self, sample_id: str, **kwargs) -> bool:
        sample = next((s for s in self.samples if s.sample_id == sample_id), None)
        if not sample:
            return False
        for key, value in kwargs.items():
            if hasattr(sample, key):
                setattr(sample, key, value)
        return True
    
    def get_sample(self, sample_id: str) -> Optional[Sample]:
        return next((s for s in self.samples if s.sample_id == sample_id), None)
    
    def add_fridge(self, fridge: Fridge) -> bool:
        existing = next((f for f in self.fridges if f.fridge_id == fridge.fridge_id), None)
        if existing:
            return False
        self.fridges.append(fridge)
        return True
    
    def add_rack(self, rack: Rack) -> bool:
        existing = next((r for r in self.racks if r.rack_id == rack.rack_id), None)
        if existing:
            return False
        self.racks.append(rack)
        return True
    
    def add_handover(self, record: HandoverRecord) -> bool:
        existing = next((h for h in self.handovers if h.record_id == record.record_id), None)
        if existing:
            return False
        self.handovers.append(record)
        return True
    
    def add_alert(self, alert: Alert):
        self.alerts.append(alert)
    
    def add_duty_note(self, note: DutyNote) -> bool:
        existing = next((n for n in self.duty_notes if n.note_id == note.note_id), None)
        if existing:
            return False
        self.duty_notes.append(note)
        return True
    
    def add_temperature_record(self, record: Dict[str, Any]):
        self.temperature_records.append(record)
    
    def get_context(self) -> Dict[str, Any]:
        return {
            "samples": self.samples,
            "fridges": self.fridges,
            "racks": self.racks,
            "handover_records": self.handovers,
            "temperature_records": self.temperature_records,
            "current_time": datetime.now()
        }
    
    def clear_all(self):
        self.samples.clear()
        self.fridges.clear()
        self.racks.clear()
        self.handovers.clear()
        self.alerts.clear()
        self.duty_notes.clear()
        self.temperature_records.clear()
