from typing import Dict, List
import math

from parsers.manifest import ImageEntry
from parsers.labels import Annotation


def analyze_class_balance(
    annotations: Dict[str, List[Annotation]],
    split_data: Dict[str, List[str]]
) -> dict:
    stats = {
        "category_distribution": {},
        "split_distribution": {},
        "balance_metrics": {}
    }
    
    all_categories = set()
    for image_anns in annotations.values():
        for ann in image_anns:
            all_categories.add(ann.category_id)
    
    for split in ["train", "val", "test"]:
        split_ids = set(split_data.get(split, []))
        category_counts = {cat: 0 for cat in all_categories}
        
        for image_id in split_ids:
            if image_id in annotations:
                for ann in annotations[image_id]:
                    category_counts[ann.category_id] += 1
        
        stats["split_distribution"][split] = category_counts
    
    overall_counts = {cat: 0 for cat in all_categories}
    for split in ["train", "val", "test"]:
        for cat, count in stats["split_distribution"][split].items():
            overall_counts[cat] += count
    
    stats["category_distribution"] = overall_counts
    
    total = sum(overall_counts.values())
    if total > 0:
        proportions = [count / total for count in overall_counts.values()]
        entropy = -sum(p * math.log(p) for p in proportions if p > 0)
        max_entropy = math.log(len(all_categories))
        balance_ratio = entropy / max_entropy if max_entropy > 0 else 0
        
        max_count = max(overall_counts.values())
        min_count = min([c for c in overall_counts.values() if c > 0]) if any(c > 0 for c in overall_counts.values()) else 1
        imbalance_ratio = max_count / min_count if min_count > 0 else float('inf')
        
        stats["balance_metrics"] = {
            "total_annotations": total,
            "num_categories": len(all_categories),
            "balance_ratio": balance_ratio,
            "imbalance_ratio": imbalance_ratio,
            "max_count": max_count,
            "min_count": min_count
        }
    
    return stats


def check_class_imbalance(
    annotations: Dict[str, List[Annotation]],
    split_data: Dict[str, List[str]],
    imbalance_threshold: float = 10.0,
    min_samples_threshold: int = 5
) -> List[dict]:
    issues = []
    stats = analyze_class_balance(annotations, split_data)
    
    if stats["balance_metrics"]["imbalance_ratio"] > imbalance_threshold:
        issues.append({
            "issue_type": "SEVERE_CLASS_IMBALANCE",
            "severity": "warning",
            "image_id": None,
            "annotation_id": None,
            "category_id": None,
            "message": f"Severe class imbalance detected (ratio: {stats['balance_metrics']['imbalance_ratio']:.2f}:1)"
        })
    
    for cat, count in stats["category_distribution"].items():
        if count < min_samples_threshold:
            issues.append({
                "issue_type": "LOW_SAMPLE_COUNT",
                "severity": "warning",
                "image_id": None,
                "annotation_id": None,
                "category_id": cat,
                "message": f"Category '{cat}' has only {count} samples, consider collecting more"
            })
    
    for split in ["train", "val"]:
        for cat, count in stats["split_distribution"][split].items():
            if count == 0 and stats["category_distribution"][cat] > 0:
                issues.append({
                    "issue_type": "MISSING_CATEGORY_IN_SPLIT",
                    "severity": "error",
                    "image_id": None,
                    "annotation_id": None,
                    "category_id": cat,
                    "message": f"Category '{cat}' has no samples in {split} split"
                })
    
    return issues, stats