from datetime import datetime
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field, asdict
import json
import os

from .models import ReviewDecision, FixAction


@dataclass
class ReviewSession:
    session_id: str
    created_at: str
    updated_at: str
    project_name: Optional[str] = None
    decisions: List[ReviewDecision] = field(default_factory=list)
    notes: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "project_name": self.project_name,
            "decisions": [asdict(d) for d in self.decisions],
            "notes": self.notes,
            "metadata": self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ReviewSession':
        decisions = []
        for d in data.get("decisions", []):
            decisions.append(ReviewDecision(**d))
        
        return cls(
            session_id=data.get("session_id", ""),
            created_at=data.get("created_at", ""),
            updated_at=data.get("updated_at", ""),
            project_name=data.get("project_name"),
            decisions=decisions,
            notes=data.get("notes", ""),
            metadata=data.get("metadata", {})
        )


class ReviewStore:
    def __init__(self, storage_dir: Optional[str] = None):
        self.storage_dir = storage_dir or os.path.join(
            os.path.expanduser("~"), ".subtitle-fixer", "reviews"
        )
        self._ensure_storage_dir()
    
    def _ensure_storage_dir(self) -> None:
        if not os.path.exists(self.storage_dir):
            os.makedirs(self.storage_dir, exist_ok=True)
    
    def create_session(
        self,
        project_name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> ReviewSession:
        import uuid
        now = datetime.now().isoformat()
        
        session = ReviewSession(
            session_id=str(uuid.uuid4()),
            created_at=now,
            updated_at=now,
            project_name=project_name,
            decisions=[],
            metadata=metadata or {}
        )
        
        return session
    
    def save_session(self, session: ReviewSession) -> str:
        session.updated_at = datetime.now().isoformat()
        
        filename = f"review_{session.session_id}.json"
        filepath = os.path.join(self.storage_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(session.to_dict(), f, ensure_ascii=False, indent=2)
        
        return filepath
    
    def load_session(self, session_id: str) -> Optional[ReviewSession]:
        filename = f"review_{session_id}.json"
        filepath = os.path.join(self.storage_dir, filename)
        
        if not os.path.exists(filepath):
            return None
        
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return ReviewSession.from_dict(data)
    
    def list_sessions(self) -> List[Dict[str, Any]]:
        sessions = []
        
        if not os.path.exists(self.storage_dir):
            return sessions
        
        for filename in os.listdir(self.storage_dir):
            if filename.startswith("review_") and filename.endswith(".json"):
                filepath = os.path.join(self.storage_dir, filename)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        sessions.append({
                            "session_id": data.get("session_id"),
                            "project_name": data.get("project_name"),
                            "created_at": data.get("created_at"),
                            "updated_at": data.get("updated_at"),
                            "decision_count": len(data.get("decisions", [])),
                            "filename": filename
                        })
                except Exception:
                    continue
        
        sessions.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return sessions
    
    def add_decision(
        self,
        session: ReviewSession,
        decision: ReviewDecision
    ) -> None:
        existing_idx = None
        for idx, d in enumerate(session.decisions):
            if d.subtitle_index == decision.subtitle_index:
                existing_idx = idx
                break
        
        if existing_idx is not None:
            session.decisions[existing_idx] = decision
        else:
            session.decisions.append(decision)
        
        session.updated_at = datetime.now().isoformat()
    
    def get_decisions_for_subtitle(
        self,
        session: ReviewSession,
        subtitle_index: int
    ) -> Optional[ReviewDecision]:
        for decision in session.decisions:
            if decision.subtitle_index == subtitle_index:
                return decision
        return None
    
    def get_approved_subtitles(self, session: ReviewSession) -> List[int]:
        return [
            d.subtitle_index
            for d in session.decisions
            if d.approved
        ]
    
    def get_rejected_subtitles(self, session: ReviewSession) -> List[int]:
        return [
            d.subtitle_index
            for d in session.decisions
            if not d.approved
        ]
    
    def get_pending_subtitles(
        self,
        session: ReviewSession,
        total_subtitles: int
    ) -> List[int]:
        decided_indices = set(d.subtitle_index for d in session.decisions)
        return [
            idx for idx in range(1, total_subtitles + 1)
            if idx not in decided_indices
        ]
    
    def export_session_summary(
        self,
        session: ReviewSession
    ) -> Dict[str, Any]:
        approved = self.get_approved_subtitles(session)
        rejected = self.get_rejected_subtitles(session)
        
        return {
            "session_id": session.session_id,
            "project_name": session.project_name,
            "created_at": session.created_at,
            "updated_at": session.updated_at,
            "summary": {
                "total_decisions": len(session.decisions),
                "approved_count": len(approved),
                "rejected_count": len(rejected),
                "approved_indices": approved,
                "rejected_indices": rejected
            },
            "notes": session.notes,
            "metadata": session.metadata
        }
