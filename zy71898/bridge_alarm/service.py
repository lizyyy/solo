import csv
import os
from datetime import datetime
from typing import List, Optional, Dict, Tuple
from .models import AlarmRecord, RecordStatus, OperationLog, STATUS_DISPLAY
from .storage import Database


class ImportResult:
    def __init__(self):
        self.success: int = 0
        self.duplicate: int = 0
        self.failed: List[str] = []
        self.imported_records: List[AlarmRecord] = []

    def to_dict(self) -> Dict:
        return {
            "success": self.success,
            "duplicate": self.duplicate,
            "failed_count": len(self.failed),
            "failed": self.failed,
        }


class AlarmService:
    def __init__(self, db: Database):
        self.db = db

    def import_from_csv(self, file_path: str, source: str, operator: str,
                        team: str = "") -> ImportResult:
        result = ImportResult()
        if not os.path.exists(file_path):
            result.failed.append(f"文件不存在: {file_path}")
            return result

        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    record = self._parse_row(row, source, operator, team)
                    if not record.threshold_level:
                        record.threshold_level = self.db.get_threshold_level(record.displacement)
                    inserted = self.db.insert_record(record)
                    if inserted:
                        result.success += 1
                        result.imported_records.append(inserted)
                    else:
                        result.duplicate += 1
                except Exception as e:
                    result.failed.append(f"第{row_num}行: {str(e)}")
        return result

    def _parse_row(self, row: Dict, source: str, operator: str, team: str) -> AlarmRecord:
        def get_val(keys: List[str], default: str = "") -> str:
            for k in keys:
                if k in row and row[k].strip():
                    return row[k].strip()
            return default

        record_no = get_val(["record_no", "记录编号", "编号", "record"])
        if not record_no:
            raise ValueError("缺少记录编号")

        alarm_time_str = get_val(["alarm_time", "报警时间", "时间", "time"])
        try:
            alarm_time = datetime.strptime(alarm_time_str, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            try:
                alarm_time = datetime.strptime(alarm_time_str, "%Y/%m/%d %H:%M:%S")
            except ValueError:
                alarm_time = datetime.now()

        displacement = float(get_val(["displacement", "位移", "位移值", "value"], "0"))
        threshold = float(get_val(["threshold", "阈值", "阈值"], "10"))

        pending_reason = get_val(["pending_reason", "待处理原因", "原因"])
        if pending_reason:
            status = RecordStatus.PENDING
        else:
            status = RecordStatus.PENDING

        return AlarmRecord(
            source=source,
            record_no=record_no,
            bridge_name=get_val(["bridge_name", "桥梁名称", "桥梁", "bridge"]),
            position=get_val(["position", "位置", "部位", "测点"]),
            displacement=displacement,
            threshold=threshold,
            threshold_level=get_val(["threshold_level", "阈值等级", "等级", "level"]),
            alarm_time=alarm_time,
            status=status,
            pending_reason=pending_reason,
            operator=operator,
            remark=get_val(["remark", "备注", "说明"]),
            vibration_file=get_val(["vibration_file", "振动文件", "振动曲线", "file"]),
            team=team if team else get_val(["team", "班组"]),
        )

    def confirm_record(self, record_id: int, operator: str, remark: str = "") -> bool:
        return self.db.update_status(record_id, RecordStatus.CONFIRMED, operator,
                                    f"确认处理: {remark}" if remark else "确认处理")

    def mark_supplement(self, record_id: int, operator: str, reason: str) -> bool:
        if not reason.strip():
            raise ValueError("待补原因不能为空")
        return self.db.update_status(record_id, RecordStatus.SUPPLEMENT, operator,
                                    "标记待补", pending_reason=reason)

    def revise_record(self, record_id: int, field_name: str, new_value: str,
                     operator: str, reason: str) -> bool:
        if not reason.strip():
            raise ValueError("修正原因不能为空")
        allowed_fields = ["displacement", "threshold", "bridge_name", "position",
                          "vibration_file", "remark", "team"]
        if field_name not in allowed_fields:
            raise ValueError(f"不允许修改字段: {field_name}，允许修改: {allowed_fields}")

        record = self.db.get_record(record_id)
        if not record:
            return False

        old_val = str(getattr(record, field_name))
        if old_val == new_value:
            return True

        success = self.db.update_field(record_id, field_name, old_val, new_value, operator, reason)
        if success and record.status != RecordStatus.REVISED:
            self.db.update_status(record_id, RecordStatus.REVISED, operator,
                                 f"人工修正: {field_name}")
        return success

    def withdraw_record(self, record_id: int, operator: str, reason: str) -> bool:
        if not reason.strip():
            raise ValueError("撤回原因不能为空")
        return self.db.withdraw_record(record_id, operator, reason)

    def get_record_detail(self, record_id: int) -> Optional[Dict]:
        record = self.db.get_record(record_id)
        if not record:
            return None
        logs = self.db.get_operation_logs(record_id)
        return {
            "record": record.to_dict(),
            "history": [log.to_dict() for log in logs],
        }

    def query_records(self, filters: Optional[Dict] = None) -> List[Dict]:
        records = self.db.get_records(filters)
        return [r.to_dict() for r in records]

    def get_record_history(self, record_id: int) -> List[Dict]:
        logs = self.db.get_operation_logs(record_id)
        return [log.to_dict() for log in logs]

    def get_thresholds(self) -> List[Dict]:
        return [t.to_dict() for t in self.db.get_thresholds()]

    def get_statistics(self, filters: Optional[Dict] = None) -> Dict:
        all_records = self.db.get_records(filters)
        stats = {
            "total": len(all_records),
            "by_status": {},
            "manual_modified": 0,
            "by_source": {},
            "by_level": {},
        }
        for status in RecordStatus:
            stats["by_status"][status.value] = {
                "display": STATUS_DISPLAY[status],
                "count": 0,
            }
        for r in all_records:
            stats["by_status"][r.status.value]["count"] += 1
            if r.is_manual_modified:
                stats["manual_modified"] += 1
            if r.source not in stats["by_source"]:
                stats["by_source"][r.source] = 0
            stats["by_source"][r.source] += 1
            if r.threshold_level not in stats["by_level"]:
                stats["by_level"][r.threshold_level] = 0
            stats["by_level"][r.threshold_level] += 1
        return stats

    def get_unified_filters(self) -> Dict[str, List[str]]:
        records = self.db.get_records()
        sources = sorted(set(r.source for r in records if r.source))
        teams = sorted(set(r.team for r in records if r.team))
        bridges = sorted(set(r.bridge_name for r in records if r.bridge_name))
        return {
            "statuses": [(s.value, STATUS_DISPLAY[s]) for s in RecordStatus],
            "sources": sources,
            "teams": teams,
            "bridges": bridges,
        }
