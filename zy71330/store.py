import json
from datetime import datetime
from typing import List, Optional
from models import CorrectionAudit, Level, ScoreReport, Session
from engine import judge_level, compute_score, generate_playback_hints


class Store:
    def __init__(self) -> None:
        self.sessions: dict[str, Session] = {}
        self.levels: dict[str, Level] = {}
        self.reports: dict[str, ScoreReport] = {}
        self.audits: dict[str, CorrectionAudit] = {}
        self._audit_counter = 0

    def add_session(self, session: Session) -> None:
        self.sessions[session.session_id] = session

    def get_session(self, session_id: str) -> Optional[Session]:
        return self.sessions.get(session_id)

    def add_level(self, level: Level) -> None:
        self.levels[level.level_id] = level
        session = self.sessions.get(level.session_id)
        if session and level.level_id not in session.levels:
            session.levels.append(level.level_id)

    def get_level(self, level_id: str) -> Optional[Level]:
        return self.levels.get(level_id)

    def add_report(self, report: ScoreReport) -> None:
        self.reports[report.level_id] = report

    def get_report(self, level_id: str) -> Optional[ScoreReport]:
        return self.reports.get(level_id)

    def correct_field(
        self,
        session_id: str,
        level_id: str,
        field_path: str,
        old_value: str,
        new_value: str,
        reason: str,
        corrected_by: str,
    ) -> CorrectionAudit:
        self._audit_counter += 1
        audit = CorrectionAudit(
            audit_id=f"audit_{self._audit_counter}",
            session_id=session_id,
            level_id=level_id,
            field_path=field_path,
            old_value=old_value,
            new_value=new_value,
            reason=reason,
            corrected_by=corrected_by,
            corrected_at=datetime.now(),
        )
        self.audits[audit.audit_id] = audit
        return audit

    def get_audits_for_session(self, session_id: str) -> List[CorrectionAudit]:
        return [a for a in self.audits.values() if a.session_id == session_id]

    def get_audits_for_level(self, level_id: str) -> List[CorrectionAudit]:
        return [a for a in self.audits.values() if a.level_id == level_id]


store = Store()
