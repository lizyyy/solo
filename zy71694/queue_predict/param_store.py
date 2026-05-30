from __future__ import annotations

import json
import hashlib
import os
from datetime import datetime, date
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict


@dataclass
class ParamSnapshot:
    snapshot_id: str = ""
    created_at: str = ""
    filter_conditions: Dict[str, Any] = None
    calc_params: Dict[str, Any] = None

    def __post_init__(self):
        if self.filter_conditions is None:
            self.filter_conditions = {}
        if self.calc_params is None:
            self.calc_params = {}


_DEFAULT_CALC_PARAMS = {
    "avg_consult_minutes": 10.0,
    "skip_penalty_factor": 1.5,
    "addon_insert_strategy": "after_current",
    "skip_recall_wait_minutes": 30,
    "suspended_doctor_reassign": True,
    "confidence_interval_sigma": 1.96,
    "queue_jump_detection_threshold": 3,
    "skip_duplicate_window_minutes": 5,
}


class ParamStore:
    def __init__(self, store_dir: str = ".param_store"):
        self.store_dir = store_dir
        os.makedirs(store_dir, exist_ok=True)

    def _compute_snapshot_id(self, filter_conditions: Dict[str, Any], calc_params: Dict[str, Any]) -> str:
        payload = json.dumps(
            {"filter": filter_conditions, "params": calc_params},
            sort_keys=True,
            ensure_ascii=False,
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]

    def save(self, filter_conditions: Dict[str, Any], calc_params: Optional[Dict[str, Any]] = None) -> ParamSnapshot:
        resolved = dict(_DEFAULT_CALC_PARAMS)
        if calc_params:
            resolved.update(calc_params)
        snapshot_id = self._compute_snapshot_id(filter_conditions, resolved)
        snapshot = ParamSnapshot(
            snapshot_id=snapshot_id,
            created_at=datetime.now().isoformat(),
            filter_conditions=dict(filter_conditions),
            calc_params=resolved,
        )
        path = os.path.join(self.store_dir, f"{snapshot_id}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(asdict(snapshot), f, ensure_ascii=False, indent=2)
        return snapshot

    def load(self, snapshot_id: str) -> Optional[ParamSnapshot]:
        path = os.path.join(self.store_dir, f"{snapshot_id}.json")
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return ParamSnapshot(**data)

    def list_snapshots(self) -> List[ParamSnapshot]:
        results = []
        for fname in os.listdir(self.store_dir):
            if fname.endswith(".json"):
                with open(os.path.join(self.store_dir, fname), "r", encoding="utf-8") as f:
                    data = json.load(f)
                results.append(ParamSnapshot(**data))
        return sorted(results, key=lambda s: s.created_at, reverse=True)

    def reproduce(self, snapshot_id: str) -> Optional[Dict[str, Any]]:
        snapshot = self.load(snapshot_id)
        if snapshot is None:
            return None
        return {
            "snapshot_id": snapshot.snapshot_id,
            "filter_conditions": snapshot.filter_conditions,
            "calc_params": snapshot.calc_params,
            "created_at": snapshot.created_at,
        }

    def get_default_calc_params(self) -> Dict[str, Any]:
        return dict(_DEFAULT_CALC_PARAMS)
