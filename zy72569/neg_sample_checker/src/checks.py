import pandas as pd
import numpy as np
from typing import List, Dict, Tuple
from .data_models import CheckResult, ConflictEvidence


def check_duplicates(df: pd.DataFrame, key_fields: List[str]) -> CheckResult:
    if df.empty:
        return CheckResult(
            check_name="重复导入检查",
            passed=True,
            details={"message": "数据集为空"},
            severity="info"
        )
    
    duplicate_mask = df.duplicated(subset=key_fields, keep=False)
    duplicate_count = duplicate_mask.sum()
    
    if duplicate_count == 0:
        return CheckResult(
            check_name="重复导入检查",
            passed=True,
            details={"total_rows": len(df), "duplicate_count": 0},
            severity="info"
        )
    else:
        duplicates = df[duplicate_mask].sort_values(by=key_fields)
        return CheckResult(
            check_name="重复导入检查",
            passed=False,
            details={
                "total_rows": len(df),
                "duplicate_count": int(duplicate_count),
                "duplicate_groups": int(duplicates.groupby(key_fields).ngroups),
                "sample_duplicates": duplicates.head(10).to_dict('records')
            },
            severity="error",
            suggestion="请检查数据源是否重复导入，建议去重后重新计算"
        )


def check_minority_class_masking(
    df: pd.DataFrame,
    label_col: str = "label",
    metric_fields: List[str] = None,
    minority_threshold: float = 0.05
) -> CheckResult:
    metric_fields = metric_fields or ["click_rate", "conversion_rate"]
    
    if df.empty:
        return CheckResult(
            check_name="少数类样本被总指标盖住检查",
            passed=True,
            details={"message": "数据集为空"},
            severity="info"
        )
    
    if label_col not in df.columns:
        return CheckResult(
            check_name="少数类样本被总指标盖住检查",
            passed=False,
            details={"message": f"标签列 {label_col} 不存在"},
            severity="error",
            suggestion="请确认标签列名是否正确"
        )
    
    label_counts = df[label_col].value_counts(normalize=True)
    total_metrics = {}
    per_label_metrics = {}
    
    for metric in metric_fields:
        if metric in df.columns:
            total_metrics[metric] = float(df[metric].mean())
            per_label_metrics[metric] = df.groupby(label_col)[metric].mean().to_dict()
    
    minority_labels = label_counts[label_counts < minority_threshold].index.tolist()
    
    masking_detected = []
    for label in minority_labels:
        for metric in metric_fields:
            if metric in per_label_metrics and label in per_label_metrics[metric]:
                label_val = per_label_metrics[metric][label]
                total_val = total_metrics.get(metric, 0)
                diff_pct = abs(label_val - total_val) / (total_val + 1e-8) * 100
                if diff_pct > 20:
                    masking_detected.append({
                        "label": label,
                        "metric": metric,
                        "label_value": float(label_val),
                        "total_value": float(total_val),
                        "diff_percent": float(diff_pct),
                        "label_ratio": float(label_counts[label])
                    })
    
    if masking_detected:
        return CheckResult(
            check_name="少数类样本被总指标盖住检查",
            passed=False,
            details={
                "label_distribution": label_counts.to_dict(),
                "total_metrics": total_metrics,
                "per_label_metrics": per_label_metrics,
                "masking_cases": masking_detected
            },
            severity="warning",
            suggestion="少数类样本指标与总指标差异较大，请勿直接归为正常，留给算法工程师复核"
        )
    else:
        return CheckResult(
            check_name="少数类样本被总指标盖住检查",
            passed=True,
            details={
                "label_distribution": label_counts.to_dict(),
                "total_metrics": total_metrics,
                "minority_labels": minority_labels
            },
            severity="info"
        )


def check_export_consistency(
    original_df: pd.DataFrame,
    exported_df: pd.DataFrame,
    check_fields: List[str]
) -> CheckResult:
    missing_fields = [f for f in check_fields if f not in original_df.columns or f not in exported_df.columns]
    if missing_fields:
        return CheckResult(
            check_name="导出一致性检查",
            passed=False,
            details={"missing_fields": missing_fields},
            severity="error",
            suggestion=f"以下字段缺失：{missing_fields}"
        )
    
    original_subset = original_df[check_fields].reset_index(drop=True)
    exported_subset = exported_df[check_fields].reset_index(drop=True)
    
    row_count_match = len(original_subset) == len(exported_subset)
    content_match = original_subset.equals(exported_subset)
    
    if row_count_match and content_match:
        return CheckResult(
            check_name="导出一致性检查",
            passed=True,
            details={"row_count": len(original_subset), "fields_checked": check_fields},
            severity="info"
        )
    else:
        diff_rows = len(original_subset) - len(exported_subset)
        return CheckResult(
            check_name="导出一致性检查",
            passed=False,
            details={
                "original_rows": len(original_subset),
                "exported_rows": len(exported_subset),
                "row_count_diff": diff_rows,
                "content_matched": content_match
            },
            severity="error",
            suggestion="导出数据与原始数据不一致，请检查导出逻辑"
        )


def check_conflict_between_neg_and_recall(
    neg_df: pd.DataFrame,
    recall_df: pd.DataFrame,
    key_fields: List[str] = None,
    label_field: str = "label"
) -> List[ConflictEvidence]:
    key_fields = key_fields or ["user_id", "item_id"]
    conflicts = []
    
    if neg_df.empty or recall_df.empty:
        return conflicts
    
    merged = pd.merge(
        neg_df[key_fields + [label_field]],
        recall_df[key_fields + [label_field]],
        on=key_fields,
        suffixes=('_neg', '_recall'),
        how='inner'
    )
    
    if merged.empty:
        return conflicts
    
    label_mismatch = merged[merged[f"{label_field}_neg"] != merged[f"{label_field}_recall"]]
    
    for idx, row in label_mismatch.iterrows():
        key_values = {k: row[k] for k in key_fields}
        conflict = ConflictEvidence(
            conflict_id=f"conflict_{idx}",
            description=f"标签冲突：{key_values}",
            neg_sample_data={label_field: row[f"{label_field}_neg"]},
            recall_candidate_data={label_field: row[f"{label_field}_recall"]},
            field=label_field
        )
        conflicts.append(conflict)
    
    return conflicts
