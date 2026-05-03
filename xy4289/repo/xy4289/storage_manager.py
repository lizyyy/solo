import json
import os
from datetime import datetime
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict
from enum import Enum
import config


class ProcessingStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"
    DEFERRED = "deferred"


@dataclass
class AlertProcessingRecord:
    alert_id: str
    machine_id: Optional[str]
    patient_id: Optional[str]
    category: str
    risk_level: str
    description: str
    status: ProcessingStatus
    assigned_to: Optional[str]
    processed_by: Optional[str]
    processed_time: Optional[datetime]
    notes: str
    actions_taken: List[str]
    created_time: datetime
    last_updated: datetime

    def to_dict(self) -> Dict[str, Any]:
        result = asdict(self)
        result['status'] = self.status.value
        if self.processed_time:
            result['processed_time'] = self.processed_time.isoformat()
        result['created_time'] = self.created_time.isoformat()
        result['last_updated'] = self.last_updated.isoformat()
        return result

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AlertProcessingRecord':
        data['status'] = ProcessingStatus(data['status'])
        if data.get('processed_time'):
            data['processed_time'] = datetime.fromisoformat(data['processed_time'])
        data['created_time'] = datetime.fromisoformat(data['created_time'])
        data['last_updated'] = datetime.fromisoformat(data['last_updated'])
        return cls(**data)


