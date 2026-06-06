import json
import os
from typing import List, Dict, Any, Optional
from datetime import datetime
from .models import (
    ScheduleRecord,
    RecordStatus,
    AbnormalType,
    ProcessStep,
    SourceLine,
    AuditLog,
)


class SingleSourceOfTruth:
    """
    单一数据源 - 所有视图(页面展示/导出/接口返回)必须从此读取
    核心原则：一份数据，多种视图，绝不各自计算
    """

    def __init__(self, storage_path: str = "data/schedule_records.json"):
        self.storage_path = storage_path
        self._records: Dict[str, ScheduleRecord] = {}
        self._ensure_storage()
        self._load()

    def _ensure_storage(self):
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        if not os.path.exists(self.storage_path):
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump({}, f, ensure_ascii=False, indent=2)

    def _load(self):
        with open(self.storage_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        for rid, record_data in data.items():
            sources = [SourceLine(**s) for s in record_data.pop("sources", [])]
            audit_logs = []
            for al in record_data.pop("audit_logs", []):
                al["timestamp"] = datetime.fromisoformat(al["timestamp"])
                if al.get("review_time"):
                    al["review_time"] = datetime.fromisoformat(al["review_time"])
                audit_logs.append(AuditLog(**al))
            record = ScheduleRecord(**record_data)
            record.sources = sources
            record.audit_logs = audit_logs
            if record.review_time:
                record.review_time = datetime.fromisoformat(record_data["review_time"])
            self._records[rid] = record

    def _save(self):
        data = {}
        for rid, record in self._records.items():
            d = record.to_dict()
            data[rid] = d
        with open(self.storage_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def add_record(self, record: ScheduleRecord):
        self._records[record.id] = record
        self._save()

    def get_record(self, record_id: str) -> Optional[ScheduleRecord]:
        return self._records.get(record_id)

    def get_all_records(self) -> List[ScheduleRecord]:
        return list(self._records.values())

    def update_record(self, record_id: str, **kwargs):
        record = self._records.get(record_id)
        if not record:
            raise ValueError(f"Record {record_id} not found")
        before = record.to_dict()
        for key, value in kwargs.items():
            if hasattr(record, key):
                setattr(record, key, value)
        record.manual_edits.append({
            "timestamp": datetime.now().isoformat(),
            "changes": kwargs
        })
        self._save()
        return before, record.to_dict()

    def add_audit_log(self, record_id: str, audit_log: AuditLog):
        record = self._records.get(record_id)
        if not record:
            raise ValueError(f"Record {record_id} not found")
        record.audit_logs.append(audit_log)
        self._save()

    def add_source_line(self, record_id: str, source_line: SourceLine):
        record = self._records.get(record_id)
        if not record:
            raise ValueError(f"Record {record_id} not found")
        record.sources.append(source_line)
        self._save()

    def get_for_display(self) -> List[Dict[str, Any]]:
        """页面展示用 - 从同一数据源读取"""
        return [self._format_for_display(r) for r in self._records.values()]

    def get_for_export(self) -> List[Dict[str, Any]]:
        """导出明细用 - 从同一数据源读取"""
        return [self._format_for_export(r) for r in self._records.values()]

    def get_for_api(self) -> List[Dict[str, Any]]:
        """接口返回用 - 从同一数据源读取"""
        return [r.to_dict() for r in self._records.values()]

    def _format_for_display(self, record: ScheduleRecord) -> Dict[str, Any]:
        return {
            "id": record.id,
            "episode": record.episode_number,
            "track": record.track_name,
            "date": record.scheduled_date,
            "time": record.scheduled_time,
            "duration": f"{record.duration_minutes}分钟",
            "engineer": record.engineer_name,
            "status": record.status.value,
            "status_text": self._status_text(record.status),
            "is_abnormal": record.status not in [RecordStatus.PENDING, RecordStatus.NORMAL, RecordStatus.REVIEW_APPROVED],
            "abnormal_type": record.abnormal_type.value if record.abnormal_type else None,
            "consumed": record.consumed,
            "is_leave": record.is_leave,
            "current_step": record.current_step.value,
            "source_count": len(record.sources),
            "has_edits": len(record.manual_edits) > 0,
        }

    def _format_for_export(self, record: ScheduleRecord) -> Dict[str, Any]:
        export_data = {
            "记录ID": record.id,
            "期数": record.episode_number,
            "曲目名称": record.track_name,
            "排期日期": record.scheduled_date,
            "排期时间": record.scheduled_time,
            "时长(分钟)": record.duration_minutes,
            "调音师": record.engineer_name,
            "状态": self._status_text(record.status),
            "异常类型": record.abnormal_type.value if record.abnormal_type else "",
            "异常说明": record.abnormal_note or "",
            "是否已消耗": "是" if record.consumed else "否",
            "是否请假": "是" if record.is_leave else "否",
            "当前步骤": record.current_step.value,
            "复核人": record.reviewer or "",
            "复核时间": record.review_time.isoformat() if record.review_time else "",
            "证据来源数": len(record.sources),
            "人工改动次数": len(record.manual_edits),
        }
        for i, src in enumerate(record.sources, 1):
            export_data[f"来源{i}名称"] = src.source_name
            export_data[f"来源{i}行号"] = src.line_number
            export_data[f"来源{i}原始内容"] = src.raw_content
        return export_data

    def _status_text(self, status: RecordStatus) -> str:
        mapping = {
            RecordStatus.PENDING: "待处理",
            RecordStatus.NORMAL: "正常",
            RecordStatus.ABNORMAL: "异常",
            RecordStatus.REVIEW_REQUIRED: "待统筹复核",
            RecordStatus.REVIEW_APPROVED: "复核通过",
            RecordStatus.REVIEW_REJECTED: "复核驳回",
            RecordStatus.ROLLED_BACK: "已回滚",
        }
        return mapping.get(status, status.value)
