"""Alignment module for TinyML diagnostic."""
from typing import Dict, List, Any, Tuple, Optional


class AlignmentWarning:
    def __init__(self, message: str, sample_ids: List[str] = None):
        self.message = message
        self.sample_ids = sample_ids or []


class AlignmentResult:
    def __init__(self, aligned: List[Dict], warnings: List[AlignmentWarning]):
        self.aligned = aligned
        self.warnings = warnings


def align_data(
    baseline: Dict[str, Dict[str, float]],
    quantized: Dict[str, Dict[str, float]],
    labels: Dict[str, str]
) -> AlignmentResult:
    """Align baseline, quantized predictions and labels by sample_id.

    Returns aligned list and list of warnings for edge cases.
    """
    aligned = []
    warnings = []

    all_ids = set(baseline.keys()) | set(quantized.keys()) | set(labels.keys())

    missing_baseline = set(labels.keys()) - set(baseline.keys())
    if missing_baseline:
        warnings.append(AlignmentWarning(
            f"Missing baseline predictions for {len(missing_baseline)} samples",
            list(missing_baseline)[:10]
        ))

    missing_quantized = set(labels.keys()) - set(quantized.keys())
    if missing_quantized:
        warnings.append(AlignmentWarning(
            f"Missing quantized predictions for {len(missing_quantized)} samples",
            list(missing_quantized)[:10]
        ))

    missing_labels = set(baseline.keys()) & set(quantized.keys()) - set(labels.keys())
    if missing_labels:
        warnings.append(AlignmentWarning(
            f"Missing labels for {len(missing_labels)} samples with predictions",
            list(missing_labels)[:10]
        ))

    for sample_id in sorted(all_ids):
        if sample_id not in baseline:
            continue
        if sample_id not in quantized:
            continue

        baseline_preds = baseline[sample_id]
        quantized_preds = quantized[sample_id]

        label = labels.get(sample_id)

        all_classes = set(baseline_preds.keys()) | set(quantized_preds.keys())

        normalized_baseline = {}
        normalized_quantized = {}
        for cls in all_classes:
            normalized_baseline[cls] = baseline_preds.get(cls, 0.0)
            normalized_quantized[cls] = quantized_preds.get(cls, 0.0)

        aligned.append({
            'sample_id': sample_id,
            'baseline': normalized_baseline,
            'quantized': normalized_quantized,
            'label': label,
        })

    return AlignmentResult(aligned=aligned, warnings=warnings)


def normalize_predictions(predictions: Dict[str, float]) -> Dict[str, float]:
    """Normalize prediction confidences to sum to 1."""
    total = sum(predictions.values())
    if total == 0:
        return {k: 0.0 for k in predictions}
    return {k: v / total for k, v in predictions.items()}


def get_top1(predictions: Dict[str, float]) -> Tuple[Optional[str], float]:
    """Get top-1 prediction class and its confidence."""
    if not predictions:
        return None, 0.0
    top_class = max(predictions, key=predictions.get)
    return top_class, predictions[top_class]


def get_all_classes(aligned_data: List[Dict]) -> set:
    """Extract all unique class names from aligned data."""
    classes = set()
    for item in aligned_data:
        classes.update(item['baseline'].keys())
        classes.update(item['quantized'].keys())
    return classes