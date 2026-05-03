"""
统计评估模块 - 计算一致率、混淆矩阵、标注员漂移、数据泄漏和高风险样本
"""

import hashlib
import uuid
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from sklearn.metrics import confusion_matrix as sklearn_confusion_matrix

from .models import (
    AnnotationRecord,
    AuditResult,
    ConsistencyMetrics,
    DataLeakage,
    HighRiskSample,
    LabelSchema,
    PredictionRecord,
    SamplingFeedback,
)


class ConsistencyCalculator:
    @staticmethod
    def calculate_overall_agreement(
        annotations: List[AnnotationRecord],
        predictions: Optional[List[PredictionRecord]] = None,
        feedbacks: Optional[List[SamplingFeedback]] = None,
    ) -> float:
        if predictions:
            pred_map = {}
            for p in predictions:
                key = (p.session_id, p.turn_id) if p.turn_id else p.session_id
                pred_map[key] = p.predicted_label

            matches = 0
            total = 0
            for a in annotations:
                key = (a.session_id, a.turn_id) if a.turn_id else a.session_id
                if key in pred_map:
                    total += 1
                    if a.label == pred_map[key]:
                        matches += 1

            if total > 0:
                return matches / total

        if feedbacks:
            agreements = sum(1 for f in feedbacks if f.is_agreement)
            return agreements / len(feedbacks) if feedbacks else 1.0

        annotator_groups = defaultdict(list)
        for a in annotations:
            key = (a.session_id, a.turn_id) if a.turn_id else a.session_id
            annotator_groups[key].append(a.label)

        consistent_sessions = sum(
            1 for labels in annotator_groups.values()
            if len(labels) > 1 and len(set(labels)) == 1
        )
        total_multi_annot = sum(
            1 for labels in annotator_groups.values() if len(labels) > 1
        )

        return consistent_sessions / total_multi_annot if total_multi_annot > 0 else 1.0

    @staticmethod
    def calculate_per_label_agreement(
        annotations: List[AnnotationRecord],
        predictions: List[PredictionRecord],
    ) -> Dict[str, float]:
        pred_map = {}
        for p in predictions:
            key = (p.session_id, p.turn_id) if p.turn_id else p.session_id
            pred_map[key] = p.predicted_label

        label_stats = defaultdict(lambda: {"matches": 0, "total": 0})

        for a in annotations:
            key = (a.session_id, a.turn_id) if a.turn_id else a.session_id
            if key in pred_map:
                label_stats[a.label]["total"] += 1
                if a.label == pred_map[key]:
                    label_stats[a.label]["matches"] += 1

        return {
            label: stats["matches"] / stats["total"] if stats["total"] > 0 else 0.0
            for label, stats in label_stats.items()
        }

    @staticmethod
    def calculate_cohen_kappa(
        annotations: List[AnnotationRecord],
        predictions: List[PredictionRecord],
    ) -> Optional[float]:
        pred_map = {}
        for p in predictions:
            key = (p.session_id, p.turn_id) if p.turn_id else p.session_id
            pred_map[key] = p.predicted_label

        y_true = []
        y_pred = []
        for a in annotations:
            key = (a.session_id, a.turn_id) if a.turn_id else a.session_id
            if key in pred_map:
                y_true.append(a.label)
                y_pred.append(pred_map[key])

        if len(y_true) < 2:
            return None

        all_labels = sorted(set(y_true + y_pred))
        label_to_idx = {label: i for i, label in enumerate(all_labels)}

        y_true_idx = [label_to_idx[y] for y in y_true]
        y_pred_idx = [label_to_idx[y] for y in y_pred]

        n = len(y_true_idx)
        k = len(all_labels)

        observed_agreement = sum(1 for t, p in zip(y_true_idx, y_pred_idx) if t == p) / n

        true_counts = Counter(y_true_idx)
        pred_counts = Counter(y_pred_idx)
        expected_agreement = sum(
            (true_counts[i] / n) * (pred_counts[i] / n)
            for i in range(k)
        )

        if expected_agreement == 1.0:
            return 1.0

        kappa = (observed_agreement - expected_agreement) / (1 - expected_agreement)
        return kappa

    @staticmethod
    def calculate_consistency_metrics(
        annotations: List[AnnotationRecord],
        predictions: Optional[List[PredictionRecord]] = None,
        feedbacks: Optional[List[SamplingFeedback]] = None,
    ) -> ConsistencyMetrics:
        overall_agreement = ConsistencyCalculator.calculate_overall_agreement(
            annotations, predictions, feedbacks
        )

        per_label_agreement = {}
        if predictions:
            per_label_agreement = ConsistencyCalculator.calculate_per_label_agreement(
                annotations, predictions
            )

        cohen_kappa = None
        if predictions:
            cohen_kappa = ConsistencyCalculator.calculate_cohen_kappa(
                annotations, predictions
            )

        per_annotator_agreement = {}
        if predictions:
            pred_map = {}
            for p in predictions:
                key = (p.session_id, p.turn_id) if p.turn_id else p.session_id
                pred_map[key] = p.predicted_label

            annotator_stats = defaultdict(lambda: {"matches": 0, "total": 0})
            for a in annotations:
                key = (a.session_id, a.turn_id) if a.turn_id else a.session_id
                if key in pred_map:
                    annotator_stats[a.annotator_id]["total"] += 1
                    if a.label == pred_map[key]:
                        annotator_stats[a.annotator_id]["matches"] += 1

            per_annotator_agreement = {
                aid: stats["matches"] / stats["total"] if stats["total"] > 0 else 0.0
                for aid, stats in annotator_stats.items()
            }

        return ConsistencyMetrics(
            overall_agreement=overall_agreement,
            cohen_kappa=cohen_kappa,
            per_label_agreement=per_label_agreement,
            per_annotator_agreement=per_annotator_agreement,
        )


