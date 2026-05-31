import json
import os
import hashlib
import time
from datetime import datetime
from typing import List, Dict, Optional, Any
import fnmatch


class ScriptRecord:
    def __init__(self, command: str, cwd: str, args: Optional[List[str]] = None,
                 exit_code: Optional[int] = None, output_files: Optional[List[str]] = None,
                 note: str = "", failure_reason: str = "", start_time: Optional[float] = None,
                 end_time: Optional[float] = None, is_rerun: bool = False,
                 rerun_of: Optional[str] = None, rollback_to: Optional[str] = None,
                 script_hash: Optional[str] = None):
        self.command = command
        self.cwd = cwd
        self.args = args or []
        self.exit_code = exit_code
        self.output_files = output_files or []
        self.note = note
        self.failure_reason = failure_reason
        self.start_time = start_time or time.time()
        self.end_time = end_time
        self.is_rerun = is_rerun
        self.rerun_of = rerun_of
        self.rollback_to = rollback_to
        self.script_hash = script_hash
        self.id = self._generate_id()
        self.file_hashes = {}

    def _generate_id(self) -> str:
        content = f"{self.command}|{self.cwd}|{'|'.join(self.args)}|{self.start_time}"
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def compute_script_hash(self) -> str:
        script_path = self._extract_script_path()
        if not script_path:
            return ""
        full_path = os.path.join(self.cwd, script_path) if not os.path.isabs(script_path) else script_path
        if not os.path.exists(full_path):
            return ""
        try:
            with open(full_path, 'rb') as f:
                self.script_hash = hashlib.sha256(f.read()).hexdigest()
                return self.script_hash
        except Exception:
            return ""

    def compute_file_hashes(self) -> Dict[str, str]:
        result = {}
        for f in self.output_files:
            full_path = os.path.join(self.cwd, f) if not os.path.isabs(f) else f
            if os.path.exists(full_path) and os.path.isfile(full_path):
                try:
                    with open(full_path, 'rb') as fh:
                        result[f] = hashlib.sha256(fh.read()).hexdigest()
                except Exception:
                    result[f] = ""
        self.file_hashes = result
        return result

    def _extract_script_path(self) -> Optional[str]:
        parts = self.command.split()
        if not parts:
            return None
        for part in parts:
            if part.endswith(('.sh', '.py', '.pl', '.rb', '.bash')):
                return part
            if os.path.exists(os.path.join(self.cwd, part)):
                return part
            if os.path.exists(part):
                return part
        return None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "command": self.command,
            "cwd": self.cwd,
            "args": self.args,
            "exit_code": self.exit_code,
            "output_files": self.output_files,
            "note": self.note,
            "failure_reason": self.failure_reason,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "is_rerun": self.is_rerun,
            "rerun_of": self.rerun_of,
            "rollback_to": self.rollback_to,
            "script_hash": self.script_hash,
            "file_hashes": self.file_hashes
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ScriptRecord':
        record = cls(
            command=data["command"],
            cwd=data["cwd"],
            args=data.get("args", []),
            exit_code=data.get("exit_code"),
            output_files=data.get("output_files", []),
            note=data.get("note", ""),
            failure_reason=data.get("failure_reason", ""),
            start_time=data.get("start_time"),
            end_time=data.get("end_time"),
            is_rerun=data.get("is_rerun", False),
            rerun_of=data.get("rerun_of"),
            rollback_to=data.get("rollback_to"),
            script_hash=data.get("script_hash")
        )
        record.id = data.get("id", record.id)
        record.file_hashes = data.get("file_hashes", {})
        return record

    def signature(self) -> str:
        return f"{self.command}|{self.cwd}|{'|'.join(self.args)}"


class Ledger:
    def __init__(self, ledger_path: str = "script_ledger.json"):
        self.ledger_path = ledger_path
        self.records: List[ScriptRecord] = []
        self._load()

    def _load(self) -> None:
        if os.path.exists(self.ledger_path):
            try:
                with open(self.ledger_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.records = [ScriptRecord.from_dict(r) for r in data.get("records", [])]
            except Exception as e:
                print(f"Warning: Failed to load ledger: {e}")
                self.records = []
        else:
            self.records = []

    def _save(self) -> None:
        data = {
            "version": "1.0",
            "generated_at": datetime.now().isoformat(),
            "records": [r.to_dict() for r in self.records]
        }
        with open(self.ledger_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def add_record(self, record: ScriptRecord, preserve_failure: bool = True) -> str:
        existing = self._find_duplicate(record)
        if existing:
            if preserve_failure and existing.failure_reason and not record.failure_reason:
                record.failure_reason = existing.failure_reason
            if not record.note and existing.note:
                record.note = existing.note
            self.records.remove(existing)
        
        if not record.script_hash:
            record.compute_script_hash()
        if not record.file_hashes:
            record.compute_file_hashes()
        
        self.records.append(record)
        self._save()
        return record.id

    def _find_duplicate(self, record: ScriptRecord) -> Optional[ScriptRecord]:
        for r in self.records:
            if r.id == record.id:
                return r
            if r.signature() == record.signature() and abs(r.start_time - record.start_time) < 300:
                return r
        return None

    def find_by_id(self, record_id: str) -> Optional[ScriptRecord]:
        for r in self.records:
            if r.id == record_id:
                return r
        return None

    def find_by_command(self, pattern: str) -> List[ScriptRecord]:
        results = []
        for r in self.records:
            if fnmatch.fnmatch(r.command, pattern):
                results.append(r)
        return results

    def find_by_cwd(self, cwd: str) -> List[ScriptRecord]:
        return [r for r in self.records if r.cwd == cwd]

    def get_reruns_of(self, record_id: str) -> List[ScriptRecord]:
        return [r for r in self.records if r.rerun_of == record_id]

    def get_all_records(self, reverse: bool = True) -> List[ScriptRecord]:
        sorted_records = sorted(self.records, key=lambda r: r.start_time)
        if reverse:
            sorted_records.reverse()
        return sorted_records

    def export(self, output_path: str) -> None:
        data = {
            "version": "1.0",
            "generated_at": datetime.now().isoformat(),
            "records": [r.to_dict() for r in self.records]
        }
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def import_records(self, import_path: str, preserve_existing_failures: bool = True) -> int:
        if not os.path.exists(import_path):
            raise FileNotFoundError(f"Import file not found: {import_path}")
        
        with open(import_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        count = 0
        for r_data in data.get("records", []):
            record = ScriptRecord.from_dict(r_data)
            self.add_record(record, preserve_failure=preserve_existing_failures)
            count += 1
        
        return count

    def update_failure_reason(self, record_id: str, reason: str) -> bool:
        record = self.find_by_id(record_id)
        if record:
            if not record.failure_reason:
                record.failure_reason = reason
            else:
                record.failure_reason = f"{record.failure_reason}; {reason}"
            self._save()
            return True
        return False

    def add_note(self, record_id: str, note: str) -> bool:
        record = self.find_by_id(record_id)
        if record:
            if not record.note:
                record.note = note
            else:
                record.note = f"{record.note}\n{note}"
            self._save()
            return True
        return False

    def mark_rerun(self, original_id: str, rerun_record: ScriptRecord) -> str:
        original = self.find_by_id(original_id)
        if original:
            rerun_record.is_rerun = True
            rerun_record.rerun_of = original_id
        return self.add_record(rerun_record)

    def delete_record(self, record_id: str) -> bool:
        record = self.find_by_id(record_id)
        if record:
            self.records.remove(record)
            self._save()
            return True
        return False
