from typing import Any, Dict, List, Optional, Tuple
from models.params import ParamsYAML
from models.layer import LayerItem, LayerResult, LayerStatus


class ThresholdChecker:
    @staticmethod
    def check_threshold_consistency(
        item: LayerItem,
        current_params: ParamsYAML,
        operator: str
    ) -> Tuple[bool, Optional[float], Optional[float]]:
        threshold_name = item.lineage.threshold_name
        if not threshold_name:
            return True, None, None

        actual_threshold = current_params.get_threshold(threshold_name)
        reported_threshold = item.lineage.threshold_value_at_time

        if actual_threshold is not None and reported_threshold is not None:
            if actual_threshold != reported_threshold:
                return False, reported_threshold, actual_threshold

        return True, reported_threshold, actual_threshold

    @staticmethod
    def scan_all_items_for_mismatch(
        layer_result: LayerResult,
        current_params: ParamsYAML,
        operator: str,
        auto_suspend: bool = True
    ) -> Dict[str, Any]:
        mismatches = []
        ok_count = 0

        for item in layer_result.items.values():
            is_consistent, reported, actual = ThresholdChecker.check_threshold_consistency(
                item, current_params, operator
            )

            if not is_consistent:
                if auto_suspend and not item.threshold_mismatch:
                    item.mark_threshold_mismatch(reported, actual, operator)

                mismatches.append({
                    "record_id": item.record_id,
                    "layer_name": item.layer_name,
                    "reported_threshold": reported,
                    "actual_threshold": actual,
                    "score": item.score,
                    "status": item.status.value,
                })
            else:
                ok_count += 1

        return {
            "total_items": len(layer_result.items),
            "ok_count": ok_count,
            "mismatch_count": len(mismatches),
            "mismatches": mismatches,
            "auto_suspended": auto_suspend,
        }

    @staticmethod
    def get_mismatch_resolution_options() -> List[Dict[str, str]]:
        return [
            {
                "action": "use_actual_threshold",
                "label": "使用当前阈值重新计算",
                "owner": "algorithm_engineer",
                "next_step": "重新生成分层结果",
            },
            {
                "action": "revert_threshold",
                "label": "回滚阈值到报告时的值",
                "owner": "algorithm_engineer",
                "next_step": "恢复参数YAML",
            },
            {
                "action": "escalate_to_scientist",
                "label": "提交数据科学家复核",
                "owner": "data_scientist",
                "next_step": "等待复核结论",
            },
        ]

    @staticmethod
    def resolve_mismatch(
        item: LayerItem,
        action: str,
        operator: str,
        new_threshold: Optional[float] = None
    ) -> bool:
        if action == "escalate_to_scientist":
            item.update({
                "status": LayerStatus.NEEDS_DATA_SCIENTIST,
            }, operator, reason="阈值不一致，升级到数据科学家复核")
            return True
        return False
