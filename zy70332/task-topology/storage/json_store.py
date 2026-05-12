import sys
from pathlib import Path
STORAGE_DIR_PATH = Path(__file__).resolve().parent
ROOT_DIR = STORAGE_DIR_PATH.parent
sys.path.insert(0, str(ROOT_DIR))

import json
import hashlib
from datetime import datetime
from typing import Dict, List, Optional
from core.models import (
    RunStatus, FailureRecord, SkipRecord,
    TaskStatus, SkipType
)
from core.config import STORAGE_DIR


class JsonStore:
    def __init__(self, storage_dir: str = None):
        self.storage_dir = Path(storage_dir) if storage_dir else STORAGE_DIR
        self.statuses_dir = self.storage_dir / "statuses"
        self.failures_dir = self.storage_dir / "failures"
        self.skips_dir = self.storage_dir / "skips"
        self.imports_dir = self.storage_dir / "imports"
        self._ensure_dirs()
    
    def _ensure_dirs(self):
        for d in [self.statuses_dir, self.failures_dir, self.skips_dir, self.imports_dir]:
            d.mkdir(parents=True, exist_ok=True)
    
    def _status_file(self, run_date: str) -> Path:
        return self.statuses_dir / f"{run_date}.json"
    
    def _failures_file(self, run_date: str) -> Path:
        return self.failures_dir / f"{run_date}.json"
    
    def _skips_file(self, run_date: str) -> Path:
        return self.skips_dir / f"{run_date}.json"
    
    def _imports_file(self) -> Path:
        return self.imports_dir / "history.json"
    
    def _compute_hash(self, data: List[Dict]) -> str:
        sorted_data = sorted([json.dumps(d, sort_keys=True) for d in data])
        combined = "|".join(sorted_data)
        return hashlib.md5(combined.encode()).hexdigest()
    
    def has_imported(self, run_date: str, import_hash: str) -> bool:
        history_file = self._imports_file()
        if not history_file.exists():
            return False
        
        with open(history_file, 'r', encoding='utf-8') as f:
            history = json.load(f)
        
        imports = history.get(run_date, {})
        return import_hash in imports
    
    def record_import(self, run_date: str, import_hash: str, description: str):
        history_file = self._imports_file()
        if history_file.exists():
            with open(history_file, 'r', encoding='utf-8') as f:
                history = json.load(f)
        else:
            history = {}
        
        if run_date not in history:
            history[run_date] = {}
        
        history[run_date][import_hash] = {
            'imported_at': datetime.now().isoformat(),
            'description': description
        }
        
        with open(history_file, 'w', encoding='utf-8') as f:
            json.dump(history, f, indent=2, ensure_ascii=False)
    
    def load_statuses(self, run_date: str) -> Dict[str, RunStatus]:
        file = self._status_file(run_date)
        if not file.exists():
            return {}
        
        with open(file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        result = {}
        for task_id, s_data in data.items():
            result[task_id] = RunStatus(
                task_id=task_id,
                run_date=run_date,
                status=TaskStatus(s_data['status']),
                start_time=datetime.fromisoformat(s_data['start_time']) if s_data.get('start_time') else None,
                end_time=datetime.fromisoformat(s_data['end_time']) if s_data.get('end_time') else None,
                reason=s_data.get('reason', ''),
                import_hash=s_data.get('import_hash', '')
            )
        return result
    
    def save_statuses(self, run_date: str, statuses: Dict[str, RunStatus], import_hash: str = ''):
        data = {}
        for task_id, status in statuses.items():
            data[task_id] = {
                'status': status.status.value,
                'start_time': status.start_time.isoformat() if status.start_time else None,
                'end_time': status.end_time.isoformat() if status.end_time else None,
                'reason': status.reason,
                'import_hash': import_hash or status.import_hash
            }
        
        with open(self._status_file(run_date), 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    
    def load_failures(self, run_date: str) -> Dict[str, FailureRecord]:
        file = self._failures_file(run_date)
        if not file.exists():
            return {}
        
        with open(file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        result = {}
        for task_id, f_data in data.items():
            result[task_id] = FailureRecord(
                task_id=task_id,
                run_date=run_date,
                failure_time=datetime.fromisoformat(f_data['failure_time']),
                reason=f_data.get('reason', ''),
                import_hash=f_data.get('import_hash', '')
            )
        return result
    
    def save_failures(self, run_date: str, failures: Dict[str, FailureRecord], import_hash: str = ''):
        data = {}
        for task_id, fail in failures.items():
            data[task_id] = {
                'failure_time': fail.failure_time.isoformat(),
                'reason': fail.reason,
                'import_hash': import_hash or fail.import_hash
            }
        
        with open(self._failures_file(run_date), 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    
    def load_skips(self, run_date: str) -> Dict[str, SkipRecord]:
        file = self._skips_file(run_date)
        if not file.exists():
            return {}
        
        with open(file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        result = {}
        for task_id, s_data in data.items():
            result[task_id] = SkipRecord(
                task_id=task_id,
                run_date=run_date,
                skip_type=SkipType(s_data['skip_type']),
                reason=s_data['reason'],
                created_at=datetime.fromisoformat(s_data['created_at']),
                import_hash=s_data.get('import_hash', '')
            )
        return result
    
    def save_skips(self, run_date: str, skips: Dict[str, SkipRecord]):
        data = {}
        for task_id, skip in skips.items():
            data[task_id] = {
                'skip_type': skip.skip_type.value,
                'reason': skip.reason,
                'created_at': skip.created_at.isoformat(),
                'import_hash': skip.import_hash
            }
        
        with open(self._skips_file(run_date), 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    
    def clear_failures(self, run_date: str, task_ids: List[str]):
        failures = self.load_failures(run_date)
        for task_id in task_ids:
            failures.pop(task_id, None)
        self.save_failures(run_date, failures)
    
    def mark_task_fixed(self, run_date: str, task_id: str):
        failures = self.load_failures(run_date)
        if task_id in failures:
            del failures[task_id]
            self.save_failures(run_date, failures)
        
        statuses = self.load_statuses(run_date)
        if task_id in statuses:
            statuses[task_id].status = TaskStatus.PENDING
            self.save_statuses(run_date, statuses)
    
    def add_skip(self, run_date: str, task_id: str, reason: str) -> SkipRecord:
        skips = self.load_skips(run_date)
        skips[task_id] = SkipRecord(
            task_id=task_id,
            run_date=run_date,
            skip_type=SkipType.MANUAL,
            reason=reason,
            created_at=datetime.now()
        )
        self.save_skips(run_date, skips)
        
        statuses = self.load_statuses(run_date)
        if task_id not in statuses:
            statuses[task_id] = RunStatus(
                task_id=task_id,
                run_date=run_date,
                status=TaskStatus.SKIPPED,
                reason=reason
            )
        else:
            statuses[task_id].status = TaskStatus.SKIPPED
            statuses[task_id].reason = reason
        self.save_statuses(run_date, statuses)
        
        return skips[task_id]