class ConfusionMatrixGenerator:
    @staticmethod
    def generate(
        annotations: List[AnnotationRecord],
        predictions: List[PredictionRecord],
        schema: LabelSchema,
    ) -> Dict[str, Any]:
        pred_map = {}
        for p in predictions:
            key = (p.session_id, p.turn_id) if p.turn_id else p.session_id
            pred_map[key] = p.predicted_label

        y_true = []
        y_pred = []
        for a in annotations:
            key = (a.session_id, a.turn_id) if a.turn_id else a.session_id
            if key in pred_map:
                y_true.append(a.label)
                y_pred.append(pred_map[key])

        if not y_true:
            return {
                "matrix": [],
                "labels": [],
                "statistics": {},
            }

        all_labels = schema.all_labels
        all_labels = sorted(set(all_labels) | set(y_true) | set(y_pred))

        try:
            cm = sklearn_confusion_matrix(y_true, y_pred, labels=all_labels)
        except Exception:
            cm = np.zeros((len(all_labels), len(all_labels)), dtype=int)
            label_to_idx = {label: i for i, label in enumerate(all_labels)}
            for t, p in zip(y_true, y_pred):
                if t in label_to_idx and p in label_to_idx:
                    cm[label_to_idx[t]][label_to_idx[p]] += 1

        per_label_stats = {}
        for i, label in enumerate(all_labels):
            true_positive = cm[i, i]
            false_negative = cm[i, :].sum() - true_positive
            false_positive = cm[:, i].sum() - true_positive
            true_negative = cm.sum() - true_positive - false_negative - false_positive

            support = cm[i, :].sum()

            precision = (
                true_positive / (true_positive + false_positive)
                if (true_positive + false_positive) > 0
                else 0.0
            )
            recall = (
                true_positive / (true_positive + false_negative)
                if (true_positive + false_negative) > 0
                else 0.0
            )
            f1 = (
                2 * precision * recall / (precision + recall)
                if (precision + recall) > 0
                else 0.0
            )

            per_label_stats[label] = {
                "precision": float(precision),
                "recall": float(recall),
                "f1": float(f1),
                "support": int(support),
                "true_positive": int(true_positive),
                "false_positive": int(false_positive),
                "false_negative": int(false_negative),
            }

        return {
            "matrix": cm.tolist(),
            "labels": all_labels,
            "statistics": per_label_stats,
            "total_samples": len(y_true),
        }


