from typing import List, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from app.models import (
    EvaluationSlice,
    FeatureSnapshot,
    WorkflowStep,
    CheckResult,
    ThresholdRecord,
)
from app.schemas import EvaluationSliceCreate, FeatureSnapshotCreate, ThresholdUpdate
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

        check_results = self.check_service.run_all_checks(evaluation_slice)
        if existing:
            from app.models import CheckResult as CR
            duplicate_result = CR(
                evaluation_slice_id=evaluation_slice.id,
                check_type="duplicate_import",
                check_status="abnormal",
                severity="medium",
                result_detail={
                    "message": "检测到重复导入",
                    "duplicate_with_slice_id": existing.id,
                    "original_import_time": existing.import_time.isoformat() if existing.import_time else None,
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

        check_results = self.check_service.run_all_checks(evaluation_slice, feature_snapshot)
        for cr in check_results:
            self.db.add(cr)

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

        threshold_records = []
        for update in threshold_updates:
            latest = (
                self.db.query(ThresholdRecord)
                .filter(ThresholdRecord.threshold_name == update.threshold_name)
                .order_by(ThresholdRecord.change_time.desc())
                .first()
            )
            old_value = latest.new_value if latest else None

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

        check_results = self.check_service.run_all_checks(evaluation_slice)
        for cr in check_results:
            self.db.add(cr)

        self._update_step_status(
            evaluation_slice_id,
            3,
            "completed",
            operator=operator,
            step_data={
                "threshold_updates": [
                    {"name": t.threshold_name, "old": t.old_value, "new": t.new_value}
                    for t in threshold_records
                ],
                "check_count": len(check_results),
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
            evaluation_slice.current_status = "pending"
        else:
            evaluation_slice.current_status = "confirmed"

        self.db.commit()
        for tr in threshold_records:
            self.db.refresh(tr)
        for cr in check_results:
            self.db.refresh(cr)

        return threshold_records, check_results

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
