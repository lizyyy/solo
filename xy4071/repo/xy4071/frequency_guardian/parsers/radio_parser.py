"""电台设备清单解析器"""

from pathlib import Path
from typing import Any, Dict, List, Optional

from ..models.radio import RadioDevice, RadioInventory
from .base import BaseCSVParser, ParseResult


class RadioInventoryParser(BaseCSVParser[RadioInventory]):
    """电台设备清单CSV解析器"""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def get_required_fields(self) -> List[str]:
        """获取必需的字段列表"""
        return ["device_id", "call_sign"]

    def get_optional_fields(self) -> List[str]:
        """获取可选的字段列表"""
        return [
            "model",
            "serial_number",
            "max_power_watts",
            "frequency_bands",
            "is_repeater",
            "repeater_id",
            "location",
            "status",
            "notes",
        ]

    def get_field_mapping(self) -> Dict[str, str]:
        """获取CSV列名到内部字段名的映射"""
        return {
            "设备ID": "device_id",
            "设备编号": "device_id",
            "DeviceID": "device_id",
            "device_id": "device_id",

            "呼号": "call_sign",
            "CallSign": "call_sign",
            "call_sign": "call_sign",

            "型号": "model",
            "设备型号": "model",
            "Model": "model",
            "model": "model",

            "序列号": "serial_number",
            "SerialNumber": "serial_number",
            "serial_number": "serial_number",

            "最大功率": "max_power_watts",
            "最大功率(瓦)": "max_power_watts",
            "MaxPower": "max_power_watts",
            "max_power_watts": "max_power_watts",

            "频段": "frequency_bands",
            "支持频段": "frequency_bands",
            "FrequencyBands": "frequency_bands",
            "frequency_bands": "frequency_bands",

            "是否中继台": "is_repeater",
            "IsRepeater": "is_repeater",
            "is_repeater": "is_repeater",

            "中继台ID": "repeater_id",
            "RepeaterID": "repeater_id",
            "repeater_id": "repeater_id",

            "位置": "location",
            "Location": "location",
            "location": "location",

            "状态": "status",
            "Status": "status",
            "status": "status",

            "备注": "notes",
            "Notes": "notes",
            "notes": "notes",
        }

    def parse_record(self, record: Dict[str, Any], line_number: int) -> Optional[RadioDevice]:
        """解析单条设备记录"""
        try:
            # 必需字段
            device_id = str(record.get("device_id", "")).strip()
            call_sign = str(record.get("call_sign", "")).strip().upper()

            if not device_id or not call_sign:
                return None

            # 可选字段
            model = record.get("model")
            if isinstance(model, str):
                model = model.strip() or None

            serial_number = record.get("serial_number")
            if isinstance(serial_number, str):
                serial_number = serial_number.strip() or None

            max_power_watts = self._parse_float(
                record.get("max_power_watts"), "max_power_watts", line_number, default=25.0
            )

            frequency_bands = self._parse_list(
                record.get("frequency_bands", ""), "frequency_bands", line_number
            )

            is_repeater = self._parse_bool(
                record.get("is_repeater", False), "is_repeater", line_number
            )

            repeater_id = record.get("repeater_id")
            if isinstance(repeater_id, str):
                repeater_id = repeater_id.strip() or None

            location = record.get("location")
            if isinstance(location, str):
                location = location.strip() or None

            status = record.get("status", "active")
            if isinstance(status, str):
                status = status.strip().lower()
                # 状态标准化
                status_mapping = {
                    "启用": "active",
                    "在用": "active",
                    "禁用": "inactive",
                    "停用": "inactive",
                    "维护": "maintenance",
                    "active": "active",
                    "inactive": "inactive",
                    "maintenance": "maintenance",
                }
                status = status_mapping.get(status, "active")

            notes = record.get("notes")
            if isinstance(notes, str):
                notes = notes.strip() or None

            return RadioDevice(
                device_id=device_id,
                call_sign=call_sign,
                model=model,
                serial_number=serial_number,
                max_power_watts=max_power_watts,
                frequency_bands=frequency_bands,
                is_repeater=is_repeater,
                repeater_id=repeater_id,
                location=location,
                status=status,
                notes=notes,
            )

        except Exception as e:
            # 记录错误但不中断
            return None

    def build_result(
        self,
        records: List[RadioDevice],
        raw_records: List[Dict[str, Any]],
        source_file: str,
    ) -> RadioInventory:
        """构建设备清单结果"""
        from datetime import datetime

        return RadioInventory(
            devices=records,
            last_updated=datetime.now().isoformat(),
            source_file=source_file,
        )
