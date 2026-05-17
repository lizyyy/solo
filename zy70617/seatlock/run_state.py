import json
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional
import uuid

from .models import RunState


class RunStateManager:
    def __init__(self, state_dir: str = "./run_state"):
        self.state_dir = Path(state_dir)
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.current_run: Optional[RunState] = None
        self._last_input_hash: Optional[str] = None
    
    def _get_run_file(self, run_id: str) -> Path:
        return self.state_dir / f"run_{run_id}.json"
    
    def _get_latest_run_file(self) -> Optional[Path]:
        runs = sorted(self.state_dir.glob("run_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
        return runs[0] if runs else None
    
    def _hash_file_content(self, filepath: Path) -> str:
        hasher = hashlib.md5()
        hasher.update(filepath.read_bytes())
        return hasher.hexdigest()
    
    def _hash_files(self, files: list) -> str:
        hasher = hashlib.md5()
        for f in sorted(files):
            path = Path(f)
            if path.exists():
                content_hash = self._hash_file_content(path)
                hasher.update(f"{path.name}:{content_hash}".encode())
        return hasher.hexdigest()
    
    def get_input_hash(self, input_files: list) -> str:
        return self._hash_files(input_files)
    
    def start_new_run(self, input_files: list = None) -> RunState:
        input_hash = self._hash_files(input_files or [])
        self._last_input_hash = input_hash
        
        run_id = input_hash[:8]
        self.current_run = RunState(
            run_id=run_id,
            started_at=datetime.now(),
            input_files=input_files or []
        )
        self.current_run.input_hash = input_hash
        self._save_run_state()
        return self.current_run
    
    def _save_run_state(self):
        if not self.current_run:
            return
        
        run_file = self._get_run_file(self.current_run.run_id)
        data = {
            "run_id": self.current_run.run_id,
            "input_hash": getattr(self.current_run, 'input_hash', None),
            "started_at": self.current_run.started_at.isoformat(),
            "completed_at": self.current_run.completed_at.isoformat() if self.current_run.completed_at else None,
            "status": self.current_run.status,
            "input_files": self.current_run.input_files,
            "records_processed": self.current_run.records_processed,
            "records_skipped": self.current_run.records_skipped,
            "issues_found": self.current_run.issues_found,
            "error_message": self.current_run.error_message
        }
        run_file.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    
    def update_progress(self, records_processed: int = None, records_skipped: int = None, issues_found: int = None):
        if not self.current_run:
            return
        
        if records_processed is not None:
            self.current_run.records_processed = records_processed
        if records_skipped is not None:
            self.current_run.records_skipped = records_skipped
        if issues_found is not None:
            self.current_run.issues_found = issues_found
        
        self._save_run_state()
    
    def complete_run(self, success: bool = True, error_message: str = None):
        if not self.current_run:
            return
        
        self.current_run.completed_at = datetime.now()
        self.current_run.status = "COMPLETED" if success else "FAILED"
        self.current_run.error_message = error_message
        self._save_run_state()
    
    def find_idempotent_run(self, input_files: list) -> Optional[RunState]:
        input_hash = self._hash_files(input_files)
        self._last_input_hash = input_hash
        
        run_id = input_hash[:8]
        run_file = self._get_run_file(run_id)
        
        if run_file.exists():
            try:
                data = json.loads(run_file.read_text(encoding='utf-8'))
                if data.get("status") == "COMPLETED" and data.get("input_hash") == input_hash:
                    run = RunState(
                        run_id=data["run_id"],
                        started_at=datetime.fromisoformat(data["started_at"]),
                        completed_at=datetime.fromisoformat(data["completed_at"]) if data.get("completed_at") else None,
                        status=data["status"],
                        input_files=data.get("input_files", []),
                        records_processed=data.get("records_processed", 0),
                        records_skipped=data.get("records_skipped", 0),
                        issues_found=data.get("issues_found", 0),
                        error_message=data.get("error_message")
                    )
                    run.input_hash = data.get("input_hash")
                    return run
            except Exception:
                pass
        
        return None
    
    def get_last_input_hash(self) -> Optional[str]:
        return self._last_input_hash
    
    def get_run_history(self, limit: int = 10) -> list:
        runs = []
        for run_file in sorted(self.state_dir.glob("run_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)[:limit]:
            try:
                data = json.loads(run_file.read_text(encoding='utf-8'))
                runs.append(data)
            except Exception:
                continue
        return runs
