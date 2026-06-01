import json
import os
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path

from .core import FractalRecord


class RecordStorage:
    def __init__(self, storage_dir: str = None):
        if storage_dir is None:
            storage_dir = os.path.join(os.path.expanduser("~"), ".fractal_generator")
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        
        self.records_file = self.storage_dir / "records.json"
        self.overrides_file = self.storage_dir / "overrides.json"
        self._ensure_files()
    
    def _ensure_files(self):
        if not self.records_file.exists():
            with open(self.records_file, 'w', encoding='utf-8') as f:
                json.dump([], f, ensure_ascii=False, indent=2)
        if not self.overrides_file.exists():
            with open(self.overrides_file, 'w', encoding='utf-8') as f:
                json.dump({}, f, ensure_ascii=False, indent=2)
    
    def save_record(self, record: FractalRecord) -> str:
        records = self._load_all_records()
        
        existing_idx = None
        for i, r in enumerate(records):
            if r['record_id'] == record.record_id:
                existing_idx = i
                break
        
        record_dict = record.to_dict()
        if existing_idx is not None:
            existing = records[existing_idx]
            if existing.get('manual_override') and not record.manual_override:
                record_dict['manual_override'] = True
                record_dict['override_reason'] = existing.get('override_reason')
                record_dict['override_by'] = existing.get('override_by')
                record_dict['override_at'] = existing.get('override_at')
            records[existing_idx] = record_dict
        else:
            records.append(record_dict)
        
        with open(self.records_file, 'w', encoding='utf-8') as f:
            json.dump(records, f, ensure_ascii=False, indent=2)
        
        return record.record_id
    
    def get_record(self, record_id: str) -> Optional[FractalRecord]:
        records = self._load_all_records()
        for r in records:
            if r['record_id'] == record_id:
                return FractalRecord.from_dict(r)
        return None
    
    def get_all_records(self, status_filter: str = None) -> List[FractalRecord]:
        records = self._load_all_records()
        result = []
        for r in records:
            record = FractalRecord.from_dict(r)
            if status_filter is None or record.status.value == status_filter:
                result.append(record)
        return result
    
    def _load_all_records(self) -> List[Dict[str, Any]]:
        try:
            with open(self.records_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []
    
    def save_override(self, case_key: str, override: Dict[str, Any]) -> None:
        overrides = self._load_overrides()
        overrides[case_key] = override
        with open(self.overrides_file, 'w', encoding='utf-8') as f:
            json.dump(overrides, f, ensure_ascii=False, indent=2, default=str)
    
    def get_override(self, case_key: str) -> Optional[Dict[str, Any]]:
        overrides = self._load_overrides()
        return overrides.get(case_key)
    
    def _load_overrides(self) -> Dict[str, Any]:
        try:
            with open(self.overrides_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return {}
    
    def get_summary(self) -> Dict[str, Any]:
        records = self.get_all_records()
        by_status = {}
        by_source = {}
        
        for record in records:
            status = record.status.value
            by_status[status] = by_status.get(status, 0) + 1
            
            source = record.source
            by_source[source] = by_source.get(source, 0) + 1
        
        total_exceptions = sum(
            1 for r in records 
            if len(r.validation_issues) > 0 or r.status != 'success'
        )
        
        return {
            'total_records': len(records),
            'by_status': by_status,
            'by_source': by_source,
            'total_exceptions': total_exceptions,
            'manual_overrides': sum(1 for r in records if r.manual_override)
        }
    
    def export_records(self, filepath: str, status_filter: str = None) -> str:
        records = self.get_all_records(status_filter)
        export_data = {
            'exported_at': datetime.now().isoformat(),
            'filter': status_filter,
            'record_count': len(records),
            'records': [r.to_dict() for r in records]
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)
        
        return filepath
    
    def clear_all(self) -> None:
        with open(self.records_file, 'w', encoding='utf-8') as f:
            json.dump([], f, ensure_ascii=False, indent=2)
