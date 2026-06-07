import uuid
from typing import Dict, List, Optional, Type, TypeVar
from .models import (
    ConstructionNotice,
    RampRecord,
    AuditLog,
    RectificationSuggestion,
    ScoreResult,
    WorkflowState,
    Role,
)

T = TypeVar("T")


class DataStore:
    def __init__(self):
        self.notices: Dict[str, ConstructionNotice] = {}
        self.ramp_records: Dict[str, RampRecord] = {}
        self.audit_logs: List[AuditLog] = []
        self.suggestions: Dict[str, List[RectificationSuggestion]] = {}
        self.scores: Dict[str, List[ScoreResult]] = {}
        self.workflows: Dict[str, WorkflowState] = {}

    @staticmethod
    def _gen_id() -> str:
        return uuid.uuid4().hex[:12]

    def add_notice(self, notice: ConstructionNotice) -> ConstructionNotice:
        if not notice.id:
            notice.id = self._gen_id()
        self.notices[notice.id] = notice
        self._log_audit("notice", notice.id, "create", None, notice.model_dump(), Role.SYSTEM, "导入施工告示")
        return notice

    def get_notice(self, notice_id: str) -> Optional[ConstructionNotice]:
        return self.notices.get(notice_id)

    def list_notices(self) -> List[ConstructionNotice]:
        return list(self.notices.values())

    def add_ramp_record(self, record: RampRecord) -> RampRecord:
        if not record.id:
            record.id = self._gen_id()
        self.ramp_records[record.id] = record
        self._log_audit(
            "ramp_record",
            record.id,
            "create",
            None,
            record.model_dump(),
            record.recorded_by,
            "补录坡道记录" if record.is_supplement else "录入坡道记录",
        )
        return record

    def get_ramp_records_for_notice(self, notice_id: str) -> List[RampRecord]:
        return [r for r in self.ramp_records.values() if r.notice_id == notice_id]

    def _log_audit(
        self,
        entity_type: str,
        entity_id: str,
        action: str,
        old_value: Optional[Dict],
        new_value: Optional[Dict],
        changed_by: Role,
        reason: str = "",
    ):
        log = AuditLog(
            id=self._gen_id(),
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            old_value=old_value,
            new_value=new_value,
            changed_by=changed_by,
            reason=reason,
        )
        self.audit_logs.append(log)

    def log_audit(
        self,
        entity_type: str,
        entity_id: str,
        action: str,
        old_value: Optional[Dict],
        new_value: Optional[Dict],
        changed_by: Role,
        reason: str = "",
    ):
        self._log_audit(entity_type, entity_id, action, old_value, new_value, changed_by, reason)

    def get_audit_logs(self, entity_type: Optional[str] = None, entity_id: Optional[str] = None) -> List[AuditLog]:
        logs = self.audit_logs
        if entity_type:
            logs = [l for l in logs if l.entity_type == entity_type]
        if entity_id:
            logs = [l for l in logs if l.entity_id == entity_id]
        return sorted(logs, key=lambda x: x.changed_at)

    def add_suggestion(self, suggestion: RectificationSuggestion) -> RectificationSuggestion:
        if not suggestion.id:
            suggestion.id = self._gen_id()
        if suggestion.notice_id not in self.suggestions:
            self.suggestions[suggestion.notice_id] = []
        for s in self.suggestions[suggestion.notice_id]:
            s.is_latest = False
        self.suggestions[suggestion.notice_id].append(suggestion)
        return suggestion

    def get_latest_suggestion(self, notice_id: str) -> Optional[RectificationSuggestion]:
        if notice_id not in self.suggestions:
            return None
        for s in reversed(self.suggestions[notice_id]):
            if s.is_latest:
                return s
        return None

    def get_all_suggestions(self, notice_id: str) -> List[RectificationSuggestion]:
        return self.suggestions.get(notice_id, [])

    def add_score(self, score: ScoreResult) -> ScoreResult:
        if not score.id:
            score.id = self._gen_id()
        if score.notice_id not in self.scores:
            self.scores[score.notice_id] = []
        self.scores[score.notice_id].append(score)
        return score

    def get_latest_score(self, notice_id: str) -> Optional[ScoreResult]:
        if notice_id not in self.scores or not self.scores[notice_id]:
            return None
        return self.scores[notice_id][-1]

    def get_all_scores(self, notice_id: str) -> List[ScoreResult]:
        return self.scores.get(notice_id, [])

    def set_workflow(self, workflow: WorkflowState) -> WorkflowState:
        self.workflows[workflow.notice_id] = workflow
        return workflow

    def get_workflow(self, notice_id: str) -> Optional[WorkflowState]:
        return self.workflows.get(notice_id)


store = DataStore()
