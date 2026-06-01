from datetime import datetime
from typing import Any, Dict, List, Optional
from .models import AuditEntry


class AuditLogger:
    def __init__(self):
        self.entries: List[AuditEntry] = []

    def log_calculation(
        self,
        record_id: str,
        source: str,
        params_used: Dict[str, Any],
        result: float,
    ) -> AuditEntry:
        ts = datetime.now().isoformat()
        param_summary = "; ".join(
            f"{k}={v[0]}(来源:{v[1]})" for k, v in params_used.items()
        )
        detail = (
            f"计算完成 | 参数: [{param_summary}] | "
            f"结果: {result:,.2f}元"
        )
        entry = AuditEntry(
            record_id=record_id,
            timestamp=ts,
            action="calculate",
            detail=detail,
            original_source=source,
        )
        self.entries.append(entry)
        return entry

    def log_conflict(
        self,
        record_id: str,
        field_name: str,
        param_value: Any,
        data_value: Any,
        resolution: str,
    ) -> AuditEntry:
        ts = datetime.now().isoformat()
        detail = (
            f"冲突检测 | 字段: {field_name} | "
            f"参数表值: {param_value} | 导入值: {data_value} | "
            f"处理: {resolution}"
        )
        entry = AuditEntry(
            record_id=record_id,
            timestamp=ts,
            action="conflict",
            detail=detail,
            original_source="冲突检测模块",
        )
        self.entries.append(entry)
        return entry

    def log_exception(
        self,
        record_id: str,
        note: str,
    ) -> AuditEntry:
        ts = datetime.now().isoformat()
        detail = f"例外标记 | 备注: {note}"
        entry = AuditEntry(
            record_id=record_id,
            timestamp=ts,
            action="exception",
            detail=detail,
            original_source="人工标注",
        )
        self.entries.append(entry)
        return entry

    def log_param_update(
        self,
        record_id: str,
        field: str,
        old_value: Any,
        new_value: Any,
        manual: bool,
    ) -> AuditEntry:
        ts = datetime.now().isoformat()
        detail = (
            f"参数更新 | 字段: {field} | "
            f"旧值: {old_value} | 新值: {new_value} | "
            f"人工操作: {'是' if manual else '否'}"
        )
        entry = AuditEntry(
            record_id=record_id,
            timestamp=ts,
            action="param_update",
            detail=detail,
            original_source="参数持久化模块",
        )
        self.entries.append(entry)
        return entry

    def get_entries(self, record_id: Optional[str] = None) -> List[AuditEntry]:
        if record_id:
            return [e for e in self.entries if e.record_id == record_id]
        return list(self.entries)