class AnnotatorDriftDetector:
    @staticmethod
    def calculate_kl_divergence(p: Dict[str, float], q: Dict[str, float]) -> float:
        all_keys = set(p.keys()) | set(q.keys())
        epsilon = 1e-10
        kl = 0.0
        for key in all_keys:
            p_val = p.get(key, epsilon)
            q_val = q.get(key, epsilon)
            if p_val > 0:
                kl += p_val * np.log(p_val / q_val)
        return max(0.0, kl)

    @staticmethod
    def calculate_js_divergence(p: Dict[str, float], q: Dict[str, float]) -> float:
        all_keys = set(p.keys()) | set(q.keys())
        m = {}
        for key in all_keys:
            m[key] = (p.get(key, 0) + q.get(key, 0)) / 2
        return (
            AnnotatorDriftDetector.calculate_kl_divergence(p, m)
            + AnnotatorDriftDetector.calculate_kl_divergence(q, m)
        ) / 2

    @staticmethod
    def detect(
        annotations: List[AnnotationRecord],
        schema: LabelSchema,
        reference_distribution: Optional[Dict[str, float]] = None,
    ) -> List[Dict[str, Any]]:
        annotator_labels = defaultdict(list)
        for a in annotations:
            annotator_labels[a.annotator_id].append(a.label)

        if reference_distribution is None:
            all_labels = [a.label for a in annotations]
            total = len(all_labels)
            reference_distribution = {
                label: count / total
                for label, count in Counter(all_labels).items()
            }

        drift_results = []

        for annotator_id, labels in annotator_labels.items():
            label_counts = Counter(labels)
            total = len(labels)
            current_distribution = {
                label: count / total
                for label, count in label_counts.items()
            }

            kl_divergence = AnnotatorDriftDetector.calculate_kl_divergence(
                current_distribution, reference_distribution
            )
            js_divergence = AnnotatorDriftDetector.calculate_js_divergence(
                current_distribution, reference_distribution
            )

            unusual_labels = []
            avg_ratio = (
                sum(reference_distribution.values()) / len(reference_distribution)
                if reference_distribution
                else 0
            )
            for label, ratio in current_distribution.items():
                ref_ratio = reference_distribution.get(label, avg_ratio * 0.1)
                if ref_ratio > 0 and ratio > ref_ratio * 3:
                    unusual_labels.append(label)

            drift_score = min(1.0, js_divergence * 2)

            drift_results.append({
                "annotator_id": annotator_id,
                "label_distribution": current_distribution,
                "reference_distribution": reference_distribution,
                "kl_divergence": float(kl_divergence),
                "js_divergence": float(js_divergence),
                "unusual_labels": unusual_labels,
                "drift_score": float(drift_score),
                "total_annotations": total,
            })

        drift_results.sort(key=lambda x: x["drift_score"], reverse=True)
        return drift_results


class DataLeakageDetector:
    @staticmethod
    def detect(annotations: List[AnnotationRecord]) -> List[Dict[str, Any]]:
        session_splits = defaultdict(set)
        session_turns = defaultdict(list)

        for a in annotations:
            session_splits[a.session_id].add(a.split.value)
            session_turns[a.session_id].append(a.turn_id)

        leakages = []

        for session_id, splits in session_splits.items():
            if len(splits) > 1:
                splits_list = sorted(splits)
                turn_ids = [t for t in session_turns[session_id] if t]

                if "train" in splits and ("val" in splits or "test" in splits):
                    severity = "high"
                    details = f"会话同时出现在训练集和{'验证/测试'}集"
                elif "val" in splits and "test" in splits:
                    severity = "medium"
                    details = "会话同时出现在验证集和测试集"
                else:
                    severity = "low"
                    details = "会话出现在多个未知类别数据中"

                leakages.append({
                    "session_id": session_id,
                    "turn_ids": turn_ids,
                    "splits": splits_list,
                    "severity": severity,
                    "details": details,
                })

        return leakages


