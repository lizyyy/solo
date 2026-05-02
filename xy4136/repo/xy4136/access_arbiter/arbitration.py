import json
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum
from collections import defaultdict

from .rules import RuleViolation, ViolationType


class ArbitrationStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    DISMISSED = "dismissed"
    NEEDS_REVIEW = "needs_review"


class ArbitrationAction(str, Enum):
    VALIDATE_EVENT = "validate_event"
    INVALIDATE_EVENT = "invalidate_event"
    ADJUST_CLOCK = "adjust_clock"
    UPDATE_PERMISSION = "update_permission"
    ADD_NOTE = "add_note"


class ArbitrationRecord(BaseModel):
    event_index: int
    card_id: str
    timestamp: datetime
    violation_type: Optional[ViolationType] = None
    original_message: str = ""
    status: ArbitrationStatus = ArbitrationStatus.PENDING
    action_taken: Optional[ArbitrationAction] = None
    arbitrator_notes: str = ""
    arbitrated_at: Optional[datetime] = None
    arbitrated_by: str = "system"
    resolved: bool = False
    resolution_details: str = ""
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ArbitrationSession(BaseModel):
    session_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    records: List[ArbitrationRecord] = Field(default_factory=list)
    total_violations: int = 0
    resolved_count: int = 0
    pending_count: int = 0
    summary: str = ""


