import os
import json
from typing import List, Optional, Dict
from pathlib import Path
from models import ReleaseRecord, generate_id


class StorageManager:
    def __init__(self, data_dir: str = None):
        if data_dir is None:
            data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.release_notes')
        
        self.data_dir = data_dir
        self.records_dir = os.path.join(data_dir, 'records')
        self.failures_dir = os.path.join(data_dir, 'failures')
        self.index_file = os.path.join(data_dir, 'index.json')
        
        self._ensure_dirs()
        self._ensure_index()
    
    def _ensure_dirs(self):
        os.makedirs(self.records_dir, exist_ok=True)
        os.makedirs(self.failures_dir, exist_ok=True)
    
    def _ensure_index(self):
        if not os.path.exists(self.index_file):
            with open(self.index_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'records': [],
                    'file_summary_index': {}
                }, f, indent=2, ensure_ascii=False)
    
    def _load_index(self) -> Dict:
        with open(self.index_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def _save_index(self, index: Dict):
        with open(self.index_file, 'w', encoding='utf-8') as f:
            json.dump(index, f, indent=2, ensure_ascii=False)
    
    def save_record(self, record: ReleaseRecord) -> str:
        record_path = os.path.join(self.records_dir, f'{record.id}.json')
        
        with open(record_path, 'w', encoding='utf-8') as f:
            json.dump(record.to_dict(), f, indent=2, ensure_ascii=False)
        
        index = self._load_index()
        
        record_exists = False
        for i, r in enumerate(index['records']):
            if r['id'] == record.id:
                index['records'][i] = {
                    'id': record.id,
                    'version': record.version,
                    'release_date': record.release_date,
                    'description': record.description,
                    'overall_status': record.overall_status.value,
                    'material_summary': record.material_summary,
                    'updated_at': record.updated_at
                }
                record_exists = True
                break
        
        if not record_exists:
            index['records'].append({
                'id': record.id,
                'version': record.version,
                'release_date': record.release_date,
                'description': record.description,
                'overall_status': record.overall_status.value,
                'material_summary': record.material_summary,
                'updated_at': record.updated_at
            })
        
        for item in record.items:
            summary = item.file_summary
            if summary not in index['file_summary_index']:
                index['file_summary_index'][summary] = []
            if record.id not in index['file_summary_index'][summary]:
                index['file_summary_index'][summary].append(record.id)
        
        self._save_index(index)
        
        for failure in record.failure_items:
            failure_path = os.path.join(self.failures_dir, f'{failure.id}.json')
            with open(failure_path, 'w', encoding='utf-8') as f:
                json.dump({
                    'id': failure.id,
                    'record_id': record.id,
                    'item_id': failure.item_id,
                    'item_type': failure.item_type,
                    'reason': failure.reason,
                    'details': failure.details,
                    'created_at': failure.created_at,
                    'assignee': failure.assignee
                }, f, indent=2, ensure_ascii=False)
        
        return record.id
    
    def load_record(self, record_id: str) -> Optional[ReleaseRecord]:
        record_path = os.path.join(self.records_dir, f'{record_id}.json')
        
        if not os.path.exists(record_path):
            return None
        
        with open(record_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return ReleaseRecord.from_dict(data)
    
    def list_records(self) -> List[Dict]:
        index = self._load_index()
        return sorted(index['records'], key=lambda x: x['updated_at'], reverse=True)
    
    def search_by_file_summary(self, summary_pattern: str) -> List[str]:
        index = self._load_index()
        matching_records = []
        
        for summary, record_ids in index['file_summary_index'].items():
            if summary_pattern.lower() in summary.lower():
                matching_records.extend(record_ids)
        
        return list(set(matching_records))
    
    def list_all_failures(self) -> List[Dict]:
        failures = []
        
        for filename in os.listdir(self.failures_dir):
            if filename.endswith('.json'):
                failure_path = os.path.join(self.failures_dir, filename)
                with open(failure_path, 'r', encoding='utf-8') as f:
                    failures.append(json.load(f))
        
        return sorted(failures, key=lambda x: x['created_at'], reverse=True)
    
    def get_failures_by_record(self, record_id: str) -> List[Dict]:
        failures = self.list_all_failures()
        return [f for f in failures if f.get('record_id') == record_id]
    
    def delete_record(self, record_id: str) -> bool:
        record_path = os.path.join(self.records_dir, f'{record_id}.json')
        
        if not os.path.exists(record_path):
            return False
        
        record = self.load_record(record_id)
        
        if record:
            for failure in record.failure_items:
                failure_path = os.path.join(self.failures_dir, f'{failure.id}.json')
                if os.path.exists(failure_path):
                    os.remove(failure_path)
        
        os.remove(record_path)
        
        index = self._load_index()
        index['records'] = [r for r in index['records'] if r['id'] != record_id]
        
        for summary in list(index['file_summary_index'].keys()):
            index['file_summary_index'][summary] = [
                rid for rid in index['file_summary_index'][summary] if rid != record_id
            ]
            if not index['file_summary_index'][summary]:
                del index['file_summary_index'][summary]
        
        self._save_index(index)
        
        return True
