from __future__ import annotations

import uuid
from typing import List, Optional, Dict, Any
import pandas as pd

from .models import (
    ResampleSession,
    ResampleRecord,
    RecordStatus,
    AuditAction,
)
from .resampler import ImbalanceResampler
from .data_store import DataStore


class WorkflowEngine:
    def __init__(self, data_store: DataStore, resampler: Optional[ImbalanceResampler] = None):
        self.data_store = data_store
        self.resampler = resampler or ImbalanceResampler()

    def step1_import_snapshot(
        self,
        df: pd.DataFrame,
        score_column: str,
        label_column: Optional[str] = None,
        created_by: str = "ayue",
        session_id: Optional[str] = None,
    ) -> ResampleSession:
        session_id = session_id or f"session_{uuid.uuid4().hex[:8]}"

        records = self.resampler.import_feature_snapshot(
            df=df,
            score_column=score_column,
            label_column=label_column,
            snapshot_id=f"snap_{session_id}",
            operator=created_by,
        )

        session = ResampleSession(
            session_id=session_id,
            created_by=created_by,
            records=records,
            config={
                "score_column": score_column,
                "label_column": label_column,
                "step": 1,
                "step_name": "特征快照导入",
            },
        )

        session.summary_stats = self._compute_stats(session)
        self.data_store.save_session(session)

        return session

    def step2_ayue_review_training_logs(
        self,
        session_id: str,
        record_decisions: Dict[str, Dict[str, Any]],
        reviewer: str = "ayue",
    ) -> ResampleSession:
        session = self.data_store.load_session(session_id)

        for record_id, decision in record_decisions.items():
            record = next(
                (r for r in session.records if r.record_id == record_id),
                None,
            )
            if record is None:
                continue

            record.training_log_curve_check = decision.get("curve_ok", False)

            if decision.get("keep_suspicious", False):
                record.change_status(
                    new_status=RecordStatus.NEEDS_RECHECK,
                    operator=reviewer,
                    comment=decision.get("note", "阿越查看训练日志后，留待推荐负责人复核"),
                )
            elif decision.get("confirm_normal", False):
                record.change_status(
                    new_status=RecordStatus.REVIEWED_BY_AYUE,
                    operator=reviewer,
                    comment=decision.get("note", "阿越查看训练日志后确认正常"),
                )
            elif decision.get("exclude", False):
                record.change_status(
                    new_status=RecordStatus.EXCLUDED,
                    operator=reviewer,
                    comment=decision.get("note", "阿越查看训练日志后排除"),
                )

            record.ayue_review_note = decision.get("note", "")

            record.add_audit_entry(
                action=AuditAction.REVIEW_COMMENT,
                operator=reviewer,
                comment=f"训练日志曲线审查结论: {decision.get('note', '')}",
            )

        session.config["step"] = 2
        session.config["step_name"] = "训练日志曲线审查"
        session.config["reviewed_by"] = reviewer
        session.summary_stats = self._compute_stats(session)

        self.data_store.save_session(session)
        return session

    def step3_update_explanation_summary(
        self,
        session_id: str,
        explanations: Dict[str, Dict[str, Any]],
        operator: str = "system",
    ) -> ResampleSession:
        session = self.data_store.load_session(session_id)

        for record_id, expl in explanations.items():
            record = next(
                (r for r in session.records if r.record_id == record_id),
                None,
            )
            if record is None:
                continue

            old_summary = record.explanation_summary
            old_detail = record.explanation_detail

            record.explanation_summary = expl.get("summary", old_summary)
            record.explanation_detail = expl.get("detail", old_detail)

            record.add_audit_entry(
                action=AuditAction.SUMMARY_UPDATE,
                operator=operator,
                old_value={"summary": old_summary, "detail": old_detail},
                new_value={"summary": record.explanation_summary, "detail": record.explanation_detail},
                comment=expl.get("update_note", "更新可解释摘要"),
            )

        session.config["step"] = 3
        session.config["step_name"] = "可解释摘要更新"
        session.summary_stats = self._compute_stats(session)

        self.data_store.save_session(session)
        return session

    def recommend_leader_review(
        self,
        session_id: str,
        record_decisions: Dict[str, Dict[str, Any]],
        operator: str = "recommend_leader",
    ) -> ResampleSession:
        session = self.data_store.load_session(session_id)

        for record_id, decision in record_decisions.items():
            record = next(
                (r for r in session.records if r.record_id == record_id),
                None,
            )
            if record is None:
                continue

            if decision.get("confirm_normal", False):
                record.change_status(
                    new_status=RecordStatus.CONFIRMED_NORMAL,
                    operator=operator,
                    comment=decision.get("note", "推荐负责人复核后确认为正常"),
                )
            elif decision.get("exclude", False):
                record.change_status(
                    new_status=RecordStatus.EXCLUDED,
                    operator=operator,
                    comment=decision.get("note", "推荐负责人复核后排除"),
                )

        session.summary_stats = self._compute_stats(session)
        self.data_store.save_session(session)
        return session

    def rollback_record(
        self,
        session_id: str,
        record_id: str,
        to_audit_index: int,
        operator: str,
        reason: str,
    ) -> ResampleSession:
        session = self.data_store.load_session(session_id)
        record = next(
            (r for r in session.records if r.record_id == record_id),
            None,
        )
        if record is None:
            raise ValueError(f"Record {record_id} not found")

        if to_audit_index < 0 or to_audit_index >= len(record.audit_log):
            raise ValueError(f"Invalid audit index {to_audit_index}")

        target_audit = record.audit_log[to_audit_index]

        new_record = ResampleRecord(
            record_id=f"rec_{uuid.uuid4().hex[:10]}",
            snapshot=record.snapshot.model_copy(deep=True),
            current_status=RecordStatus.IMPORTED,
            is_rollback_of=record.record_id,
        )

        for i in range(to_audit_index + 1):
            audit_entry = record.audit_log[i]
            new_record.audit_log.append(audit_entry.model_copy(deep=True))

        new_record.add_audit_entry(
            action=AuditAction.ROLLBACK,
            operator=operator,
            old_value=record.record_id,
            new_value=new_record.record_id,
            comment=f"回滚到第{to_audit_index}条审计记录。原因: {reason}。原记录: {target_audit.comment}",
        )

        session.records.append(new_record)

        record.change_status(
            new_status=RecordStatus.EXCLUDED,
            operator=operator,
            comment=f"被回滚，新记录ID: {new_record.record_id}。回滚原因: {reason}",
        )

        self.data_store.save_session(session)
        return session

    def _compute_stats(self, session: ResampleSession) -> Dict[str, Any]:
        stats = {
            "total": len(session.records),
            "by_status": {},
        }
        for rec in session.records:
            status = rec.current_status.value
            stats["by_status"][status] = stats["by_status"].get(status, 0) + 1

        suspicious = [
            r for r in session.records
            if r.snapshot.used_default_score and r.snapshot.has_missing_features
        ]
        stats["suspicious_default_score"] = len(suspicious)

        needs_recheck = session.get_records_by_status(RecordStatus.NEEDS_RECHECK)
        stats["needs_recheck_count"] = len(needs_recheck)

        return stats

    def get_suspicious_records_for_review(self, session_id: str) -> List[ResampleRecord]:
        session = self.data_store.load_session(session_id)
        return session.get_suspicious_records()
