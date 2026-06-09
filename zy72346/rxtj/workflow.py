from __future__ import annotations

from datetime import datetime
from typing import Optional

from .models import Annotation, ChangeRecord, CalculationResult, EvidenceSummary
from .rules import ReviewStatus, AnnotationSource
from .store import Store
from .engine import calculate_inclusion_exclusion, detect_edge_case, apply_boundary_rule, build_evidence
from .importer import import_annotations, ImportResult


class WorkflowStep:
    IMPORT_ANNOTATIONS = "import_annotations"
    REVIEW_SAMPLING = "review_sampling"
    REVIEW_FLAGGED = "review_flagged"
    UPDATE_DEMO = "update_demo"


class WorkflowState:
    def __init__(self, current_step: str, annotation_count: int,
                 sampling_count: int, flagged_count: int,
                 reviewed_count: int = 0,
                 results: Optional[list[CalculationResult]] = None):
        self.current_step = current_step
        self.annotation_count = annotation_count
        self.sampling_count = sampling_count
        self.flagged_count = flagged_count
        self.reviewed_count = reviewed_count
        self.results = results or []

    def summary(self) -> str:
        lines = [
            f"当前步骤: {self.current_step}",
            f"批注条数: {self.annotation_count}",
            f"抽样条数: {self.sampling_count}",
            f"待复核: {self.flagged_count}",
            f"已复核: {self.reviewed_count}",
            f"计算结果数: {len(self.results)}",
        ]
        return "\n".join(lines)

    def to_dict(self) -> dict:
        return {
            "current_step": self.current_step,
            "annotation_count": self.annotation_count,
            "sampling_count": self.sampling_count,
            "flagged_count": self.flagged_count,
            "reviewed_count": self.reviewed_count,
        }


