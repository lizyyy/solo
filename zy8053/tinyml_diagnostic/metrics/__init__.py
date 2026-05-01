"""Metrics module for TinyML diagnostic."""
from typing import Dict, List, Any, Optional, Tuple
from alignment import get_top1, AlignmentResult


class MetricsResult:
    def __init__(self, summary: Dict, per_class: Dict, bad_cases: List[Dict], drift_details: List[Dict]):
        self.summary = summary
        self.per_class = per_class
        self.bad_cases = bad_cases
        self.drift_details = drift_details


def compute_metrics(aligned_result: AlignmentResult, thresholds: Dict[str, float]) -> MetricsResult:
    """Compute top1 accuracy, confidence drift, and per-class recall changes."""
    aligned = aligned_result.aligned
    warnings = aligned_result.warnings

    total = len(aligned)
    if total == 0:
        return MetricsResult(
            summary={'total_samples': 0, 'top1_correct': 0, 'top1_accuracy': 0.0},
            per_class={},
            bad_cases=[],
            drift_details=[]
        )

    top1_correct = 0
    top1_flipped = []

    all_classes = set()
    for item in aligned:
        all_classes.update(item['baseline'].keys())
        all_classes.update(item['quantized'].keys())

    class_correct_baseline = {c: 0 for c in all_classes}
    class_correct_quantized = {c: 0 for c in all_classes}
    class_total = {c: 0 for c in all_classes}

    confidence_drifts = []
    bad_cases = []
    drift_threshold = 0.1

    for item in aligned:
        sample_id = item['sample_id']
        baseline_preds = item['baseline']
        quantized_preds = item['quantized']
        label = item.get('label')

        if label is None:
            continue

        baseline_top1, baseline_conf = get_top1(baseline_preds)
        quantized_top1, quantized_conf = get_top1(quantized_preds)

        if baseline_top1 == label:
            class_correct_baseline[baseline_top1] = class_correct_baseline.get(baseline_top1, 0) + 1
        if quantized_top1 == label:
            class_correct_quantized[quantized_top1] = class_correct_quantized.get(quantized_top1, 0) + 1
        if label in all_classes:
            class_total[label] = class_total.get(label, 0) + 1

        if baseline_top1 == label:
            top1_correct += 1

        if baseline_top1 != quantized_top1:
            top1_flipped.append({
                'sample_id': sample_id,
                'baseline_top1': baseline_top1,
                'quantized_top1': quantized_top1,
                'label': label,
                'baseline_conf': baseline_conf,
                'quantized_conf': quantized_conf,
            })

        max_drift = 0.0
        drift_classes = []
        for cls in all_classes:
            b_conf = baseline_preds.get(cls, 0.0)
            q_conf = quantized_preds.get(cls, 0.0)
            drift = abs(b_conf - q_conf)
            if drift > max_drift:
                max_drift = drift
            if drift > drift_threshold:
                drift_classes.append(cls)

        confidence_drifts.append({
            'sample_id': sample_id,
            'max_drift': max_drift,
            'drift_classes': drift_classes,
        })

        if baseline_top1 != quantized_top1 or max_drift > drift_threshold:
            bad_cases.append({
                'sample_id': sample_id,
                'label': label,
                'baseline_top1': baseline_top1,
                'baseline_conf': baseline_conf,
                'quantized_top1': quantized_top1,
                'quantized_conf': quantized_conf,
                'max_confidence_drift': max_drift,
                'drift_classes': drift_classes,
            })

    per_class_metrics = {}
    for cls in sorted(all_classes):
        baseline_recall = 0.0
        quantized_recall = 0.0
        total_for_class = class_total.get(cls, 0)

        if total_for_class > 0:
            baseline_recall = class_correct_baseline.get(cls, 0) / total_for_class
            quantized_recall = class_correct_quantized.get(cls, 0) / total_for_class

        threshold = thresholds.get(cls, 1.0)
        recall_change = quantized_recall - baseline_recall

        per_class_metrics[cls] = {
            'baseline_recall': baseline_recall,
            'quantized_recall': quantized_recall,
            'recall_change': recall_change,
            'threshold': threshold,
            'total_samples': total_for_class,
        }

    avg_drift = sum(d['max_drift'] for d in confidence_drifts) / len(confidence_drifts) if confidence_drifts else 0.0

    summary = {
        'total_samples': total,
        'top1_correct': top1_correct,
        'top1_accuracy': top1_correct / total if total > 0 else 0.0,
        'top1_flipped_count': len(top1_flipped),
        'avg_confidence_drift': avg_drift,
        'bad_cases_count': len(bad_cases),
        'warnings': [{'message': w.message, 'sample_ids': w.sample_ids} for w in warnings],
    }

    return MetricsResult(
        summary=summary,
        per_class=per_class_metrics,
        bad_cases=bad_cases,
        drift_details=confidence_drifts
    )