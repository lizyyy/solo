from __future__ import annotations

import hashlib
import json
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

from .config import Config
from .models import (
    AuditLog,
    CheckResult,
    Document,
    DocumentType,
    ProjectState,
    ReviewItem,
    ReviewStatus,
)


class StateEncoder(json.JSONEncoder):
    def default(self, obj: Any) -> Any:
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, (DocumentType, ReviewStatus)):
            return obj.value
        return super().default(obj)


def object_hook(d: Dict[str, Any]) -> Any:
    if "created_at" in d and d["created_at"] and isinstance(d["created_at"], str):
        d["created_at"] = datetime.fromisoformat(d["created_at"])
    if "updated_at" in d and d["updated_at"] and isinstance(d["updated_at"], str):
        d["updated_at"] = datetime.fromisoformat(d["updated_at"])
    if "closed_at" in d and d["closed_at"]:
        d["closed_at"] = datetime.fromisoformat(d["closed_at"])
    if "overridden_at" in d and d["overridden_at"]:
        d["overridden_at"] = datetime.fromisoformat(d["overridden_at"])
    if "timestamp" in d and d["timestamp"]:
        d["timestamp"] = datetime.fromisoformat(d["timestamp"])
    return d


class Storage:
    def __init__(self, project_dir: Path):
        self.project_dir = project_dir
        self.config_path = Config.get_config_path(project_dir)
        self.state_path = Config.get_state_path(project_dir)
    
    def initialize_project(self, project_name: str) -> ProjectState:
        self.config_path.mkdir(parents=True, exist_ok=True)
        Config.get_cache_path(self.project_dir).mkdir(parents=True, exist_ok=True)
        
        now = datetime.now()
        state = ProjectState(
            project_id=str(uuid4()),
            project_name=project_name,
            created_at=now,
            updated_at=now,
            version_history=[
                {
                    "version": "v1.0.0",
                    "timestamp": now.isoformat(),
                    "description": "初始化项目",
                }
            ],
        )
        self.save_state(state)
        return state
    
    def save_state(self, state: ProjectState) -> None:
        state.updated_at = datetime.now()
        data = asdict(state)
        with open(self.state_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, cls=StateEncoder)
    
    def load_state(self) -> Optional[ProjectState]:
        if not self.state_path.exists():
            return None
        
        with open(self.state_path, "r", encoding="utf-8") as f:
            data = json.load(f, object_hook=object_hook)
        
        documents = [Document(**doc) for doc in data.get("documents", [])]
        review_items = [ReviewItem(**ri) for ri in data.get("review_items", [])]
        check_results = [CheckResult(**cr) for cr in data.get("check_results", [])]
        audit_logs = [AuditLog(**al) for al in data.get("audit_logs", [])]
        
        return ProjectState(
            project_id=data["project_id"],
            project_name=data["project_name"],
            created_at=data["created_at"],
            updated_at=data["updated_at"],
            documents=documents,
            review_items=review_items,
            check_results=check_results,
            audit_logs=audit_logs,
            current_version=data.get("current_version", "v1.0.0"),
            version_history=data.get("version_history", []),
        )
    
    def calculate_checksum(self, file_path: Path) -> str:
        hasher = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                hasher.update(chunk)
        return hasher.hexdigest()
    
    def add_audit_log(
        self,
        state: ProjectState,
        action: str,
        actor: str,
        description: str,
        before: Optional[Dict[str, Any]] = None,
        after: Optional[Dict[str, Any]] = None,
    ) -> AuditLog:
        log = AuditLog(
            id=str(uuid4()),
            action=action,
            actor=actor,
            timestamp=datetime.now(),
            before=before,
            after=after,
            description=description,
        )
        state.audit_logs.append(log)
        return log