class StorageManager:
    def __init__(self):
        self.storage_dir = config.STORAGE_DIR
        self.audit_dir = os.path.join(self.storage_dir, 'audit')
        self.alert_records_file = os.path.join(self.storage_dir, 'alert_records.json')
        self.session_history_file = os.path.join(self.storage_dir, 'session_history.json')
        
        os.makedirs(self.audit_dir, exist_ok=True)
        self._initialize_files()

    def _initialize_files(self):
        if not os.path.exists(self.alert_records_file):
            with open(self.alert_records_file, 'w', encoding='utf-8') as f:
                json.dump({}, f, ensure_ascii=False, indent=2)
        
        if not os.path.exists(self.session_history_file):
            with open(self.session_history_file, 'w', encoding='utf-8') as f:
                json.dump([], f, ensure_ascii=False, indent=2)

    def create_alert_record(self, alert_id: str, alert_data: Dict[str, Any]) -> AlertProcessingRecord:
        now = datetime.now()
        record = AlertProcessingRecord(
            alert_id=alert_id,
            machine_id=alert_data.get('machine_id'),
            patient_id=alert_data.get('patient_id'),
            category=alert_data.get('category', ''),
            risk_level=alert_data.get('risk_level', 'medium'),
            description=alert_data.get('problem', ''),
            status=ProcessingStatus.PENDING,
            assigned_to=None,
            processed_by=None,
            processed_time=None,
            notes='',
            actions_taken=[],
            created_time=now,
            last_updated=now
        )
        
        records = self._load_alert_records()
        records[alert_id] = record.to_dict()
        self._save_alert_records(records)
        
        return record

    def update_alert_status(self, alert_id: str, status: ProcessingStatus, 
                            processed_by: Optional[str] = None,
                            notes: str = '',
                            actions_taken: List[str] = None) -> Optional[AlertProcessingRecord]:
        records = self._load_alert_records()
        
        if alert_id not in records:
            return None
        
        record_dict = records[alert_id]
        record = AlertProcessingRecord.from_dict(record_dict)
        
        record.status = status
        record.last_updated = datetime.now()
        
        if processed_by:
            record.processed_by = processed_by
            record.processed_time = datetime.now()
        
        if notes:
            record.notes = notes
        
        if actions_taken:
            record.actions_taken.extend(actions_taken)
        
        records[alert_id] = record.to_dict()
        self._save_alert_records(records)
        
        self._log_audit(alert_id, 'status_update', {
            'new_status': status.value,
            'processed_by': processed_by,
            'notes': notes
        })
        
        return record

    def get_alert_record(self, alert_id: str) -> Optional[AlertProcessingRecord]:
        records = self._load_alert_records()
        if alert_id in records:
            return AlertProcessingRecord.from_dict(records[alert_id])
        return None

    def get_all_alert_records(self, status_filter: Optional[List[str]] = None) -> List[AlertProcessingRecord]:
        records = self._load_alert_records()
        result = []
        
        for record_dict in records.values():
            record = AlertProcessingRecord.from_dict(record_dict)
            
            if status_filter:
                if record.status.value not in status_filter:
                    continue
            
            result.append(record)
        
        result.sort(key=lambda x: x.created_time, reverse=True)
        return result

    def save_session(self, session_data: Dict[str, Any]) -> str:
        session_id = f"SESSION-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        session_entry = {
            'session_id': session_id,
            'timestamp': datetime.now().isoformat(),
            'data': session_data
        }
        
        history = self._load_session_history()
        history.append(session_entry)
        self._save_session_history(history)
        
        self._log_audit(session_id, 'session_create', {
            'total_alerts': session_data.get('total_alerts', 0),
            'risk_counts': session_data.get('risk_counts', {})
        })
        
        return session_id

    def get_recent_sessions(self, limit: int = 10) -> List[Dict[str, Any]]:
        history = self._load_session_history()
        return history[-limit:][::-1]

    def _load_alert_records(self) -> Dict[str, Any]:
        try:
            with open(self.alert_records_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return {}

    def _save_alert_records(self, records: Dict[str, Any]):
        with open(self.alert_records_file, 'w', encoding='utf-8') as f:
            json.dump(records, f, ensure_ascii=False, indent=2)

    def _load_session_history(self) -> List[Dict[str, Any]]:
        try:
            with open(self.session_history_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []

    def _save_session_history(self, history: List[Dict[str, Any]]):
        with open(self.session_history_file, 'w', encoding='utf-8') as f:
            json.dump(history, f, ensure_ascii=False, indent=2)

    def _log_audit(self, entity_id: str, action: str, details: Dict[str, Any]):
        audit_entry = {
            'timestamp': datetime.now().isoformat(),
            'entity_id': entity_id,
            'action': action,
            'details': details
        }
        
        audit_file = os.path.join(
            self.audit_dir, 
            f"audit_{datetime.now().strftime('%Y%m%d')}.json"
        )
        
        try:
            if os.path.exists(audit_file):
                with open(audit_file, 'r', encoding='utf-8') as f:
                    audits = json.load(f)
            else:
                audits = []
        except:
            audits = []
        
        audits.append(audit_entry)
        
        with open(audit_file, 'w', encoding='utf-8') as f:
            json.dump(audits, f, ensure_ascii=False, indent=2)

    def get_audit_logs(self, date: Optional[str] = None) -> List[Dict[str, Any]]:
        if date is None:
            date = datetime.now().strftime('%Y%m%d')
        
        audit_file = os.path.join(self.audit_dir, f"audit_{date}.json")
        
        if not os.path.exists(audit_file):
            return []
        
        try:
            with open(audit_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return []

    def export_audit_package(self, export_path: str, 
                               start_date: Optional[datetime] = None,
                               end_date: Optional[datetime] = None) -> str:
        package = {
            'export_time': datetime.now().isoformat(),
            'date_range': {
                'start': start_date.isoformat() if start_date else None,
                'end': end_date.isoformat() if end_date else None
            },
            'alert_records': self._load_alert_records(),
            'session_history': self._load_session_history(),
            'audit_logs': {}
        }
        
        for filename in os.listdir(self.audit_dir):
            if filename.startswith('audit_') and filename.endswith('.json'):
                date_str = filename[6:-5]
                file_path = os.path.join(self.audit_dir, filename)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        package['audit_logs'][date_str] = json.load(f)
                except:
                    continue
        
        with open(export_path, 'w', encoding='utf-8') as f:
            json.dump(package, f, ensure_ascii=False, indent=2)
        
        return export_path
