import json
import uuid
from dataclasses import dataclass, asdict, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

from config import DATA_DIR
from risk_fusion import FusionResult, RiskSource, KeywordEvidence, TimeConflict


@dataclass
class ReviewRecord:
    review_id: str
    call_id: str
    original_risk: str
    new_risk: str
    reviewer: str
    review_time: datetime
    reason: str
    notes: str = ""


@dataclass
class SessionState:
    session_id: str
    created_at: datetime
    updated_at: datetime
    call_ids: List[str] = field(default_factory=list)
    processed_calls: List[str] = field(default_factory=list)
    reviewed_calls: Dict[str, ReviewRecord] = field(default_factory=dict)
    time_conflicts: List[Dict] = field(default_factory=list)
    
    metadata: Dict = field(default_factory=dict)


class StorageManager:
    def __init__(self, data_dir: Optional[Path] = None):
        self.data_dir = data_dir or DATA_DIR
        self.sessions_dir = self.data_dir / "sessions"
        self.sessions_dir.mkdir(parents=True, exist_ok=True)
        
        self._current_session: Optional[SessionState] = None
    
    def create_session(self, metadata: Optional[Dict] = None) -> SessionState:
        session_id = datetime.now().strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:6]
        now = datetime.now()
        
        self._current_session = SessionState(
            session_id=session_id,
            created_at=now,
            updated_at=now,
            metadata=metadata or {}
        )
        
        return self._current_session
    
    def load_session(self, session_id: str) -> Optional[SessionState]:
        session_file = self.sessions_dir / f"{session_id}.json"
        
        if not session_file.exists():
            return None
        
        with open(session_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        self._current_session = self._dict_to_session(data)
        return self._current_session
    
    def save_session(self) -> str:
        if not self._current_session:
            raise RuntimeError("没有当前会话，请先调用 create_session() 或 load_session()")
        
        self._current_session.updated_at = datetime.now()
        
        session_file = self.sessions_dir / f"{self._current_session.session_id}.json"
        
        with open(session_file, 'w', encoding='utf-8') as f:
            json.dump(self._session_to_dict(self._current_session), f, ensure_ascii=False, indent=2, default=str)
        
        return str(session_file)
    
    def add_call_to_session(self, call_id: str) -> None:
        if not self._current_session:
            self.create_session()
        
        if call_id not in self._current_session.call_ids:
            self._current_session.call_ids.append(call_id)
    
    def mark_call_processed(self, call_id: str) -> None:
        if not self._current_session:
            return
        
        if call_id not in self._current_session.processed_calls:
            self._current_session.processed_calls.append(call_id)
    
    def add_review(
        self,
        call_id: str,
        original_risk: str,
        new_risk: str,
        reviewer: str,
        reason: str,
        notes: str = ""
    ) -> ReviewRecord:
        if not self._current_session:
            self.create_session()
        
        review_id = uuid.uuid4().hex[:12]
        
        review = ReviewRecord(
            review_id=review_id,
            call_id=call_id,
            original_risk=original_risk,
            new_risk=new_risk,
            reviewer=reviewer,
            review_time=datetime.now(),
            reason=reason,
            notes=notes
        )
        
        self._current_session.reviewed_calls[call_id] = review
        
        return review
    
    def set_time_conflicts(self, conflicts: List[TimeConflict]) -> None:
        if not self._current_session:
            self.create_session()
        
        self._current_session.time_conflicts = [
            self._time_conflict_to_dict(c) for c in conflicts
        ]
    
    def get_current_session(self) -> Optional[SessionState]:
        return self._current_session
    
    def list_sessions(self) -> List[Dict]:
        sessions = []
        
        for session_file in self.sessions_dir.glob("*.json"):
            try:
                with open(session_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                sessions.append({
                    "session_id": data.get("session_id"),
                    "created_at": data.get("created_at"),
                    "updated_at": data.get("updated_at"),
                    "call_count": len(data.get("call_ids", [])),
                    "processed_count": len(data.get("processed_calls", [])),
                    "reviewed_count": len(data.get("reviewed_calls", {}))
                })
            except (json.JSONDecodeError, KeyError):
                continue
        
        sessions.sort(key=lambda x: x["created_at"], reverse=True)
        return sessions
    
    def save_fusion_results(
        self,
        results: Dict[str, FusionResult],
        filename: Optional[str] = None
    ) -> str:
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"fusion_results_{timestamp}.json"
        
        filepath = self.data_dir / filename
        
        results_dict = {}
        for call_id, result in results.items():
            results_dict[call_id] = self._fusion_result_to_dict(result)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(results_dict, f, ensure_ascii=False, indent=2, default=str)
        
        return str(filepath)
    
    def load_fusion_results(self, filepath: str) -> Dict[str, FusionResult]:
        path = Path(filepath)
        if not path.exists():
            raise FileNotFoundError(f"结果文件不存在: {filepath}")
        
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        results = {}
        for call_id, result_dict in data.items():
            results[call_id] = self._dict_to_fusion_result(result_dict)
        
        return results
    
    def _session_to_dict(self, session: SessionState) -> Dict:
        return {
            "session_id": session.session_id,
            "created_at": session.created_at.isoformat() if session.created_at else None,
            "updated_at": session.updated_at.isoformat() if session.updated_at else None,
            "call_ids": session.call_ids,
            "processed_calls": session.processed_calls,
            "reviewed_calls": {
                call_id: {
                    "review_id": r.review_id,
                    "call_id": r.call_id,
                    "original_risk": r.original_risk,
                    "new_risk": r.new_risk,
                    "reviewer": r.reviewer,
                    "review_time": r.review_time.isoformat() if r.review_time else None,
                    "reason": r.reason,
                    "notes": r.notes
                }
                for call_id, r in session.reviewed_calls.items()
            },
            "time_conflicts": session.time_conflicts,
            "metadata": session.metadata
        }
    
    def _dict_to_session(self, data: Dict) -> SessionState:
        reviewed_calls = {}
        for call_id, r_data in data.get("reviewed_calls", {}).items():
            reviewed_calls[call_id] = ReviewRecord(
                review_id=r_data.get("review_id", ""),
                call_id=r_data.get("call_id", ""),
                original_risk=r_data.get("original_risk", ""),
                new_risk=r_data.get("new_risk", ""),
                reviewer=r_data.get("reviewer", ""),
                review_time=datetime.fromisoformat(r_data["review_time"]) if r_data.get("review_time") else None,
                reason=r_data.get("reason", ""),
                notes=r_data.get("notes", "")
            )
        
        created_at = datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now()
        updated_at = datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else datetime.now()
        
        return SessionState(
            session_id=data.get("session_id", ""),
            created_at=created_at,
            updated_at=updated_at,
            call_ids=data.get("call_ids", []),
            processed_calls=data.get("processed_calls", []),
            reviewed_calls=reviewed_calls,
            time_conflicts=data.get("time_conflicts", []),
            metadata=data.get("metadata", {})
        )
    
    def _fusion_result_to_dict(self, result: FusionResult) -> Dict:
        return {
            "call_id": result.call_id,
            "final_risk": result.final_risk,
            "final_risk_level": result.final_risk_level,
            "risk_source": result.risk_source.value if result.risk_source else None,
            "confidence": result.confidence,
            "keyword_evidences": [
                {
                    "keyword": e.keyword,
                    "count": e.count,
                    "category": e.category,
                    "context": e.context
                }
                for e in result.keyword_evidences
            ],
            "is_missed_high_risk": result.is_missed_high_risk,
            "template_issue_score": result.template_issue_score,
            "has_template_issue": result.has_template_issue,
            "manual_override": result.manual_override,
            "override_reason": result.override_reason,
            "notes": result.notes,
            "model_probabilities": result.model_result.probabilities if result.model_result else None,
            "model_confidence": result.model_result.confidence if result.model_result else None
        }
    
    def _dict_to_fusion_result(self, data: Dict) -> FusionResult:
        evidences = []
        for e_data in data.get("keyword_evidences", []):
            evidences.append(KeywordEvidence(
                keyword=e_data.get("keyword", ""),
                count=e_data.get("count", 0),
                category=e_data.get("category", ""),
                context=e_data.get("context", "")
            ))
        
        risk_source = None
        risk_source_str = data.get("risk_source")
        if risk_source_str:
            for rs in RiskSource:
                if rs.value == risk_source_str:
                    risk_source = rs
                    break
        
        return FusionResult(
            call_id=data.get("call_id", ""),
            final_risk=data.get("final_risk", "低风险"),
            final_risk_level=data.get("final_risk_level", 1),
            risk_source=risk_source or RiskSource.FUSION,
            confidence=data.get("confidence", 0.5),
            keyword_evidences=evidences,
            is_missed_high_risk=data.get("is_missed_high_risk", False),
            template_issue_score=data.get("template_issue_score", 0.0),
            has_template_issue=data.get("has_template_issue", False),
            manual_override=data.get("manual_override", False),
            override_reason=data.get("override_reason", ""),
            notes=data.get("notes", "")
        )
    
    def _time_conflict_to_dict(self, conflict: TimeConflict) -> Dict:
        return {
            "call_id_1": conflict.call_id_1,
            "call_id_2": conflict.call_id_2,
            "time_1": conflict.time_1.isoformat() if conflict.time_1 else None,
            "time_2": conflict.time_2.isoformat() if conflict.time_2 else None,
            "volunteer": conflict.volunteer,
            "conflict_type": conflict.conflict_type
        }
