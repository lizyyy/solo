from typing import Dict, Any, List, Tuple
from .models import ScoringDifferenceRecord, ProcessingStatus


class DiffEngine:
    """
    差异分析引擎

    边界规则（写在代码里）：
    1. 阈值改过但报告仍写旧值 → 标记为 THRESHOLD_MISMATCH，不自动归正常
    2. 原始行号必须保留，不可丢失
    3. 人工改动必须记录变更前后的值
    4. 所有状态转换必须有审计日志
    5. 数据科学家确认前，记录停在待处理状态
    """

    BOUNDARY_RULES = {
        "threshold_report_mismatch": (
            "阈值已更改但报告仍显示旧值时，自动标记为 THRESHOLD_MISMATCH，"
            "必须由数据科学家确认才能转为终态。禁止自动归为正常。"
        ),
        "original_line_preservation": (
            "特征快照的原始行号必须完整保留在导出、页面、API返回中，"
            "任何处理步骤不得丢弃该信息。"
        ),
        "manual_change_audit": (
            "所有人工改动必须记录变更前值、变更后值、操作人、时间、原因，"
            "写入审计日志且不可删除。"
        ),
        "pending_before_confirm": (
            "数据科学家（林姐）确认前，所有存在疑问的记录必须停在待处理状态，"
            "禁止自动流转到终态。"
        ),
        "single_source_of_truth": (
            "导出明细、页面展示、API返回必须读取同一份存储结果，"
            "禁止各自计算或缓存。"
        ),
    }

    @classmethod
    def get_boundary_rules(cls) -> Dict[str, str]:
        return dict(cls.BOUNDARY_RULES)

    @staticmethod
    def analyze_record(
        record: ScoringDifferenceRecord,
    ) -> Dict[str, Any]:
        analysis = {
            "record_id": record.record_id,
            "snapshot_id": record.snapshot_id,
            "original_line_number": (
                record.feature_snapshot.original_line_number
                if record.feature_snapshot
                else None
            ),
            "current_status": record.current_status.value,
            "has_threshold_mismatch": record.has_threshold_mismatch(),
            "threshold_change_count": len(record.threshold_changes),
            "manual_change_count": len(record.manual_changes),
            "training_log_count": len(record.training_logs),
            "has_tier_metrics": record.tier_metrics is not None,
            "needs_data_scientist_review": record.current_status
            in {
                ProcessingStatus.PENDING,
                ProcessingStatus.NEEDS_REVIEW,
                ProcessingStatus.THRESHOLD_MISMATCH,
            },
            "is_final": ProcessingStatus.is_final(record.current_status),
        }
        return analysis

    @staticmethod
    def compare_online_offline(
        online_scores: List[float], offline_scores: List[float]
    ) -> List[Tuple[float, float, float]]:
        results = []
        for o, of in zip(online_scores, offline_scores):
            diff = o - of
            percent = (diff / of * 100) if of != 0 else 0.0
            results.append((diff, percent, abs(percent)))
        return results

    @staticmethod
    def check_threshold_consistency(
        current_thresholds: Dict[str, float],
        reported_thresholds: Dict[str, float],
    ) -> Dict[str, Any]:
        mismatches = []
        for key, current_val in current_thresholds.items():
            reported_val = reported_thresholds.get(key)
            if reported_val is not None and abs(current_val - reported_val) > 1e-9:
                mismatches.append(
                    {
                        "field_name": key,
                        "current_value": current_val,
                        "reported_value": reported_val,
                        "diff": current_val - reported_val,
                    }
                )
        return {
            "is_consistent": len(mismatches) == 0,
            "mismatches": mismatches,
            "mismatch_count": len(mismatches),
        }
