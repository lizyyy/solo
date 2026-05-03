from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import asdict, dataclass, is_dataclass
import json
import hashlib

from .rules_checker import CheckIssue


class ReviewStore:
    REVIEW_STATUSES = ["pending", "fixed", "ignored", "rework"]
    STATUS_LABELS = {
        "pending": "待复核",
        "fixed": "已修",
        "ignored": "忽略",
        "rework": "需返工"
    }

    def __init__(self, project_dir: Path, store_filename: str = ".review_store.json"):
        self.project_dir = project_dir
        self.store_path = project_dir / store_filename
        self._cache: Dict[str, dict] = {}
        self._project_hash: str = ""
        self._load()

    def _generate_project_hash(self) -> str:
        import os
        import stat
        
        files_info = []
        for file_path in self.project_dir.rglob('*'):
            if file_path.is_file():
                stat_info = file_path.stat()
                files_info.append(f"{file_path.name}:{stat_info.st_mtime}:{stat_info.st_size}")
        
        files_info.sort()
        content = "|".join(files_info)
        return hashlib.md5(content.encode('utf-8')).hexdigest()[:16]

    def _load(self):
        if self.store_path.exists():
            try:
                with open(self.store_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                self._cache = data.get("issues", {})
                self._project_hash = data.get("project_hash", "")
            except Exception:
                self._cache = {}
                self._project_hash = ""
        else:
            self._cache = {}
            self._project_hash = ""

    def save(self):
        try:
            self.project_dir.mkdir(parents=True, exist_ok=True)
            self._project_hash = self._generate_project_hash()
            data = {
                "project_hash": self._project_hash,
                "last_updated": self._get_timestamp(),
                "issues": self._cache
            }
            with open(self.store_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception:
            return False

    def _get_timestamp(self) -> str:
        from datetime import datetime
        return datetime.now().isoformat()

    def get_issue_status(self, issue_id: str) -> dict:
        return self._cache.get(issue_id, {
            "status": "pending",
            "note": "",
            "updated_at": ""
        })

    def update_issue(self, issue_id: str, status: str, note: str = "") -> bool:
        if status not in self.REVIEW_STATUSES:
            return False
        
        self._cache[issue_id] = {
            "status": status,
            "note": note,
            "updated_at": self._get_timestamp()
        }
        return True

    def apply_to_issues(self, issues: List[CheckIssue]) -> List[CheckIssue]:
        for issue in issues:
            stored = self.get_issue_status(issue.issue_id)
            issue.review_status = stored.get("status", "pending")
            issue.review_note = stored.get("note", "")
        return issues

    def get_statistics(self) -> Dict[str, int]:
        stats = {status: 0 for status in self.REVIEW_STATUSES}
        for stored in self._cache.values():
            status = stored.get("status", "pending")
            if status in stats:
                stats[status] += 1
        stats["total"] = len(self._cache)
        return stats

    def clear(self) -> bool:
        try:
            if self.store_path.exists():
                self.store_path.unlink()
            self._cache = {}
            self._project_hash = ""
            return True
        except Exception:
            return False

    def export_all(self) -> List[dict]:
        result = []
        for issue_id, data in self._cache.items():
            result.append({
                "issue_id": issue_id,
                **data
            })
        return result
