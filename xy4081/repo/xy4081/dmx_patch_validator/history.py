import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

from .models import HistoryRecord, ProjectData, Fixture, PatchEntry
from .config import ConfigManager


class HistoryManager:
    def __init__(self, config_manager: ConfigManager):
        self.config_manager = config_manager
        self.history_dir = config_manager.get_history_path()

    def _generate_record_id(self) -> str:
        return str(uuid.uuid4())[:12]

    def _save_record_to_file(self, record: HistoryRecord) -> Path:
        if not self.history_dir.exists():
            self.history_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = record.timestamp.strftime("%Y%m%d_%H%M%S")
        filename = f"{timestamp}_{record.id}.json"
        filepath = self.history_dir / filename
        
        data_dict = record.model_dump()
        
        def datetime_to_str(obj):
            if isinstance(obj, datetime):
                return obj.isoformat()
            if isinstance(obj, dict):
                return {k: datetime_to_str(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [datetime_to_str(item) for item in obj]
            return obj
        
        data_dict = datetime_to_str(data_dict)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data_dict, f, ensure_ascii=False, indent=2)
        
        return filepath

    def record_import(self, import_type: str, file_path: str,
                       imported_count: int, user_note: Optional[str] = None) -> HistoryRecord:
        record = HistoryRecord(
            id=self._generate_record_id(),
            action="import",
            description=f"导入{import_type}: {Path(file_path).name}",
            changes=[{
                "type": "import",
                "import_type": import_type,
                "file": str(file_path),
                "count": imported_count
            }],
            user_note=user_note
        )
        
        self._save_record_to_file(record)
        return record

    def record_check(self, issue_count: int, critical_count: int,
                      warning_count: int, user_note: Optional[str] = None) -> HistoryRecord:
        record = HistoryRecord(
            id=self._generate_record_id(),
            action="check",
            description=f"执行校验: 发现 {issue_count} 个问题",
            changes=[{
                "type": "check",
                "total_issues": issue_count,
                "critical": critical_count,
                "warning": warning_count
            }],
            user_note=user_note
        )
        
        self._save_record_to_file(record)
        return record

    def record_plan(self, plan_summary: str, action_count: int,
                    user_note: Optional[str] = None) -> HistoryRecord:
        record = HistoryRecord(
            id=self._generate_record_id(),
            action="plan",
            description=f"生成规划: {plan_summary}",
            changes=[{
                "type": "plan",
                "summary": plan_summary,
                "action_count": action_count
            }],
            user_note=user_note
        )
        
        self._save_record_to_file(record)
        return record

    def record_apply(self, action_count: int, changes: List[Dict[str, Any]],
                      user_note: Optional[str] = None) -> HistoryRecord:
        record = HistoryRecord(
            id=self._generate_record_id(),
            action="apply",
            description=f"应用 {action_count} 个变更",
            changes=changes,
            user_note=user_note
        )
        
        self._save_record_to_file(record)
        return record

    def record_export(self, export_type: str, file_path: str,
                      user_note: Optional[str] = None) -> HistoryRecord:
        record = HistoryRecord(
            id=self._generate_record_id(),
            action="export",
            description=f"导出{export_type}: {Path(file_path).name}",
            changes=[{
                "type": "export",
                "export_type": export_type,
                "file": str(file_path)
            }],
            user_note=user_note
        )
        
        self._save_record_to_file(record)
        return record

    def record_fixture_change(self, old_fixture: Optional[Fixture],
                               new_fixture: Optional[Fixture],
                               change_type: str, user_note: Optional[str] = None) -> HistoryRecord:
        change_detail = {"type": change_type}
        
        if old_fixture:
            change_detail["old"] = {
                "id": old_fixture.id,
                "universe": old_fixture.universe,
                "start_address": old_fixture.start_address,
                "mode": old_fixture.mode,
                "position": old_fixture.position
            }
        
        if new_fixture:
            change_detail["new"] = {
                "id": new_fixture.id,
                "universe": new_fixture.universe,
                "start_address": new_fixture.start_address,
                "mode": new_fixture.mode,
                "position": new_fixture.position
            }
        
        description = ""
        if change_type == "add":
            description = f"添加灯具: {new_fixture.id if new_fixture else 'Unknown'}"
        elif change_type == "remove":
            description = f"移除灯具: {old_fixture.id if old_fixture else 'Unknown'}"
        elif change_type == "modify":
            description = f"修改灯具: {new_fixture.id if new_fixture else old_fixture.id if old_fixture else 'Unknown'}"
        
        record = HistoryRecord(
            id=self._generate_record_id(),
            action="fixture_change",
            description=description,
            changes=[change_detail],
            user_note=user_note
        )
        
        self._save_record_to_file(record)
        return record

    def list_history(self, limit: int = 20) -> List[HistoryRecord]:
        if not self.history_dir.exists():
            return []
        
        files = sorted(self.history_dir.glob("*.json"), reverse=True)
        records = []
        
        for filepath in files[:limit]:
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    record = HistoryRecord(**data)
                    records.append(record)
            except (json.JSONDecodeError, KeyError):
                continue
        
        return records

    def get_record(self, record_id: str) -> Optional[HistoryRecord]:
        if not self.history_dir.exists():
            return None
        
        for filepath in self.history_dir.glob(f"*_{record_id}.json"):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return HistoryRecord(**data)
            except (json.JSONDecodeError, KeyError):
                continue
        
        return None
