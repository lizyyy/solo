import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional
from dataclasses import asdict

from .models import AuditEntry


class AuditLog:
    def __init__(self, log_file: str = "audit_log.json"):
        self.log_file = log_file
        self.entries: List[AuditEntry] = []
        self._load_existing_log()
        
    def _load_existing_log(self):
        path = Path(self.log_file)
        if path.exists():
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for entry_data in data:
                        entry = AuditEntry(
                            entry_id=entry_data['entry_id'],
                            timestamp=datetime.fromisoformat(entry_data['timestamp']),
                            operator=entry_data['operator'],
                            action=entry_data['action'],
                            track_id=entry_data.get('track_id'),
                            file_path=entry_data.get('file_path'),
                            old_value=entry_data.get('old_value'),
                            new_value=entry_data.get('new_value'),
                            reason=entry_data.get('reason', ''),
                            source=entry_data.get('source', '')
                        )
                        self.entries.append(entry)
            except Exception as e:
                print(f"加载审计日志失败: {e}")
    
    def log(self, operator: str, action: str, track_id: Optional[str] = None,
            file_path: Optional[str] = None, old_value: Optional[str] = None,
            new_value: Optional[str] = None, reason: str = "", source: str = "") -> AuditEntry:
        
        entry = AuditEntry(
            entry_id=str(uuid.uuid4()),
            timestamp=datetime.now(),
            operator=operator,
            action=action,
            track_id=track_id,
            file_path=file_path,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
            source=source
        )
        
        self.entries.append(entry)
        self._save_log()
        
        return entry
    
    def _save_log(self):
        path = Path(self.log_file)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        serializable_entries = []
        for entry in self.entries:
            entry_dict = asdict(entry)
            entry_dict['timestamp'] = entry.timestamp.isoformat()
            serializable_entries.append(entry_dict)
            
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(serializable_entries, f, ensure_ascii=False, indent=2)
    
    def get_track_history(self, track_id: str) -> List[AuditEntry]:
        return [e for e in self.entries if e.track_id == track_id]
    
    def get_file_history(self, file_path: str) -> List[AuditEntry]:
        return [e for e in self.entries if e.file_path == file_path]
    
    def get_by_operator(self, operator: str) -> List[AuditEntry]:
        return [e for e in self.entries if e.operator == operator]
    
    def get_by_action(self, action: str) -> List[AuditEntry]:
        return [e for e in self.entries if e.action == action]
    
    def get_recent_entries(self, limit: int = 100) -> List[AuditEntry]:
        return sorted(self.entries, key=lambda e: e.timestamp, reverse=True)[:limit]
