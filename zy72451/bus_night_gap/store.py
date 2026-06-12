import uuid
import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Type, TypeVar
from pathlib import Path
from .models import (
    ConstructionNotice,
    RampRecord,
    AuditLog,
    RectificationSuggestion,
    ScoreResult,
    WorkflowState,
    Role,
    RecordStatus,
)

T = TypeVar("T")
DATA_FILE = Path(__file__).parent.parent / "data" / "store.json"


class EnhancedAuditLog(AuditLog):
    affected_results: List[str] = []
    missing_materials_before: List[str] = []
    missing_materials_after: List[str] = []
    score_before: Optional[float] = None
    score_after: Optional[float] = None
    suggestion_version_before: Optional[int] = None
    suggestion_version_after: Optional[int] = None
    status_before: Optional[RecordStatus] = None
    status_after: Optional[RecordStatus] = None


class DataStore:
    def __init__(self, persist: bool = True):
        self.persist = persist
        self.notices: Dict[str, ConstructionNotice] = {}
        self.ramp_records: Dict[str, RampRecord] = {}
        self.audit_logs: List[EnhancedAuditLog] = []
        self.suggestions: Dict[str, List[RectificationSuggestion]] = {}
        self.scores: Dict[str, List[ScoreResult]] = {}
        self.workflows: Dict[str, WorkflowState] = {}
        self._last_snapshot = None
        if self.persist:
            self._load()

    def _save(self):
        if not self.persist:
            return
        DATA_FILE.parent.mkdir(exist_ok=True)
        data = {
            "notices": {k: v.model_dump(mode="json") for k, v in self.notices.items()},
            "ramp_records": {k: v.model_dump(mode="json") for k, v in self.ramp_records.items()},
            "audit_logs": [l.model_dump(mode="json") for l in self.audit_logs],
            "suggestions": {k: [v.model_dump(mode="json") for v in vs] for k, vs in self.suggestions.items()},
            "scores": {k: [v.model_dump(mode="json") for v in vs] for k, vs in self.scores.items()},
            "workflows": {k: v.model_dump(mode="json") for k, v in self.workflows.items()},
        }
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _load(self):
        if DATA_FILE.exists():
            try:
                with open(DATA_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for k, v in data.get("notices", {}).items():
                    self.notices[k] = ConstructionNotice(**v)
                for k, v in data.get("ramp_records", {}).items():
                    self.ramp_records[k] = RampRecord(**v)
                for l in data.get("audit_logs", []):
                    self.audit_logs.append(EnhancedAuditLog(**l))
                for k, vs in data.get("suggestions", {}).items():
                    self.suggestions[k] = [RectificationSuggestion(**v) for v in vs]
                for k, vs in data.get("scores", {}).items():
                    self.scores[k] = [ScoreResult(**v) for v in vs]
                for k, v in data.get("workflows", {}).items():
                    self.workflows[k] = WorkflowState(**v)
            except Exception as e:
                    print(f"⚠️  加载数据失败: {e}")

    def snapshot(self):
        self._last_snapshot = {
            "scores": {k: [s.model_dump() for s in vs] for k, vs in self.scores.items()},
            "suggestions": {k: [s.model_dump() for s in vs] for k, vs in self.suggestions.items()},
            "workflows": {k: v.model_dump() for k, v in self.workflows.items()},
        }

    @staticmethod
    def _gen_id() -> str:
        return uuid.uuid4().hex[:12]

    def _compare_and_log(
        self,
        entity_type: str,
        entity_id: str,
        action: str,
        old_value: Optional[Dict],
        new_value: Optional[Dict],
        changed_by: Role,
        reason: str = "",
        affected_notice_id: Optional[str] = None,
        change_description: str = "",
    ):
        notice_id = affected_notice_id or entity_id
        prev_score_before = None
        prev_score_after = None
        missing_before: List[str] = []
        missing_after: List[str] = []
        sugg_ver_before = None
        sugg_ver_after = None
        status_before = None
        status_after = None
        affected_results: List[str] = []

        if self._last_snapshot and notice_id in self._last_snapshot["scores"]:
            old_scores = self._last_snapshot["scores"].get(notice_id, [])
            if old_scores:
                prev_score_before = old_scores[-1]["score"] if old_scores else None

        latest_score = self.get_latest_score(notice_id)
        if latest_score:
            prev_score_after = latest_score.score

        if self._last_snapshot and notice_id in self._last_snapshot["suggestions"]:
            old_suggs = self._last_snapshot["suggestions"].get(notice_id, [])
            if old_suggs:
                missing_before = old_suggs[-1].get("missing_materials", [])
                sugg_ver_before = old_suggs[-1].get("version")
                status_before = old_suggs[-1].get("status")

        latest_sugg = self.get_latest_suggestion(notice_id)
        if latest_sugg:
            missing_after = latest_sugg.missing_materials
            sugg_ver_after = latest_sugg.version
            status_after = latest_sugg.status.value

        if prev_score_before is not None and prev_score_after is not None:
            if abs(prev_score_before - prev_score_after) > 0.001:
                affected_results.append(f"评分从 {prev_score_before:.1f} 变为 {prev_score_after:.1f}")

        if missing_before != missing_after:
            added = [m for m in missing_after if m not in missing_before]
            removed = [m for m in missing_before if m not in missing_after]
            if added:
                affected_results.append(f"新增缺材料清单增加: {', '.join(added)}")
            if removed:
                affected_results.append(f"缺材料清单移除: {', '.join(removed)}")
            if not added and not removed:
                affected_results.append("缺材料清单有变化")

        if status_before != status_after:
            affected_results.append(f"状态从 {status_before} 变为 {status_after}")

        if sugg_ver_before != sugg_ver_after:
            affected_results.append(f"整改建议版本从 {sugg_ver_before} 变为 {sugg_ver_after}")

        if change_description:
            affected_results.append(change_description)

        if not affected_results:
            affected_results.append("暂无直接影响")

        log = EnhancedAuditLog(
            id=self._gen_id(),
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            old_value=old_value,
            new_value=new_value,
            changed_by=changed_by,
            changed_at=datetime.now(),
            reason=reason,
            affected_results=affected_results,
            missing_materials_before=missing_before,
            missing_materials_after=missing_after,
            score_before=prev_score_before,
            score_after=prev_score_after,
            suggestion_version_before=sugg_ver_before,
            suggestion_version_after=sugg_ver_after,
            status_before=RecordStatus(status_before) if status_before else None,
            status_after=RecordStatus(status_after) if status_after else None,
        )
        self.audit_logs.append(log)
        self._save()
        return log

    def add_notice(self, notice: ConstructionNotice) -> ConstructionNotice:
        self.snapshot()
        if not notice.id:
            notice.id = self._gen_id()
        self.notices[notice.id] = notice
        self._compare_and_log(
            "notice", notice.id, "create",
            None, notice.model_dump(),
            Role.SYSTEM,
            "导入施工告示",
            notice.id,
            f"导入了[{notice.road_name}]的施工告示，原始备注保留了{len(notice.raw_notes)}字符的现场描述"
        )
        return notice

    def get_notice(self, notice_id: str) -> Optional[ConstructionNotice]:
        return self.notices.get(notice_id)

    def list_notices(self) -> List[ConstructionNotice]:
        return list(self.notices.values())

    def add_ramp_record(self, record: RampRecord) -> RampRecord:
        self.snapshot()
        if not record.id:
            record.id = self._gen_id()
        self.ramp_records[record.id] = record
        desc_parts = []
        if record.raw_notes:
            desc_parts.append(f"备注包含现场描述：{record.raw_notes[:50]}...")
        if record.is_supplement:
            desc_parts.append("这是补录记录")
        desc = "；".join(desc_parts) if desc_parts else ""
        self._compare_and_log(
            "ramp_record",
            record.id,
            "create",
            None,
            record.model_dump(),
            record.recorded_by,
            "补录坡道记录" if record.is_supplement else "录入坡道记录",
            record.notice_id,
            desc
        )
        return record

    def update_ramp_record_notes(self, record_id: str, new_raw_notes: str, changed_by: Role, reason: str = "") -> Optional[RampRecord]:
        self.snapshot()
        record = self.ramp_records.get(record_id)
        if not record:
            return None
        old_value = record.model_dump()
        old_notes = record.raw_notes
        record.raw_notes = new_raw_notes
        record.notes = new_raw_notes[:50] + "..." if len(new_raw_notes) > 50 else new_raw_notes
        self._compare_and_log(
            "ramp_record",
            record_id,
            "update_notes",
            old_value,
            record.model_dump(),
            changed_by,
            reason or "修改坡道记录备注",
            record.notice_id,
            f"备注从「{old_notes[:30]}...」更新为「{new_raw_notes[:30]}...」"
        )
        return record

    def get_ramp_records_for_notice(self, notice_id: str) -> List[RampRecord]:
        return [r for r in self.ramp_records.values() if r.notice_id == notice_id]

    def get_audit_logs(self, entity_type: Optional[str] = None, entity_id: Optional[str] = None) -> List[EnhancedAuditLog]:
        logs = self.audit_logs
        if entity_type:
            logs = [l for l in logs if l.entity_type == entity_type]
        if entity_id:
            logs = [l for l in logs if l.entity_id == entity_id]
        return sorted(logs, key=lambda x: x.changed_at)

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
        self.snapshot()
        affected_notice = entity_id
        if entity_type == "ramp_record" and new_value:
            affected_notice = new_value.get("notice_id") or affected_notice
        self._compare_and_log(
            entity_type, entity_id, action,
            old_value, new_value, changed_by, reason,
            affected_notice,
            ""
        )

    def add_suggestion(self, suggestion: RectificationSuggestion) -> RectificationSuggestion:
        self.snapshot()
        if not suggestion.id:
            suggestion.id = self._gen_id()
        if suggestion.notice_id not in self.suggestions:
            self.suggestions[suggestion.notice_id] = []
        for s in self.suggestions[suggestion.notice_id]:
            s.is_latest = False
        self.suggestions[suggestion.notice_id].append(suggestion)
        self._save()
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
        self.snapshot()
        if not score.id:
            score.id = self._gen_id()
        if score.notice_id not in self.scores:
            self.scores[score.notice_id] = []
        self.scores[score.notice_id].append(score)
        self._save()
        return score

    def get_latest_score(self, notice_id: str) -> Optional[ScoreResult]:
        if notice_id not in self.scores or not self.scores[notice_id]:
            return None
        return self.scores[notice_id][-1]

    def get_all_scores(self, notice_id: str) -> List[ScoreResult]:
        return self.scores.get(notice_id, [])

    def set_workflow(self, workflow: WorkflowState) -> WorkflowState:
        self.snapshot()
        self.workflows[workflow.notice_id] = workflow
        self._save()
        return workflow

    def get_workflow(self, notice_id: str) -> Optional[WorkflowState]:
        return self.workflows.get(notice_id)

    def clear(self):
        self.notices.clear()
        self.ramp_records.clear()
        self.audit_logs.clear()
        self.suggestions.clear()
        self.scores.clear()
        self.workflows.clear()
        if DATA_FILE.exists():
            DATA_FILE.unlink()
        self._save()


store = DataStore()
