import csv
import os
from datetime import datetime
from typing import List, Optional, Dict
from .models import RecordStatus, STATUS_DISPLAY
from .storage import Database


EXPORT_COLUMNS = [
    ("id", "ID"),
    ("source", "来源"),
    ("record_no", "记录编号"),
    ("bridge_name", "桥梁名称"),
    ("position", "位置"),
    ("displacement", "位移(mm)"),
    ("threshold", "阈值(mm)"),
    ("threshold_level", "阈值等级"),
    ("alarm_time", "报警时间"),
    ("status", "状态代码"),
    ("status_display", "状态"),
    ("pending_reason", "待处理原因"),
    ("is_manual_modified", "是否人工修改"),
    ("operator", "最后操作人"),
    ("remark", "备注"),
    ("vibration_file", "振动文件"),
    ("team", "班组"),
    ("created_at", "创建时间"),
    ("updated_at", "更新时间"),
]


class ExportService:
    def __init__(self, db: Database):
        self.db = db

    def export_to_csv(self, file_path: str, filters: Optional[Dict] = None,
                      include_withdrawn: bool = False) -> Dict:
        filters = filters or {}
        if not include_withdrawn and "status" not in filters:
            pass

        records = self.db.get_records(filters)

        if not include_withdrawn:
            records = [r for r in records if r.status != RecordStatus.WITHDRAWN]

        dir_path = os.path.dirname(file_path)
        if dir_path and not os.path.exists(dir_path):
            os.makedirs(dir_path)

        with open(file_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([c[1] for c in EXPORT_COLUMNS])

            for record in records:
                data = record.to_dict()
                row = []
                for key, _ in EXPORT_COLUMNS:
                    val = data.get(key, "")
                    if key == "is_manual_modified":
                        val = "是" if val else "否"
                    row.append(val)
                writer.writerow(row)

        return {
            "exported_count": len(records),
            "file_path": os.path.abspath(file_path),
            "filters": filters,
        }

    def export_history_to_csv(self, record_id: int, file_path: str) -> Dict:
        logs = self.db.get_operation_logs(record_id)

        with open(file_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["操作ID", "记录ID", "操作类型", "原状态", "新状态",
                           "操作人", "原因", "修改字段", "原值", "新值", "操作时间"])

            for log in logs:
                data = log.to_dict()
                writer.writerow([
                    data["id"], data["record_id"],
                    self._action_display(data["action"]),
                    self._status_display(data["old_status"]),
                    self._status_display(data["new_status"]),
                    data["operator"], data["reason"],
                    data["field_name"], data["old_value"],
                    data["new_value"], data["created_at"],
                ])

        return {
            "exported_count": len(logs),
            "file_path": os.path.abspath(file_path),
            "record_id": record_id,
        }

    def _action_display(self, action: str) -> str:
        mapping = {
            "import": "导入",
            "update": "更新",
            "status_change": "状态变更",
            "field_edit": "字段修改",
            "withdraw": "撤回",
        }
        return mapping.get(action, action)

    def _status_display(self, status: str) -> str:
        if not status:
            return "-"
        try:
            return STATUS_DISPLAY[RecordStatus.from_str(status)]
        except:
            return status

    def get_export_template(self) -> List[tuple]:
        return EXPORT_COLUMNS
