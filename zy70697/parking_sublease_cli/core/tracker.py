import hashlib
import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

from .models import SubleaseRecord, BadRecord, SourceInfo


class SourceTracker:
    def __init__(self, cache_dir: Optional[str] = None):
        if cache_dir:
            self.cache_dir = Path(cache_dir)
        else:
            self.cache_dir = Path.home() / ".parking_sublease" / "cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.processed_files: Dict[str, Dict] = {}
        self.change_log: List[Dict] = []
    
    def _get_file_hash(self, file_path: str) -> str:
        hasher = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                hasher.update(chunk)
        return hasher.hexdigest()
    
    def _get_record_hash(self, record: SubleaseRecord) -> str:
        record_dict = {
            "record_id": record.record_id,
            "space_id": record.space_id,
            "owner_id": record.owner_id,
            "tenant_id": record.tenant_id,
            "start_date": record.start_date.strftime("%Y-%m-%d"),
            "end_date": record.end_date.strftime("%Y-%m-%d"),
            "monthly_fee": record.monthly_fee
        }
        json_str = json.dumps(record_dict, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(json_str.encode('utf-8')).hexdigest()
    
    def track_file(self, file_path: str) -> Dict[str, Any]:
        abs_path = os.path.abspath(file_path)
        file_hash = self._get_file_hash(abs_path)
        file_stat = os.stat(abs_path)
        
        file_info = {
            "file_path": abs_path,
            "file_hash": file_hash,
            "file_size": file_stat.st_size,
            "modified_time": datetime.fromtimestamp(file_stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
            "processed_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        self.processed_files[abs_path] = file_info
        return file_info
    
    def compare_with_previous(self, records: List[SubleaseRecord], 
                               bad_records: List[BadRecord],
                               file_path: str) -> Dict[str, Any]:
        cache_file = self.cache_dir / f"{os.path.basename(file_path)}.json"
        
        if not cache_file.exists():
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump({
                    "records": [r.to_dict() for r in records],
                    "bad_records": [b.to_dict() for b in bad_records],
                    "record_ids": [r.record_id for r in records]
                }, f, ensure_ascii=False, indent=2)
            return {
                "is_first_run": True,
                "added": len(records),
                "removed": 0,
                "modified": 0,
                "unchanged": len(records)
            }
        
        with open(cache_file, 'r', encoding='utf-8') as f:
            previous_data = json.load(f)
        
        previous_ids = set(previous_data.get("record_ids", []))
        current_ids = set(r.record_id for r in records)
        
        added_ids = current_ids - previous_ids
        removed_ids = previous_ids - current_ids
        common_ids = current_ids & previous_ids
        
        modified_count = 0
        unchanged_count = 0
        
        previous_record_map = {r["record_id"]: r for r in previous_data.get("records", [])}
        
        for record in records:
            if record.record_id in common_ids:
                prev_record = previous_record_map.get(record.record_id)
                if prev_record:
                    prev_hash = hashlib.sha256(
                        json.dumps({
                            "record_id": prev_record["record_id"],
                            "space_id": prev_record["space_id"],
                            "owner_id": prev_record["owner_id"],
                            "tenant_id": prev_record["tenant_id"],
                            "start_date": prev_record["start_date"],
                            "end_date": prev_record["end_date"],
                            "monthly_fee": prev_record["monthly_fee"]
                        }, sort_keys=True, ensure_ascii=False).encode('utf-8')
                    ).hexdigest()
                    
                    curr_hash = self._get_record_hash(record)
                    
                    if prev_hash != curr_hash:
                        modified_count += 1
                        self.change_log.append({
                            "record_id": record.record_id,
                            "change_type": "modified",
                            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        })
                    else:
                        unchanged_count += 1
        
        for record_id in added_ids:
            self.change_log.append({
                "record_id": record_id,
                "change_type": "added",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })
        
        for record_id in removed_ids:
            self.change_log.append({
                "record_id": record_id,
                "change_type": "removed",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })
        
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump({
                "records": [r.to_dict() for r in records],
                "bad_records": [b.to_dict() for b in bad_records],
                "record_ids": [r.record_id for r in records]
            }, f, ensure_ascii=False, indent=2)
        
        return {
            "is_first_run": False,
            "added": len(added_ids),
            "removed": len(removed_ids),
            "modified": modified_count,
            "unchanged": unchanged_count,
            "change_log": self.change_log
        }
    
    def get_source_summary(self, records: List[SubleaseRecord], 
                           bad_records: List[BadRecord]) -> Dict[str, Any]:
        source_files = {}
        for record in records:
            file_path = record.source.file_path
            if file_path not in source_files:
                source_files[file_path] = {
                    "sheet_names": set(),
                    "valid_records": 0,
                    "invalid_records": 0
                }
            if record.source.sheet_name:
                source_files[file_path]["sheet_names"].add(record.source.sheet_name)
            source_files[file_path]["valid_records"] += 1
        
        for bad in bad_records:
            file_path = bad.file_path
            if file_path not in source_files:
                source_files[file_path] = {
                    "sheet_names": set(),
                    "valid_records": 0,
                    "invalid_records": 0
                }
            if bad.sheet_name:
                source_files[file_path]["sheet_names"].add(bad.sheet_name)
            source_files[file_path]["invalid_records"] += 1
        
        for file_path in source_files:
            source_files[file_path]["sheet_names"] = list(source_files[file_path]["sheet_names"])
        
        return {
            "total_files": len(source_files),
            "source_files": source_files,
            "total_valid_records": len(records),
            "total_invalid_records": len(bad_records),
            "total_records": len(records) + len(bad_records)
        }
    
    def get_record_source(self, record_id: str, records: List[SubleaseRecord]) -> Optional[SourceInfo]:
        for record in records:
            if record.record_id == record_id:
                return record.source
        return None
    
    def export_source_trail(self, records: List[SubleaseRecord], 
                            bad_records: List[BadRecord],
                            output_path: str) -> None:
        source_trail = {
            "export_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "processed_files": self.processed_files,
            "source_summary": self.get_source_summary(records, bad_records),
            "record_sources": [
                {
                    "record_id": r.record_id,
                    "source": r.source.to_dict()
                }
                for r in records
            ],
            "bad_records": [b.to_dict() for b in bad_records]
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(source_trail, f, ensure_ascii=False, indent=2)
