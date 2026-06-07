import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from .models import (
    ProcessingStatus,
    FeatureSnapshot,
    TrainingLog,
    ThresholdChange,
    ManualChange,
    ScoringDifferenceRecord,
    AuditLog,
)
from .storage import ResultStore


class WorkflowEngine:
    """
    三步工作流引擎：
    1. 特征快照编号第一次导入
    2. 数据科学家林姐补看训练日志曲线
    3. 分层指标更新

    关键规则：
    - 阈值改过但报告仍写旧值 → 自动标记为 THRESHOLD_MISMATCH，不自动归为正常
    - 所有状态变更都留下审计日志
    - 数据科学家确认前，记录停在待处理状态
    """

    VALID_TRANSITIONS = {
        ProcessingStatus.PENDING: {
            ProcessingStatus.IMPORTED,
        },
        ProcessingStatus.IMPORTED: {
            ProcessingStatus.LOGS_REVIEWED,
            ProcessingStatus.METRICS_UPDATED,
            ProcessingStatus.CONFIRMED_NORMAL,
            ProcessingStatus.CONFIRMED_ABNORMAL,
            ProcessingStatus.THRESHOLD_MISMATCH,
            ProcessingStatus.NEEDS_REVIEW,
        },
        ProcessingStatus.LOGS_REVIEWED: {
            ProcessingStatus.IMPORTED,
            ProcessingStatus.METRICS_UPDATED,
            ProcessingStatus.CONFIRMED_NORMAL,
            ProcessingStatus.CONFIRMED_ABNORMAL,
            ProcessingStatus.THRESHOLD_MISMATCH,
            ProcessingStatus.NEEDS_REVIEW,
        },
        ProcessingStatus.METRICS_UPDATED: {
            ProcessingStatus.IMPORTED,
            ProcessingStatus.LOGS_REVIEWED,
            ProcessingStatus.CONFIRMED_NORMAL,
            ProcessingStatus.CONFIRMED_ABNORMAL,
            ProcessingStatus.THRESHOLD_MISMATCH,
            ProcessingStatus.NEEDS_REVIEW,
        },
        ProcessingStatus.THRESHOLD_MISMATCH: {
            ProcessingStatus.CONFIRMED_NORMAL,
            ProcessingStatus.CONFIRMED_ABNORMAL,
            ProcessingStatus.NEEDS_REVIEW,
        },
        ProcessingStatus.NEEDS_REVIEW: {
            ProcessingStatus.CONFIRMED_NORMAL,
            ProcessingStatus.CONFIRMED_ABNORMAL,
            ProcessingStatus.IMPORTED,
            ProcessingStatus.LOGS_REVIEWED,
            ProcessingStatus.METRICS_UPDATED,
            ProcessingStatus.THRESHOLD_MISMATCH,
        },
        ProcessingStatus.CONFIRMED_NORMAL: set(),
        ProcessingStatus.CONFIRMED_ABNORMAL: set(),
    }

    def __init__(self, store: ResultStore):
        self.store = store

    def _can_transition(
        self, current: ProcessingStatus, target: ProcessingStatus
    ) -> bool:
        return target in self.VALID_TRANSITIONS.get(current, set())

    def _transition(
        self,
        record: ScoringDifferenceRecord,
        target_status: ProcessingStatus,
        actor: str,
        action: str,
        details: Optional[Dict[str, Any]] = None,
    ) -> ScoringDifferenceRecord:
        old_status = record.current_status
        if not self._can_transition(old_status, target_status):
            raise ValueError(
                f"无效的状态转换: {old_status.value} -> {target_status.value}"
            )

        record.current_status = target_status
        record.updated_at = datetime.now()

        audit = AuditLog(
            record_id=record.record_id,
            action=action,
            actor=actor,
            old_status=old_status,
            new_status=target_status,
            details=details,
        )
        self.store.add_audit_log(audit)
        self.store.save_record(record)
        return record

    def step1_import_snapshot(
        self,
        snapshot_id: str,
        original_line_number: int,
        main_flow: str,
        raw_data: Dict[str, Any],
        online_score: float,
        offline_score: float,
        source_file: Optional[str] = None,
        sheet_name: Optional[str] = None,
        imported_by: str = "system",
    ) -> ScoringDifferenceRecord:
        existing = self.store.get_record_by_snapshot(snapshot_id)
        if existing:
            raise ValueError(f"快照 {snapshot_id} 已存在")

        snapshot = FeatureSnapshot(
            snapshot_id=snapshot_id,
            original_line_number=original_line_number,
            main_flow=main_flow,
            raw_data=raw_data,
            source_file=source_file,
            sheet_name=sheet_name,
        )

        diff = online_score - offline_score
        percent_diff = (diff / offline_score * 100) if offline_score != 0 else 0.0

        record = ScoringDifferenceRecord(
            record_id=str(uuid.uuid4()),
            snapshot_id=snapshot_id,
            online_score=online_score,
            offline_score=offline_score,
            difference=diff,
            percent_diff=percent_diff,
            feature_snapshot=snapshot,
        )

        self.store.save_record(record)
        return self._transition(
            record,
            ProcessingStatus.IMPORTED,
            imported_by,
            "import_snapshot",
            {"original_line_number": original_line_number, "main_flow": main_flow},
        )

    def step2_review_training_logs(
        self,
        record_id: str,
        on_site_statement: str,
        curve_data: Dict[str, Any],
        reviewed_by: str = "林姐",
        reviewer_notes: Optional[str] = None,
    ) -> ScoringDifferenceRecord:
        record = self.store.get_record(record_id)
        if not record:
            raise ValueError(f"记录 {record_id} 不存在")

        log = TrainingLog(
            log_id=str(uuid.uuid4()),
            snapshot_id=record.snapshot_id,
            on_site_statement=on_site_statement,
            curve_data=curve_data,
            review_timestamp=datetime.now(),
            reviewed_by=reviewed_by,
            reviewer_notes=reviewer_notes,
        )
        record.training_logs.append(log)

        if self._detect_threshold_report_mismatch(record):
            if record.current_status == ProcessingStatus.THRESHOLD_MISMATCH:
                self.store.save_record(record)
                audit = AuditLog(
                    record_id=record.record_id,
                    action="review_training_logs_keep_mismatch",
                    actor=reviewed_by,
                    details={"log_id": log.log_id, "reviewer_notes": reviewer_notes},
                )
                self.store.add_audit_log(audit)
                return record
            return self._transition(
                record,
                ProcessingStatus.THRESHOLD_MISMATCH,
                reviewed_by,
                "review_logs_threshold_mismatch",
                {
                    "log_id": log.log_id,
                    "reviewer_notes": reviewer_notes,
                    "mismatch_detected": True,
                },
            )

        return self._transition(
            record,
            ProcessingStatus.LOGS_REVIEWED,
            reviewed_by,
            "review_training_logs",
            {"log_id": log.log_id, "reviewer_notes": reviewer_notes},
        )

    def step3_update_tier_metrics(
        self,
        record_id: str,
        tier_metrics: Dict[str, Any],
        updated_by: str = "林姐",
    ) -> ScoringDifferenceRecord:
        record = self.store.get_record(record_id)
        if not record:
            raise ValueError(f"记录 {record_id} 不存在")

        record.tier_metrics = tier_metrics
        record.tier_metrics_updated_by = updated_by
        record.tier_metrics_updated_at = datetime.now()

        if self._detect_threshold_report_mismatch(record):
            if record.current_status == ProcessingStatus.THRESHOLD_MISMATCH:
                self.store.save_record(record)
                audit = AuditLog(
                    record_id=record.record_id,
                    action="update_tier_metrics_keep_mismatch",
                    actor=updated_by,
                    details={},
                )
                self.store.add_audit_log(audit)
                return record
            return self._transition(
                record,
                ProcessingStatus.THRESHOLD_MISMATCH,
                updated_by,
                "update_metrics_threshold_mismatch",
                {"mismatch_detected": True},
            )

        return self._transition(
            record,
            ProcessingStatus.METRICS_UPDATED,
            updated_by,
            "update_tier_metrics",
            {},
        )

    def add_threshold_change(
        self,
        record_id: str,
        field_name: str,
        old_value: float,
        new_value: float,
        changed_by: str,
        change_reason: Optional[str] = None,
        report_still_shows_old: bool = False,
    ) -> ScoringDifferenceRecord:
        record = self.store.get_record(record_id)
        if not record:
            raise ValueError(f"记录 {record_id} 不存在")

        tc = ThresholdChange(
            change_id=str(uuid.uuid4()),
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            changed_by=changed_by,
            change_reason=change_reason,
            report_still_shows_old=report_still_shows_old,
        )
        record.threshold_changes.append(tc)

        if report_still_shows_old:
            return self._transition(
                record,
                ProcessingStatus.THRESHOLD_MISMATCH,
                changed_by,
                "add_threshold_change_mismatch",
                {
                    "change_id": tc.change_id,
                    "field_name": field_name,
                    "report_still_shows_old": True,
                },
            )

        self.store.save_record(record)
        audit = AuditLog(
            record_id=record.record_id,
            action="add_threshold_change",
            actor=changed_by,
            details={
                "change_id": tc.change_id,
                "field_name": field_name,
                "old_value": old_value,
                "new_value": new_value,
            },
        )
        self.store.add_audit_log(audit)
        return record

    def add_manual_change(
        self,
        record_id: str,
        field_name: str,
        old_value: Any,
        new_value: Any,
        changed_by: str,
        change_reason: Optional[str] = None,
    ) -> ScoringDifferenceRecord:
        record = self.store.get_record(record_id)
        if not record:
            raise ValueError(f"记录 {record_id} 不存在")

        mc = ManualChange(
            change_id=str(uuid.uuid4()),
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            changed_by=changed_by,
            change_reason=change_reason,
        )
        record.manual_changes.append(mc)
        record.updated_at = datetime.now()

        self.store.save_record(record)
        audit = AuditLog(
            record_id=record.record_id,
            action="add_manual_change",
            actor=changed_by,
            details={
                "change_id": mc.change_id,
                "field_name": field_name,
                "old_value": old_value,
                "new_value": new_value,
                "change_reason": change_reason,
            },
        )
        self.store.add_audit_log(audit)
        return record

    def confirm_normal(
        self,
        record_id: str,
        confirmed_by: str,
        notes: Optional[str] = None,
    ) -> ScoringDifferenceRecord:
        record = self.store.get_record(record_id)
        if not record:
            raise ValueError(f"记录 {record_id} 不存在")

        if notes:
            record.data_scientist_notes = notes

        return self._transition(
            record,
            ProcessingStatus.CONFIRMED_NORMAL,
            confirmed_by,
            "confirm_normal",
            {"notes": notes},
        )

    def confirm_abnormal(
        self,
        record_id: str,
        confirmed_by: str,
        notes: Optional[str] = None,
    ) -> ScoringDifferenceRecord:
        record = self.store.get_record(record_id)
        if not record:
            raise ValueError(f"记录 {record_id} 不存在")

        if notes:
            record.data_scientist_notes = notes

        return self._transition(
            record,
            ProcessingStatus.CONFIRMED_ABNORMAL,
            confirmed_by,
            "confirm_abnormal",
            {"notes": notes},
        )

    def mark_needs_review(
        self,
        record_id: str,
        marked_by: str,
        reason: str,
    ) -> ScoringDifferenceRecord:
        record = self.store.get_record(record_id)
        if not record:
            raise ValueError(f"记录 {record_id} 不存在")

        return self._transition(
            record,
            ProcessingStatus.NEEDS_REVIEW,
            marked_by,
            "mark_needs_review",
            {"reason": reason},
        )

    def rollback_status(
        self,
        record_id: str,
        target_status: ProcessingStatus,
        rolled_back_by: str,
        reason: str,
    ) -> ScoringDifferenceRecord:
        record = self.store.get_record(record_id)
        if not record:
            raise ValueError(f"记录 {record_id} 不存在")

        return self._transition(
            record,
            target_status,
            rolled_back_by,
            "rollback_status",
            {"reason": reason, "target_status": target_status.value},
        )

    def _detect_threshold_report_mismatch(
        self, record: ScoringDifferenceRecord
    ) -> bool:
        return record.has_threshold_mismatch()
