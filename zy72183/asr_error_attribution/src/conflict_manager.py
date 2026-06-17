import uuid
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


class ConflictManager:
    def __init__(self):
        self.conflicts: Dict[str, ConflictRecord] = {}

    def detect_conflicts(
        self,
        attributions: List[AttributionResult],
        annotations: List[AnnotationRecord],
        annotation_conflicts: Optional[List[Dict]] = None,
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

        if annotation_conflicts:
            for ac in annotation_conflicts:
                conflict = ConflictRecord(
                    conflict_id=str(uuid.uuid4()),
                    log_id=ac["triple_key"][0] if ac["triple_key"] else "",
                    annotation_id=",".join(ac["annotation_ids"]),
                    attribution_id="",
                    conflict_type="annotation_conflict",
                    description=ac["description"],
                    auto_attribution=",".join(ac["conflict_types"]),
                    manual_attribution=None,
                    resolved=False,
                )
                conflicts.append(conflict)
                self.conflicts[conflict.conflict_id] = conflict

        return conflicts

    def _check_single_conflict(
        self, attribution: AttributionResult, annotation: AnnotationRecord
    ) -> Optional[ConflictRecord]:
        conflict_type = None
        description = ""

        if not annotation.error_word or not annotation.correct_word:
            empty_parts = []
            if not annotation.error_word:
                empty_parts.append("错误词")
            if not annotation.correct_word:
                empty_parts.append("正确词")
            conflict_type = "missing_data"
            description = f"标注数据空值: {', '.join(empty_parts)}为空，需要人工确认"

        elif annotation.error_type and attribution.error_type != annotation.error_type:
            conflict_type = "type_mismatch"
            description = (
                f"自动归因类型 '{attribution.error_type}' 与标注类型 "
                f"'{annotation.error_type}' 不一致"
            )

        elif (
            attribution.confidence < 0.7
            and annotation.confidence > 0.8
        ):
            conflict_type = "confidence_mismatch"
            description = (
                f"自动归因置信度 {attribution.confidence:.2f} 与标注置信度 "
                f"{annotation.confidence:.2f} 存在显著差异"
            )

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
