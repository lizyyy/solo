import json
import os
from datetime import datetime
from typing import Dict, List, Optional
from uuid import uuid4

from app.models.models import HandoverRecord, HandoverHistory, ShiftStatus


DATA_FILE = "data/handover_records.json"
HISTORY_FILE = "data/handover_history.json"


def _load_json(file_path: str) -> dict:
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def _save_json(file_path: str, data: dict) -> None:
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)


class HandoverDatabase:
    def __init__(self):
        self.records: Dict[str, HandoverRecord] = {}
        self.history: Dict[str, List[HandoverHistory]] = {}
        self._load_data()

    def _load_data(self):
        records_data = _load_json(DATA_FILE)
        for record_id, record_data in records_data.items():
            if 'created_at' in record_data:
                record_data['created_at'] = datetime.fromisoformat(record_data['created_at'])
            if 'updated_at' in record_data:
                record_data['updated_at'] = datetime.fromisoformat(record_data['updated_at'])
            self.records[record_id] = HandoverRecord(**record_data)

        history_data = _load_json(HISTORY_FILE)
        for handover_id, history_list in history_data.items():
            self.history[handover_id] = []
            for h in history_list:
                if 'changed_at' in h:
                    h['changed_at'] = datetime.fromisoformat(h['changed_at'])
                self.history[handover_id].append(HandoverHistory(**h))

    def _save_data(self):
        records_dict = {rid: r.model_dump() for rid, r in self.records.items()}
        _save_json(DATA_FILE, records_dict)

        history_dict = {hid: [h.model_dump() for h in hl] for hid, hl in self.history.items()}
        _save_json(HISTORY_FILE, history_dict)

    def create_record(self, data: dict) -> HandoverRecord:
        record_id = str(uuid4())[:8]
        now = datetime.now()
        
        record = HandoverRecord(
            id=record_id,
            shift_date=data['shift_date'],
            shift_type=data.get('shift_type', '夜班'),
            on_duty_nurse=data['on_duty_nurse'],
            off_duty_nurse=data['off_duty_nurse'],
            status=ShiftStatus.DRAFT,
            created_at=now,
            updated_at=now,
            baby_count=data.get('baby_count', 0),
            maternal_conditions=data.get('maternal_conditions', []),
            baby_conditions=data.get('baby_conditions', []),
            special_notes=data.get('special_notes', ''),
            equipment_status=data.get('equipment_status', ''),
            emergency_supplies=data.get('emergency_supplies', ''),
            next_shift_tasks=data.get('next_shift_tasks', ''),
            version=1,
            history=[]
        )
        
        self.records[record_id] = record
        self.history[record_id] = []
        self._save_data()
        return record

    def get_record(self, record_id: str) -> Optional[HandoverRecord]:
        return self.records.get(record_id)

    def list_records(self) -> List[HandoverRecord]:
        return sorted(self.records.values(), key=lambda x: x.created_at, reverse=True)

    def _add_history(self, record_id: str, change_type: str, 
                     previous_values: dict, new_values: dict, 
                     changed_by: str, remarks: str = ""):
        history_id = str(uuid4())[:8]
        record = self.records[record_id]
        
        history_entry = HandoverHistory(
            id=history_id,
            handover_id=record_id,
            version=record.version,
            changed_by=changed_by,
            changed_at=datetime.now(),
            change_type=change_type,
            previous_values=previous_values,
            new_values=new_values,
            remarks=remarks
        )
        
        if record_id not in self.history:
            self.history[record_id] = []
        self.history[record_id].append(history_entry)
        
        history_simple = {
            "version": record.version,
            "changed_by": changed_by,
            "changed_at": datetime.now().isoformat(),
            "change_type": change_type,
            "remarks": remarks
        }
        record.history.append(history_simple)

    def update_record(self, record_id: str, data: dict, changed_by: str, 
                     remarks: str = "") -> Optional[HandoverRecord]:
        record = self.records.get(record_id)
        if not record:
            return None

        previous_values = {}
        new_values = {}
        
        for key, value in data.items():
            if key in ['id', 'created_at', 'version', 'history']:
                continue
            if hasattr(record, key):
                old_val = getattr(record, key)
                if old_val != value:
                    previous_values[key] = old_val
                    new_values[key] = value
                    setattr(record, key, value)

        if new_values:
            record.version += 1
            record.updated_at = datetime.now()
            self._add_history(record_id, "更新", previous_values, new_values, changed_by, remarks)
            self._save_data()
        
        return record

    def submit_record(self, record_id: str, submitted_by: str) -> Optional[HandoverRecord]:
        record = self.records.get(record_id)
        if not record:
            return None
        
        previous_values = {"status": record.status}
        record.status = ShiftStatus.SUBMITTED
        record.version += 1
        record.updated_at = datetime.now()
        
        self._add_history(record_id, "提交", previous_values, 
                         {"status": ShiftStatus.SUBMITTED}, submitted_by)
        self._save_data()
        return record

    def withdraw_record(self, record_id: str, withdrawn_by: str, 
                       reason: str) -> Optional[HandoverRecord]:
        record = self.records.get(record_id)
        if not record:
            return None
        
        previous_values = {"status": record.status}
        record.status = ShiftStatus.WITHDRAWN
        record.version += 1
        record.updated_at = datetime.now()
        
        self._add_history(record_id, "撤回", previous_values, 
                         {"status": ShiftStatus.WITHDRAWN}, withdrawn_by, reason)
        self._save_data()
        return record

    def sign_record(self, record_id: str, signer: str, signature: str) -> Optional[HandoverRecord]:
        record = self.records.get(record_id)
        if not record:
            return None
        
        previous_values = {}
        new_values = {}
        
        if signer == record.off_duty_nurse:
            previous_values["off_duty_signature"] = record.off_duty_signature
            record.off_duty_signature = signature
            new_values["off_duty_signature"] = signature
        
        if signer == record.on_duty_nurse:
            previous_values["on_duty_signature"] = record.on_duty_signature
            record.on_duty_signature = signature
            new_values["on_duty_signature"] = signature
        
        if record.off_duty_signature and record.on_duty_signature:
            previous_values["status"] = record.status
            record.status = ShiftStatus.SIGNED
            new_values["status"] = ShiftStatus.SIGNED
        
        record.version += 1
        record.updated_at = datetime.now()
        
        self._add_history(record_id, "签字", previous_values, new_values, signer)
        self._save_data()
        return record

    def flag_manual_process(self, record_id: str, flagged_by: str, 
                           reason: str) -> Optional[HandoverRecord]:
        record = self.records.get(record_id)
        if not record:
            return None
        
        previous_values = {"status": record.status}
        record.status = ShiftStatus.PENDING_MANUAL
        record.version += 1
        record.updated_at = datetime.now()
        
        self._add_history(record_id, "标记人工处理", previous_values, 
                         {"status": ShiftStatus.PENDING_MANUAL}, flagged_by, reason)
        self._save_data()
        return record

    def process_manual(self, record_id: str, processed_by: str, 
                      notes: str, new_status: ShiftStatus) -> Optional[HandoverRecord]:
        record = self.records.get(record_id)
        if not record:
            return None
        
        previous_values = {
            "status": record.status,
            "manual_process_notes": record.manual_process_notes
        }
        
        record.status = new_status
        record.manual_process_notes = notes
        record.version += 1
        record.updated_at = datetime.now()
        
        new_values = {
            "status": new_status,
            "manual_process_notes": notes
        }
        
        self._add_history(record_id, "人工处理完成", previous_values, 
                         new_values, processed_by, notes)
        self._save_data()
        return record

    def get_history(self, record_id: str) -> List[HandoverHistory]:
        return self.history.get(record_id, [])


db = HandoverDatabase()
