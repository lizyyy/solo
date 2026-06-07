from typing import Any, Dict, List
from models.base import FieldDiff
from models.candidate import CandidateRecord, CandidateTable
from models.params import ParamsYAML


class DiffEngine:
    @staticmethod
    def compare_records(rec1: CandidateRecord, rec2: CandidateRecord) -> List[FieldDiff]:
        diffs = []
        fields = ["record_id", "features", "remark", "tags", "source"]

        for field in fields:
            val1 = getattr(rec1, field)
            val2 = getattr(rec2, field)
            if val1 != val2:
                diffs.append(FieldDiff(
                    field_name=field,
                    old_value=val1,
                    new_value=val2,
                ))

        return diffs

    @staticmethod
    def compare_params(params1: ParamsYAML, params2: ParamsYAML) -> Dict[str, List[FieldDiff]]:
        result = {
            "thresholds": [],
            "layer_configs": [],
            "extra_params": [],
        }

        for key in set(list(params1.thresholds.keys()) + list(params2.thresholds.keys())):
            v1 = params1.thresholds.get(key)
            v2 = params2.thresholds.get(key)
            if v1 != v2:
                result["thresholds"].append(FieldDiff(
                    field_name=f"thresholds.{key}",
                    old_value=v1,
                    new_value=v2,
                ))

        return result

    @staticmethod
    def get_field_change_summary(diffs: List[FieldDiff]) -> str:
        if not diffs:
            return "无变更"

        lines = []
        for d in diffs:
            lines.append(f"  • {d.field_name}: {d.old_value} → {d.new_value}")
        return "\n".join(lines)

    @staticmethod
    def format_remark_change_history(record: CandidateRecord) -> List[Dict[str, Any]]:
        history = record.get_field_history("remark")
        formatted = []
        for i, entry in enumerate(history):
            formatted.append({
                "version": entry["version"],
                "timestamp": entry["timestamp"],
                "remark": entry["value"],
                "change_type": "初始值" if i == 0 else "修改",
            })
        return formatted
