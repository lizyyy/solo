"""通联日志解析器"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from ..models.log import ContactLogEntry, ContactLog
from .base import BaseCSVParser


class ContactLogParser(BaseCSVParser[ContactLog]):
    """通联日志CSV解析器"""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def get_required_fields(self) -> List[str]:
        """获取必需的字段列表"""
        return [
            "date",
            "time_start",
            "call_sign_own",
            "call_sign_other",
            "frequency_mhz",
        ]

    def get_optional_fields(self) -> List[str]:
        """获取可选的字段列表"""
        return [
            "entry_id",
            "time_end",
            "mode",
            "power_watts",
            "signal_report_sent",
            "signal_report_received",
            "operator_name",
            "location",
            "repeater_id",
            "repeater_switch",
            "previous_repeater_id",
            "notes",
        ]

    def get_field_mapping(self) -> Dict[str, str]:
        """获取CSV列名到内部字段名的映射"""
        return {
            "日志ID": "entry_id",
            "LogID": "entry_id",
            "entry_id": "entry_id",

            "日期": "date",
            "通联日期": "date",
            "Date": "date",
            "date": "date",

            "开始时间": "time_start",
            "TimeStart": "time_start",
            "time_start": "time_start",

            "结束时间": "time_end",
            "TimeEnd": "time_end",
            "time_end": "time_end",

            "己方呼号": "call_sign_own",
            "本机呼号": "call_sign_own",
            "CallSignOwn": "call_sign_own",
            "call_sign_own": "call_sign_own",

            "对方呼号": "call_sign_other",
            "远程呼号": "call_sign_other",
            "CallSignOther": "call_sign_other",
            "call_sign_other": "call_sign_other",

            "频率": "frequency_mhz",
            "频率(MHz)": "frequency_mhz",
            "Frequency": "frequency_mhz",
            "frequency_mhz": "frequency_mhz",

            "调制模式": "mode",
            "Mode": "mode",
            "mode": "mode",

            "功率": "power_watts",
            "发射功率": "power_watts",
            "功率(瓦)": "power_watts",
            "Power": "power_watts",
            "power_watts": "power_watts",

            "发送信号报告": "signal_report_sent",
            "SignalReportSent": "signal_report_sent",
            "signal_report_sent": "signal_report_sent",

            "接收信号报告": "signal_report_received",
            "SignalReportReceived": "signal_report_received",
            "signal_report_received": "signal_report_received",

            "操作员姓名": "operator_name",
            "操作员": "operator_name",
            "OperatorName": "operator_name",
            "operator_name": "operator_name",

            "位置": "location",
            "Location": "location",
            "location": "location",

            "中继台ID": "repeater_id",
            "RepeaterID": "repeater_id",
            "repeater_id": "repeater_id",

            "中继台切换": "repeater_switch",
            "是否切换中继": "repeater_switch",
            "RepeaterSwitch": "repeater_switch",
            "repeater_switch": "repeater_switch",

            "切换前中继台ID": "previous_repeater_id",
            "PreviousRepeaterID": "previous_repeater_id",
            "previous_repeater_id": "previous_repeater_id",

            "备注": "notes",
            "内容摘要": "notes",
            "Notes": "notes",
            "notes": "notes",
        }

    def parse_record(self, record: Dict[str, Any], line_number: int) -> Optional[ContactLogEntry]:
        """解析单条日志记录"""
        try:
            # 必需字段
            date = str(record.get("date", "")).strip()
            time_start = str(record.get("time_start", "")).strip()
            call_sign_own = str(record.get("call_sign_own", "")).strip().upper()
            call_sign_other = str(record.get("call_sign_other", "")).strip().upper()
            frequency_mhz = self._parse_float(
                record.get("frequency_mhz"), "frequency_mhz", line_number
            )

            if not all([date, time_start, call_sign_own, call_sign_other]) or frequency_mhz is None:
                return None

            # 可选字段
            entry_id = record.get("entry_id")
            if isinstance(entry_id, str):
                entry_id = entry_id.strip() or None
            if entry_id is None:
                entry_id = f"log_{line_number}_{datetime.now().strftime('%Y%m%d%H%M%S')}"

            time_end = record.get("time_end")
            if isinstance(time_end, str):
                time_end = time_end.strip() or None

            mode = record.get("mode", "FM")
            if isinstance(mode, str):
                mode = mode.strip().upper()

            power_watts = self._parse_float(
                record.get("power_watts"), "power_watts", line_number
            )

            signal_report_sent = record.get("signal_report_sent")
            if isinstance(signal_report_sent, str):
                signal_report_sent = signal_report_sent.strip() or None

            signal_report_received = record.get("signal_report_received")
            if isinstance(signal_report_received, str):
                signal_report_received = signal_report_received.strip() or None

            operator_name = record.get("operator_name")
            if isinstance(operator_name, str):
                operator_name = operator_name.strip() or None

            location = record.get("location")
            if isinstance(location, str):
                location = location.strip() or None

            repeater_id = record.get("repeater_id")
            if isinstance(repeater_id, str):
                repeater_id = repeater_id.strip() or None

            repeater_switch = self._parse_bool(
                record.get("repeater_switch", False), "repeater_switch", line_number
            )

            previous_repeater_id = record.get("previous_repeater_id")
            if isinstance(previous_repeater_id, str):
                previous_repeater_id = previous_repeater_id.strip() or None

            notes = record.get("notes")
            if isinstance(notes, str):
                notes = notes.strip() or None

            return ContactLogEntry(
                entry_id=entry_id,
                date=date,
                time_start=time_start,
                time_end=time_end,
                call_sign_own=call_sign_own,
                call_sign_other=call_sign_other,
                frequency_mhz=frequency_mhz,
                mode=mode,
                power_watts=power_watts,
                signal_report_sent=signal_report_sent,
                signal_report_received=signal_report_received,
                operator_name=operator_name,
                location=location,
                repeater_id=repeater_id,
                repeater_switch=repeater_switch,
                previous_repeater_id=previous_repeater_id,
                notes=notes,
                line_number=line_number,
            )

        except Exception:
            return None

    def build_result(
        self,
        records: List[ContactLogEntry],
        raw_records: List[Dict[str, Any]],
        source_file: str,
    ) -> ContactLog:
        """构建日志结果"""
        # 提取日期范围
        dates = sorted({e.date for e in records})
        start_date = dates[0] if dates else None
        end_date = dates[-1] if dates else None

        # 提取主要呼号（出现次数最多的己方呼号）
        call_signs: Dict[str, int] = {}
        for entry in records:
            cs = entry.call_sign_own
            call_signs[cs] = call_signs.get(cs, 0) + 1
        call_sign_primary = max(call_signs.keys(), key=lambda k: call_signs[k]) if call_signs else None

        return ContactLog(
            entries=records,
            call_sign_primary=call_sign_primary,
            start_date=start_date,
            end_date=end_date,
            last_updated=datetime.now().isoformat(),
            source_files=[source_file],
        )
