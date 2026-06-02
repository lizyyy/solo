from typing import Dict, List
from collections import defaultdict
from .models import MergedRecord, ConflictAlert, ConflictType, MergeDecision


class ConflictDetector:
    def __init__(self):
        self.conflicts: List[ConflictAlert] = []
        self.label_conflicts: List[ConflictAlert] = []
        self.sample_leaks: List[ConflictAlert] = []
        self.missing_data: List[ConflictAlert] = []
        self.duplicates: List[ConflictAlert] = []
        self.boundary_cases: List[ConflictAlert] = []

    def detect_all(
        self, records: Dict[str, MergedRecord]
    ) -> Dict[str, MergedRecord]:
        self.conflicts = []
        self.label_conflicts = []
        self.sample_leaks = []
        self.missing_data = []
        self.duplicates = []
        self.boundary_cases = []

        self._detect_label_conflicts(records)
        self._detect_sample_leaks(records)
        self._detect_missing_data(records)
        self._detect_duplicates(records)
        self._detect_boundary_cases(records)

        for conflict in self.conflicts:
            if conflict.sample_id in records:
                records[conflict.sample_id].conflicts.append(conflict)

        return records

    def _detect_label_conflicts(self, records: Dict[str, MergedRecord]):
        for sample_id, record in records.items():
            if not record.model_output or not record.sample.ground_truth:
                continue

            if record.model_output.decision != record.sample.ground_truth:
                alert = ConflictAlert(
                    conflict_type=ConflictType.LABEL_CONFLICT,
                    sample_id=sample_id,
                    severity="high",
                    message=f"模型预测({record.model_output.decision.value})与标注({record.sample.ground_truth.value})不一致",
                    details={
                        "model_decision": record.model_output.decision.value,
                        "ground_truth": record.sample.ground_truth.value,
                        "confidence": record.model_output.confidence,
                        "merge_reason": record.model_output.merge_reason,
                    },
                )
                self.label_conflicts.append(alert)
                self.conflicts.append(alert)

            if (
                record.human_correction
                and record.human_correction.corrected_decision
                != record.sample.ground_truth
            ):
                alert = ConflictAlert(
                    conflict_type=ConflictType.LABEL_CONFLICT,
                    sample_id=sample_id,
                    severity="critical",
                    message=f"人工修正({record.human_correction.corrected_decision.value})与标注({record.sample.ground_truth.value})不一致",
                    details={
                        "corrected_decision": record.human_correction.corrected_decision.value,
                        "ground_truth": record.sample.ground_truth.value,
                        "correction_reason": record.human_correction.correction_reason,
                    },
                )
                self.label_conflicts.append(alert)
                self.conflicts.append(alert)

    def _detect_sample_leaks(self, records: Dict[str, MergedRecord]):
        all_entity_pairs = defaultdict(list)

        for sample_id, record in records.items():
            entity_a_val = (
                record.sample.entity_a.entity_value.strip().lower()
                if record.sample.entity_a.entity_value
                else ""
            )
            entity_b_val = (
                record.sample.entity_b.entity_value.strip().lower()
                if record.sample.entity_b.entity_value
                else ""
            )

            pair = tuple(sorted([entity_a_val, entity_b_val]))
            all_entity_pairs[pair].append(sample_id)

            if record.sample.ground_truth == MergeDecision.MERGE:
                if record.model_output and record.model_output.decision in [
                    MergeDecision.MERGE,
                    MergeDecision.REVIEW,
                ]:
                    if record.model_output.predicted_cluster_id:
                        cluster_key = (
                            f"cluster_{record.model_output.predicted_cluster_id}"
                        )
                        all_entity_pairs[cluster_key].append(sample_id)

        for pair, sample_ids in all_entity_pairs.items():
            if len(sample_ids) > 1 and pair[0] and pair[1]:
                for sample_id in sample_ids:
                    alert = ConflictAlert(
                        conflict_type=ConflictType.SAMPLE_LEAK,
                        sample_id=sample_id,
                        severity="medium",
                        message=f"样本可能存在泄漏：同对实体出现在 {len(sample_ids)} 个样本中",
                        details={
                            "entity_pair": pair,
                            "overlapping_samples": sample_ids,
                            "sample_count": len(sample_ids),
                        },
                    )
                    self.sample_leaks.append(alert)
                    self.conflicts.append(alert)

    def _detect_missing_data(self, records: Dict[str, MergedRecord]):
        for sample_id, record in records.items():
            issues = []

            if record.sample.has_missing_values():
                missing_fields = []
                if not record.sample.entity_a.entity_id:
                    missing_fields.append("entity_a_id")
                if not record.sample.entity_b.entity_id:
                    missing_fields.append("entity_b_id")
                if not record.sample.entity_a.entity_value:
                    missing_fields.append("entity_a_value")
                if not record.sample.entity_b.entity_value:
                    missing_fields.append("entity_b_value")
                issues.append(
                    f"样本字段缺失: {', '.join(missing_fields)}"
                )

            if not record.model_output:
                issues.append("缺少模型输出结果")

            if record.model_output and record.model_output.confidence is None:
                issues.append("模型输出缺少置信度")

            if issues:
                alert = ConflictAlert(
                    conflict_type=ConflictType.MISSING_DATA,
                    sample_id=sample_id,
                    severity="low",
                    message="; ".join(issues),
                    details={"issues": issues},
                )
                self.missing_data.append(alert)
                self.conflicts.append(alert)

    def _detect_duplicates(self, records: Dict[str, MergedRecord]):
        for sample_id, record in records.items():
            if record.sample.has_duplicate_entities():
                alert = ConflictAlert(
                    conflict_type=ConflictType.DUPLICATE,
                    sample_id=sample_id,
                    severity="medium",
                    message="样本中两个实体完全相同，可能是重复数据",
                    details={
                        "entity_a_value": record.sample.entity_a.entity_value,
                        "entity_b_value": record.sample.entity_b.entity_value,
                        "entity_a_id": record.sample.entity_a.entity_id,
                        "entity_b_id": record.sample.entity_b.entity_id,
                    },
                )
                self.duplicates.append(alert)
                self.conflicts.append(alert)

    def _detect_boundary_cases(self, records: Dict[str, MergedRecord]):
        for sample_id, record in records.items():
            boundary_reasons = []

            if record.sample.is_boundary:
                boundary_reasons.append("样本被标记为边界案例")

            if record.model_output:
                if 0.45 <= record.model_output.confidence <= 0.55:
                    boundary_reasons.append(
                        f"模型置信度临界({record.model_output.confidence:.2f})"
                    )
                if record.model_output.decision == MergeDecision.UNCERTAIN:
                    boundary_reasons.append("模型输出为不确定")

            if (
                record.human_correction
                and record.human_correction.original_decision
                != record.human_correction.corrected_decision
            ):
                boundary_reasons.append("存在人工修正决策变更")

            if boundary_reasons:
                alert = ConflictAlert(
                    conflict_type=ConflictType.BOUNDARY_CASE,
                    sample_id=sample_id,
                    severity="medium",
                    message="边界案例: " + "; ".join(boundary_reasons),
                    details={"boundary_reasons": boundary_reasons},
                )
                self.boundary_cases.append(alert)
                self.conflicts.append(alert)

    def get_conflict_summary(self) -> Dict:
        return {
            "total_conflicts": len(self.conflicts),
            "label_conflicts": len(self.label_conflicts),
            "sample_leaks": len(self.sample_leaks),
            "missing_data": len(self.missing_data),
            "duplicates": len(self.duplicates),
            "boundary_cases": len(self.boundary_cases),
            "conflicts_by_severity": {
                "critical": len(
                    [c for c in self.conflicts if c.severity == "critical"]
                ),
                "high": len([c for c in self.conflicts if c.severity == "high"]),
                "medium": len(
                    [c for c in self.conflicts if c.severity == "medium"]
                ),
                "low": len([c for c in self.conflicts if c.severity == "low"]),
            },
        }


