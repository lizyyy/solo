from typing import List, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from app.models import (
    EvaluationSlice,
    FeatureSnapshot,
    WorkflowStep,
    CheckResult,
    ThresholdRecord,
    ManualChange,
    StatusHistory,
)
from app.schemas import EvaluationSliceCreate, FeatureSnapshotCreate, ThresholdUpdate, ManualChangeCreate
from app.services import CheckService


WORKFLOW_STEPS = [
    (1, "导入评测切片"),
    (2, "补看特征快照编号"),
    (3, "分层指标更新"),
]


class WorkflowService:
    def __init__(self, db: Session):
        self.db = db
        self.check_service = CheckService(db)

    def _init_workflow_steps(self, evaluation_slice_id: int) -> List[WorkflowStep]:
        steps = []
        for step_num, step_name in WORKFLOW_STEPS:
            step = WorkflowStep(
                evaluation_slice_id=evaluation_slice_id,
                step_number=step_num,
                step_name=step_name,
                step_status="pending",
            )
            self.db.add(step)
            steps.append(step)
        self.db.commit()
        for step in steps:
            self.db.refresh(step)
        return steps

    def _update_step_status(
        self,
        evaluation_slice_id: int,
        step_number: int,
        status: str,
        operator: Optional[str] = None,
        step_data: Optional[dict] = None,
    ) -> Optional[WorkflowStep]:
        step = (
            self.db.query(WorkflowStep)
            .filter(
                WorkflowStep.evaluation_slice_id == evaluation_slice_id,
                WorkflowStep.step_number == step_number,
            )
            .first()
        )
        if not step:
            return None
        step.step_status = status
        if operator:
            step.operator = operator
        if step_data:
            step.step_data = step_data
        step.operation_time = datetime.utcnow()
        self.db.commit()
        self.db.refresh(step)
        return step

    def _record_status_change(
        self,
        evaluation_slice_id: int,
        old_status: str,
        new_status: str,
        changed_by: Optional[str] = None,
        change_reason: Optional[str] = None,
        check_result_id: Optional[int] = None,
        step_context: Optional[dict] = None,
    ) -> StatusHistory:
        status_history = StatusHistory(
            evaluation_slice_id=evaluation_slice_id,
            check_result_id=check_result_id,
            old_status=old_status,
            new_status=new_status,
            changed_by=changed_by,
            change_reason=change_reason,
            step_context=step_context,
        )
        self.db.add(status_history)
        self.db.commit()
        self.db.refresh(status_history)
        return status_history

    def _record_manual_change(
        self,
        evaluation_slice_id: int,
        field_name: str,
        old_value: Optional[str],
        new_value: str,
        changed_by: Optional[str] = None,
        change_reason: Optional[str] = None,
        check_result_id: Optional[int] = None,
    ) -> ManualChange:
        manual_change = ManualChange(
            evaluation_slice_id=evaluation_slice_id,
            check_result_id=check_result_id,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            changed_by=changed_by,
            change_reason=change_reason,
        )
        self.db.add(manual_change)
        self.db.commit()
        self.db.refresh(manual_change)
        return manual_change

    def create_manual_change(self, change_data: ManualChangeCreate) -> ManualChange:
        return self._record_manual_change(
            evaluation_slice_id=change_data.evaluation_slice_id,
            check_result_id=change_data.check_result_id,
            field_name=change_data.field_name,
            old_value=change_data.old_value,
            new_value=change_data.new_value,
            changed_by=change_data.changed_by,
            change_reason=change_data.change_reason,
        )

    def get_manual_changes(self, evaluation_slice_id: Optional[int] = None) -> List[ManualChange]:
        query = self.db.query(ManualChange)
        if evaluation_slice_id:
            query = query.filter(ManualChange.evaluation_slice_id == evaluation_slice_id)
        return query.order_by(ManualChange.change_time.desc()).all()

    def get_status_history(self, evaluation_slice_id: Optional[int] = None) -> List[StatusHistory]:
        query = self.db.query(StatusHistory)
        if evaluation_slice_id:
            query = query.filter(StatusHistory.evaluation_slice_id == evaluation_slice_id)
        return query.order_by(StatusHistory.change_time.desc()).all()

    def _update_evaluation_slice_status(
        self,
        evaluation_slice: EvaluationSlice,
        new_status: str,
        changed_by: Optional[str] = None,
        change_reason: Optional[str] = None,
        check_result_id: Optional[int] = None,
        step_context: Optional[dict] = None,
    ) -> EvaluationSlice:
        old_status = evaluation_slice.current_status
        if old_status == new_status:
            return evaluation_slice

        self._record_status_change(
            evaluation_slice_id=evaluation_slice.id,
            old_status=old_status,
            new_status=new_status,
            changed_by=changed_by,
            change_reason=change_reason,
            check_result_id=check_result_id,
            step_context=step_context,
        )

        evaluation_slice.current_status = new_status
        self.db.commit()
        self.db.refresh(evaluation_slice)
        return evaluation_slice

    def _enhance_threshold_mismatch_result(
        self,
        check_result: CheckResult,
        threshold_record: ThresholdRecord,
        operator: Optional[str],
    ) -> CheckResult:
        if check_result.check_type != "threshold_mismatch":
            return check_result

        result_detail = check_result.result_detail or {}
        result_detail.update({
            "threshold_record_id": threshold_record.id,
            "operator": operator,
            "threshold_change_time": threshold_record.change_time.isoformat() if threshold_record.change_time else None,
            "is_applied_in_report": threshold_record.is_applied_in_report,
            "status_guidance": "阈值已更新但报告未同步，需数据科学家复核确认是否需要修正报告口径。此记录不会自动归为正常，需人工复核。",
            "alignment_status": "unmatched",
            "report_threshold": check_result.report_threshold_value,
            "system_threshold": check_result.threshold_new_value,
            "diff_value": check_result.threshold_new_value - check_result.report_threshold_value if (check_result.threshold_new_value and check_result.report_threshold_value) else None,
        })
        check_result.result_detail = result_detail

        evidence_chain = check_result.evidence_chain or {}
        evidence_chain.update({
            "threshold_change_recorded": True,
            "threshold_change_by": operator,
            "status_before_review": check_result.check_status,
        })
        check_result.evidence_chain = evidence_chain

        check_result.check_status = "pending_review"
        check_result.needs_data_scientist_review = True

        flag_modified(check_result, "result_detail")
        flag_modified(check_result, "evidence_chain")

        return check_result

    def step1_import_evaluation_slice(
        self,
        slice_data: EvaluationSliceCreate,
        operator: Optional[str] = None,
    ) -> Tuple[EvaluationSlice, List[CheckResult]]:
        existing = (
            self.db.query(EvaluationSlice)
            .filter(
                EvaluationSlice.original_row_number == slice_data.original_row_number,
                EvaluationSlice.import_batch_id == slice_data.import_batch_id,
            )
            .first()
        )

        evaluation_slice = EvaluationSlice(
            original_row_number=slice_data.original_row_number,
            main_process_data=slice_data.main_process_data,
            import_batch_id=slice_data.import_batch_id,
            remarks=slice_data.remarks,
            current_status="reviewing",
        )
        self.db.add(evaluation_slice)
        self.db.flush()

        self._init_workflow_steps(evaluation_slice.id)

        self._record_status_change(
            evaluation_slice_id=evaluation_slice.id,
            old_status=None,
            new_status="reviewing",
            changed_by=operator,
            change_reason="步骤1：评测切片首次导入",
            step_context={
                "step": 1,
                "original_row_number": evaluation_slice.original_row_number,
                "import_batch_id": evaluation_slice.import_batch_id,
            },
        )

        check_results = self.check_service.run_all_checks(evaluation_slice)
        if existing:
            duplicate_result = CheckResult(
                evaluation_slice_id=evaluation_slice.id,
                check_type="duplicate_import",
                check_status="abnormal",
                severity="medium",
                result_detail={
                    "message": "检测到重复导入",
                    "duplicate_with_slice_id": existing.id,
                    "original_import_time": existing.import_time.isoformat() if existing.import_time else None,
                    "status_guidance": "同一批次同一行号已导入过，请确认是否为误操作。",
                },
                evidence_chain=self.check_service._build_evidence_chain(
                    evaluation_slice,
                    extra={"duplicate_slice_id": existing.id},
                ),
            )
            check_results = [cr for cr in check_results if cr.check_type != "duplicate_import"]
            check_results.append(duplicate_result)

        for cr in check_results:
            self.db.add(cr)

        self._update_step_status(
            evaluation_slice.id,
            1,
            "completed",
            operator=operator,
            step_data={
                "original_row_number": evaluation_slice.original_row_number,
                "import_batch_id": evaluation_slice.import_batch_id,
                "check_count": len(check_results),
                "check_types": [cr.check_type for cr in check_results],
            },
        )

        self.db.commit()
        self.db.refresh(evaluation_slice)
        for cr in check_results:
            self.db.refresh(cr)

        return evaluation_slice, check_results

    def step2_supplement_feature_snapshot(
        self,
        snapshot_data: FeatureSnapshotCreate,
        operator: Optional[str] = None,
        is_resupplement: bool = False,
    ) -> Tuple[FeatureSnapshot, List[CheckResult]]:
        evaluation_slice = (
            self.db.query(EvaluationSlice)
            .filter(EvaluationSlice.id == snapshot_data.evaluation_slice_id)
            .first()
        )
        if not evaluation_slice:
            raise ValueError("评测切片不存在")

        existing_snapshots = (
            self.db.query(FeatureSnapshot)
            .filter(FeatureSnapshot.evaluation_slice_id == evaluation_slice.id)
            .all()
        )

        old_on_site_statement = None
        if existing_snapshots:
            old_on_site_statement = existing_snapshots[-1].on_site_statement

        feature_snapshot = FeatureSnapshot(
            snapshot_number=snapshot_data.snapshot_number,
            on_site_statement=snapshot_data.on_site_statement,
            feature_data=snapshot_data.feature_data,
            evaluation_slice_id=snapshot_data.evaluation_slice_id,
            supplemented_by=snapshot_data.supplemented_by or operator,
            is_resupplemented=is_resupplement or len(existing_snapshots) > 0,
        )
        self.db.add(feature_snapshot)
        self.db.flush()

        if old_on_site_statement != snapshot_data.on_site_statement:
            self._record_manual_change(
                evaluation_slice_id=evaluation_slice.id,
                field_name="on_site_statement",
                old_value=old_on_site_statement,
                new_value=snapshot_data.on_site_statement,
                changed_by=snapshot_data.supplemented_by or operator,
                change_reason="步骤2：特征快照现场说法更新",
            )

        check_results = self.check_service.run_all_checks(evaluation_slice, feature_snapshot)

        for cr in check_results:
            if cr.check_type == "cross_leak":
                rd = cr.result_detail or {}
                rd["status_guidance"] = "主流程与特征快照数据存在差异，需数据科学家结合现场说法判断是否为特征交叉泄漏。"
                rd["alignment_status"] = "pending_check"
                cr.result_detail = rd
                flag_modified(cr, "result_detail")
            self.db.add(cr)

        self._record_status_change(
            evaluation_slice_id=evaluation_slice.id,
            old_status=evaluation_slice.current_status,
            new_status=evaluation_slice.current_status,
            changed_by=operator,
            change_reason="步骤2：特征快照补录完成，等待分层指标更新",
            step_context={
                "snapshot_number": feature_snapshot.snapshot_number,
                "supplemented_by": feature_snapshot.supplemented_by,
                "is_resupplemented": feature_snapshot.is_resupplemented,
                "check_count": len(check_results),
                "check_types": [cr.check_type for cr in check_results],
            },
        )

        self._update_step_status(
            evaluation_slice.id,
            2,
            "completed",
            operator=operator,
            step_data={
                "snapshot_number": feature_snapshot.snapshot_number,
                "supplemented_by": feature_snapshot.supplemented_by,
                "is_resupplemented": feature_snapshot.is_resupplemented,
                "check_count": len(check_results),
                "check_types": [cr.check_type for cr in check_results],
                "on_site_statement_updated": old_on_site_statement != snapshot_data.on_site_statement,
            },
        )

        self.db.commit()
        self.db.refresh(feature_snapshot)
        for cr in check_results:
            self.db.refresh(cr)

        return feature_snapshot, check_results

    def step3_update_hierarchical_metrics(
        self,
        evaluation_slice_id: int,
        threshold_updates: List[ThresholdUpdate],
        operator: Optional[str] = None,
    ) -> Tuple[List[ThresholdRecord], List[CheckResult]]:
        evaluation_slice = (
            self.db.query(EvaluationSlice)
            .filter(EvaluationSlice.id == evaluation_slice_id)
            .first()
        )
        if not evaluation_slice:
            raise ValueError("评测切片不存在")

        old_slice_status = evaluation_slice.current_status

        feature_snapshot = (
            self.db.query(FeatureSnapshot)
            .filter(FeatureSnapshot.evaluation_slice_id == evaluation_slice_id)
            .order_by(FeatureSnapshot.supplement_time.desc())
            .first()
        )

        threshold_records = []
        for update in threshold_updates:
            latest = (
                self.db.query(ThresholdRecord)
                .filter(ThresholdRecord.threshold_name == update.threshold_name)
                .order_by(ThresholdRecord.change_time.desc())
                .first()
            )
            old_value = latest.new_value if latest else None

            if old_value != update.new_value:
                self._record_manual_change(
                    evaluation_slice_id=evaluation_slice_id,
                    field_name=f"threshold:{update.threshold_name}",
                    old_value=str(old_value) if old_value is not None else None,
                    new_value=str(update.new_value),
                    changed_by=update.changed_by or operator,
                    change_reason="步骤3：分层指标阈值更新",
                )

            record = ThresholdRecord(
                threshold_name=update.threshold_name,
                old_value=old_value,
                new_value=update.new_value,
                changed_by=update.changed_by or operator,
                is_applied_in_report=update.apply_to_report,
            )
            self.db.add(record)
            threshold_records.append(record)
        self.db.flush()

        check_results = self.check_service.run_all_checks(evaluation_slice, feature_snapshot)

        for idx, cr in enumerate(check_results):
            if cr.check_type == "threshold_mismatch":
                tr = threshold_records[idx] if idx < len(threshold_records) else threshold_records[0]
                enhanced_cr = self._enhance_threshold_mismatch_result(cr, tr, operator)
                check_results[idx] = enhanced_cr
                cr = enhanced_cr
                if tr and not tr.is_applied_in_report:
                    self._record_status_change(
                        evaluation_slice_id=evaluation_slice_id,
                        old_status=old_slice_status,
                        new_status="pending",
                        changed_by=operator,
                        change_reason="步骤3：检测到阈值改过但报告仍写旧值，标记为待数据科学家复核",
                        check_result_id=cr.id,
                        step_context={
                            "step": 3,
                            "threshold_name": tr.threshold_name,
                            "old_threshold": tr.old_value,
                            "new_threshold": tr.new_value,
                            "report_threshold": cr.report_threshold_value,
                            "is_applied_in_report": tr.is_applied_in_report,
                        },
                    )
                    if evaluation_slice.current_status != "pending":
                        evaluation_slice.current_status = "pending"
            self.db.add(cr)

        self.db.flush()

        self._update_step_status(
            evaluation_slice_id,
            3,
            "completed",
            operator=operator,
            step_data={
                "threshold_updates": [
                    {"name": t.threshold_name, "old": t.old_value, "new": t.new_value, "applied_in_report": t.is_applied_in_report}
                    for t in threshold_records
                ],
                "check_count": len(check_results),
                "check_types": [cr.check_type for cr in check_results],
                "pending_review_count": sum(1 for cr in check_results if cr.needs_data_scientist_review),
            },
        )

        pending_reviews = (
            self.db.query(CheckResult)
            .filter(
                CheckResult.evaluation_slice_id == evaluation_slice_id,
                CheckResult.needs_data_scientist_review == True,
            )
            .count()
        )

        if pending_reviews > 0:
            if evaluation_slice.current_status != "pending":
                evaluation_slice.current_status = "pending"
        else:
            evaluation_slice.current_status = "confirmed"

        self.db.commit()
        for tr in threshold_records:
            self.db.refresh(tr)
        for cr in check_results:
            self.db.refresh(cr)

        return threshold_records, check_results

    def update_check_result_status(
        self,
        check_result_id: int,
        new_status: str,
        reviewer: str,
        review_comment: str,
    ) -> Optional[CheckResult]:
        check_result = self.db.query(CheckResult).filter(CheckResult.id == check_result_id).first()
        if not check_result:
            return None

        old_status = check_result.check_status

        self._record_status_change(
            evaluation_slice_id=check_result.evaluation_slice_id,
            old_status=old_status,
            new_status=new_status,
            changed_by=reviewer,
            change_reason=review_comment,
            check_result_id=check_result_id,
            step_context={
                "action": "data_scientist_review",
                "old_status": old_status,
                "new_status": new_status,
            },
        )

        check_result.check_status = new_status
        check_result.reviewer = reviewer
        check_result.review_comment = review_comment
        check_result.review_time = datetime.utcnow()
        check_result.needs_data_scientist_review = False

        rd = check_result.result_detail or {}
        rd["reviewed_by"] = reviewer
        rd["review_comment"] = review_comment
        rd["review_time"] = check_result.review_time.isoformat()
        rd["final_status"] = new_status
        check_result.result_detail = rd

        self.db.commit()
        self.db.refresh(check_result)

        pending_count = (
            self.db.query(CheckResult)
            .filter(
                CheckResult.evaluation_slice_id == check_result.evaluation_slice_id,
                CheckResult.needs_data_scientist_review == True,
            )
            .count()
        )
        if pending_count == 0:
            evaluation_slice = self.db.query(EvaluationSlice).filter(
                EvaluationSlice.id == check_result.evaluation_slice_id
            ).first()
            if evaluation_slice:
                self._update_evaluation_slice_status(
                    evaluation_slice,
                    "confirmed",
                    changed_by=reviewer,
                    change_reason="所有待复核项已处理完毕",
                    check_result_id=check_result_id,
                )

        return check_result

    def get_workflow_status(self, evaluation_slice_id: int) -> List[WorkflowStep]:
        return (
            self.db.query(WorkflowStep)
            .filter(WorkflowStep.evaluation_slice_id == evaluation_slice_id)
            .order_by(WorkflowStep.step_number)
            .all()
        )

    def get_evaluation_slice(self, slice_id: int) -> Optional[EvaluationSlice]:
        return self.db.query(EvaluationSlice).filter(EvaluationSlice.id == slice_id).first()

    def get_feature_snapshots(self, slice_id: int) -> List[FeatureSnapshot]:
        return (
            self.db.query(FeatureSnapshot)
            .filter(FeatureSnapshot.evaluation_slice_id == slice_id)
            .order_by(FeatureSnapshot.supplement_time)
            .all()
        )
