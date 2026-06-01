import json
import os
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from .models import ParameterVersion


class ParameterManager:
    DEFAULT_PARAMS = {
        "outlier_zscore_threshold": 3.0,
        "outlier_iqr_factor": 1.5,
        "vol_min_valid": 0.01,
        "vol_max_valid": 2.0,
        "arbitrage_max_spread": 0.05,
        "interpolation_method": "cubic",
        "smoothness_lambda": 0.1,
        "confidence_weight_source": {
            "lecture_note": 0.6,
            "business_table": 0.9,
            "screenshot": 0.4,
            "summary_page": 0.8
        },
        "conflict_tolerance_pct": 5.0,
        "tenor_order": ["1M", "3M", "6M", "1Y", "2Y", "3Y", "5Y", "10Y"]
    }

    def __init__(self, storage_path: str = "storage/params.json"):
        self.storage_path = storage_path
        self._current_params: Dict[str, ParameterVersion] = {}
        self._version_history: List[ParameterVersion] = []
        self._load_from_storage()

    def _load_from_storage(self) -> None:
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                for pv_dict in data.get("current", {}).values():
                    pv = self._dict_to_param_version(pv_dict)
                    self._current_params[pv.parameter_name] = pv
                for pv_dict in data.get("history", []):
                    self._version_history.append(self._dict_to_param_version(pv_dict))
            except Exception as e:
                print(f"[ParameterManager] 加载参数失败，使用默认值: {e}")
                self._init_default_params()
        else:
            self._init_default_params()

    def _init_default_params(self) -> None:
        for name, default_value in self.DEFAULT_PARAMS.items():
            pv = ParameterVersion(
                version_id=f"v{str(uuid.uuid4())[:6]}",
                parameter_name=name,
                value=default_value,
                default_value=default_value,
                is_user_modified=False,
                comment="系统默认参数"
            )
            self._current_params[name] = pv
            self._version_history.append(pv)
        self._save_to_storage()

    def _dict_to_param_version(self, d: Dict[str, Any]) -> ParameterVersion:
        return ParameterVersion(
            version_id=d["version_id"],
            parameter_name=d["parameter_name"],
            value=d["value"],
            default_value=d["default_value"],
            is_user_modified=d.get("is_user_modified", False),
            modified_at=datetime.fromisoformat(d["modified_at"]) if d.get("modified_at") else None,
            modified_by=d.get("modified_by", "system"),
            valid_from=datetime.fromisoformat(d["valid_from"]),
            valid_to=datetime.fromisoformat(d["valid_to"]) if d.get("valid_to") else None,
            comment=d.get("comment", ""),
            surface_ids_used=d.get("surface_ids_used", [])
        )

    def _save_to_storage(self) -> None:
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        data = {
            "current": {k: v.to_dict() for k, v in self._current_params.items()},
            "history": [v.to_dict() for v in self._version_history]
        }
        with open(self.storage_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def get_param(self, name: str) -> Any:
        if name not in self._current_params:
            if name in self.DEFAULT_PARAMS:
                return self.DEFAULT_PARAMS[name]
            raise KeyError(f"参数 {name} 不存在")
        return self._current_params[name].value

    def get_param_version(self, name: str) -> ParameterVersion:
        if name not in self._current_params:
            raise KeyError(f"参数 {name} 不存在")
        return self._current_params[name]

    def get_all_params(self) -> Dict[str, Any]:
        return {k: v.value for k, v in self._current_params.items()}

    def get_all_param_versions(self) -> List[ParameterVersion]:
        return list(self._current_params.values())

    def set_param(self, name: str, value: Any, modified_by: str = "user",
                  comment: str = "", surface_id: str = "") -> ParameterVersion:
        old_pv = self._current_params.get(name)
        if old_pv and old_pv.value == value:
            if surface_id and surface_id not in old_pv.surface_ids_used:
                old_pv.surface_ids_used.append(surface_id)
                self._save_to_storage()
            return old_pv

        default_value = old_pv.default_value if old_pv else (
            self.DEFAULT_PARAMS.get(name, value)
        )

        if old_pv:
            old_pv.valid_to = datetime.now()
            if surface_id and surface_id not in old_pv.surface_ids_used:
                old_pv.surface_ids_used.append(surface_id)

        new_pv = ParameterVersion(
            version_id=f"v{str(uuid.uuid4())[:6]}",
            parameter_name=name,
            value=value,
            default_value=default_value,
            is_user_modified=True,
            modified_at=datetime.now(),
            modified_by=modified_by,
            comment=comment,
            surface_ids_used=[surface_id] if surface_id else []
        )

        self._current_params[name] = new_pv
        self._version_history.append(new_pv)
        self._save_to_storage()

        return new_pv

    def get_history(self, name: Optional[str] = None) -> List[ParameterVersion]:
        if name:
            return [v for v in self._version_history if v.parameter_name == name]
        return list(self._version_history)

    def is_user_modified(self, name: str) -> bool:
        if name not in self._current_params:
            return False
        return self._current_params[name].is_user_modified

    def reset_to_default(self, name: str) -> ParameterVersion:
        if name not in self.DEFAULT_PARAMS:
            raise KeyError(f"参数 {name} 没有默认值")
        return self.set_param(
            name=name,
            value=self.DEFAULT_PARAMS[name],
            modified_by="system",
            comment="重置为系统默认值"
        )

    def mark_used_by_surface(self, surface_id: str) -> None:
        for pv in self._current_params.values():
            if surface_id not in pv.surface_ids_used:
                pv.surface_ids_used.append(surface_id)
        self._save_to_storage()

    def export_params_for_surface(self, surface_id: str) -> Dict[str, Any]:
        used_versions = [
            pv for pv in self._version_history
            if surface_id in pv.surface_ids_used
        ]
        if not used_versions:
            used_versions = self.get_all_param_versions()

        return {
            "surface_id": surface_id,
            "export_time": datetime.now().isoformat(),
            "parameters": [pv.to_dict() for pv in used_versions]
        }
