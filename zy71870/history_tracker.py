#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import json
import hashlib
from datetime import datetime
from typing import Dict, List, Any, Optional
from config import HISTORY_DIR


class HistoryTracker:
    def __init__(self, project_name: str = "fairness_model"):
        self.project_name = project_name
        self.history_file = os.path.join(HISTORY_DIR, f"{project_name}_history.json")
        self._ensure_history_file()

    def _ensure_history_file(self) -> None:
        if not os.path.exists(self.history_file):
            initial_data = {
                "project_name": self.project_name,
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "snapshots": []
            }
            self._write_history(initial_data)

    def _read_history(self) -> Dict[str, Any]:
        with open(self.history_file, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _write_history(self, data: Dict[str, Any]) -> None:
        with open(self.history_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _calculate_hash(self, data: Dict[str, Any]) -> str:
        data_str = json.dumps(data, sort_keys=True, ensure_ascii=False)
        return hashlib.md5(data_str.encode('utf-8')).hexdigest()

    def snapshot(self, 
                 parameters: Dict[str, Any], 
                 model_description: str,
                 modified_by: str = "未指定",
                 change_reason: str = "",
                 results: Optional[Dict[str, Any]] = None) -> str:
        history = self._read_history()
        
        snapshot_id = self._calculate_hash({
            "parameters": parameters,
            "timestamp": datetime.now().isoformat()
        })[:12]
        
        previous_params = {}
        if history["snapshots"]:
            previous_params = history["snapshots"][-1]["parameters"]
        
        param_changes = self._compare_parameters(previous_params, parameters)
        
        snapshot = {
            "snapshot_id": snapshot_id,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "modified_by": modified_by,
            "change_reason": change_reason,
            "model_description": model_description,
            "parameters": parameters,
            "parameter_changes": param_changes,
            "results": results or {}
        }
        
        history["snapshots"].append(snapshot)
        self._write_history(history)
        
        return snapshot_id

    def _compare_parameters(self, old_params: Dict[str, Any], 
                            new_params: Dict[str, Any]) -> List[Dict[str, Any]]:
        changes = []
        all_keys = set(old_params.keys()) | set(new_params.keys())
        
        for key in all_keys:
            old_val = old_params.get(key)
            new_val = new_params.get(key)
            
            if old_val != new_val:
                change_type = "modified"
                if key not in old_params:
                    change_type = "added"
                elif key not in new_params:
                    change_type = "removed"
                
                changes.append({
                    "parameter": key,
                    "change_type": change_type,
                    "old_value": old_val,
                    "new_value": new_val,
                    "display_text": self._format_change(key, old_val, new_val, change_type)
                })
        
        return changes

    def _format_change(self, key: str, old_val: Any, new_val: Any, 
                       change_type: str) -> str:
        param_names = {
            "rest_time_weight": "休息时间权重",
            "back_to_back_weight": "背靠背权重",
            "venue_balance_weight": "场地均衡权重",
            "opponent_strength_weight": "对手强度权重",
            "min_rest_hours": "最小休息时间(小时)",
            "max_consecutive_games": "最大连赛场次",
            "fairness_threshold": "公平性阈值"
        }
        
        display_name = param_names.get(key, key)
        
        if change_type == "added":
            return f"新增参数 '{display_name}' = {new_val}"
        elif change_type == "removed":
            return f"删除参数 '{display_name}' (原值 = {old_val})"
        else:
            return f"调整 '{display_name}': {old_val} → {new_val}"

    def get_snapshot(self, snapshot_id: str) -> Optional[Dict[str, Any]]:
        history = self._read_history()
        for snapshot in history["snapshots"]:
            if snapshot["snapshot_id"] == snapshot_id:
                return snapshot
        return None

    def list_snapshots(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        history = self._read_history()
        snapshots = history["snapshots"]
        
        if limit:
            snapshots = snapshots[-limit:]
        
        return snapshots

    def get_change_history(self, parameter_name: str) -> List[Dict[str, Any]]:
        history = self._read_history()
        changes = []
        
        for snapshot in history["snapshots"]:
            for change in snapshot["parameter_changes"]:
                if change["parameter"] == parameter_name:
                    changes.append({
                        "timestamp": snapshot["timestamp"],
                        "modified_by": snapshot["modified_by"],
                        "change_reason": snapshot["change_reason"],
                        "old_value": change["old_value"],
                        "new_value": change["new_value"]
                    })
        
        return changes

    def compare_snapshots(self, snapshot_id1: str, snapshot_id2: str) -> Dict[str, Any]:
        snap1 = self.get_snapshot(snapshot_id1)
        snap2 = self.get_snapshot(snapshot_id2)
        
        if not snap1 or not snap2:
            return {"error": "找不到指定的快照"}
        
        param_changes = self._compare_parameters(
            snap1["parameters"], 
            snap2["parameters"]
        )
        
        result_changes = self._compare_results(
            snap1.get("results", {}),
            snap2.get("results", {})
        )
        
        return {
            "snapshot1": {
                "id": snapshot_id1,
                "timestamp": snap1["timestamp"],
                "description": snap1["model_description"]
            },
            "snapshot2": {
                "id": snapshot_id2,
                "timestamp": snap2["timestamp"],
                "description": snap2["model_description"]
            },
            "parameter_changes": param_changes,
            "result_changes": result_changes
        }

    def _compare_results(self, old_results: Dict[str, Any], 
                         new_results: Dict[str, Any]) -> List[Dict[str, Any]]:
        changes = []
        all_keys = set(old_results.keys()) | set(new_results.keys())
        
        for key in all_keys:
            old_val = old_results.get(key)
            new_val = new_results.get(key)
            
            if old_val != new_val:
                changes.append({
                    "metric": key,
                    "old_value": old_val,
                    "new_value": new_val
                })
        
        return changes

    def rollback(self, snapshot_id: str) -> Optional[Dict[str, Any]]:
        snapshot = self.get_snapshot(snapshot_id)
        if not snapshot:
            return None
        
        return snapshot["parameters"]