class SampleStratifier:
    def __init__(self):
        self.strata: Dict[str, List[str]] = defaultdict(list)

    def stratify(
        self, records: Dict[str, MergedRecord]
    ) -> Dict[str, List[str]]:
        self.strata = defaultdict(list)

        for sample_id, record in records.items():
            self.strata["all_samples"].append(sample_id)

            if record.sample.ground_truth:
                gt_key = f"ground_truth_{record.sample.ground_truth.value}"
                self.strata[gt_key].append(sample_id)

            if record.model_output:
                model_key = f"model_{record.model_output.decision.value}"
                self.strata[model_key].append(sample_id)

                conf = record.model_output.confidence
                if conf >= 0.9:
                    self.strata["high_confidence"].append(sample_id)
                elif conf >= 0.7:
                    self.strata["medium_confidence"].append(sample_id)
                elif conf >= 0.5:
                    self.strata["low_confidence"].append(sample_id)
                else:
                    self.strata["very_low_confidence"].append(sample_id)

            if record.human_correction:
                self.strata["human_corrected"].append(sample_id)
                if (
                    record.human_correction.original_decision
                    != record.human_correction.corrected_decision
                ):
                    self.strata["decision_changed"].append(sample_id)

            if len(record.feedback) > 0:
                self.strata["has_feedback"].append(sample_id)
                unresolved = [f for f in record.feedback if not f.resolved]
                if unresolved:
                    self.strata["unresolved_feedback"].append(sample_id)

            has_conflicts = len(record.conflicts) > 0
            if has_conflicts:
                self.strata["has_conflicts"].append(sample_id)

                conflict_types = set(c.conflict_type.value for c in record.conflicts)
                for ct in conflict_types:
                    self.strata[f"conflict_{ct}"].append(sample_id)

                severities = set(c.severity for c in record.conflicts)
                for s in severities:
                    self.strata[f"severity_{s}"].append(sample_id)

            entity_type = record.sample.entity_a.entity_type.value
            self.strata[f"entity_type_{entity_type}"].append(sample_id)

        return dict(self.strata)

    def get_sample_ids(self, stratum_name: str) -> List[str]:
        return self.strata.get(stratum_name, [])

    def get_strata_summary(self) -> Dict[str, int]:
        return {k: len(v) for k, v in self.strata.items()}
