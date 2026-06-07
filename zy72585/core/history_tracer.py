from typing import Any, Dict, List, Optional
from models.base import AuditLog
from models.candidate import CandidateTable
from models.params import ParamsYAML
from models.layer import LayerResult, LayerItem


class HistoryTracer:
    @staticmethod
    def trace_item_origin(item: LayerItem) -> Dict[str, Any]:
        return {
            "layer_item_id": item.id,
            "record_id": item.record_id,
            "lineage": item.lineage.to_dict(),
            "status": item.status.value,
            "version_history": item.get_history(),
            "audit_logs": [log.to_dict() for log in item.get_audit_logs()],
        }

    @staticmethod
    def trace_threshold_impact(
        params: ParamsYAML,
        threshold_name: str,
        layer_results: List[LayerResult]
    ) -> Dict[str, Any]:
        threshold_history = params.get_threshold_history(threshold_name)
        affected_items = []

        for result in layer_results:
            for item in result.items.values():
                if item.lineage.threshold_name == threshold_name:
                    affected_items.append({
                        "layer_result": result.name,
                        "record_id": item.record_id,
                        "score": item.score,
                        "status": item.status.value,
                        "threshold_at_time": item.lineage.threshold_value_at_time,
                    })

        return {
            "threshold_name": threshold_name,
            "history": threshold_history,
            "affected_layer_items": affected_items,
            "affected_count": len(affected_items),
        }

    @staticmethod
    def get_full_audit_trail(
        candidate_table: Optional[CandidateTable] = None,
        params: Optional[ParamsYAML] = None,
        layer_result: Optional[LayerResult] = None
    ) -> List[Dict[str, Any]]:
        all_logs = []

        if candidate_table:
            for log in candidate_table.get_audit_logs():
                entry = log.to_dict()
                entry["source"] = "candidate_table"
                entry["source_id"] = candidate_table.id
                all_logs.append(entry)

        if params:
            for log in params.get_audit_logs():
                entry = log.to_dict()
                entry["source"] = "params_yaml"
                entry["source_id"] = params.id
                all_logs.append(entry)

        if layer_result:
            for log in layer_result.get_audit_logs():
                entry = log.to_dict()
                entry["source"] = "layer_result"
                entry["source_id"] = layer_result.id
                all_logs.append(entry)
            for item in layer_result.items.values():
                for log in item.get_audit_logs():
                    entry = log.to_dict()
                    entry["source"] = "layer_item"
                    entry["source_id"] = item.id
                    all_logs.append(entry)

        all_logs.sort(key=lambda x: x["timestamp"])
        return all_logs

    @staticmethod
    def who_changed_when(
        obj,
        field_name: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        if field_name:
            return obj.get_field_history(field_name)
        return obj.get_history()
