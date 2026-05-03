import json
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
from dataclasses import dataclass, field, asdict
from uuid import uuid4

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from models import (
    Student, ScreeningResult, DeviceLog, CalibrationCertificate,
    ValidationIssue, ReviewStatus
)
from config import STORAGE_FILE


@dataclass
class ImportedFile:
    file_id: str
    file_path: str
    file_name: str
    file_type: str
    import_timestamp: datetime
    record_count: int = 0
    hash_value: Optional[str] = None
    
    def to_dict(self) -> dict:
        return {
            "file_id": self.file_id,
            "file_path": self.file_path,
            "file_name": self.file_name,
            "file_type": self.file_type,
            "import_timestamp": self.import_timestamp.isoformat(),
            "record_count": self.record_count,
            "hash_value": self.hash_value
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "ImportedFile":
        import_timestamp = datetime.now()
        if data.get("import_timestamp"):
            try:
                import_timestamp = datetime.fromisoformat(data["import_timestamp"])
            except (ValueError, TypeError):
                pass
        
        return cls(
            file_id=data.get("file_id", str(uuid4())),
            file_path=data.get("file_path", ""),
            file_name=data.get("file_name", ""),
            file_type=data.get("file_type", ""),
            import_timestamp=import_timestamp,
            record_count=data.get("record_count", 0),
            hash_value=data.get("hash_value")
        )


@dataclass
class ReviewState:
    students: List[Student] = field(default_factory=list)
    screening_results: List[ScreeningResult] = field(default_factory=list)
    device_logs: List[DeviceLog] = field(default_factory=list)
    certificates: List[CalibrationCertificate] = field(default_factory=list)
    issues: List[ValidationIssue] = field(default_factory=list)
    imported_files: List[ImportedFile] = field(default_factory=list)
    session_name: str = "默认会话"
    created_at: datetime = field(default_factory=datetime.now)
    last_modified: datetime = field(default_factory=datetime.now)
    notes: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> dict:
        return {
            "students": [s.to_dict() for s in self.students],
            "screening_results": [r.to_dict() for r in self.screening_results],
            "device_logs": [l.to_dict() for l in self.device_logs],
            "certificates": [c.to_dict() for c in self.certificates],
            "issues": [i.to_dict() for i in self.issues],
            "imported_files": [f.to_dict() for f in self.imported_files],
            "session_name": self.session_name,
            "created_at": self.created_at.isoformat(),
            "last_modified": self.last_modified.isoformat(),
            "notes": self.notes,
            "metadata": self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: dict) -> "ReviewState":
        students = [Student.from_dict(s) for s in data.get("students", [])]
        screening_results = [ScreeningResult.from_dict(r) for r in data.get("screening_results", [])]
        device_logs = [DeviceLog.from_dict(l) for l in data.get("device_logs", [])]
        certificates = [CalibrationCertificate.from_dict(c) for c in data.get("certificates", [])]
        issues = [ValidationIssue.from_dict(i) for i in data.get("issues", [])]
        imported_files = [ImportedFile.from_dict(f) for f in data.get("imported_files", [])]
        
        created_at = datetime.now()
        if data.get("created_at"):
            try:
                created_at = datetime.fromisoformat(data["created_at"])
            except (ValueError, TypeError):
                pass
        
        last_modified = datetime.now()
        if data.get("last_modified"):
            try:
                last_modified = datetime.fromisoformat(data["last_modified"])
            except (ValueError, TypeError):
                pass
        
        return cls(
            students=students,
            screening_results=screening_results,
            device_logs=device_logs,
            certificates=certificates,
            issues=issues,
            imported_files=imported_files,
            session_name=data.get("session_name", "默认会话"),
            created_at=created_at,
            last_modified=last_modified,
            notes=data.get("notes"),
            metadata=data.get("metadata", {})
        )
    
    def update_issue_review(self, issue_id: str, status: ReviewStatus,
                            notes: Optional[str] = None,
                            reviewer: Optional[str] = None) -> bool:
        for issue in self.issues:
            if issue.issue_id == issue_id:
                issue.mark_reviewed(status, notes, reviewer)
                self.last_modified = datetime.now()
                return True
        return False
    
    def get_issue_by_id(self, issue_id: str) -> Optional[ValidationIssue]:
        for issue in self.issues:
            if issue.issue_id == issue_id:
                return issue
        return None
    
    def clear_all(self) -> None:
        self.students.clear()
        self.screening_results.clear()
        self.device_logs.clear()
        self.certificates.clear()
        self.issues.clear()
        self.imported_files.clear()
        self.last_modified = datetime.now()


class LocalStorage:
    def __init__(self, storage_path: Optional[Path] = None):
        self.storage_path = storage_path or STORAGE_FILE
        self._ensure_storage_dir()
    
    def _ensure_storage_dir(self) -> None:
        self.storage_path.parent.mkdir(exist_ok=True)
    
    def save(self, state: ReviewState) -> bool:
        try:
            state.last_modified = datetime.now()
            data = state.to_dict()
            
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2, default=str)
            
            return True
        except Exception as e:
            return False
    
    def load(self) -> Optional[ReviewState]:
        if not self.storage_path.exists():
            return None
        
        try:
            with open(self.storage_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            return ReviewState.from_dict(data)
        except Exception as e:
            return None
    
    def exists(self) -> bool:
        return self.storage_path.exists()
    
    def delete(self) -> bool:
        if self.storage_path.exists():
            try:
                self.storage_path.unlink()
                return True
            except Exception:
                return False
        return False
    
    def export_to_file(self, state: ReviewState, export_path: Path) -> bool:
        try:
            data = state.to_dict()
            with open(export_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2, default=str)
            return True
        except Exception:
            return False
    
    def import_from_file(self, import_path: Path) -> Optional[ReviewState]:
        if not import_path.exists():
            return None
        
        try:
            with open(import_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return ReviewState.from_dict(data)
        except Exception:
            return None


class StorageManager:
    _instance: Optional["StorageManager"] = None
    
    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self, storage_path: Optional[Path] = None):
        if not hasattr(self, "_initialized"):
            self._storage = LocalStorage(storage_path)
            self._current_state: Optional[ReviewState] = None
            self._initialized = True
    
    def get_current_state(self) -> ReviewState:
        if self._current_state is None:
            loaded = self._storage.load()
            if loaded:
                self._current_state = loaded
            else:
                self._current_state = ReviewState()
        return self._current_state
    
    def set_current_state(self, state: ReviewState) -> None:
        self._current_state = state
        self.save()
    
    def save(self) -> bool:
        if self._current_state is None:
            return False
        return self._storage.save(self._current_state)
    
    def load(self) -> bool:
        state = self._storage.load()
        if state:
            self._current_state = state
            return True
        return False
    
    def create_new_session(self, name: str = "新会话") -> ReviewState:
        self._current_state = ReviewState(session_name=name)
        self.save()
        return self._current_state
    
    def clear_session(self) -> None:
        if self._current_state:
            self._current_state.clear_all()
            self.save()
    
    def has_saved_state(self) -> bool:
        return self._storage.exists()
    
    def update_issue(self, issue_id: str, status: ReviewStatus,
                     notes: Optional[str] = None,
                     reviewer: Optional[str] = None) -> bool:
        state = self.get_current_state()
        success = state.update_issue_review(issue_id, status, notes, reviewer)
        if success:
            self.save()
        return success
    
    def add_imported_file(self, file_path: Path, file_type: str, 
                          record_count: int = 0) -> ImportedFile:
        state = self.get_current_state()
        
        imported_file = ImportedFile(
            file_id=str(uuid4()),
            file_path=str(file_path),
            file_name=file_path.name,
            file_type=file_type,
            import_timestamp=datetime.now(),
            record_count=record_count
        )
        
        state.imported_files.append(imported_file)
        state.last_modified = datetime.now()
        self.save()
        
        return imported_file
    
    def get_imported_files(self) -> List[ImportedFile]:
        state = self.get_current_state()
        return state.imported_files.copy()


def save_state(state: ReviewState, path: Optional[Path] = None) -> bool:
    storage = LocalStorage(path)
    return storage.save(state)


def load_state(path: Optional[Path] = None) -> Optional[ReviewState]:
    storage = LocalStorage(path)
    return storage.load()
