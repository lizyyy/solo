import uuid
import pandas as pd
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from .models import (
    AttributionResult,
    AnnotationRecord,
    ConflictRecord,
    ErrorType,
    AttributionStatus,
    ReviewAction,
)


def _is_empty(value) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and pd.isna(value):
        return True
    s = str(value).strip()
    return not s or s.lower() in ("nan", "none", "null")


class ConflictManager:
    def __init__(self):
        self.conflicts: Dict[str, ConflictRecord] = {}

    def detect_conflicts(
        self,
        attributions: List[AttributionResult],
        annotations: List[AnnotationRecord],
    ) -> List[ConflictRecord]:
        annotation_map = {a.annotation_id: a for a in annotations}
        conflicts = []

        for attr in attributions:
            annotation = annotation_map.get(attr.annotation_id)
            if not annotation:
                continue

            conflict = self._check_single_conflict(attr, annotation)
            if conflict:
                conflicts.append(conflict)
                self.conflicts[conflict.conflict_id] = conflict

        triple_groups: Dict[Tuple[str, str, str], List[AnnotationRecord]] = {}
        for a in annotations:
            if not a.is_valid:
                continue
            ew = "" if _is_empty(a.error_word) else a.error_word
            cw = "" if _is_empty(a.correct_word) else a.correct_word
            key = (a.log_id, ew, cw)
            triple_groups.setdefault(key, []).append(a)

        for key, group in triple_groups.items():
            if len(group) < 2:
                continue
            types = {a.error_type for a in group if a.error_type and not _is_empty(a.error_type)}
            annotators = {a.annotated_by for a in group}
            if len(types) > 1 or len(annotators) > 1:
                for a in group:
                    for attr in attributions:
                        if attr.annotation_id == a.annotation_id:
                            if any(c.annotation_id == a.annotation_id for c in conflicts):
                                continue
                            others = [
                                f"{x.annotation_id}(type={x.error_type},by={x.annotated_by})"
                                for x in group
                                if x.annotation_id != a.annotation_id
                            ]
                            conflict = ConflictRecord(
                                conflict_id=str(uuid.uuid4()),
                                log_id=a.log_id,
                                annotation_id=a.annotation_id,
                                attribution_id=attr.attribution_id,
                                conflict_type="annotation_disagreement",
                                description=(
                                    f"同三元组({key[0]}, {key[1]!r}, {key[2]!r})有{len(group)}条标注, "
                                    f"人工类型/标注人不一致: {'; '.join(others)}"
                                ),
                                auto_attribution=attr.error_type,
                                manual_attribution=a.error_type,
                                resolved=False,
                            )
                            conflicts.append(conflict)
                            self.conflicts[conflict.conflict_id] = conflict
                            break

        return conflicts

    def _check_single_conflict(
        self, attribution: AttributionResult, annotation: AnnotationRecord
    ) -> Optional[ConflictRecord]:
        conflict_type = None
        description = ""

        if annotation.error_type and attribution.error_type != annotation.error_type:
            conflict_type = "type_mismatch"
            description = (
                f"自动归因类型 '{attribution.error_type}' 与标注类型 "
                f"'{annotation.error_type}' 不一致"
            )

        if (
            attribution.confidence < 0.7
            and annotation.confidence > 0.8
        ):
            if not conflict_type:
                conflict_type = "confidence_mismatch"
                description = (
                    f"自动归因置信度 {attribution.confidence:.2f} 与标注置信度 "
                    f"{annotation.confidence:.2f} 存在显著差异"
                )

        if _is_empty(annotation.error_word) or _is_empty(annotation.correct_word):
            conflict_type = "missing_data"
            missing_fields = []
            if _is_empty(annotation.error_word):
                missing_fields.append("error_word")
            if _is_empty(annotation.correct_word):
                missing_fields.append("correct_word")
            description = f"标注数据存在空值，需要人工确认 (缺失: {', '.join(missing_fields)})"

        if conflict_type:
            return ConflictRecord(
                conflict_id=str(uuid.uuid4()),
                log_id=attribution.log_id,
                annotation_id=attribution.annotation_id,
                attribution_id=attribution.attribution_id,
                conflict_type=conflict_type,
                description=description,
                auto_attribution=attribution.error_type,
                manual_attribution=annotation.error_type if annotation.error_type else None,
                resolved=False,
            )

        return None

    def resolve_conflict(
        self,
        conflict_id: str,
        resolved_by: str,
        resolution_notes: str,
        final_error_type: str,
    ) -> Optional[ConflictRecord]:
        if conflict_id not in self.conflicts:
            return None

        conflict = self.conflicts[conflict_id]
        conflict.resolved = True
        conflict.resolved_by = resolved_by
        conflict.resolved_at = datetime.now()
        conflict.resolution_notes = resolution_notes
        conflict.manual_attribution = final_error_type

        return conflict

    def get_unresolved_conflicts(self) -> List[ConflictRecord]:
        return [c for c in self.conflicts.values() if not c.resolved]

    def get_conflicts_by_type(self, conflict_type: str) -> List[ConflictRecord]:
        return [c for c in self.conflicts.values() if c.conflict_type == conflict_type]

    def get_conflict(self, conflict_id: str) -> Optional[ConflictRecord]:
        return self.conflicts.get(conflict_id)


class ReviewManager:
    def __init__(self):
        pass

    def review_attribution(
        self,
        attribution: AttributionResult,
        reviewer: str,
        action: ReviewAction,
        review_notes: str = "",
        revised_error_type: Optional[str] = None,
    ) -> AttributionResult:
        attribution.reviewed_by = reviewer
        attribution.reviewed_at = datetime.now()
        attribution.review_notes = review_notes
        attribution.review_action = action.value

        if action == ReviewAction.CONFIRM:
            attribution.status = AttributionStatus.MANUAL_REVIEWED
            attribution.final_error_type = attribution.error_type

        elif action == ReviewAction.REVISE:
            attribution.status = AttributionStatus.MANUAL_REVIEWED
            if revised_error_type:
                attribution.final_error_type = revised_error_type
            else:
                attribution.final_error_type = attribution.error_type

        elif action == ReviewAction.REJECT:
            attribution.status = AttributionStatus.MANUAL_REVIEWED
            attribution.final_error_type = ErrorType.UNKNOWN.value

        return attribution

    def batch_review(
        self,
        attributions: List[AttributionResult],
        reviewer: str,
        action: ReviewAction,
        review_notes: str = "",
    ) -> List[AttributionResult]:
        return [
            self.review_attribution(attr, reviewer, action, review_notes)
            for attr in attributions
        ]

    def get_review_summary(
        self, attributions: List[AttributionResult]
    ) -> Dict[str, any]:
        total = len(attributions)
        reviewed = sum(1 for a in attributions if a.reviewed_by)
        auto_attributed = sum(
            1
            for a in attributions
            if a.status == AttributionStatus.AUTO_ATTRIBUTED
        )
        manual_reviewed = sum(
            1
            for a in attributions
            if a.status == AttributionStatus.MANUAL_REVIEWED
        )
        pending = sum(
            1 for a in attributions if a.status == AttributionStatus.PENDING
        )

        error_type_counts = {}
        for a in attributions:
            et = a.final_error_type or a.error_type
            error_type_counts[et] = error_type_counts.get(et, 0) + 1

        return {
            "total": total,
            "reviewed": reviewed,
            "auto_attributed": auto_attributed,
            "manual_reviewed": manual_reviewed,
            "pending": pending,
            "review_rate": reviewed / total if total > 0 else 0,
            "error_type_distribution": error_type_counts,
        }