class HighRiskSampleDetector:
    @staticmethod
    def detect(
        annotations: List[AnnotationRecord],
        predictions: Optional[List[PredictionRecord]] = None,
        feedbacks: Optional[List[SamplingFeedback]] = None,
        schema: Optional[LabelSchema] = None,
    ) -> List[Dict[str, Any]]:
        pred_map = {}
        if predictions:
            for p in predictions:
                key = (p.session_id, p.turn_id) if p.turn_id else p.session_id
                pred_map[key] = p

        feedback_map = {}
        if feedbacks:
            for f in feedbacks:
                key = (f.session_id, f.turn_id) if f.turn_id else f.session_id
                feedback_map[key] = f

        high_risk_samples = []

        for a in annotations:
            risk_factors = []
            risk_score = 0.0

            key = (a.session_id, a.turn_id) if a.turn_id else a.session_id

            if key in pred_map:
                pred = pred_map[key]
                if pred.predicted_label != a.label:
                    risk_factors.append(f"标注-预测不一致 (标注: {a.label}, 预测: {pred.predicted_label})")
                    risk_score += 0.3

                if pred.confidence < 0.5:
                    risk_factors.append(f"低置信度预测 ({pred.confidence:.2f})")
                    risk_score += 0.2

            if key in feedback_map:
                fb = feedback_map[key]
                if not fb.is_agreement:
                    risk_factors.append(f"抽检不同意 (抽检标签: {fb.reviewer_label})")
                    risk_score += 0.4

            if schema and not schema.validate_label(a.label):
                risk_factors.append(f"无效标签 '{a.label}'")
                risk_score += 0.5

            if len(a.text.strip()) < 5:
                risk_factors.append("文本过短")
                risk_score += 0.1

            if risk_score > 0:
                record_id = hashlib.md5(
                    f"{a.session_id}:{a.turn_id or ''}".encode()
                ).hexdigest()[:12]

                high_risk_samples.append({
                    "record_id": record_id,
                    "session_id": a.session_id,
                    "turn_id": a.turn_id,
                    "text": a.text,
                    "risk_factors": risk_factors,
                    "risk_score": float(risk_score),
                    "annotation": a.to_dict() if a else None,
                    "prediction": pred_map[key].to_dict() if key in pred_map else None,
                })

        high_risk_samples.sort(key=lambda x: x["risk_score"], reverse=True)
        return high_risk_samples


class AuditEngine:
    @staticmethod
    def run_audit(
        annotations: List[AnnotationRecord],
        schema: LabelSchema,
        predictions: Optional[List[PredictionRecord]] = None,
        feedbacks: Optional[List[SamplingFeedback]] = None,
    ) -> AuditResult:
        audit_id = str(uuid.uuid4())[:8]
        audit_timestamp = datetime.now()

        consistency_metrics = ConsistencyCalculator.calculate_consistency_metrics(
            annotations, predictions, feedbacks
        )

        confusion_matrix_data = {"matrix": [], "labels": [], "statistics": {}}
        if predictions:
            confusion_matrix_data = ConfusionMatrixGenerator.generate(
                annotations, predictions, schema
            )

        annotator_drifts = AnnotatorDriftDetector.detect(annotations, schema)

        data_leakages = DataLeakageDetector.detect(annotations)

        high_risk_samples = HighRiskSampleDetector.detect(
            annotations, predictions, feedbacks, schema
        )

        summary = {
            "total_annotations": len(annotations),
            "unique_annotators": len({a.annotator_id for a in annotations}),
            "unique_sessions": len({a.session_id for a in annotations}),
            "label_distribution": dict(Counter(a.label for a in annotations)),
            "split_distribution": dict(Counter(a.split.value for a in annotations)),
            "overall_agreement": consistency_metrics.overall_agreement,
            "data_leakage_count": len(data_leakages),
            "high_risk_sample_count": len(high_risk_samples),
            "annotator_drift_count": len([d for d in annotator_drifts if d["drift_score"] > 0.5]),
        }

        warnings = []

        if consistency_metrics.overall_agreement < 0.7:
            warnings.append(f"整体一致率较低: {consistency_metrics.overall_agreement:.2%}")

        if len(data_leakages) > 0:
            high_leaks = [l for l in data_leakages if l["severity"] == "high"]
            if high_leaks:
                warnings.append(f"发现 {len(high_leaks)} 个严重数据泄漏")

        high_drift_annotators = [d for d in annotator_drifts if d["drift_score"] > 0.7]
        if high_drift_annotators:
            warnings.append(
                f"发现 {len(high_drift_annotators)} 个标注员存在显著漂移"
            )

        if len(high_risk_samples) > len(annotations) * 0.2:
            warnings.append(
                f"高风险样本占比较高: {len(high_risk_samples)}/{len(annotations)}"
            )

        return AuditResult(
            audit_id=audit_id,
            schema_version=schema.version,
            audit_timestamp=audit_timestamp,
            consistency_metrics=consistency_metrics,
            confusion_matrix=confusion_matrix_data,
            annotator_drifts=annotator_drifts,
            data_leakages=data_leakages,
            high_risk_samples=high_risk_samples,
            summary=summary,
            warnings=warnings,
        )
