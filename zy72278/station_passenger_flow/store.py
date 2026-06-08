import json
import os
from datetime import datetime
from typing import Optional, List, Dict, Any
from .models import PassengerFlowResult, PathPoint


class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


class DataStore:
    def __init__(self, data_dir: str = None):
        if data_dir is None:
            data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
        self.data_dir = data_dir
        self.results_dir = os.path.join(data_dir, "results")
        self.replay_dir = os.path.join(data_dir, "replays")
        os.makedirs(self.results_dir, exist_ok=True)
        os.makedirs(self.replay_dir, exist_ok=True)

    def save_result(self, result: PassengerFlowResult) -> str:
        filename = f"{result.result_id}_v{result.version}.json"
        filepath = os.path.join(self.results_dir, filename)
        data = result.model_dump(mode="json")
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, cls=DateTimeEncoder)
        self._save_latest_pointer(result.result_id, result.version)
        return filepath

    def load_result(self, result_id: str, version: Optional[int] = None) -> Optional[PassengerFlowResult]:
        if version is None:
            version = self._get_latest_version(result_id)
            if version is None:
                return None
        filename = f"{result_id}_v{version}.json"
        filepath = os.path.join(self.results_dir, filename)
        if not os.path.exists(filepath):
            return None
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        return PassengerFlowResult.model_validate(data)

    def load_latest_result(self, result_id: str) -> Optional[PassengerFlowResult]:
        return self.load_result(result_id)

    def list_result_versions(self, result_id: str) -> List[int]:
        versions = []
        if not os.path.exists(self.results_dir):
            return versions
        for fname in os.listdir(self.results_dir):
            if fname.startswith(result_id) and fname.endswith(".json"):
                try:
                    v_part = fname.split("_v")[1].replace(".json", "")
                    versions.append(int(v_part))
                except (IndexError, ValueError):
                    continue
        return sorted(versions)

    def list_all_results(self) -> List[Dict[str, Any]]:
        results = []
        if not os.path.exists(self.results_dir):
            return results
        seen = set()
        for fname in sorted(os.listdir(self.results_dir)):
            if not fname.endswith(".json"):
                continue
            result_id = fname.split("_v")[0]
            if result_id in seen:
                continue
            seen.add(result_id)
            filepath = os.path.join(self.results_dir, fname)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                latest = self.load_latest_result(result_id)
                results.append({
                    "result_id": result_id,
                    "hall_name": data.get("hall_name", ""),
                    "station_name": data.get("station_name", ""),
                    "current_step": latest.current_step if latest else data.get("current_step", ""),
                    "version": latest.version if latest else data.get("version", 1),
                    "available_versions": self.list_result_versions(result_id)
                })
            except Exception:
                continue
        return results

    def save_replay_version(self, result_id: str, version: int, path_points: List[PathPoint]) -> int:
        replay_versions_dir = os.path.join(self.replay_dir, result_id)
        os.makedirs(replay_versions_dir, exist_ok=True)
        existing = self.list_replay_versions(result_id)
        new_version = max(existing) + 1 if existing else 1
        filepath = os.path.join(replay_versions_dir, f"replay_v{new_version}_result_v{version}.json")
        data = {
            "result_id": result_id,
            "result_version": version,
            "replay_version": new_version,
            "path_points": [p.model_dump(mode="json") for p in path_points],
            "saved_at": datetime.now().isoformat()
        }
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, cls=DateTimeEncoder)
        return new_version

    def load_replay_version(self, result_id: str, replay_version: int) -> Optional[Dict[str, Any]]:
        replay_versions_dir = os.path.join(self.replay_dir, result_id)
        if not os.path.exists(replay_versions_dir):
            return None
        for fname in os.listdir(replay_versions_dir):
            if fname.startswith(f"replay_v{replay_version}_"):
                filepath = os.path.join(replay_versions_dir, fname)
                with open(filepath, "r", encoding="utf-8") as f:
                    return json.load(f)
        return None

    def list_replay_versions(self, result_id: str) -> List[int]:
        replay_versions_dir = os.path.join(self.replay_dir, result_id)
        if not os.path.exists(replay_versions_dir):
            return []
        versions = []
        for fname in os.listdir(replay_versions_dir):
            if fname.startswith("replay_v") and fname.endswith(".json"):
                try:
                    v = int(fname.split("_v")[1].split("_")[0])
                    versions.append(v)
                except (IndexError, ValueError):
                    continue
        return sorted(versions)

    def verify_replay_consistency(self, result_id: str, replay_version: int) -> Dict[str, Any]:
        replay_data = self.load_replay_version(result_id, replay_version)
        if replay_data is None:
            return {
                "consistent": False,
                "message": f"回放版本{replay_version}不存在，请检查版本号是否正确。",
                "details": {"available_versions": self.list_replay_versions(result_id)}
            }
        result_version = replay_data["result_version"]
        latest_result = self.load_latest_result(result_id)
        if latest_result is None:
            return {
                "consistent": False,
                "message": f"找不到结果ID「{result_id}」的任何数据。",
                "details": {}
            }
        if latest_result.version != result_version:
            return {
                "consistent": False,
                "message": f"回放版本{replay_version}关联的是结果版本{result_version}，但最新结果版本是{latest_result.version}。CAD图层名和测距仪记录可能与最新结果不一致，请确认后再操作。",
                "details": {
                    "replay_result_version": result_version,
                    "latest_result_version": latest_result.version,
                    "cad_layer_name": latest_result.cad_layer.layer_name if latest_result.cad_layer else None,
                    "rangefinder_count": len(latest_result.rangefinder_records)
                }
            }
        return {
            "consistent": True,
            "message": f"回放版本{replay_version}与最新结果版本{latest_result.version}一致，CAD图层名和测距仪记录对得上。",
            "details": {
                "replay_result_version": result_version,
                "latest_result_version": latest_result.version,
                "cad_layer_name": latest_result.cad_layer.layer_name if latest_result.cad_layer else None,
                "rangefinder_count": len(latest_result.rangefinder_records)
            }
        }

    def _save_latest_pointer(self, result_id: str, version: int):
        pointer_path = os.path.join(self.results_dir, f"{result_id}_latest.json")
        with open(pointer_path, "w", encoding="utf-8") as f:
            json.dump({"result_id": result_id, "latest_version": version}, f)

    def _get_latest_version(self, result_id: str) -> Optional[int]:
        pointer_path = os.path.join(self.results_dir, f"{result_id}_latest.json")
        if not os.path.exists(pointer_path):
            versions = self.list_result_versions(result_id)
            return max(versions) if versions else None
        with open(pointer_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("latest_version")
