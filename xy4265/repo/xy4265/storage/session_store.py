#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
会话存储 - 复核会话记录
"""

import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

from models.data_models import ReviewSession, ReviewStatus


class SessionStore:
    """复核会话存储"""
    
    def __init__(self, storage_dir: Optional[str] = None):
        if storage_dir is None:
            home = Path.home()
            storage_dir = str(home / ".clause_redline" / "sessions")
        
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
    
    def start_session(self, project_id: str, reviewer: str) -> ReviewSession:
        """开始新的复核会话"""
        session = ReviewSession(
            session_id=f"session_{uuid.uuid4().hex[:8]}",
            project_id=project_id,
            reviewer=reviewer,
            started_at=datetime.now()
        )
        self._save_session(session)
        return session
    
    def end_session(self, session_id: str, notes: str = "") -> Optional[ReviewSession]:
        """结束复核会话"""
        session = self.get_session(session_id)
        if session:
            session.ended_at = datetime.now()
            session.notes = notes
            self._save_session(session)
        return session
    
    def _save_session(self, session: ReviewSession):
        """保存会话"""
        data = {
            "session_id": session.session_id,
            "project_id": session.project_id,
            "reviewer": session.reviewer,
            "started_at": session.started_at.isoformat() if session.started_at else None,
            "ended_at": session.ended_at.isoformat() if session.ended_at else None,
            "decisions": session.decisions,
            "notes": session.notes
        }
        
        file_path = self.storage_dir / f"{session.session_id}.json"
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def get_session(self, session_id: str) -> Optional[ReviewSession]:
        """获取会话"""
        file_path = self.storage_dir / f"{session_id}.json"
        
        if not file_path.exists():
            return None
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        started_at = datetime.fromisoformat(data["started_at"]) if data.get("started_at") else None
        ended_at = datetime.fromisoformat(data["ended_at"]) if data.get("ended_at") else None
        
        return ReviewSession(
            session_id=data["session_id"],
            project_id=data["project_id"],
            reviewer=data["reviewer"],
            started_at=started_at,
            ended_at=ended_at,
            decisions=data.get("decisions", {}),
            notes=data.get("notes", "")
        )
    
    def list_project_sessions(self, project_id: str) -> List[Dict[str, Any]]:
        """列出项目的所有会话"""
        sessions = []
        
        for session_file in self.storage_dir.glob("*.json"):
            try:
                with open(session_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                if data.get("project_id") == project_id:
                    sessions.append({
                        "session_id": data.get("session_id"),
                        "reviewer": data.get("reviewer"),
                        "started_at": data.get("started_at"),
                        "ended_at": data.get("ended_at"),
                        "decision_count": len(data.get("decisions", {}))
                    })
            except Exception:
                continue
        
        sessions.sort(key=lambda x: x.get("started_at", ""), reverse=True)
        return sessions
    
    def record_decision(
        self,
        session_id: str,
        risk_id: str,
        decision: str,
        note: str = ""
    ) -> bool:
        """记录风险项决策"""
        session = self.get_session(session_id)
        if not session:
            return False
        
        session.decisions[risk_id] = {
            "decision": decision,
            "note": note,
            "timestamp": datetime.now().isoformat()
        }
        
        self._save_session(session)
        return True
