import json
import os
import hashlib
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Any
from dataclasses import asdict

from .models import Record, RecordStatus
from .processor import RecordProcessor


class BatchEngine:
    def __init__(self, data_dir: str = "./data", checkpoint_file: str = None):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        self.checkpoint_file = Path(checkpoint_file) if checkpoint_file else \
            self.data_dir / ".checkpoint.json"
        self.checkpoint: Dict[str, Any] = self._load_checkpoint()
        
        self.processor = RecordProcessor()
        self._load_saved_records()

    def _load_checkpoint(self) -> Dict[str, Any]:
        if self.checkpoint_file.exists():
            try:
                with open(self.checkpoint_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except (json.JSONDecodeError, IOError):
                pass
        return {
            "processed_files": {},
            "last_run": None,
            "record_count": 0,
            "run_hash": None
        }

    def _save_checkpoint(self):
        self.checkpoint["last_run"] = datetime.now().isoformat()
        self.checkpoint["record_count"] = len(self.processor.records)
        self.checkpoint["run_hash"] = self._generate_run_hash()
        
        with open(self.checkpoint_file, 'w', encoding='utf-8') as f:
            json.dump(self.checkpoint, f, indent=2, ensure_ascii=False)

    def _generate_run_hash(self) -> str:
        record_hashes = sorted(
            [f"{r.id}:{r.content_hash()}:{r.status.value}" 
             for r in self.processor.records.values()]
        )
        content = "|".join(record_hashes)
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def _get_records_file(self) -> Path:
        return self.data_dir / "records.json"

    def _load_saved_records(self):
        records_file = self._get_records_file()
        if records_file.exists():
            try:
                with open(records_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                records = [Record.from_dict(r) for r in data]
                self.processor.load_records(records)
            except (json.JSONDecodeError, IOError):
                pass

    def _save_records(self):
        records_file = self._get_records_file()
        data = [r.to_dict() for r in self.processor.get_all_records()]
        with open(records_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def _file_hash(self, file_path: Path) -> str:
        stat = file_path.stat()
        hash_input = f"{file_path}|{stat.st_size}|{stat.st_mtime}"
        return hashlib.md5(hash_input.encode()).hexdigest()

    def _parse_json_file(self, file_path: Path) -> List[Dict]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if isinstance(data, list):
            return data
        elif isinstance(data, dict):
            return [data]
        return []

    def process_directory(self, directory: str, 
                          file_pattern: str = "*.json",
                          actor: str = "batch_system") -> Dict[str, Any]:
        dir_path = Path(directory)
        if not dir_path.exists():
            return {"error": f"目录不存在: {directory}"}

        files = sorted(dir_path.glob(file_pattern))
        results = {
            "total_files": len(files),
            "processed_files": 0,
            "skipped_files": 0,
            "new_records": 0,
            "updated_records": 0,
            "errors": []
        }

        for file_path in files:
            file_key = str(file_path.absolute())
            file_hash = self._file_hash(file_path)
            
            if (file_key in self.checkpoint["processed_files"] and
                    self.checkpoint["processed_files"][file_key] == file_hash):
                results["skipped_files"] += 1
                continue

            try:
                record_dicts = self._parse_json_file(file_path)
                for rd in record_dicts:
                    record = Record.from_dict(rd)
                    existing = self.processor.get_record_by_id(record.id)
                    
                    processed = self.processor.process_new_record(record, actor)
                    
                    if existing is None:
                        results["new_records"] += 1
                    elif existing.content_hash() != processed.content_hash():
                        results["updated_records"] += 1

                self.checkpoint["processed_files"][file_key] = file_hash
                results["processed_files"] += 1

            except Exception as e:
                results["errors"].append({
                    "file": str(file_path),
                    "error": str(e)
                })

        self._post_process(actor)
        self._save_records()
        self._save_checkpoint()

        return results

    def _post_process(self, actor: str):
        self.processor.mark_duplicates(actor)
        self.processor.mark_late_arrivals(actor=actor)
        
        for record in self.processor.get_all_records():
            if record.status == RecordStatus.PENDING:
                self.processor.classify_record(record, actor)

    def run_pipeline(self, input_dir: str, 
                     actor: str = "batch_system") -> Dict[str, Any]:
        current_hash = self._generate_run_hash() if self.processor.records else None
        
        results = self.process_directory(input_dir, actor=actor)
        
        new_hash = self._generate_run_hash()
        results["run_hash_changed"] = (current_hash != new_hash) if current_hash else True
        results["final_hash"] = new_hash
        results["total_records"] = len(self.processor.records)
        
        return results

    def safe_re_run(self, input_dir: str) -> Dict[str, Any]:
        original_hash = self.checkpoint.get("run_hash")
        
        results = self.run_pipeline(input_dir)
        
        new_hash = results.get("final_hash")
        if original_hash and original_hash == new_hash:
            results["idempotent_verified"] = True
            results["note"] = "重复运行结果一致，数据无变化"
        else:
            results["idempotent_verified"] = False
            results["note"] = "运行结果已更新"
        
        return results

    def get_statistics(self) -> Dict[str, Any]:
        stats = {
            "total": 0,
            "by_status": {},
            "by_source": {},
            "by_satellite": {},
            "pending_reasons": {}
        }
        
        for record in self.processor.get_all_records():
            stats["total"] += 1
            
            status = record.status.value
            stats["by_status"][status] = stats["by_status"].get(status, 0) + 1
            
            source = f"{record.source.type.value}:{record.source.system}"
            stats["by_source"][source] = stats["by_source"].get(source, 0) + 1
            
            stats["by_satellite"][record.satellite] = \
                stats["by_satellite"].get(record.satellite, 0) + 1
            
            if record.pending_reason:
                stats["pending_reasons"][record.pending_reason] = \
                    stats["pending_reasons"].get(record.pending_reason, 0) + 1
        
        return stats

    def export_briefing(self, output_file: str = None) -> Dict[str, Any]:
        briefing = {
            "export_time": datetime.now().isoformat(),
            "statistics": self.get_statistics(),
            "pending_records": [
                {
                    "id": r.id,
                    "satellite": r.satellite,
                    "start_time": r.start_time.isoformat(),
                    "end_time": r.end_time.isoformat(),
                    "pending_reason": r.pending_reason,
                    "source": r.source.to_dict(),
                    "last_updated": r.updated_at.isoformat()
                }
                for r in self.processor.get_pending_records()
            ],
            "window_overlaps": {
                sat: [
                    {
                        "record1_id": r1.id,
                        "record2_id": r2.id,
                        "record1_time": f"{r1.start_time.isoformat()} - {r1.end_time.isoformat()}",
                        "record2_time": f"{r2.start_time.isoformat()} - {r2.end_time.isoformat()}",
                        "record1_source": r1.source.system,
                        "record2_source": r2.source.system
                    }
                    for r1, r2 in pairs
                ]
                for sat, pairs in self.processor.find_window_overlaps().items()
            }
        }
        
        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(briefing, f, indent=2, ensure_ascii=False)
        
        return briefing

    def reset(self):
        self.processor = RecordProcessor()
        self.checkpoint = {
            "processed_files": {},
            "last_run": None,
            "record_count": 0,
            "run_hash": None
        }
        if self._get_records_file().exists():
            self._get_records_file().unlink()
        if self.checkpoint_file.exists():
            self.checkpoint_file.unlink()
