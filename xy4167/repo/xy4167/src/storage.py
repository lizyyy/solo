import json
import os
import tempfile
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import List, Optional, Dict, Any, Iterator

from .rules import Violation, RiskLevel, RuleResult


class ReviewStatus(Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    NEEDS_REVIEW = "NEEDS_REVIEW"


class ReviewConclusion(Enum):
    PENDING = "PENDING"
    PASS = "PASS"
    WARNING = "WARNING"
    FAIL = "FAIL"
    REQUIRES_MANUAL_REVIEW = "REQUIRES_MANUAL_REVIEW"


@dataclass
class ReviewNote:
    note_id: str
    content: str
    author: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "note_id": self.note_id,
            "content": self.content,
            "author": self.author,
            "created_at": self.created_at.isoformat(),
            "metadata": self.metadata,
        }


@dataclass
class ReviewRecord:
    review_id: str
    device_id: str
    batch_id: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    status: ReviewStatus = ReviewStatus.PENDING
    conclusion: ReviewConclusion = ReviewConclusion.PENDING
    
    source_version: str = ""
    target_version: str = ""
    
    violations: List[Violation] = field(default_factory=list)
    notes: List[ReviewNote] = field(default_factory=list)
    
    state_summary: Dict[str, Any] = field(default_factory=dict)
    rule_results: List[RuleResult] = field(default_factory=list)
    
    log_file_path: str = ""
    manifest_file_path: str = ""
    batch_file_path: str = ""
    
    metadata: Dict[str, Any] = field(default_factory=dict)
    reviewer: str = ""
    
    def add_violation(self, violation: Violation):
        self.violations.append(violation)
        self.updated_at = datetime.now()
    
    def add_note(self, content: str, author: str = "") -> ReviewNote:
        note = ReviewNote(
            note_id=str(uuid.uuid4()),
            content=content,
            author=author,
        )
        self.notes.append(note)
        self.updated_at = datetime.now()
        return note
    
    def determine_conclusion(self) -> ReviewConclusion:
        if not self.violations:
            return ReviewConclusion.PASS
        
        critical_count = sum(1 for v in self.violations if v.risk_level == RiskLevel.CRITICAL)
        high_count = sum(1 for v in self.violations if v.risk_level == RiskLevel.HIGH)
        medium_count = sum(1 for v in self.violations if v.risk_level == RiskLevel.MEDIUM)
        
        if critical_count > 0:
            return ReviewConclusion.FAIL
        elif high_count > 0:
            return ReviewConclusion.WARNING
        elif medium_count > 0:
            return ReviewConclusion.WARNING
        else:
            return ReviewConclusion.PASS
    
    def auto_conclude(self):
        self.conclusion = self.determine_conclusion()
        self.status = ReviewStatus.COMPLETED
        self.updated_at = datetime.now()
    
    def get_risk_summary(self) -> Dict[str, int]:
        return {
            "critical": sum(1 for v in self.violations if v.risk_level == RiskLevel.CRITICAL),
            "high": sum(1 for v in self.violations if v.risk_level == RiskLevel.HIGH),
            "medium": sum(1 for v in self.violations if v.risk_level == RiskLevel.MEDIUM),
            "low": sum(1 for v in self.violations if v.risk_level == RiskLevel.LOW),
        }
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "review_id": self.review_id,
            "device_id": self.device_id,
            "batch_id": self.batch_id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "status": self.status.value,
            "conclusion": self.conclusion.value,
            "source_version": self.source_version,
            "target_version": self.target_version,
            "violations": [v.to_dict() for v in self.violations],
            "notes": [n.to_dict() for n in self.notes],
            "state_summary": self.state_summary,
            "rule_results": [r.to_dict() for r in self.rule_results],
            "log_file_path": self.log_file_path,
            "manifest_file_path": self.manifest_file_path,
            "batch_file_path": self.batch_file_path,
            "metadata": self.metadata,
            "reviewer": self.reviewer,
            "risk_summary": self.get_risk_summary(),
        }


