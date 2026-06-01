import json
import os
import copy
from datetime import datetime
from typing import Dict, Any, Optional


DEFAULT_PARAMETERS = {
    "hole_area_estimation": {
        "min_hole_area": 0.5,
        "max_hole_area": 100.0,
        "normal_distribution_mean": 25.0,
        "normal_distribution_std": 10.0,
        "boundary_sample_threshold": 5,
        "outlier_z_score_threshold": 3.0,
        "smoothing_kernel_size": 3,
        "triangulation_method": "delaunay",
        "confidence_level": 0.95,
        "area_unit": "mm2"
    },
    "reporting": {
        "include_confidence_interval": True,
        "include_historical_comparison": True,
        "show_outlier_details": True,
        "decimal_places": 3
    },
    "anomaly_detection": {
        "enable_isolation_forest": False,
        "iqr_multiplier": 1.5,
        "min_cluster_size": 2,
        "flag_boundary_samples": True
    },
    "persistence": {
        "backup_before_overwrite": True,
        "keep_last_n_backups": 10
    }
}


class ParameterManager:
    def __init__(self, param_file: str = "data/parameters.json",
                 history_file: str = "data/history.json"):
        self.param_file = param_file
        self.history_file = history_file
        self._user_params: Dict[str, Any] = {}
        self._merged_params: Dict[str, Any] = {}
        self._load_user_params()
        self._merge_params()

    def _load_user_params(self) -> None:
        if os.path.exists(self.param_file):
            try:
                with open(self.param_file, "r", encoding="utf-8") as f:
                    self._user_params = json.load(f)
            except json.JSONDecodeError:
                print(f"[警告] 参数文件 {self.param_file} 格式损坏，使用默认参数")
                self._user_params = {}
        else:
            self._user_params = {}

    def _merge_params(self) -> None:
        self._merged_params = copy.deepcopy(DEFAULT_PARAMETERS)
        self._deep_update(self._merged_params, self._user_params)

    def _deep_update(self, base: Dict[str, Any], override: Dict[str, Any]) -> None:
        for key, value in override.items():
            if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                self._deep_update(base[key], value)
            else:
                base[key] = value

    def get(self, key_path: str, default: Any = None) -> Any:
        keys = key_path.split(".")
        value = self._merged_params
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return default
        return value

    def get_all(self) -> Dict[str, Any]:
        return copy.deepcopy(self._merged_params)

    def get_user_modified(self) -> Dict[str, Any]:
        return copy.deepcopy(self._user_params)

    def set(self, key_path: str, value: Any, operator: str = "system",
            note: str = "") -> None:
        keys = key_path.split(".")
        target = self._user_params
        for key in keys[:-1]:
            if key not in target or not isinstance(target[key], dict):
                target[key] = {}
            target = target[key]
        old_value = target.get(keys[-1], None)
        target[keys[-1]] = value
        self._merge_params()
        self._save_user_params()
        self._record_history(key_path, old_value, value, operator, note)

    def set_batch(self, updates: Dict[str, Any], operator: str = "system",
                  note: str = "") -> None:
        for key_path, value in updates.items():
            keys = key_path.split(".")
            target = self._user_params
            for key in keys[:-1]:
                if key not in target or not isinstance(target[key], dict):
                    target[key] = {}
                target = target[key]
            target[keys[-1]] = value
        self._merge_params()
        self._save_user_params()
        for key_path, value in updates.items():
            self._record_history(key_path, None, value, operator, note)

    def _save_user_params(self) -> None:
        os.makedirs(os.path.dirname(self.param_file), exist_ok=True)
        if self.get("persistence.backup_before_overwrite", True) and os.path.exists(self.param_file):
            self._backup_file(self.param_file)
        with open(self.param_file, "w", encoding="utf-8") as f:
            json.dump(self._user_params, f, indent=2, ensure_ascii=False)

    def _backup_file(self, filepath: str) -> None:
        backup_dir = os.path.join(os.path.dirname(filepath), "backups")
        os.makedirs(backup_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        basename = os.path.basename(filepath)
        backup_path = os.path.join(backup_dir, f"{timestamp}_{basename}")
        with open(filepath, "r", encoding="utf-8") as f_src:
            with open(backup_path, "w", encoding="utf-8") as f_dst:
                f_dst.write(f_src.read())
        keep_n = self.get("persistence.keep_last_n_backups", 10)
        backups = sorted([f for f in os.listdir(backup_dir) if basename in f])
        if len(backups) > keep_n:
            for old_backup in backups[:-keep_n]:
                os.remove(os.path.join(backup_dir, old_backup))

    def _record_history(self, key_path: str, old_value: Any, new_value: Any,
                        operator: str, note: str) -> None:
        os.makedirs(os.path.dirname(self.history_file), exist_ok=True)
        history = []
        if os.path.exists(self.history_file):
            try:
                with open(self.history_file, "r", encoding="utf-8") as f:
                    history = json.load(f)
            except json.JSONDecodeError:
                history = []
        history.append({
            "timestamp": datetime.now().isoformat(),
            "key_path": key_path,
            "old_value": old_value,
            "new_value": new_value,
            "operator": operator,
            "note": note
        })
        with open(self.history_file, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2, ensure_ascii=False)

    def get_history(self, key_path: Optional[str] = None,
                    limit: int = 50) -> list:
        if not os.path.exists(self.history_file):
            return []
        try:
            with open(self.history_file, "r", encoding="utf-8") as f:
                history = json.load(f)
        except json.JSONDecodeError:
            return []
        if key_path:
            history = [h for h in history if h["key_path"] == key_path]
        return list(reversed(history))[:limit]

    def reset_param(self, key_path: str, operator: str = "system",
                    note: str = "") -> bool:
        keys = key_path.split(".")
        target = self._user_params
        for key in keys[:-1]:
            if isinstance(target, dict) and key in target:
                target = target[key]
            else:
                return False
        if keys[-1] in target:
            old_value = target.pop(keys[-1])
            self._merge_params()
            self._save_user_params()
            self._record_history(
                key_path, old_value,
                self.get(key_path), operator,
                note if note else "重置为默认值"
            )
            return True
        return False

    def diff_from_default(self) -> Dict[str, Any]:
        diffs = {}
        self._compare_dicts(DEFAULT_PARAMETERS, self._user_params, "", diffs)
        return diffs

    def _compare_dicts(self, default: Dict[str, Any], user: Dict[str, Any],
                       prefix: str, diffs: Dict[str, Any]) -> None:
        for key in set(list(default.keys()) + list(user.keys())):
            full_key = f"{prefix}.{key}" if prefix else key
            if key not in user:
                continue
            if key not in default:
                diffs[full_key] = {
                    "default": "<新增参数，无默认值>",
                    "current": user[key],
                    "status": "added"
                }
            elif isinstance(default[key], dict) and isinstance(user[key], dict):
                self._compare_dicts(default[key], user[key], full_key, diffs)
            elif default[key] != user[key]:
                diffs[full_key] = {
                    "default": default[key],
                    "current": user[key],
                    "status": "modified"
                }
