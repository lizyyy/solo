"""频率计划解析器"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from ..models.frequency import FrequencyChannel, FrequencyAssignment, FrequencyPlan
from .base import BaseCSVParser


class FrequencyPlanParser(BaseCSVParser[FrequencyPlan]):
    """频率计划CSV解析器"""

    def __init__(self, parse_type: str = "channels", **kwargs):
        """
        初始化解析器

        Args:
            parse_type: 解析类型 - "channels" 解析频道, "assignments" 解析分配
        """
        super().__init__(**kwargs)
        self.parse_type = parse_type

    def get_required_fields(self) -> List[str]:
        """获取必需的字段列表"""
        if self.parse_type == "channels":
            return ["channel_id", "frequency_mhz"]
        else:  # assignments
            return ["assignment_id", "channel_id", "call_sign", "start_time", "end_time"]

    def get_optional_fields(self) -> List[str]:
        """获取可选的字段列表"""
        if self.parse_type == "channels":
            return [
                "channel_name",
                "bandwidth_khz",
                "mode",
                "is_repeater",
                "repeater_input_mhz",
                "repeater_output_mhz",
                "tone",
                "usage_type",
                "priority",
                "restrictions",
            ]
        else:  # assignments
            return [
                "device_id",
                "days",
                "assignment_type",
                "authorized_by",
                "notes",
            ]

    def get_field_mapping(self) -> Dict[str, str]:
        """获取CSV列名到内部字段名的映射"""
        if self.parse_type == "channels":
            return {
                "频道ID": "channel_id",
                "频道编号": "channel_id",
                "ChannelID": "channel_id",
                "channel_id": "channel_id",

                "频道名称": "channel_name",
                "ChannelName": "channel_name",
                "channel_name": "channel_name",

                "频率": "frequency_mhz",
                "频率(MHz)": "frequency_mhz",
                "Frequency": "frequency_mhz",
                "frequency_mhz": "frequency_mhz",

                "带宽": "bandwidth_khz",
                "带宽(kHz)": "bandwidth_khz",
                "Bandwidth": "bandwidth_khz",
                "bandwidth_khz": "bandwidth_khz",

                "调制模式": "mode",
                "Mode": "mode",
                "mode": "mode",

                "是否中继台": "is_repeater",
                "IsRepeater": "is_repeater",
                "is_repeater": "is_repeater",

                "上行频率": "repeater_input_mhz",
                "上行频率(MHz)": "repeater_input_mhz",
                "RepeaterInput": "repeater_input_mhz",
                "repeater_input_mhz": "repeater_input_mhz",

                "下行频率": "repeater_output_mhz",
                "下行频率(MHz)": "repeater_output_mhz",
                "RepeaterOutput": "repeater_output_mhz",
                "repeater_output_mhz": "repeater_output_mhz",

                "亚音": "tone",
                "PL码": "tone",
                "Tone": "tone",
                "tone": "tone",

                "使用类型": "usage_type",
                "UsageType": "usage_type",
                "usage_type": "usage_type",

                "优先级": "priority",
                "Priority": "priority",
                "priority": "priority",

                "限制说明": "restrictions",
                "Restrictions": "restrictions",
                "restrictions": "restrictions",
            }
        else:  # assignments
            return {
                "分配ID": "assignment_id",
                "AssignmentID": "assignment_id",
                "assignment_id": "assignment_id",

                "频道ID": "channel_id",
                "ChannelID": "channel_id",
                "channel_id": "channel_id",

                "呼号": "call_sign",
                "CallSign": "call_sign",
                "call_sign": "call_sign",

                "设备ID": "device_id",
                "DeviceID": "device_id",
                "device_id": "device_id",

                "开始时间": "start_time",
                "StartTime": "start_time",
                "start_time": "start_time",

                "结束时间": "end_time",
                "EndTime": "end_time",
                "end_time": "end_time",

                "适用日期": "days",
                "适用星期": "days",
                "Days": "days",
                "days": "days",

                "分配类型": "assignment_type",
                "AssignmentType": "assignment_type",
                "assignment_type": "assignment_type",

                "授权人": "authorized_by",
                "AuthorizedBy": "authorized_by",
                "authorized_by": "authorized_by",

                "备注": "notes",
                "Notes": "notes",
                "notes": "notes",
            }

    def parse_record(self, record: Dict[str, Any], line_number: int) -> Optional[Any]:
        """解析单条记录"""
        if self.parse_type == "channels":
            return self._parse_channel(record, line_number)
        else:
            return self._parse_assignment(record, line_number)

    def _parse_channel(self, record: Dict[str, Any], line_number: int) -> Optional[FrequencyChannel]:
        """解析频道记录"""
        try:
            # 必需字段
            channel_id = str(record.get("channel_id", "")).strip()
            frequency_mhz = self._parse_float(
                record.get("frequency_mhz"), "frequency_mhz", line_number
            )

            if not channel_id or frequency_mhz is None:
                return None

            # 可选字段
            channel_name = record.get("channel_name")
            if isinstance(channel_name, str):
                channel_name = channel_name.strip() or None

            bandwidth_khz = self._parse_float(
                record.get("bandwidth_khz"), "bandwidth_khz", line_number, default=12.5
            )

            mode = record.get("mode", "FM")
            if isinstance(mode, str):
                mode = mode.strip().upper()

            is_repeater = self._parse_bool(
                record.get("is_repeater", False), "is_repeater", line_number
            )

            repeater_input_mhz = self._parse_float(
                record.get("repeater_input_mhz"), "repeater_input_mhz", line_number
            )

            repeater_output_mhz = self._parse_float(
                record.get("repeater_output_mhz"), "repeater_output_mhz", line_number
            )

            tone = record.get("tone")
            if isinstance(tone, str):
                tone = tone.strip() or None

            usage_type = record.get("usage_type", "general")
            if isinstance(usage_type, str):
                usage_type = usage_type.strip().lower()

            priority = self._parse_int(
                record.get("priority"), "priority", line_number, default=1
            )
            if priority is not None:
                priority = max(1, min(5, priority))
            else:
                priority = 1

            restrictions = record.get("restrictions")
            if isinstance(restrictions, str):
                restrictions = restrictions.strip() or None

            return FrequencyChannel(
                channel_id=channel_id,
                channel_name=channel_name,
                frequency_mhz=frequency_mhz,
                bandwidth_khz=bandwidth_khz,
                mode=mode,
                is_repeater=is_repeater,
                repeater_input_mhz=repeater_input_mhz,
                repeater_output_mhz=repeater_output_mhz,
                tone=tone,
                usage_type=usage_type,
                priority=priority,
                restrictions=restrictions,
            )

        except Exception:
            return None

    def _parse_assignment(self, record: Dict[str, Any], line_number: int) -> Optional[FrequencyAssignment]:
        """解析分配记录"""
        try:
            # 必需字段
            assignment_id = str(record.get("assignment_id", "")).strip()
            channel_id = str(record.get("channel_id", "")).strip()
            call_sign = str(record.get("call_sign", "")).strip().upper()
            start_time = str(record.get("start_time", "")).strip()
            end_time = str(record.get("end_time", "")).strip()

            if not all([assignment_id, channel_id, call_sign, start_time, end_time]):
                return None

            # 可选字段
            device_id = record.get("device_id")
            if isinstance(device_id, str):
                device_id = device_id.strip() or None

            days = self._parse_list(
                record.get("days", "MON,TUE,WED,THU,FRI,SAT,SUN"), "days", line_number
            )
            if not days:
                days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
            else:
                days = [d.upper().strip() for d in days]

            assignment_type = record.get("assignment_type", "permanent")
            if isinstance(assignment_type, str):
                assignment_type = assignment_type.strip().lower()

            authorized_by = record.get("authorized_by")
            if isinstance(authorized_by, str):
                authorized_by = authorized_by.strip() or None

            notes = record.get("notes")
            if isinstance(notes, str):
                notes = notes.strip() or None

            return FrequencyAssignment(
                assignment_id=assignment_id,
                channel_id=channel_id,
                call_sign=call_sign,
                device_id=device_id,
                start_time=start_time,
                end_time=end_time,
                days=days,
                assignment_type=assignment_type,
                authorized_by=authorized_by,
                notes=notes,
            )

        except Exception:
            return None

    def build_result(
        self,
        records: List[Any],
        raw_records: List[Dict[str, Any]],
        source_file: str,
    ) -> FrequencyPlan:
        """构建频率计划结果"""
        if self.parse_type == "channels":
            channels = records
            assignments = []
        else:
            channels = []
            assignments = records

        return FrequencyPlan(
            channels=channels,
            assignments=assignments,
            last_updated=datetime.now().isoformat(),
            source_file=source_file,
        )
