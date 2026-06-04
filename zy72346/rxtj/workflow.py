from __future__ import annotations

from datetime import datetime
from typing import Optional

from .models import Annotation, ChangeRecord, CalculationResult
from .rules import ReviewStatus, AnnotationSource
from .store import Store
from .engine import calculate_inclusion_exclusion, detect_edge_case, apply_boundary_rule, build_evidence
from .importer import import_annotations, ImportResult


class WorkflowStep:
    IMPORT_ANNOTATIONS = "import_annotations"
    REVIEW_SAMPLING = "review_sampling"
    UPDATE_DEMO = "update_demo"


class WorkflowState:
    def __init__(self, current_step: str, annotation_count: int,
                 sampling_count: int, flagged_count: int,
                 results: Optional[list[CalculationResult]] = None):
        self.current_step = current_step
        self.annotation_count = annotation_count
        self.sampling_count = sampling_count
        self.flagged_count = flagged_count
        self.results = results or []

    def summary(self) -> str:
        lines = [
            f"当前步骤: {self.current_step}",
            f"批注条数: {self.annotation_count}",
            f"抽样条数: {self.sampling_count}",
            f"待复核: {self.flagged_count}",
            f"计算结果数: {len(self.results)}",
        ]
        return "\n".join(lines)


def step1_import_annotations(
    store: Store,
    rows: list[dict],
    changed_by: str = "system",
) -> tuple[ImportResult, WorkflowState]:
    result = import_annotations(store, rows, AnnotationSource.TEACHER_ANNOTATION, changed_by)

    annotations = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
    flagged = [a for a in annotations if a.status == ReviewStatus.FLAGGED]

    state = WorkflowState(
        current_step=WorkflowStep.REVIEW_SAMPLING,
        annotation_count=len(annotations),
        sampling_count=0,
        flagged_count=len(flagged),
    )

    return result, state


def step2_review_sampling(
    store: Store,
    sampling_rows: list[dict],
    changed_by: str = "coach",
) -> tuple[list[ChangeRecord], WorkflowState]:
    sampling_result = import_annotations(
        store, sampling_rows, AnnotationSource.SAMPLING_LIST, changed_by
    )

    annotations = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
    sampling_annotations = store.list_annotations(source=AnnotationSource.SAMPLING_LIST)

    conflict_changes: list[ChangeRecord] = []
    for ann in annotations:
        if ann.status == ReviewStatus.FLAGGED:
            continue

        for sa in sampling_annotations:
            if (sa.item_name == ann.item_name and
                    sa.original_line_number == ann.original_line_number):
                if sa.current_value != ann.current_value:
                    ch = ChangeRecord(
                        annotation_id=ann.id,
                        field_name="status",
                        old_value=ann.status.value,
                        new_value=ReviewStatus.FLAGGED.value,
                        changed_by=changed_by,
                        reason=(
                            f"conflict: annotation='{ann.current_value}' vs "
                            f"sampling='{sa.current_value}'"
                        ),
                        import_batch_id=sa.import_batch_id,
                    )
                    store.save_change(ch)
                    conflict_changes.append(ch)

                    ann.status = ReviewStatus.FLAGGED
                    ann.updated_at = datetime.now().isoformat()
                    store.save_annotation(ann)
                break

    all_flagged = [a for a in annotations if a.status == ReviewStatus.FLAGGED]

    state = WorkflowState(
        current_step=WorkflowStep.UPDATE_DEMO,
        annotation_count=len(annotations),
        sampling_count=len(sampling_annotations),
        flagged_count=len(all_flagged),
    )

    return conflict_changes, state


def step3_update_demo(store: Store) -> tuple[list[CalculationResult], WorkflowState]:
    annotations = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
    sampling_annotations = store.list_annotations(source=AnnotationSource.SAMPLING_LIST)

    non_flagged = [a for a in annotations if a.status != ReviewStatus.FLAGGED and a.status != ReviewStatus.ROLLED_BACK]
    flagged = [a for a in annotations if a.status == ReviewStatus.FLAGGED]

    results = calculate_inclusion_exclusion(non_flagged, sampling_annotations)

    for ann in flagged:
        evidence = build_evidence(ann, sampling_annotations)
        result = CalculationResult(
            item_name=ann.item_name,
            category=ann.category,
            value=None,
            denominator=0.0,
            numerator=0.0,
            was_edge_case=ann.is_edge_case,
            edge_case_type=ann.edge_case_type,
            status=ReviewStatus.FLAGGED,
            evidence=evidence,
        )
        results.append(result)

    state = WorkflowState(
        current_step="completed",
        annotation_count=len(annotations),
        sampling_count=len(sampling_annotations),
        flagged_count=len(flagged),
        results=results,
    )

    return results, state


def get_audit_trail(store: Store, annotation_id: str) -> dict:
    ann = store.get_annotation(annotation_id)
    if ann is None:
        return {"error": f"annotation {annotation_id} not found"}

    changes = store.get_changes_for_annotation(annotation_id)
    sampling_annotations = store.list_annotations(source=AnnotationSource.SAMPLING_LIST)
    evidence = build_evidence(ann, sampling_annotations)

    return {
        "annotation": ann.to_dict(),
        "changes": [ch.to_dict() for ch in changes],
        "evidence": evidence.to_dict(),
        "change_count": len(changes),
    }
