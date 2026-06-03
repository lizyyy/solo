from typing import Dict, Any, List, Optional
from fourier_noise.models import (
    Record,
    RecordType,
    ReviewStatus,
    TeacherAnnotation,
    BoundarySampleReport,
)
from fourier_noise.decomposer import FourierNoiseDecomposer


class WorkflowStep:
    IMPORT_ANNOTATIONS = "import_annotations"
    SUPPLEMENT_SAMPLING = "supplement_sampling"
    UPDATE_REPORT = "update_report"
    MANUAL_CORRECT = "manual_correct"
    RERUN = "rerun"

    ALL = [IMPORT_ANNOTATIONS, SUPPLEMENT_SAMPLING, UPDATE_REPORT, MANUAL_CORRECT, RERUN]


class WorkflowEngine:

    def __init__(self):
        self.decomposer = FourierNoiseDecomposer(sample_rate=1.0, noise_threshold_sigma=1.0)
        self.records: List[Record] = []
        self.annotations: List[TeacherAnnotation] = []
        self.completed_steps: List[str] = []
        self.current_step: Optional[str] = None

    def import_teacher_annotations(
        self,
        records: List[Record],
        annotations: List[TeacherAnnotation],
    ) -> Dict[str, Any]:
        self.records = self.decomposer.classify_records(records)
        self.annotations = annotations

        annotation_map = {a.record_id: a for a in annotations}
        for r in self.records:
            if r.id in annotation_map:
                r.teacher_annotation = annotation_map[r.id].annotation

        self.decomposer.mark_negative_for_review(self.records)
        self.decomposer.apply_fourier_to_records(self.records)

        self.current_step = WorkflowStep.IMPORT_ANNOTATIONS
        self.completed_steps.append(WorkflowStep.IMPORT_ANNOTATIONS)

        return {
            "step": WorkflowStep.IMPORT_ANNOTATIONS,
            "status": "completed",
            "records_imported": len(self.records),
            "annotations_applied": len(annotations),
            "negative_flagged": sum(
                1 for r in self.records if r.record_type == RecordType.NEGATIVE_AS_MISSING
            ),
            "pending_review": sum(
                1 for r in self.records if r.review_status == ReviewStatus.PENDING
            ),
            "note": "负数样本已被标记为待复核，未归入正常——等待学生助教确认",
        }

    def supplement_from_sampling(
        self,
        sampling_entries: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        if WorkflowStep.IMPORT_ANNOTATIONS not in self.completed_steps:
            return {
                "step": WorkflowStep.SUPPLEMENT_SAMPLING,
                "status": "error",
                "message": "请先完成老师批注导入步骤",
            }

        before_types = {r.id: r.record_type for r in self.records}

        self.records = self.decomposer.supplement_from_sampling(self.records, sampling_entries)

        changed = []
        for r in self.records:
            if before_types.get(r.id) != r.record_type:
                changed.append({
                    "record_id": r.id,
                    "from": before_types[r.id].value,
                    "to": r.record_type.value,
                })

        still_negative = [
            r for r in self.records if r.record_type == RecordType.NEGATIVE_AS_MISSING
        ]

        self.current_step = WorkflowStep.SUPPLEMENT_SAMPLING
        self.completed_steps.append(WorkflowStep.SUPPLEMENT_SAMPLING)

        return {
            "step": WorkflowStep.SUPPLEMENT_SAMPLING,
            "status": "completed",
            "sampling_entries_applied": len(sampling_entries),
            "records_updated": len(changed),
            "updates": changed,
            "still_negative_as_missing": len(still_negative),
            "still_negative_ids": [r.id for r in still_negative],
            "note": (
                "补录后仍为负数缺失的记录继续待复核，不自动归正常——"
                "这些需要学生助教人工确认"
            ),
        }

    def update_boundary_report(self) -> BoundarySampleReport:
        if WorkflowStep.SUPPLEMENT_SAMPLING not in self.completed_steps:
            return BoundarySampleReport(
                total_records=0,
                normal_count=0,
                negative_as_missing_count=0,
                supplemented_count=0,
                pending_review_count=0,
                confirmed_count=0,
                rejected_count=0,
                records=[],
            )

        self.decomposer.apply_fourier_to_records(self.records)

        normal_count = sum(1 for r in self.records if r.record_type == RecordType.NORMAL)
        neg_count = sum(
            1 for r in self.records if r.record_type == RecordType.NEGATIVE_AS_MISSING
        )
        supp_count = sum(
            1 for r in self.records if r.record_type == RecordType.SUPPLEMENTED_FROM_SAMPLING
        )
        pending_count = sum(
            1 for r in self.records if r.review_status == ReviewStatus.PENDING
        )
        confirmed_count = sum(
            1 for r in self.records if r.review_status == ReviewStatus.CONFIRMED
        )
        rejected_count = sum(
            1 for r in self.records if r.review_status == ReviewStatus.REJECTED
        )

        report = BoundarySampleReport(
            total_records=len(self.records),
            normal_count=normal_count,
            negative_as_missing_count=neg_count,
            supplemented_count=supp_count,
            pending_review_count=pending_count,
            confirmed_count=confirmed_count,
            rejected_count=rejected_count,
            records=[r.to_dict() for r in self.records],
        )

        self.current_step = WorkflowStep.UPDATE_REPORT
        self.completed_steps.append(WorkflowStep.UPDATE_REPORT)

        return report

    def manual_correct(
        self,
        record_id: str,
        corrected_value: float,
    ) -> Dict[str, Any]:
        result = self.decomposer.manual_correct(self.records, record_id, corrected_value)

        if result is None:
            return {
                "step": WorkflowStep.MANUAL_CORRECT,
                "status": "error",
                "message": f"未找到记录 {record_id}",
            }

        self.current_step = WorkflowStep.MANUAL_CORRECT
        if WorkflowStep.MANUAL_CORRECT not in self.completed_steps:
            self.completed_steps.append(WorkflowStep.MANUAL_CORRECT)

        return {
            "step": WorkflowStep.MANUAL_CORRECT,
            "status": "completed",
            "record_id": record_id,
            "original_value": result.value,
            "corrected_value": corrected_value,
            "review_status": result.review_status.value,
        }

    def rerun(self) -> Dict[str, Any]:
        self.decomposer.apply_fourier_to_records(self.records)

        normal_count = sum(1 for r in self.records if r.record_type == RecordType.NORMAL)
        neg_count = sum(
            1 for r in self.records if r.record_type == RecordType.NEGATIVE_AS_MISSING
        )
        supp_count = sum(
            1 for r in self.records if r.record_type == RecordType.SUPPLEMENTED_FROM_SAMPLING
        )
        pending_count = sum(
            1 for r in self.records if r.review_status == ReviewStatus.PENDING
        )

        self.current_step = WorkflowStep.RERUN
        self.completed_steps.append(WorkflowStep.RERUN)

        return {
            "step": WorkflowStep.RERUN,
            "status": "completed",
            "total_records": len(self.records),
            "normal_count": normal_count,
            "negative_as_missing_count": neg_count,
            "supplemented_count": supp_count,
            "pending_review_count": pending_count,
            "note": "重跑完成——三类处理结果已更新",
        }

    def get_status(self) -> Dict[str, Any]:
        return {
            "current_step": self.current_step,
            "completed_steps": self.completed_steps,
            "total_records": len(self.records),
            "pending_review": sum(
                1 for r in self.records if r.review_status == ReviewStatus.PENDING
            ),
        }
