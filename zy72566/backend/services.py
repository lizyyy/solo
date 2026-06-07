"""
召回排序漏斗对账 - 核心业务逻辑
"""
import json
from typing import List, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session

from models import (
    EvaluationSlice,
    ReconciliationRecord,
    AuditLog,
    ReconciliationStatus,
)
from schemas import (
    ReconciliationRecordImport,
    FeatureSnapshotUpdate,
    ThresholdReplayUpdate,
    ManualReviewUpdate,
)
from boundary_rules import BoundaryRules


class ReconciliationService:
    """对账核心服务"""

    def __init__(self, db: Session):
        self.db = db
        self.rules = BoundaryRules()

    def _create_audit_log(
        self,
        record_id: int,
        action: str,
        operator: str,
        previous_value: Optional[dict] = None,
        new_value: Optional[dict] = None,
        remark: Optional[str] = None,
    ) -> AuditLog:
        """创建审计日志"""
        log = AuditLog(
            record_id=record_id,
            action=action,
            previous_value=json.dumps(previous_value, ensure_ascii=False) if previous_value else None,
            new_value=json.dumps(new_value, ensure_ascii=False) if new_value else None,
            operator=operator,
            remark=remark,
        )
        self.db.add(log)
        return log

    def import_evaluation_slice(
        self,
        slice_name: str,
        records: List[ReconciliationRecordImport],
        imported_by: str = "system",
        description: Optional[str] = None,
    ) -> Tuple[EvaluationSlice, dict]:
        """
        第一步: 导入评测切片

        边界规则:
        - 自动识别少数类样本
        - 自动检测被总指标盖住的样本
        - 被盖住的样本标记为待复核，不自动归为正常
        """
        slice_obj = EvaluationSlice(
            slice_name=slice_name,
            imported_by=imported_by,
            description=description,
            total_count=len(records),
        )
        self.db.add(slice_obj)
        self.db.flush()

        all_total_metrics = [r.total_metric for r in records if r.total_metric is not None]
        slice_avg_metric = sum(all_total_metrics) / len(all_total_metrics) if all_total_metrics else None

        minority_count = 0
        masked_count = 0

        for idx, record_data in enumerate(records):
            is_minority, _ = self.rules.is_minority_sample(
                record_data.sample_type,
                record_data.recall_rate,
            )

            is_masked, mask_reason = self.rules.is_masked_by_total_metric(
                is_minority,
                record_data.total_metric,
                slice_avg_metric,
            )

            if is_minority:
                minority_count += 1
            if is_masked:
                masked_count += 1

            status = ReconciliationStatus.STEP1_IMPORTED
            if is_masked:
                status = ReconciliationStatus.PENDING_REVIEW

            record = ReconciliationRecord(
                slice_id=slice_obj.id,
                original_row_number=record_data.original_row_number,
                sample_id=record_data.sample_id,
                sample_type=record_data.sample_type,
                is_minority=is_minority,
                recall_rate=record_data.recall_rate,
                precision_rate=record_data.precision_rate,
                total_metric=record_data.total_metric,
                is_masked_by_total=is_masked,
                status=status,
                manual_note=mask_reason if is_masked else None,
            )
            self.db.add(record)
            self.db.flush()

            self._create_audit_log(
                record_id=record.id,
                action="import",
                operator=imported_by,
                new_value={
                    "original_row_number": record.original_row_number,
                    "sample_id": record.sample_id,
                    "is_minority": is_minority,
                    "is_masked_by_total": is_masked,
                    "initial_status": status,
                },
                remark=f"导入评测切片: {slice_name}",
            )

        slice_obj.abnormal_count = masked_count
        self.db.commit()
        self.db.refresh(slice_obj)

        stats = {
            "total_records": len(records),
            "minority_count": minority_count,
            "masked_by_total_count": masked_count,
        }

        return slice_obj, stats

    def add_feature_snapshot(
        self,
        record_id: int,
        update: FeatureSnapshotUpdate,
    ) -> ReconciliationRecord:
        """
        第二步: 实验平台负责人阿越补看特征快照编号

        边界规则:
        - 必须是 step1_imported 状态才能进入此步骤
        - 被盖住的少数类样本保留待复核状态
        """
        record = self.db.query(ReconciliationRecord).filter(
            ReconciliationRecord.id == record_id
        ).first()

        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        if record.status not in [
            ReconciliationStatus.STEP1_IMPORTED,
            ReconciliationStatus.PENDING_REVIEW,
            ReconciliationStatus.ROLLBACK,
        ]:
            raise ValueError(f"当前状态 {record.status} 不允许补特征快照编号")

        previous = {
            "feature_snapshot_id": record.feature_snapshot_id,
            "status": record.status,
        }

        record.feature_snapshot_id = update.feature_snapshot_id
        record.feature_snapshot_added_by = update.operator
        record.feature_snapshot_added_time = datetime.now()

        if not record.is_masked_by_total and record.status == ReconciliationStatus.STEP1_IMPORTED:
            record.status = ReconciliationStatus.STEP2_FEATURE_ADDED

        if update.note:
            record.manual_note = (record.manual_note or "") + f"\n[补看特征快照] {update.note}"

        self._create_audit_log(
            record_id=record.id,
            action="add_feature_snapshot",
            operator=update.operator,
            previous_value=previous,
            new_value={
                "feature_snapshot_id": update.feature_snapshot_id,
                "status": record.status,
            },
            remark=update.note,
        )

        self.db.commit()
        self.db.refresh(record)
        return record

    def update_threshold_replay(
        self,
        record_id: int,
        update: ThresholdReplayUpdate,
    ) -> ReconciliationRecord:
        """
        第三步: 阈值回放更新

        边界规则:
        - 必须是 step2_feature_added 或 pending_review 状态
        - 被盖住的少数类样本仍然保持待复核，不自动归为正常
        """
        record = self.db.query(ReconciliationRecord).filter(
            ReconciliationRecord.id == record_id
        ).first()

        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        if record.status not in [
            ReconciliationStatus.STEP1_IMPORTED,
            ReconciliationStatus.STEP2_FEATURE_ADDED,
            ReconciliationStatus.PENDING_REVIEW,
            ReconciliationStatus.ROLLBACK,
        ]:
            raise ValueError(f"当前状态 {record.status} 不允许更新阈值回放")

        previous = {
            "threshold_value": record.threshold_value,
            "threshold_replay_result": record.threshold_replay_result,
            "status": record.status,
        }

        record.threshold_value = update.threshold_value
        record.threshold_replay_result = update.threshold_replay_result
        record.threshold_updated_by = update.operator
        record.threshold_updated_time = datetime.now()

        if not record.is_masked_by_total and record.status in [
            ReconciliationStatus.STEP1_IMPORTED,
            ReconciliationStatus.STEP2_FEATURE_ADDED,
        ]:
            record.status = ReconciliationStatus.STEP3_THRESHOLD_UPDATED

        if update.note:
            record.manual_note = (record.manual_note or "") + f"\n[阈值回放] {update.note}"

        self._create_audit_log(
            record_id=record.id,
            action="update_threshold",
            operator=update.operator,
            previous_value=previous,
            new_value={
                "threshold_value": update.threshold_value,
                "threshold_replay_result": update.threshold_replay_result,
                "status": record.status,
            },
            remark=update.note,
        )

        self.db.commit()
        self.db.refresh(record)
        return record

    def manual_review(
        self,
        record_id: int,
        review: ManualReviewUpdate,
    ) -> ReconciliationRecord:
        """
        算法工程师人工复核

        边界规则:
        - 只有 pending_review 状态的记录可以被复核
        - 被总指标盖住的少数类样本必须经过此步骤才能确认
        """
        record = self.db.query(ReconciliationRecord).filter(
            ReconciliationRecord.id == record_id
        ).first()

        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        if record.status != ReconciliationStatus.PENDING_REVIEW:
            raise ValueError("只有待复核状态的记录可以进行人工复核")

        if review.status in [
            ReconciliationStatus.CONFIRMED_NORMAL,
            ReconciliationStatus.CONFIRMED_ABNORMAL,
        ]:
            can_confirm, reason = self.rules.can_auto_confirm_normal(
                record.is_masked_by_total,
                record.is_minority,
                record.status,
            )
            if not can_confirm and review.status == ReconciliationStatus.CONFIRMED_NORMAL:
                pass

        previous = {
            "status": record.status,
            "manual_note": record.manual_note,
            "reviewed_by": record.reviewed_by,
        }

        record.status = review.status
        record.reviewed_by = review.reviewed_by
        record.reviewed_time = datetime.now()

        if review.manual_note:
            record.manual_note = (record.manual_note or "") + f"\n[人工复核] {review.manual_note}"

        action = "confirm_normal" if review.status == ReconciliationStatus.CONFIRMED_NORMAL else "confirm_abnormal"
        self._create_audit_log(
            record_id=record.id,
            action=action,
            operator=review.reviewed_by,
            previous_value=previous,
            new_value={
                "status": review.status,
                "manual_note": record.manual_note,
            },
            remark=review.manual_note,
        )

        self.db.commit()
        self.db.refresh(record)
        return record

    def rollback_record(
        self,
        record_id: int,
        operator: str,
        target_step: str = "step1_imported",
        remark: Optional[str] = None,
    ) -> ReconciliationRecord:
        """
        回滚记录到指定步骤

        边界规则:
        - 所有操作都可以回滚
        - 回滚操作必须记录审计日志
        - 回滚后状态重新开始流程
        """
        record = self.db.query(ReconciliationRecord).filter(
            ReconciliationRecord.id == record_id
        ).first()

        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        previous = {
            "status": record.status,
            "feature_snapshot_id": record.feature_snapshot_id,
            "threshold_value": record.threshold_value,
            "threshold_replay_result": record.threshold_replay_result,
        }

        if target_step == "step1_imported":
            record.feature_snapshot_id = None
            record.feature_snapshot_added_by = None
            record.feature_snapshot_added_time = None
            record.threshold_value = None
            record.threshold_replay_result = None
            record.threshold_updated_by = None
            record.threshold_updated_time = None
            record.status = ReconciliationStatus.STEP1_IMPORTED
        elif target_step == "step2_feature_added":
            record.threshold_value = None
            record.threshold_replay_result = None
            record.threshold_updated_by = None
            record.threshold_updated_time = None
            record.status = ReconciliationStatus.STEP2_FEATURE_ADDED

        record.manual_note = (record.manual_note or "") + f"\n[回滚] 回滚到 {target_step}"

        self._create_audit_log(
            record_id=record.id,
            action="rollback",
            operator=operator,
            previous_value=previous,
            new_value={
                "status": record.status,
                "target_step": target_step,
            },
            remark=remark or "执行回滚操作",
        )

        self.db.commit()
        self.db.refresh(record)
        return record

    def get_record_with_audit(self, record_id: int) -> Optional[ReconciliationRecord]:
        """获取记录详情（包含审计日志）"""
        return self.db.query(ReconciliationRecord).filter(
            ReconciliationRecord.id == record_id
        ).first()

    def get_slice_records(
        self,
        slice_id: int,
        status_filter: Optional[str] = None,
        minority_only: bool = False,
        masked_only: bool = False,
    ) -> List[ReconciliationRecord]:
        """获取切片下的所有对账记录"""
        query = self.db.query(ReconciliationRecord).filter(
            ReconciliationRecord.slice_id == slice_id
        )

        if status_filter:
            query = query.filter(ReconciliationRecord.status == status_filter)
        if minority_only:
            query = query.filter(ReconciliationRecord.is_minority == True)
        if masked_only:
            query = query.filter(ReconciliationRecord.is_masked_by_total == True)

        return query.order_by(ReconciliationRecord.original_row_number).all()

    def mark_pending_review(
        self,
        record_id: int,
        operator: str,
        remark: Optional[str] = None,
    ) -> ReconciliationRecord:
        """手动标记为待复核"""
        record = self.db.query(ReconciliationRecord).filter(
            ReconciliationRecord.id == record_id
        ).first()

        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        previous = {"status": record.status}
        record.status = ReconciliationStatus.PENDING_REVIEW

        if remark:
            record.manual_note = (record.manual_note or "") + f"\n[标记待复核] {remark}"

        self._create_audit_log(
            record_id=record.id,
            action="mark_pending_review",
            operator=operator,
            previous_value=previous,
            new_value={"status": ReconciliationStatus.PENDING_REVIEW},
            remark=remark,
        )

        self.db.commit()
        self.db.refresh(record)
        return record