def step1_import_annotations(
    store: Store,
    rows: list[dict],
    changed_by: str = "system",
) -> tuple[ImportResult, WorkflowState]:
    result = import_annotations(store, rows, AnnotationSource.TEACHER_ANNOTATION, changed_by)

    annotations = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
    flagged = [a for a in annotations if a.status == ReviewStatus.FLAGGED]
    reviewed = [a for a in annotations if a.status == ReviewStatus.REVIEWED]

    state = WorkflowState(
        current_step=WorkflowStep.REVIEW_SAMPLING,
        annotation_count=len(annotations),
        sampling_count=0,
        flagged_count=len(flagged),
        reviewed_count=len(reviewed),
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
        if ann.status in (ReviewStatus.FLAGGED, ReviewStatus.REVIEWED, ReviewStatus.ROLLED_BACK):
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
                    store.save_annotation(ann)
                break

    annotations = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
    all_flagged = [a for a in annotations if a.status == ReviewStatus.FLAGGED]
    all_reviewed = [a for a in annotations if a.status == ReviewStatus.REVIEWED]

    next_step = WorkflowStep.UPDATE_DEMO if not all_flagged else WorkflowStep.REVIEW_FLAGGED
    state = WorkflowState(
        current_step=next_step,
        annotation_count=len(annotations),
        sampling_count=len(sampling_annotations),
        flagged_count=len(all_flagged),
        reviewed_count=len(all_reviewed),
    )

    return conflict_changes, state


def review_flagged_annotation(
    store: Store,
    annotation_id: str,
    corrected_value: str,
    review_reason: str,
    next_contact: str,
    reviewed_by: str,
    corrected_denominator: Optional[str] = None,
    corrected_numerator: Optional[str] = None,
    mark_as_pending_after: bool = False,
) -> tuple[Annotation, list[ChangeRecord]]:
    ann = store.get_annotation(annotation_id)
    if ann is None:
        raise KeyError(f"annotation {annotation_id} not found")
    if ann.status != ReviewStatus.FLAGGED:
        raise ValueError(
            f"annotation {annotation_id} status={ann.status.value}, "
            f"只能复核 flagged 状态的记录"
        )

    changes: list[ChangeRecord] = []
    now = datetime.now().isoformat()

    old_current_value = ann.current_value
    if corrected_value != old_current_value:
        ch = ChangeRecord(
            annotation_id=ann.id,
            field_name="current_value",
            old_value=str(old_current_value),
            new_value=str(corrected_value),
            changed_by=reviewed_by,
            reason=f"review: {review_reason}",
            created_at=now,
        )
        store.save_change(ch)
        changes.append(ch)
        ann.current_value = corrected_value

    if corrected_denominator is not None and corrected_denominator != ann.denominator_raw:
        ch = ChangeRecord(
            annotation_id=ann.id,
            field_name="denominator_raw",
            old_value=str(ann.denominator_raw),
            new_value=str(corrected_denominator),
            changed_by=reviewed_by,
            reason=f"review: 修正分母, {review_reason}",
            created_at=now,
        )
        store.save_change(ch)
        changes.append(ch)
        ann.denominator_raw = corrected_denominator

    if corrected_numerator is not None and corrected_numerator != ann.numerator_raw:
        ch = ChangeRecord(
            annotation_id=ann.id,
            field_name="numerator_raw",
            old_value=str(ann.numerator_raw),
            new_value=str(corrected_numerator),
            changed_by=reviewed_by,
            reason=f"review: 修正分子, {review_reason}",
            created_at=now,
        )
        store.save_change(ch)
        changes.append(ch)
        ann.numerator_raw = corrected_numerator

    old_status = ann.status
    new_status = ReviewStatus.PENDING if mark_as_pending_after else ReviewStatus.REVIEWED
    if old_status != new_status:
        ch = ChangeRecord(
            annotation_id=ann.id,
            field_name="status",
            old_value=str(old_status.value),
            new_value=str(new_status.value),
            changed_by=reviewed_by,
            reason=f"review: 复核完成 → {new_status.value}, {review_reason}",
            created_at=now,
        )
        store.save_change(ch)
        changes.append(ch)
        ann.status = new_status

    ann.review_reason = review_reason
    ann.next_contact = next_contact
    ann.reviewed_by = reviewed_by
    ann.reviewed_at = now
    store.save_annotation(ann)

    return ann, changes


def step3_update_demo(store: Store) -> tuple[list[CalculationResult], WorkflowState]:
    annotations = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
    sampling_annotations = store.list_annotations(source=AnnotationSource.SAMPLING_LIST)

    compute_ready = {
        ReviewStatus.PENDING,
        ReviewStatus.ANNOTATION_IMPORTED,
        ReviewStatus.SAMPLING_REVIEWED,
        ReviewStatus.DEMO_UPDATED,
    }
    included = [a for a in annotations if a.status in compute_ready]
    flagged = [a for a in annotations if a.status == ReviewStatus.FLAGGED]
    reviewed = [a for a in annotations if a.status == ReviewStatus.REVIEWED]
    rolled_back = [a for a in annotations if a.status == ReviewStatus.ROLLED_BACK]

    intermediate_results = calculate_inclusion_exclusion(included, sampling_annotations)
    results: list[CalculationResult] = []

    for r in intermediate_results:
        matched = None
        for a in included:
            if a.item_name == r.item_name and a.category == r.category:
                matched = a
                break
        if matched is not None:
            changes = store.get_changes_for_annotation(matched.id)
            ev = build_evidence(matched, sampling_annotations, changes)
            ev.change_count = len(changes)
            r.evidence = ev
            r.status = matched.status
        results.append(r)

    for ann in flagged:
        changes = store.get_changes_for_annotation(ann.id)
        evidence = build_evidence(ann, sampling_annotations, changes)
        evidence.change_count = len(changes)
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

    for ann in reviewed:
        changes = store.get_changes_for_annotation(ann.id)
        evidence = build_evidence(ann, sampling_annotations, changes)
        evidence.change_count = len(changes)
        result = CalculationResult(
            item_name=ann.item_name,
            category=ann.category,
            value=None,
            denominator=0.0,
            numerator=0.0,
            was_edge_case=ann.is_edge_case,
            edge_case_type=ann.edge_case_type,
            status=ReviewStatus.REVIEWED,
            evidence=evidence,
        )
        results.append(result)

    for ann in rolled_back:
        changes = store.get_changes_for_annotation(ann.id)
        evidence = build_evidence(ann, sampling_annotations, changes)
        evidence.change_count = len(changes)
        result = CalculationResult(
            item_name=ann.item_name,
            category=ann.category,
            value=None,
            denominator=0.0,
            numerator=0.0,
            was_edge_case=ann.is_edge_case,
            edge_case_type=ann.edge_case_type,
            status=ReviewStatus.ROLLED_BACK,
            evidence=evidence,
        )
        results.append(result)

    annotations = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
    all_flagged = [a for a in annotations if a.status == ReviewStatus.FLAGGED]
    all_reviewed = [a for a in annotations if a.status == ReviewStatus.REVIEWED]

    state = WorkflowState(
        current_step="completed",
        annotation_count=len(annotations),
        sampling_count=len(sampling_annotations),
        flagged_count=len(all_flagged),
        reviewed_count=len(all_reviewed),
        results=results,
    )

    return results, state


def build_unified_report(store: Store) -> dict:
    results, state = step3_update_demo(store)
    annotations = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
    sampling = store.list_annotations(source=AnnotationSource.SAMPLING_LIST)
    batches = []

    conn = store._get_conn()
    rows = conn.execute(
        "SELECT * FROM import_batches ORDER BY created_at"
    ).fetchall()
    for r in rows:
        batches.append({
            "id": r["id"],
            "source": r["source"],
            "total_rows": r["total_rows"],
            "new": r["new_count"],
            "changed": r["changed_count"],
            "unchanged": r["unchanged_count"],
            "skipped": r["skipped_duplicate_count"],
            "flagged": r["flagged_count"],
            "rolled_back": bool(r["rolled_back"]),
            "created_at": r["created_at"],
        })

    flagged_list = []
    reviewed_list = []
    normal_list = []
    for a in annotations:
        changes = store.get_changes_for_annotation(a.id)
        ev = build_evidence(a, sampling, changes)
        item = {
            "annotation": a.to_dict(),
            "evidence": ev.to_dict(),
            "change_count": len(changes),
            "changes": [c.to_dict() for c in changes],
        }
        if a.status == ReviewStatus.FLAGGED:
            flagged_list.append(item)
        elif a.status == ReviewStatus.REVIEWED:
            reviewed_list.append(item)
        else:
            normal_list.append(item)

    return {
        "state": state.to_dict(),
        "batches": batches,
        "calculation_results": [r.to_dict() for r in results],
        "annotations_summary": {
            "total": len(annotations),
            "sampling_total": len(sampling),
            "normal_pending_count": len(normal_list),
            "flagged_count": len(flagged_list),
            "reviewed_count": len(reviewed_list),
        },
        "by_status": {
            "normal_pending": normal_list,
            "flagged": flagged_list,
            "reviewed": reviewed_list,
        },
    }


def get_audit_trail(store: Store, annotation_id: str) -> dict:
    ann = store.get_annotation(annotation_id)
    if ann is None:
        return {"error": f"annotation {annotation_id} not found"}

    changes = store.get_changes_for_annotation(annotation_id)
    sampling_annotations = store.list_annotations(source=AnnotationSource.SAMPLING_LIST)
    evidence = build_evidence(ann, sampling_annotations, changes)
    evidence.change_count = len(changes)

    return {
        "annotation": ann.to_dict(),
        "changes": [ch.to_dict() for ch in changes],
        "evidence": evidence.to_dict(),
        "change_count": len(changes),
    }
