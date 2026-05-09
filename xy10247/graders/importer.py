import csv
import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional

from graders.config import STATE_DIR
from graders.models import Sample


class BatchManager:
    def __init__(self):
        self.state_file = STATE_DIR / "batch_index.json"
        self._load_index()
    
    def _load_index(self):
        if self.state_file.exists():
            with open(self.state_file, 'r', encoding='utf-8') as f:
                self.index = json.load(f)
        else:
            self.index = {}
    
    def _save_index(self):
        with open(self.state_file, 'w', encoding='utf-8') as f:
            json.dump(self.index, f, ensure_ascii=False, indent=2)
    
    def _compute_file_hash(self, file_path: str) -> str:
        with open(file_path, 'rb') as f:
            content = f.read()
        return hashlib.md5(content).hexdigest()
    
    def get_or_create_batch(self, file_path: str) -> str:
        file_hash = self._compute_file_hash(file_path)
        
        for batch_id, info in self.index.items():
            if info.get('file_hash') == file_hash:
                return batch_id
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        batch_id = f"BATCH_{timestamp}"
        
        self.index[batch_id] = {
            'file_path': file_path,
            'file_hash': file_hash,
            'created_at': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            'process_count': 0
        }
        self._save_index()
        
        return batch_id
    
    def get_batch_state(self, batch_id: str) -> Optional[Dict]:
        state_file = STATE_DIR / f"{batch_id}_state.json"
        if state_file.exists():
            with open(state_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return None
    
    def save_batch_state(self, batch_id: str, state: Dict):
        state_file = STATE_DIR / f"{batch_id}_state.json"
        state['updated_at'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        if batch_id in self.index:
            self.index[batch_id]['process_count'] = self.index[batch_id].get('process_count', 0) + 1
            self._save_index()
        
        with open(state_file, 'w', encoding='utf-8') as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
    
    def get_batch_results(self, batch_id: str) -> Optional[Dict]:
        results_file = STATE_DIR / f"{batch_id}_results.json"
        if results_file.exists():
            with open(results_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return None
    
    def save_batch_results(self, batch_id: str, results: Dict):
        results_file = STATE_DIR / f"{batch_id}_results.json"
        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)


class SampleImporter:
    @staticmethod
    def import_from_csv(file_path: str) -> List[Sample]:
        samples = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                sample = Sample(
                    sample_id=row['sample_id'],
                    leaf_area_cm2=float(row['leaf_area_cm2']),
                    lesion_area_cm2=float(row['lesion_area_cm2']),
                    lesion_color=row['lesion_color'],
                    collected_at=row['collected_at'],
                    technician_id=row['technician_id'],
                    field_id=row['field_id'],
                    metadata={}
                )
                samples.append(sample)
        
        return samples
