"""传感器CSV解析器"""

from __future__ import annotations

import csv
import re
from pathlib import Path
from typing import Optional

from ..models import SensorRecord, SensorType, UnitType
from .base import ParserResult, ValidationError
from .utils import parse_timestamp, generate_record_id, fahrenheit_to_celsius


class SensorCSVParser:
    """传感器CSV解析器"""
    
    STANDARD_HEADERS = [
        "timestamp", "时间", "时间戳", "record_time",
        "box_id", "箱号", "展箱编号", "箱编号", "exhibit_box",
        "sensor_id", "传感器", "传感器编号", "sensor",
        "sensor_type", "类型", "传感器类型",
        "value", "数值", "值", "测量值",
        "unit", "单位",
    ]
    
    MULTI_COLUMN_HEADERS = {
        "x_accel": ["x轴(g)", "x轴", "x(g)", "x_accel(g)", "x加速度", "x"],
        "y_accel": ["y轴(g)", "y轴", "y(g)", "y_accel(g)", "y加速度", "y"],
        "z_accel": ["z轴(g)", "z轴", "z(g)", "z_accel(g)", "z加速度", "z"],
        "temperature": ["温度", "温度(°c)", "温度(c)", "temp", "temp(°c)", "temp(c)"],
        "humidity": ["湿度", "湿度(%)", "humidity", "humidity(%)", "hum"],
    }
    
    def __init__(self, auto_convert_units: bool = True):
        self.auto_convert_units = auto_convert_units
        self.header_mapping: dict[str, str] = {}
        self.is_multi_column_format = False
    
    def parse(self, file_path: str | Path) -> ParserResult[SensorRecord]:
        """解析传感器CSV文件"""
        file_path = Path(file_path)
        result = ParserResult[SensorRecord](source_file=str(file_path))
        
        try:
            with open(file_path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                
                if not reader.fieldnames:
                    result.errors.append(ValidationError(
                        message="无法读取CSV表头",
                        source_file=str(file_path),
                    ))
                    return result
                
                self._detect_format(reader.fieldnames)
                
                for row_idx, row in enumerate(reader, start=2):
                    result.total_rows += 1
                    
                    try:
                        if self.is_multi_column_format:
                            record = self._parse_multi_column_row(row, row_idx, str(file_path))
                        else:
                            record = self._parse_standard_row(row, row_idx, str(file_path))
                        result.data.append(record)
                        result.valid_rows += 1
                    except ValidationError as e:
                        result.errors.append(e)
                    except Exception as e:
                        result.errors.append(ValidationError(
                            message=f"解析行失败: {str(e)}",
                            line_number=row_idx,
                            source_file=str(file_path),
                        ))
        
        except FileNotFoundError:
            result.errors.append(ValidationError(
                message=f"文件不存在: {file_path}",
                source_file=str(file_path),
            ))
        except Exception as e:
            result.errors.append(ValidationError(
                message=f"读取文件失败: {str(e)}",
                source_file=str(file_path),
            ))
        
        return result
    
    def _detect_format(self, fieldnames: list[str]):
        """检测CSV格式类型"""
        fieldnames_lower = [fn.strip().lower() for fn in fieldnames]
        
        multi_col_count = 0
        for col_name, variations in self.MULTI_COLUMN_HEADERS.items():
            for var in variations:
                if var.lower() in fieldnames_lower:
                    multi_col_count += 1
                    idx = fieldnames_lower.index(var.lower())
                    self.header_mapping[col_name] = fieldnames[idx]
                    break
        
        if multi_col_count >= 2:
            self.is_multi_column_format = True
            self._map_multi_column_headers(fieldnames)
        else:
            self.is_multi_column_format = False
            self._map_standard_headers(fieldnames)
    
    def _map_standard_headers(self, fieldnames: list[str]):
        """映射标准格式表头"""
        fieldnames_lower = [fn.strip().lower() for fn in fieldnames]
        
        expected_groups = [
            (["timestamp", "时间", "时间戳"], "timestamp"),
            (["box_id", "箱号", "展箱编号", "箱编号"], "box_id"),
            (["sensor_id", "传感器", "传感器编号"], "sensor_id"),
            (["sensor_type", "类型", "传感器类型"], "sensor_type"),
            (["value", "数值", "值", "测量值"], "value"),
            (["unit", "单位"], "unit"),
        ]
        
        for variations, standard_name in expected_groups:
            for var in variations:
                if var.lower() in fieldnames_lower:
                    idx = fieldnames_lower.index(var.lower())
                    self.header_mapping[standard_name] = fieldnames[idx]
                    break
    
    def _map_multi_column_headers(self, fieldnames: list[str]):
        """映射多列格式表头"""
        fieldnames_lower = [fn.strip().lower() for fn in fieldnames]
        
        additional_mappings = [
            (["timestamp", "时间", "时间戳"], "timestamp"),
            (["box_id", "箱号", "展箱编号", "箱编号"], "box_id"),
            (["sensor_id", "传感器", "传感器编号"], "sensor_id"),
        ]
        
        for variations, standard_name in additional_mappings:
            for var in variations:
                if var.lower() in fieldnames_lower:
                    idx = fieldnames_lower.index(var.lower())
                    self.header_mapping[standard_name] = fieldnames[idx]
                    break
    
    def _get_field(self, row: dict[str, str], field_name: str) -> str:
        """从行中获取字段值"""
        csv_field = self.header_mapping.get(field_name, field_name)
        value = row.get(csv_field, row.get(field_name, ""))
        if value is None:
            return ""
        return str(value).strip()
    
    def _get_float_field(self, row: dict[str, str], field_name: str) -> Optional[float]:
        """获取浮点数字段值"""
        value_str = self._get_field(row, field_name)
        if not value_str or value_str == "-":
            return None
        try:
            return float(value_str.replace(",", ""))
        except ValueError:
            return None
    
    def _parse_standard_row(
        self,
        row: dict[str, str],
        line_number: int,
        source_file: str,
    ) -> SensorRecord:
        """解析标准格式单行数据"""
        timestamp_str = self._get_field(row, "timestamp")
        if not timestamp_str:
            raise ValidationError(
                message="时间戳不能为空",
                field="timestamp",
                line_number=line_number,
                source_file=source_file,
            )
        
        try:
            timestamp = parse_timestamp(timestamp_str)
        except ValueError:
            raise ValidationError(
                message=f"无效的时间戳格式: {timestamp_str}",
                field="timestamp",
                value=timestamp_str,
                line_number=line_number,
                source_file=source_file,
            )
        
        box_id = self._get_field(row, "box_id")
        if not box_id:
            raise ValidationError(
                message="展箱编号不能为空",
                field="box_id",
                line_number=line_number,
                source_file=source_file,
            )
        
        sensor_id = self._get_field(row, "sensor_id")
        if not sensor_id:
            sensor_id = f"UNKNOWN_{box_id}"
        
        sensor_type_str = self._get_field(row, "sensor_type").lower()
        sensor_type = self._parse_sensor_type(sensor_type_str)
        
        value_str = self._get_field(row, "value")
        if not value_str:
            raise ValidationError(
                message="测量值不能为空",
                field="value",
                line_number=line_number,
                source_file=source_file,
            )
        
        try:
            value = float(value_str)
        except ValueError:
            raise ValidationError(
                message=f"无效的数值格式: {value_str}",
                field="value",
                value=value_str,
                line_number=line_number,
                source_file=source_file,
            )
        
        unit_str = self._get_field(row, "unit").lower()
        unit = self._parse_unit(unit_str)
        
        raw_value = value
        raw_unit = unit
        
        record_id = generate_record_id("SENSOR", len(self.header_mapping) + line_number)
        
        return SensorRecord(
            record_id=record_id,
            box_id=box_id,
            sensor_id=sensor_id,
            sensor_type=sensor_type,
            timestamp=timestamp,
            value=value,
            unit=unit,
            raw_value=raw_value,
            raw_unit=raw_unit,
            source_file=source_file,
            line_number=line_number,
        )
    
    def _parse_multi_column_row(
        self,
        row: dict[str, str],
        line_number: int,
        source_file: str,
    ) -> SensorRecord:
        """解析多列格式单行数据"""
        timestamp_str = self._get_field(row, "timestamp")
        if not timestamp_str:
            raise ValidationError(
                message="时间戳不能为空",
                field="timestamp",
                line_number=line_number,
                source_file=source_file,
            )
        
        try:
            timestamp = parse_timestamp(timestamp_str)
        except ValueError:
            raise ValidationError(
                message=f"无效的时间戳格式: {timestamp_str}",
                field="timestamp",
                value=timestamp_str,
                line_number=line_number,
                source_file=source_file,
            )
        
        box_id = self._get_field(row, "box_id")
        if not box_id:
            box_id = "UNKNOWN"
        
        sensor_id = self._get_field(row, "sensor_id")
        if not sensor_id:
            sensor_id = f"MULTI_{box_id}"
        
        x_accel_g = self._get_float_field(row, "x_accel")
        y_accel_g = self._get_float_field(row, "y_accel")
        z_accel_g = self._get_float_field(row, "z_accel")
        temperature_celsius = self._get_float_field(row, "temperature")
        humidity_pct = self._get_float_field(row, "humidity")
        
        combined_accel_g = None
        if x_accel_g is not None and y_accel_g is not None and z_accel_g is not None:
            import math
            combined_accel_g = math.sqrt(
                x_accel_g ** 2 + y_accel_g ** 2 + z_accel_g ** 2
            )
        
        sensor_type = SensorType.MULTI
        
        has_accel = any(v is not None for v in [x_accel_g, y_accel_g, z_accel_g, combined_accel_g])
        has_temp = temperature_celsius is not None
        has_humid = humidity_pct is not None
        
        record_id = generate_record_id("SENSOR", line_number)
        
        return SensorRecord(
            record_id=record_id,
            box_id=box_id,
            sensor_id=sensor_id,
            sensor_type=sensor_type,
            timestamp=timestamp,
            value=None,
            unit=None,
            x_accel_g=x_accel_g,
            y_accel_g=y_accel_g,
            z_accel_g=z_accel_g,
            combined_accel_g=combined_accel_g,
            temperature_celsius=temperature_celsius,
            humidity_pct=humidity_pct,
            source_file=source_file,
            line_number=line_number,
        )
    
    def _parse_sensor_type(self, value: str) -> SensorType:
        """解析传感器类型"""
        mapping = {
            "shock": SensorType.SHOCK,
            "震动": SensorType.SHOCK,
            "冲击": SensorType.SHOCK,
            "vibration": SensorType.SHOCK,
            "temperature": SensorType.TEMPERATURE,
            "temp": SensorType.TEMPERATURE,
            "温度": SensorType.TEMPERATURE,
            "humidity": SensorType.HUMIDITY,
            "湿度": SensorType.HUMIDITY,
            "multi": SensorType.MULTI,
            "综合": SensorType.MULTI,
        }
        return mapping.get(value.lower(), SensorType.MULTI)
    
    def _parse_unit(self, value: str) -> UnitType:
        """解析单位"""
        mapping = {
            "g": UnitType.G,
            "g-force": UnitType.G,
            "°c": UnitType.CELSIUS,
            "c": UnitType.CELSIUS,
            "celsius": UnitType.CELSIUS,
            "摄氏度": UnitType.CELSIUS,
            "°f": UnitType.FAHRENHEIT,
            "f": UnitType.FAHRENHEIT,
            "fahrenheit": UnitType.FAHRENHEIT,
            "华氏度": UnitType.FAHRENHEIT,
            "%": UnitType.PERCENT,
            "percent": UnitType.PERCENT,
            "pct": UnitType.PERCENT,
            "百分比": UnitType.PERCENT,
        }
        return mapping.get(value.lower(), UnitType.PERCENT)


def parse_sensor_csv(
    file_path: str | Path,
    auto_convert_units: bool = True,
) -> ParserResult[SensorRecord]:
    """便捷函数：解析传感器CSV文件"""
    parser = SensorCSVParser(auto_convert_units=auto_convert_units)
    return parser.parse(file_path)
