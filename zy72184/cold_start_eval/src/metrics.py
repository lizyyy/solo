from typing import List, Dict, Any
from collections import defaultdict
from .schemas import EvaluationRecord, ReviewStatus, AnomalyType


class MetricsCalculator:
    def __init__(self):
        self.label_weights = {
            "explanation_quality": 0.4,
            "feature_relevance": 0.3,
            "user_understandable": 0.3
        }

    def calculate_all(self, records: List[EvaluationRecord]) -> Dict[str, float]:
        metrics = {}
        valid_records = [r for r in records if r.review]
        if not valid_records:
            return metrics
        metrics.update(self._calculate_accuracy_metrics(valid_records))
        metrics.update(self._calculate_review_metrics(records))
        metrics.update(self._calculate_consistency_metrics(valid_records))
        metrics.update(self._calculate_overall_score(metrics))
        return metrics

    def calculate_single(self, record: EvaluationRecord) -> Dict[str, float]:
        metrics = {}
        if not record.review:
            return metrics
        pred = record.prediction.prediction
        corrected = record.review.corrected_label or pred
        for label_key, weight in self.label_weights.items():
            pred_val = pred.get(label_key)
            corr_val = corrected.get(label_key)
            if pred_val is not None and corr_val is not None:
                metrics[f"{label_key}_accuracy"] = self._calculate_field_accuracy(
                    pred_val, corr_val
                )
                metrics[f"{label_key}_weighted"] = metrics[f"{label_key}_accuracy"] * weight
        if metrics:
            metrics["overall_score"] = sum(
                v for k, v in metrics.items() if k.endswith("_weighted")
            )
        if record.review.review_status == ReviewStatus.APPROVED:
            metrics["approved"] = 1.0
        elif record.review.review_status == ReviewStatus.REJECTED:
            metrics["approved"] = 0.0
        elif record.review.review_status == ReviewStatus.REWORK:
            metrics["approved"] = 0.5
        else:
            metrics["approved"] = 0.0
        return metrics

    def _calculate_accuracy_metrics(self, records: List[EvaluationRecord]) -> Dict[str, float]:
        metrics = {}
        for label_key in self.label_weights:
            field_metrics = []
            for record in records:
                pred = record.prediction.prediction
                corrected = record.review.corrected_label or pred
                pred_val = pred.get(label_key)
                corr_val = corrected.get(label_key)
                if pred_val is not None and corr_val is not None:
                    acc = self._calculate_field_accuracy(pred_val, corr_val)
                    field_metrics.append(acc)
            if field_metrics:
                metrics[f"{label_key}_accuracy"] = sum(field_metrics) / len(field_metrics)
        return metrics

    def _calculate_review_metrics(self, records: List[EvaluationRecord]) -> Dict[str, float]:
        metrics = {}
        total = len(records)
        reviewed = [r for r in records if r.review]
        approved = [r for r in reviewed if r.review.review_status == ReviewStatus.APPROVED]
        rejected = [r for r in reviewed if r.review.review_status == ReviewStatus.REJECTED]
        rework = [r for r in reviewed if r.review.review_status == ReviewStatus.REWORK]
        pending = [r for r in records if not r.review or r.review.review_status == ReviewStatus.PENDING]
        metrics["review_rate"] = len(reviewed) / total if total > 0 else 0.0
        metrics["approval_rate"] = len(approved) / len(reviewed) if reviewed else 0.0
        metrics["rejection_rate"] = len(rejected) / len(reviewed) if reviewed else 0.0
        metrics["rework_rate"] = len(rework) / len(reviewed) if reviewed else 0.0
        metrics["pending_rate"] = len(pending) / total if total > 0 else 0.0
        avg_round = 0.0
        if reviewed:
            rounds = [r.review.review_round for r in reviewed]
            avg_round = sum(rounds) / len(rounds)
        metrics["avg_review_round"] = avg_round
        return metrics

    def _calculate_consistency_metrics(self, records: List[EvaluationRecord]) -> Dict[str, float]:
        metrics = {}
        has_feedback = [r for r in records if r.feedback]
        if has_feedback:
            consistent_count = 0
            for record in has_feedback:
                if record.review and record.feedback:
                    review_approved = record.review.review_status == ReviewStatus.APPROVED
                    feedback_positive = record.feedback.feedback_value in ["good", "positive", True, 1]
                    if review_approved == feedback_positive:
                        consistent_count += 1
            metrics["human_online_consistency"] = consistent_count / len(has_feedback)
        label_conflicts = [
            r for r in records
            if any(a.anomaly_type == AnomalyType.LABEL_CONFLICT for a in r.anomalies)
        ]
        metrics["label_conflict_rate"] = len(label_conflicts) / len(records) if records else 0.0
        return metrics

    def _calculate_overall_score(self, metrics: Dict[str, float]) -> Dict[str, float]:
        score = 0.0
        weight_sum = 0.0
        for label_key, weight in self.label_weights.items():
            acc_key = f"{label_key}_accuracy"
            if acc_key in metrics:
                score += metrics[acc_key] * weight
                weight_sum += weight
        if weight_sum > 0:
            score = score / weight_sum
        if "approval_rate" in metrics:
            score = score * 0.7 + metrics["approval_rate"] * 0.3
        return {"overall_score": score}

    def _calculate_field_accuracy(self, pred: Any, corr: Any) -> float:
        if pred == corr:
            return 1.0
        if isinstance(pred, str) and isinstance(corr, str):
            if pred.lower() == corr.lower():
                return 0.8
            pred_words = set(pred.lower().split())
            corr_words = set(corr.lower().split())
            if pred_words and corr_words:
                overlap = len(pred_words & corr_words) / len(pred_words | corr_words)
                return 0.5 + 0.5 * overlap
        if isinstance(pred, (int, float)) and isinstance(corr, (int, float)):
            if corr != 0:
                diff = abs(pred - corr) / abs(corr)
                return max(0.0, 1.0 - diff)
        return 0.0