class ArbitrationManager:
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.sessions_dir = output_dir / "arbitration"
        self.sessions_dir.mkdir(exist_ok=True)
    
    def create_session(self, violations: List[RuleViolation]) -> ArbitrationSession:
        records: List[ArbitrationRecord] = []
        
        for violation in violations:
            record = ArbitrationRecord(
                event_index=violation.event_index,
                card_id=violation.card_id,
                timestamp=violation.timestamp,
                violation_type=violation.violation_type,
                original_message=violation.message,
                status=ArbitrationStatus.PENDING,
                resolved=False
            )
            records.append(record)
        
        session = ArbitrationSession(
            session_id=f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            created_at=datetime.now(),
            records=records,
            total_violations=len(violations),
            pending_count=len(violations)
        )
        
        return session
    
    def load_session(self, session_id: str) -> ArbitrationSession:
        session_file = self.sessions_dir / f"{session_id}.json"
        
        if not session_file.exists():
            raise FileNotFoundError(f"仲裁会话不存在: {session_id}")
        
        with open(session_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        return self._dict_to_session(data)
    
    def save_session(self, session: ArbitrationSession) -> Path:
        session.updated_at = datetime.now()
        
        pending = 0
        resolved = 0
        for record in session.records:
            if record.resolved:
                resolved += 1
            else:
                pending += 1
        
        session.pending_count = pending
        session.resolved_count = resolved
        
        session_file = self.sessions_dir / f"{session.session_id}.json"
        
        with open(session_file, "w", encoding="utf-8") as f:
            json.dump(self._session_to_dict(session), f, indent=2, ensure_ascii=False, default=str)
        
        return session_file
    
    def list_sessions(self) -> List[Dict[str, Any]]:
        sessions = []
        
        for file in self.sessions_dir.glob("session_*.json"):
            try:
                with open(file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                
                sessions.append({
                    "session_id": data.get("session_id"),
                    "created_at": data.get("created_at"),
                    "total_violations": data.get("total_violations", 0),
                    "resolved_count": data.get("resolved_count", 0),
                    "pending_count": data.get("pending_count", 0),
                    "file_path": str(file)
                })
            except Exception:
                continue
        
        sessions.sort(key=lambda x: x["created_at"], reverse=True)
        return sessions
    
    def update_record(
        self,
        session: ArbitrationSession,
        event_index: int,
        status: ArbitrationStatus,
        action: Optional[ArbitrationAction] = None,
        notes: str = "",
        resolution: str = "",
        arbitrator: str = "admin"
    ) -> bool:
        for record in session.records:
            if record.event_index == event_index:
                record.status = status
                record.action_taken = action
                record.arbitrator_notes = notes
                record.arbitrated_at = datetime.now()
                record.arbitrated_by = arbitrator
                record.resolution_details = resolution
                
                if status in [ArbitrationStatus.CONFIRMED, ArbitrationStatus.DISMISSED]:
                    record.resolved = True
                
                return True
        
        return False
    
    def get_pending_records(self, session: ArbitrationSession) -> List[ArbitrationRecord]:
        return [r for r in session.records if not r.resolved]
    
    def get_confirmed_records(self, session: ArbitrationSession) -> List[ArbitrationRecord]:
        return [r for r in session.records if r.status == ArbitrationStatus.CONFIRMED]
    
    def get_dismissed_records(self, session: ArbitrationSession) -> List[ArbitrationRecord]:
        return [r for r in session.records if r.status == ArbitrationStatus.DISMISSED]
    
    def get_stats_by_type(self, session: ArbitrationSession) -> Dict[ViolationType, Dict[str, int]]:
        stats: Dict[ViolationType, Dict[str, int]] = defaultdict(lambda: {"total": 0, "resolved": 0, "pending": 0})
        
        for record in session.records:
            if record.violation_type:
                stats[record.violation_type]["total"] += 1
                if record.resolved:
                    stats[record.violation_type]["resolved"] += 1
                else:
                    stats[record.violation_type]["pending"] += 1
        
        return dict(stats)
    
    def _session_to_dict(self, session: ArbitrationSession) -> Dict[str, Any]:
        def datetime_to_str(dt):
            return dt.isoformat() if dt else None
        
        records_dicts = []
        for r in session.records:
            records_dicts.append({
                "event_index": r.event_index,
                "card_id": r.card_id,
                "timestamp": datetime_to_str(r.timestamp),
                "violation_type": str(r.violation_type.value) if r.violation_type else None,
                "original_message": r.original_message,
                "status": str(r.status.value),
                "action_taken": str(r.action_taken.value) if r.action_taken else None,
                "arbitrator_notes": r.arbitrator_notes,
                "arbitrated_at": datetime_to_str(r.arbitrated_at),
                "arbitrated_by": r.arbitrated_by,
                "resolved": r.resolved,
                "resolution_details": r.resolution_details,
                "metadata": r.metadata
            })
        
        return {
            "session_id": session.session_id,
            "created_at": datetime_to_str(session.created_at),
            "updated_at": datetime_to_str(session.updated_at),
            "records": records_dicts,
            "total_violations": session.total_violations,
            "resolved_count": session.resolved_count,
            "pending_count": session.pending_count,
            "summary": session.summary
        }
    
    def _dict_to_session(self, data: Dict[str, Any]) -> ArbitrationSession:
        def str_to_datetime(s):
            if s is None:
                return None
            try:
                return datetime.fromisoformat(s)
            except ValueError:
                return None
        
        records: List[ArbitrationRecord] = []
        for r_data in data.get("records", []):
            record = ArbitrationRecord(
                event_index=r_data.get("event_index", 0),
                card_id=r_data.get("card_id", ""),
                timestamp=str_to_datetime(r_data.get("timestamp")),
                violation_type=ViolationType(r_data["violation_type"]) if r_data.get("violation_type") else None,
                original_message=r_data.get("original_message", ""),
                status=ArbitrationStatus(r_data["status"]) if r_data.get("status") else ArbitrationStatus.PENDING,
                action_taken=ArbitrationAction(r_data["action_taken"]) if r_data.get("action_taken") else None,
                arbitrator_notes=r_data.get("arbitrator_notes", ""),
                arbitrated_at=str_to_datetime(r_data.get("arbitrated_at")),
                arbitrated_by=r_data.get("arbitrated_by", "system"),
                resolved=r_data.get("resolved", False),
                resolution_details=r_data.get("resolution_details", ""),
                metadata=r_data.get("metadata", {})
            )
            records.append(record)
        
        return ArbitrationSession(
            session_id=data.get("session_id", ""),
            created_at=str_to_datetime(data.get("created_at")) or datetime.now(),
            updated_at=str_to_datetime(data.get("updated_at")),
            records=records,
            total_violations=data.get("total_violations", 0),
            resolved_count=data.get("resolved_count", 0),
            pending_count=data.get("pending_count", 0),
            summary=data.get("summary", "")
        )