class ReviewStorage:
    def __init__(self, storage_path: Optional[str] = None):
        if storage_path is None:
            try:
                home = Path.home()
                storage_path = str(home / ".serial_firmware_replayer" / "reviews")
                test_path = Path(storage_path)
                test_path.mkdir(parents=True, exist_ok=True)
            except (PermissionError, OSError):
                temp_dir = tempfile.gettempdir()
                storage_path = os.path.join(temp_dir, "serial_firmware_replayer", "reviews")
        
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
    
    def generate_review_id(self) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        return f"RV_{timestamp}_{unique_id}"
    
    def save(self, record: ReviewRecord) -> str:
        record.updated_at = datetime.now()
        file_path = self.storage_path / f"{record.review_id}.json"
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(record.to_dict(), f, ensure_ascii=False, indent=2)
        
        return record.review_id
    
    def load(self, review_id: str) -> Optional[ReviewRecord]:
        file_path = self.storage_path / f"{review_id}.json"
        
        if not file_path.exists():
            return None
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return self._dict_to_record(data)
    
    def _dict_to_record(self, data: Dict[str, Any]) -> ReviewRecord:
        created_at = datetime.fromisoformat(data["created_at"])
        updated_at = datetime.fromisoformat(data["updated_at"])
        
        return ReviewRecord(
            review_id=data["review_id"],
            device_id=data["device_id"],
            batch_id=data.get("batch_id", ""),
            created_at=created_at,
            updated_at=updated_at,
            status=ReviewStatus(data["status"]),
            conclusion=ReviewConclusion(data["conclusion"]),
            source_version=data.get("source_version", ""),
            target_version=data.get("target_version", ""),
            log_file_path=data.get("log_file_path", ""),
            manifest_file_path=data.get("manifest_file_path", ""),
            batch_file_path=data.get("batch_file_path", ""),
            reviewer=data.get("reviewer", ""),
            metadata=data.get("metadata", {}),
            state_summary=data.get("state_summary", {}),
        )
    
    def list_reviews(self, 
                     batch_id: Optional[str] = None,
                     conclusion: Optional[ReviewConclusion] = None,
                     status: Optional[ReviewStatus] = None,
                     limit: int = 100) -> List[ReviewRecord]:
        records = []
        
        for file_path in self.storage_path.glob("RV_*.json"):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                if batch_id and data.get("batch_id") != batch_id:
                    continue
                if conclusion and ReviewConclusion(data["conclusion"]) != conclusion:
                    continue
                if status and ReviewStatus(data["status"]) != status:
                    continue
                
                record = self._dict_to_record(data)
                records.append(record)
                
                if len(records) >= limit:
                    break
            except (json.JSONDecodeError, KeyError):
                continue
        
        records.sort(key=lambda r: r.created_at, reverse=True)
        return records
    
    def get_latest_by_device(self, device_id: str) -> Optional[ReviewRecord]:
        records = []
        for file_path in self.storage_path.glob("RV_*.json"):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                if data.get("device_id") == device_id:
                    records.append(self._dict_to_record(data))
            except (json.JSONDecodeError, KeyError):
                continue
        
        if not records:
            return None
        
        records.sort(key=lambda r: r.created_at, reverse=True)
        return records[0]
    
    def delete(self, review_id: str) -> bool:
        file_path = self.storage_path / f"{review_id}.json"
        if file_path.exists():
            file_path.unlink()
            return True
        return False
    
    def get_statistics(self) -> Dict[str, Any]:
        all_records = self.list_reviews(limit=10000)
        
        conclusions = {}
        statuses = {}
        risk_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        
        for record in all_records:
            concl = record.conclusion.value
            conclusions[concl] = conclusions.get(concl, 0) + 1
            
            status = record.status.value
            statuses[status] = statuses.get(status, 0) + 1
            
            risk_summary = record.get_risk_summary()
            for key in risk_counts:
                risk_counts[key] += risk_summary.get(key, 0)
        
        return {
            "total_reviews": len(all_records),
            "by_conclusion": conclusions,
            "by_status": statuses,
            "total_violations_by_risk": risk_counts,
        }
