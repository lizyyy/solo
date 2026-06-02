from typing import Dict, List, Optional
from dataclasses import dataclass, field
from collections import defaultdict
from .models import MergedRecord, MergeDecision


@dataclass
class StratifiedMetrics:
    stratum_name: str
    sample_count: int
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    true_positives: int
    true_negatives: int
    false_positives: int
    false_negatives: int
    avg_confidence: float
    confidence_distribution: Dict[str, float] = field(default_factory=dict)


class MetricCalculator:
    def __init__(self):
        self.overall_metrics: Optional[Dict] = None
        self.stratified_metrics: Dict[str, StratifiedMetrics] = {}
        self.decision_matrix: Dict[str, Dict[str, int]] = defaultdict(
            lambda: defaultdict(int)
        )

    def calculate(
        self,
        records: Dict[str, MergedRecord],
        strata: Optional[Dict[str, List[str]]] = None,
    ) -> Dict:
        self.overall_metrics = self._calculate_metrics(
            records, list(records.keys())
        )

        if strata:
            for stratum_name, sample_ids in strata.items():
                if len(sample_ids) > 0:
                    self.stratified_metrics[stratum_name] = self._calculate_stratified(
                        records, sample_ids, stratum_name
                    )

        self._build_decision_matrix(records)

        return {
            "overall": self.overall_metrics,
            "stratified": {
                k: v.__dict__ for k, v in self.stratified_metrics.items()
            },
            "decision_matrix": dict(self.decision_matrix),
        }

    def _calculate_metrics(
        self, records: Dict[str, MergedRecord], sample_ids: List[str]
    ) -> Dict:
        tp = tn = fp = fn = 0
        confidences = []
        valid_samples = 0

        for sid in sample_ids:
            if sid not in records:
                continue

            record = records[sid]
            if not record.model_output or not record.sample.ground_truth:
                continue

            valid_samples += 1
            pred = record.model_output.decision
            gt = record.sample.ground_truth
            confidences.append(record.model_output.confidence)

            if pred == MergeDecision.MERGE and gt == MergeDecision.MERGE:
                tp += 1
            elif pred == MergeDecision.NOT_MERGE and gt == MergeDecision.NOT_MERGE:
                tn += 1
            elif pred == MergeDecision.MERGE and gt == MergeDecision.NOT_MERGE:
                fp += 1
            elif pred == MergeDecision.NOT_MERGE and gt == MergeDecision.MERGE:
                fn += 1

        accuracy = (tp + tn) / valid_samples if valid_samples > 0 else 0.0
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (
            2 * precision * recall / (precision + recall)
            if (precision + recall) > 0
            else 0.0
        )
        avg_conf = sum(confidences) / len(confidences) if confidences else 0.0

        conf_dist = {}
        if confidences:
            conf_dist[">=0.9"] = sum(1 for c in confidences if c >= 0.9) / len(
                confidences
            )
            conf_dist["0.7-0.9"] = (
                sum(1 for c in confidences if 0.7 <= c < 0.9) / len(confidences)
            )
            conf_dist["0.5-0.7"] = (
                sum(1 for c in confidences if 0.5 <= c < 0.7) / len(confidences)
            )
            conf_dist["<0.5"] = sum(1 for c in confidences if c < 0.5) / len(
                confidences
            )

        return {
            "sample_count": valid_samples,
            "accuracy": accuracy,
            "precision": precision,
            "recall": recall,
            "f1_score": f1,
            "true_positives": tp,
            "true_negatives": tn,
            "false_positives": fp,
            "false_negatives": fn,
            "avg_confidence": avg_conf,
            "confidence_distribution": conf_dist,
        }

    def _calculate_stratified(
        self,
        records: Dict[str, MergedRecord],
        sample_ids: List[str],
        stratum_name: str,
    ) -> StratifiedMetrics:
        metrics = self._calculate_metrics(records, sample_ids)
        return StratifiedMetrics(
            stratum_name=stratum_name,
            sample_count=metrics["sample_count"],
            accuracy=metrics["accuracy"],
            precision=metrics["precision"],
            recall=metrics["recall"],
            f1_score=metrics["f1_score"],
            true_positives=metrics["true_positives"],
            true_negatives=metrics["true_negatives"],
            false_positives=metrics["false_positives"],
            false_negatives=metrics["false_negatives"],
            avg_confidence=metrics["avg_confidence"],
            confidence_distribution=metrics["confidence_distribution"],
        )

    def _build_decision_matrix(self, records: Dict[str, MergedRecord]):
        self.decision_matrix = defaultdict(lambda: defaultdict(int))
        for record in records.values():
            if not record.model_output or not record.sample.ground_truth:
                continue
            gt = record.sample.ground_truth.value
            pred = record.model_output.decision.value
            self.decision_matrix[gt][pred] += 1

    def get_worst_cases(
        self, records: Dict[str, MergedRecord], top_n: int = 10
    ) -> List[Dict]:
        errors = []
        for sample_id, record in records.items():
            if not record.model_output or not record.sample.ground_truth:
                continue

            if record.model_output.decision != record.sample.ground_truth:
                errors.append(
                    {
                        "sample_id": sample_id,
                        "ground_truth": record.sample.ground_truth.value,
                        "predicted": record.model_output.decision.value,
                        "confidence": record.model_output.confidence,
                        "entity_a": record.sample.entity_a.entity_value,
                        "entity_b": record.sample.entity_b.entity_value,
                        "merge_reason": record.model_output.merge_reason,
                    }
                )

        errors.sort(key=lambda x: x["confidence"], reverse=True)
        return errors[:top_n]

    def get_human_correction_analysis(
        self, records: Dict[str, MergedRecord]
    ) -> Dict:
        corrected = [r for r in records.values() if r.human_correction]
        model_overruled = [
            r
            for r in corrected
            if r.human_correction.original_decision
            != r.human_correction.corrected_decision
        ]

        return {
            "total_corrected": len(corrected),
            "model_overruled_count": len(model_overruled),
            "overrule_rate": (
                len(model_overruled) / len(corrected) if corrected else 0.0
            ),
            "overruled_samples": [
                {
                    "sample_id": r.sample.sample_id,
                    "original_decision": r.human_correction.original_decision.value,
                    "corrected_decision": r.human_correction.corrected_decision.value,
                    "reason": r.human_correction.correction_reason,
                    "corrected_by": r.human_correction.corrected_by,
                }
                for r in model_overruled
            ],
        }
