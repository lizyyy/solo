import json
import os
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from .models import AuditLog


class AuditTrail:
    def __init__(self, storage_path: str = "storage/audit_logs.json"):
        self.storage_path = storage_path
        self._logs: List[AuditLog] = []
        self._load_from_storage()

    def _load_from_storage(self) -> None:
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                for log_dict in data:
                    self._logs.append(self._dict_to_audit_log(log_dict))
            except Exception as e:
                print(f"[AuditTrail] 加载审计日志失败: {e}")

    def _dict_to_audit_log(self, d: Dict[str, Any]) -> AuditLog:
        return AuditLog(
            log_id=d["log_id"],
            timestamp=datetime.fromisoformat(d["timestamp"]),
            action=d["action"],
            surface_id=d.get("surface_id", ""),
            point_id=d.get("point_id", ""),
            old_value=d.get("old_value"),
            new_value=d.get("new_value"),
            operator=d.get("operator", "system"),
            reason=d.get("reason", ""),
            parameters_used=d.get("parameters_used", {})
        )

    def _save_to_storage(self) -> None:
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        data = [log.to_dict() for log in self._logs]
        with open(self.storage_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def log(self, action: str, surface_id: str = "", point_id: str = "",
            old_value: Any = None, new_value: Any = None,
            operator: str = "system", reason: str = "",
            parameters_used: Optional[Dict[str, Any]] = None) -> AuditLog:
        log = AuditLog(
            log_id=str(uuid.uuid4())[:8],
            timestamp=datetime.now(),
            action=action,
            surface_id=surface_id,
            point_id=point_id,
            old_value=old_value,
            new_value=new_value,
            operator=operator,
            reason=reason,
            parameters_used=parameters_used or {}
        )
        self._logs.append(log)
        self._save_to_storage()
        return log

    def get_logs_for_surface(self, surface_id: str) -> List[AuditLog]:
        return [log for log in self._logs if log.surface_id == surface_id]

    def get_logs_for_point(self, point_id: str) -> List[AuditLog]:
        return [log for log in self._logs if log.point_id == point_id]

    def get_logs_by_action(self, action: str) -> List[AuditLog]:
        return [log for log in self._logs if log.action == action]

    def get_logs_by_operator(self, operator: str) -> List[AuditLog]:
        return [log for log in self._logs if log.operator == operator]

    def get_recent_logs(self, limit: int = 100) -> List[AuditLog]:
        return sorted(self._logs, key=lambda x: x.timestamp, reverse=True)[:limit]

    def export_to_dict(self) -> List[Dict[str, Any]]:
        return [log.to_dict() for log in self._logs]

    def search_logs(self, keyword: str) -> List[AuditLog]:
        keyword = keyword.lower()
        return [
            log for log in self._logs
            if keyword in str(log.action).lower()
            or keyword in str(log.reason).lower()
            or keyword in str(log.operator).lower()
            or keyword in str(log.surface_id).lower()
        ]
