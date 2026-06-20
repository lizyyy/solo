import json
import os
from datetime import datetime
from typing import Optional, Dict, Any

from .timeline import HistoryTimeline
from ..models.params import ParameterTable
from ..models.recall import RecallRecord
from ..models.note import VerbalNote


class PersistenceManager:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = data_dir
        self._ensure_dirs()

    def _ensure_dirs(self) -> None:
        os.makedirs(self.data_dir, exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "history"), exist_ok=True)
        os.makedirs(os.path.join(self.data_dir, "results"), exist_ok=True)

    def save_state(
        self,
        timeline: HistoryTimeline,
        param_table: ParameterTable,
        recall_records: list,
        verbal_notes: list,
        state_name: str = "latest",
    ) -> str:
        state = {
            "saved_at": datetime.now().isoformat(),
            "timeline": timeline.to_dict(),
            "param_table": param_table.to_dict(),
            "recall_records": [
                r.to_dict() if hasattr(r, "to_dict") else r
                for r in recall_records
            ],
            "verbal_notes": [
                n.to_dict() if hasattr(n, "to_dict") else n
                for n in verbal_notes
            ],
        }

        file_path = os.path.join(self.data_dir, f"state_{state_name}.json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)

        return file_path

    def load_state(self, state_name: str = "latest") -> Optional[Dict[str, Any]]:
        file_path = os.path.join(self.data_dir, f"state_{state_name}.json")
        if not os.path.exists(file_path):
            return None

        with open(file_path, "r", encoding="utf-8") as f:
            state = json.load(f)

        return state

    def save_calculation_result(
        self,
        result_data: Dict[str, Any],
        result_id: str,
    ) -> str:
        results_dir = os.path.join(self.data_dir, "results")
        file_path = os.path.join(results_dir, f"result_{result_id}.json")

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(result_data, f, ensure_ascii=False, indent=2)

        return file_path

    def load_calculation_result(self, result_id: str) -> Optional[Dict[str, Any]]:
        file_path = os.path.join(self.data_dir, "results", f"result_{result_id}.json")
        if not os.path.exists(file_path):
            return None

        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def list_calculation_results(self) -> list:
        results_dir = os.path.join(self.data_dir, "results")
        if not os.path.exists(results_dir):
            return []

        results = []
        for filename in os.listdir(results_dir):
            if filename.startswith("result_") and filename.endswith(".json"):
                result_id = filename[len("result_"):-len(".json")]
                results.append(result_id)

        return sorted(results)

    def save_timeline_snapshot(self, timeline: HistoryTimeline, snapshot_name: str) -> str:
        history_dir = os.path.join(self.data_dir, "history")
        file_path = os.path.join(history_dir, f"snapshot_{snapshot_name}.json")

        snapshot = {
            "snapshot_name": snapshot_name,
            "created_at": datetime.now().isoformat(),
            "timeline": timeline.to_dict(),
        }

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(snapshot, f, ensure_ascii=False, indent=2)

        return file_path

    def load_timeline_snapshot(self, snapshot_name: str) -> Optional[Dict[str, Any]]:
        file_path = os.path.join(self.data_dir, "history", f"snapshot_{snapshot_name}.json")
        if not os.path.exists(file_path):
            return None

        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def export_timeline_for_review(self, timeline: HistoryTimeline, export_path: str) -> str:
        timeline_data = timeline.to_dict()
        summary = timeline.get_timeline_summary()

        export_data = {
            "exported_at": datetime.now().isoformat(),
            "summary": summary,
            "events": timeline_data["events"],
        }

        with open(export_path, "w", encoding="utf-8") as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)

        return export_path

    def service_restart_recover(self) -> Dict[str, Any]:
        state = self.load_state("latest")
        if state:
            return {
                "recovered": True,
                "state": state,
                "message": "服务重启后成功恢复历史状态",
            }
        return {
            "recovered": False,
            "state": None,
            "message": "未找到历史状态，从零开始",
        }
