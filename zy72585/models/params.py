import yaml
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional
from .base import VersionedModel, AuditLog


class ParamsYAML(VersionedModel):
    def __init__(self, name: str, source_path: str = ""):
        super().__init__()
        self.id = f"params_{name}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        self.name: str = name
        self.source_path: str = source_path
        self.thresholds: Dict[str, float] = {}
        self.layer_configs: Dict[str, Any] = {}
        self.extra_params: Dict[str, Any] = {}

    def load_from_yaml(self, yaml_content: str, operator: str, reason: str = "") -> List:
        data = yaml.safe_load(yaml_content) or {}
        updates = {}

        if "thresholds" in data:
            updates["thresholds"] = data["thresholds"]
        if "layer_configs" in data:
            updates["layer_configs"] = data["layer_configs"]
        if "extra_params" in data:
            updates["extra_params"] = data["extra_params"]

        diffs = self.update(updates, operator, reason)
        return diffs

    def get_threshold(self, name: str, default: Optional[float] = None) -> Optional[float]:
        return self.thresholds.get(name, default)

    def update_threshold(self, name: str, value: float, operator: str, reason: str = "") -> List:
        new_thresholds = self.thresholds.copy()
        new_thresholds[name] = value
        return self.update({"thresholds": new_thresholds}, operator, reason)

    def get_threshold_history(self, name: str) -> List[Dict[str, Any]]:
        history = []
        for snapshot in self._history:
            thresholds = snapshot["data"].get("thresholds", {})
            if name in thresholds:
                history.append({
                    "version": snapshot["version"],
                    "timestamp": snapshot["snapshot_at"],
                    "value": thresholds[name],
                })
        return history

    def to_yaml(self) -> str:
        data = {
            "name": self.name,
            "thresholds": self.thresholds,
            "layer_configs": self.layer_configs,
            "extra_params": self.extra_params,
            "_meta": {
                "version": self.version,
                "updated_at": self.updated_at.isoformat(),
                "updated_by": self.updated_by,
            }
        }
        return yaml.dump(data, default_flow_style=False, allow_unicode=True)
