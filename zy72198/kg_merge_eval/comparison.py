from typing import Dict, List, Optional
from dataclasses import dataclass
from .models import MergedRecord, MergeDecision


@dataclass
class RunDifference:
    sample_id: str
    change_type: str
    old_decision: Optional[str]
    new_decision: Optional[str]
    old_confidence: Optional[float]
    new_confidence: Optional[float]
    reason: str


class RunComparator:
    def __init__(self):
        self.differences: List[RunDifference] = []
        self.metric_differences: Dict = {}

    def compare_records(
        self,
        old_records: Dict[str, MergedRecord],
        new_records: Dict[str, MergedRecord],
    ) -> Dict:
        self.differences = []

        all_sample_ids = set(old_records.keys()) | set(new_records.keys())

        for sample_id in all_sample_ids:
            old = old_records.get(sample_id)
            new = new_records.get(sample_id)

            if old is None and new is not None:
                self.differences.append(
                    RunDifference(
                        sample_id=sample_id,
                        change_type="new_sample",
                        old_decision=None,
                        new_decision=(
                            new.model_output.decision.value
                            if new.model_output
                            else None
                        ),
                        old_confidence=None,
                        new_confidence=(
                            new.model_output.confidence if new.model_output else None
                        ),
                        reason="新增样本",
                    )
                )
            elif old is not None and new is None:
                self.differences.append(
                    RunDifference(
                        sample_id=sample_id,
                        change_type="removed_sample",
                        old_decision=(
                            old.model_output.decision.value
                            if old.model_output
                            else None
                        ),
                        new_decision=None,
                        old_confidence=(
                            old.model_output.confidence if old.model_output else None
                        ),
                        new_confidence=None,
                        reason="样本被移除",
                    )
                )
            else:
                self._compare_single_record(old, new)

        return {
            "total_changes": len(self.differences),
            "changes_by_type": self._summarize_by_type(),
            "detailed_changes": [d.__dict__ for d in self.differences],
        }

    def _compare_single_record(
        self, old: MergedRecord, new: MergedRecord
    ):
        changes = []

        if old.model_output and new.model_output:
            if old.model_output.decision != new.model_output.decision:
                changes.append("决策变更")

            confidence_diff = abs(
                old.model_output.confidence - new.model_output.confidence
            )
            if confidence_diff > 0.1:
                changes.append(
                    f"置信度变化较大({confidence_diff:.2f})"
                )

        if old.final_decision != new.final_decision:
            changes.append("最终决策变更")

        old_conflicts = {c.conflict_type.value for c in old.conflicts}
        new_conflicts = {c.conflict_type.value for c in new.conflicts}
        if old_conflicts != new_conflicts:
            added = new_conflicts - old_conflicts
            removed = old_conflicts - new_conflicts
            conflict_changes = []
            if added:
                conflict_changes.append(f"新增冲突: {', '.join(added)}")
            if removed:
                conflict_changes.append(f"移除冲突: {', '.join(removed)}")
            if conflict_changes:
                changes.append("; ".join(conflict_changes))

        if changes:
            self.differences.append(
                RunDifference(
                    sample_id=old.sample.sample_id,
                    change_type="modified",
                    old_decision=(
                        old.model_output.decision.value
                        if old.model_output
                        else None
                    ),
                    new_decision=(
                        new.model_output.decision.value
                        if new.model_output
                        else None
                    ),
                    old_confidence=(
                        old.model_output.confidence if old.model_output else None
                    ),
                    new_confidence=(
                        new.model_output.confidence if new.model_output else None
                    ),
                    reason="; ".join(changes),
                )
            )

    def _summarize_by_type(self) -> Dict[str, int]:
        summary: Dict[str, int] = {}
        for diff in self.differences:
            summary[diff.change_type] = summary.get(diff.change_type, 0) + 1
        return summary

    def compare_metrics(
        self, old_metrics: Dict, new_metrics: Dict
    ) -> Dict:
        self.metric_differences = {}

        old_overall = old_metrics.get("overall", {})
        new_overall = new_metrics.get("overall", {})

        metric_fields = [
            "accuracy",
            "precision",
            "recall",
            "f1_score",
            "avg_confidence",
            "sample_count",
        ]

        for field in metric_fields:
            old_val = old_overall.get(field, 0)
            new_val = new_overall.get(field, 0)
            diff = new_val - old_val if isinstance(old_val, (int, float)) else None
            self.metric_differences[field] = {
                "old": old_val,
                "new": new_val,
                "difference": diff,
                "change_percent": (
                    (diff / old_val * 100) if old_val and diff is not None else None
                ),
            }

        return {
            "metric_changes": self.metric_differences,
            "interpretation": self._interpret_metric_changes(),
        }

    def _interpret_metric_changes(self) -> List[str]:
        interpretations = []

        accuracy_diff = self.metric_differences.get("accuracy", {}).get("difference")
        if accuracy_diff is not None:
            if accuracy_diff > 0.01:
                interpretations.append(
                    f"准确率提升显著 ({accuracy_diff*100:+.2f}%)"
                )
            elif accuracy_diff < -0.01:
                interpretations.append(
                    f"准确率下降明显 ({accuracy_diff*100:+.2f}%)"
                )

        f1_diff = self.metric_differences.get("f1_score", {}).get("difference")
        if f1_diff is not None:
            if f1_diff > 0.02:
                interpretations.append(
                    f"F1分数提升明显 ({f1_diff*100:+.2f}%)"
                )
            elif f1_diff < -0.02:
                interpretations.append(
                    f"F1分数下降明显 ({f1_diff*100:+.2f}%)，需要关注"
                )

        sample_count_diff = self.metric_differences.get("sample_count", {}).get(
            "difference"
        )
        if sample_count_diff:
            interpretations.append(
                f"评测样本数量变化: {sample_count_diff:+d}"
            )

        if not interpretations:
            interpretations.append("指标变化在正常范围内")

        return interpretations

    def get_decision_changes_summary(
        self, records_old: Dict[str, MergedRecord], records_new: Dict[str, MergedRecord]
    ) -> Dict:
        decision_changes = {
            "to_merge": [],
            "to_not_merge": [],
            "to_review": [],
            "to_uncertain": [],
        }

        for diff in self.differences:
            if diff.change_type == "modified" and diff.old_decision != diff.new_decision:
                if diff.new_decision == MergeDecision.MERGE.value:
                    decision_changes["to_merge"].append(diff.sample_id)
                elif diff.new_decision == MergeDecision.NOT_MERGE.value:
                    decision_changes["to_not_merge"].append(diff.sample_id)
                elif diff.new_decision == MergeDecision.REVIEW.value:
                    decision_changes["to_review"].append(diff.sample_id)
                elif diff.new_decision == MergeDecision.UNCERTAIN.value:
                    decision_changes["to_uncertain"].append(diff.sample_id)

        return {
            k: {"count": len(v), "sample_ids": v}
            for k, v in decision_changes.items()
        }
