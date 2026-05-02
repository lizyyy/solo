"""值守排班解析器"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from ..models.schedule import DutyShift, DutySchedule
from .base import BaseCSVParser


class DutyScheduleParser(BaseCSVParser[DutySchedule]):
    """值守排班CSV解析器"""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def get_required_fields(self) -> List[str]:
        """获取必需的字段列表"""
        return [
            "shift_id",
            "call_sign",
            "channel_id",
            "date",
            "start_time",
            "end_time",
        ]

    def get_optional_fields(self) -> List[str]:
        """获取可选的字段列表"""
        return [
            "operator_name",
            "device_id",
            "role",
            "team",
            "location",
            "notes",
            "is_backup",
            "backup_for",
        ]

    def get_field_mapping(self) -> Dict[str, str]:
        """获取CSV列名到内部字段名的映射"""
        return {
            "班次ID": "shift_id",
            "排班编号": "shift_id",
            "ShiftID": "shift_id",
            "shift_id": "shift_id",

            "呼号": "call_sign",
            "值守呼号": "call_sign",
            "CallSign": "call_sign",
            "call_sign": "call_sign",

            "操作员姓名": "operator_name",
            "姓名": "operator_name",
            "OperatorName": "operator_name",
            "operator_name": "operator_name",

            "频道ID": "channel_id",
            "ChannelID": "channel_id",
            "channel_id": "channel_id",

            "设备ID": "device_id",
            "DeviceID": "device_id",
            "device_id": "device_id",

            "日期": "date",
            "值守日期": "date",
            "Date": "date",
            "date": "date",

            "开始时间": "start_time",
            "StartTime": "start_time",
            "start_time": "start_time",

            "结束时间": "end_time",
            "EndTime": "end_time",
            "end_time": "end_time",

            "角色": "role",
            "值守角色": "role",
            "Role": "role",
            "role": "role",

            "团队": "team",
            "所属团队": "team",
            "Team": "team",
            "team": "team",

            "位置": "location",
            "值守位置": "location",
            "Location": "location",
            "location": "location",

            "备注": "notes",
            "Notes": "notes",
            "notes": "notes",

            "是否备班": "is_backup",
            "IsBackup": "is_backup",
            "is_backup": "is_backup",

            "主班班次ID": "backup_for",
            "BackupFor": "backup_for",
            "backup_for": "backup_for",
        }

    def parse_record(self, record: Dict[str, Any], line_number: int) -> Optional[DutyShift]:
        """解析单条班次记录"""
        try:
            # 必需字段
            shift_id = str(record.get("shift_id", "")).strip()
            call_sign = str(record.get("call_sign", "")).strip().upper()
            channel_id = str(record.get("channel_id", "")).strip()
            date = str(record.get("date", "")).strip()
            start_time = str(record.get("start_time", "")).strip()
            end_time = str(record.get("end_time", "")).strip()

            if not all([shift_id, call_sign, channel_id, date, start_time, end_time]):
                return None

            # 可选字段
            operator_name = record.get("operator_name")
            if isinstance(operator_name, str):
                operator_name = operator_name.strip() or None

            device_id = record.get("device_id")
            if isinstance(device_id, str):
                device_id = device_id.strip() or None

            role = record.get("role", "operator")
            if isinstance(role, str):
                role = role.strip().lower()
                role_mapping = {
                    "操作员": "operator",
                    "操作": "operator",
                    "监督员": "supervisor",
                    "监督": "supervisor",
                    "主控": "net_control",
                    "主控制": "net_control",
                    "记录员": "scribe",
                    "记录": "scribe",
                    "替补": "relief",
                    "operator": "operator",
                    "supervisor": "supervisor",
                    "net_control": "net_control",
                    "scribe": "scribe",
                    "relief": "relief",
                }
                role = role_mapping.get(role, "operator")

            team = record.get("team")
            if isinstance(team, str):
                team = team.strip() or None

            location = record.get("location")
            if isinstance(location, str):
                location = location.strip() or None

            notes = record.get("notes")
            if isinstance(notes, str):
                notes = notes.strip() or None

            is_backup = self._parse_bool(
                record.get("is_backup", False), "is_backup", line_number
            )

            backup_for = record.get("backup_for")
            if isinstance(backup_for, str):
                backup_for = backup_for.strip() or None

            return DutyShift(
                shift_id=shift_id,
                call_sign=call_sign,
                operator_name=operator_name,
                channel_id=channel_id,
                device_id=device_id,
                date=date,
                start_time=start_time,
                end_time=end_time,
                role=role,
                team=team,
                location=location,
                notes=notes,
                is_backup=is_backup,
                backup_for=backup_for,
            )

        except Exception:
            return None

    def build_result(
        self,
        records: List[DutyShift],
        raw_records: List[Dict[str, Any]],
        source_file: str,
    ) -> DutySchedule:
        """构建排班结果"""
        # 提取日期范围
        dates = sorted({s.date for s in records})
        start_date = dates[0] if dates else None
        end_date = dates[-1] if dates else None

        return DutySchedule(
            shifts=records,
            start_date=start_date,
            end_date=end_date,
            last_updated=datetime.now().isoformat(),
            source_file=source_file,
        )
