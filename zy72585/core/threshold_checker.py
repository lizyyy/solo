from typing import Any, Dict, List, Optional, Tuple
from models.params import ParamsYAML
from models.candidate import CandidateTable
from models.layer import LayerItem, LayerResult, LayerStatus, MismatchSource


class ThresholdChecker:
    @staticmethod
    def detect_mismatch_source(
        item: LayerItem,
        current_params: ParamsYAML,
        original_params: Optional[ParamsYAML] = None,
        current_candidate_table: Optional[CandidateTable] = None,
        original_candidate_table: Optional[CandidateTable] = None,
    ) -> MismatchSource:
        params_changed = False
        candidate_changed = False

        if original_params and current_params:
            if original_params.version != current_params.version:
                params_changed = True
            elif original_params.get_threshold(item.lineage.threshold_name) != current_params.get_threshold(item.lineage.threshold_name):
                params_changed = True

        if current_candidate_table and original_candidate_table:
            if original_candidate_table.version != current_candidate_table.version:
                candidate_changed = True
            else:
                record = current_candidate_table.get_record(item.record_id)
                orig_record = original_candidate_table.get_record(item.record_id)
                if record and orig_record:
                    if record.get_record_hash() != orig_record.get_record_hash():
                        candidate_changed = True

        if params_changed and candidate_changed:
            return MismatchSource.BOTH_CHANGED
        elif params_changed:
            return MismatchSource.PARAMS_YAML_CHANGED
        elif candidate_changed:
            return MismatchSource.CANDIDATE_TABLE_CHANGED
        else:
            return MismatchSource.UNKNOWN

    @staticmethod
    def check_threshold_consistency(
        item: LayerItem,
        current_params: ParamsYAML,
        operator: str,
        original_params: Optional[ParamsYAML] = None,
        current_candidate_table: Optional[CandidateTable] = None,
        original_candidate_table: Optional[CandidateTable] = None,
    ) -> Tuple[bool, Optional[float], Optional[float], MismatchSource]:
        threshold_name = item.lineage.threshold_name
        if not threshold_name:
            return True, None, None, MismatchSource.UNKNOWN

        actual_threshold = current_params.get_threshold(threshold_name)
        reported_threshold = item.lineage.threshold_value_at_time

        mismatch_source = MismatchSource.UNKNOWN
        is_consistent = True

        if actual_threshold is not None and reported_threshold is not None:
            if actual_threshold != reported_threshold:
                is_consistent = False
                mismatch_source = ThresholdChecker.detect_mismatch_source(
                    item, current_params, original_params,
                    current_candidate_table, original_candidate_table
                )

        return is_consistent, reported_threshold, actual_threshold, mismatch_source

    @staticmethod
    def scan_all_items_for_mismatch(
        layer_result: LayerResult,
        current_params: ParamsYAML,
        operator: str,
        auto_suspend: bool = True,
        original_params: Optional[ParamsYAML] = None,
        current_candidate_table: Optional[CandidateTable] = None,
        original_candidate_table: Optional[CandidateTable] = None,
    ) -> Dict[str, Any]:
        mismatches = []
        ok_count = 0

        for item in layer_result.items.values():
            is_consistent, reported, actual, source = ThresholdChecker.check_threshold_consistency(
                item, current_params, operator,
                original_params, current_candidate_table, original_candidate_table
            )

            if not is_consistent:
                if auto_suspend and not item.threshold_mismatch:
                    item.mark_threshold_mismatch(reported, actual, operator, source)

                mismatches.append({
                    "record_id": item.record_id,
                    "layer_name": item.layer_name,
                    "reported_threshold": reported,
                    "actual_threshold": actual,
                    "score": item.score,
                    "status": item.status.value,
                    "mismatch_source": source.value,
                })
            else:
                ok_count += 1

        source_counts = {}
        for m in mismatches:
            src = m["mismatch_source"]
            source_counts[src] = source_counts.get(src, 0) + 1

        return {
            "total_items": len(layer_result.items),
            "ok_count": ok_count,
            "mismatch_count": len(mismatches),
            "mismatches": mismatches,
            "source_counts": source_counts,
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
