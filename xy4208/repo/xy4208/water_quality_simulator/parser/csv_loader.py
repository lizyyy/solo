import csv
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from uuid import uuid4

from ..models import (
    PondConfig,
    PondState,
    SensorRecord,
    SensorData,
    WaterQualityParams,
)


class CSVLoader:
    POND_CONFIG_FIELDS = [
        "pond_id", "pond_name", "volume", "area", "depth",
        "species", "stage", "stocking_density", "notes"
    ]

    SENSOR_RECORD_FIELDS = [
        "record_id", "pond_id", "timestamp", "sensor_type",
        "sensor_id", "value", "unit", "location", "is_valid", "invalid_reason"
    ]

    WATER_QUALITY_FIELDS = [
        "timestamp", "temperature", "ph", "ammonia_nitrogen",
        "nitrite", "salinity", "dissolved_oxygen", "turbidity",
        "alkalinity", "hardness"
    ]

    def __init__(self):
        self._validation_errors: List[Dict[str, Any]] = []

    @property
    def validation_errors(self) -> List[Dict[str, Any]]:
        return self._validation_errors.copy()

    def _add_error(self, row_num: int, field: str, message: str, value: Any = None) -> None:
        self._validation_errors.append({
            "row": row_num,
            "field": field,
            "message": message,
            "value": value,
        })

    def _clear_errors(self) -> None:
        self._validation_errors = []

    def _parse_datetime(self, value: str, row_num: int, field: str) -> Optional[datetime]:
        if not value or value.strip() == "":
            return None
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y/%m/%d",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(value.strip(), fmt)
            except ValueError:
                continue
        self._add_error(row_num, field, f"无法解析日期时间格式: {value}", value)
        return None

    def _parse_float(self, value: str, row_num: int, field: str, default: float = 0.0) -> float:
        if not value or value.strip() == "":
            return default
        try:
            return float(value.strip())
        except ValueError:
            self._add_error(row_num, field, f"无法解析数值: {value}", value)
            return default

    def _parse_bool(self, value: str, row_num: int, field: str, default: bool = True) -> bool:
        if not value or value.strip() == "":
            return default
        value_lower = value.strip().lower()
        if value_lower in ["true", "1", "yes", "是"]:
            return True
        if value_lower in ["false", "0", "no", "否"]:
            return False
        self._add_error(row_num, field, f"无法解析布尔值: {value}", value)
        return default

    def load_pond_config(self, file_path: str) -> Optional[PondConfig]:
        self._clear_errors()
        path = Path(file_path)
        if not path.exists():
            self._add_error(0, "file", f"文件不存在: {file_path}")
            return None

        try:
            with open(path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                rows = list(reader)

            if not rows:
                self._add_error(0, "file", "CSV文件为空")
                return None

            row = rows[0]
            row_num = 2

            volume = self._parse_float(row.get("volume", ""), row_num, "volume")
            area = self._parse_float(row.get("area", ""), row_num, "area")
            depth = self._parse_float(row.get("depth", ""), row_num, "depth")
            stocking_density = self._parse_float(row.get("stocking_density", ""), row_num, "stocking_density")

            try:
                config = PondConfig(
                    pond_id=row.get("pond_id", f"pond_{uuid4().hex[:8]}"),
                    pond_name=row.get("pond_name", "未命名池塘"),
                    volume=volume,
                    area=area,
                    depth=depth,
                    species=row.get("species", "未知品种"),
                    stage=row.get("stage", "未知阶段"),
                    stocking_density=stocking_density,
                    notes=row.get("notes"),
                )
                return config
            except Exception as e:
                self._add_error(row_num, "config", f"池塘配置验证失败: {str(e)}")
                return None

        except Exception as e:
            self._add_error(0, "file", f"读取文件失败: {str(e)}")
            return None

    def load_sensor_records(self, file_path: str, pond_id: Optional[str] = None) -> Optional[SensorData]:
        self._clear_errors()
        path = Path(file_path)
        if not path.exists():
            self._add_error(0, "file", f"文件不存在: {file_path}")
            return None

        try:
            with open(path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                rows = list(reader)

            if not rows:
                self._add_error(0, "file", "CSV文件为空")
                return None

            records: List[SensorRecord] = []
            timestamps: List[datetime] = []

            for i, row in enumerate(rows, start=2):
                ts = self._parse_datetime(row.get("timestamp", ""), i, "timestamp")
                if ts is None:
                    continue

                value = self._parse_float(row.get("value", ""), i, "value")
                is_valid = self._parse_bool(row.get("is_valid", "true"), i, "is_valid")

                record_pond_id = row.get("pond_id", pond_id)
                if not record_pond_id:
                    self._add_error(i, "pond_id", "缺少池塘ID")
                    continue

                try:
                    record = SensorRecord(
                        record_id=row.get("record_id", f"rec_{uuid4().hex[:8]}"),
                        pond_id=record_pond_id,
                        timestamp=ts,
                        sensor_type=row.get("sensor_type", "unknown"),
                        sensor_id=row.get("sensor_id"),
                        value=value,
                        unit=row.get("unit", ""),
                        location=row.get("location"),
                        is_valid=is_valid,
                        invalid_reason=row.get("invalid_reason"),
                    )
                    records.append(record)
                    timestamps.append(ts)
                except Exception as e:
                    self._add_error(i, "record", f"记录验证失败: {str(e)}")

            if not records:
                self._add_error(0, "records", "没有有效的传感器记录")
                return None

            actual_pond_id = pond_id or records[0].pond_id
            start_time = min(timestamps)
            end_time = max(timestamps)

            sensor_data = SensorData(
                pond_id=actual_pond_id,
                start_time=start_time,
                end_time=end_time,
                records=records,
            )
            return sensor_data

        except Exception as e:
            self._add_error(0, "file", f"读取文件失败: {str(e)}")
            return None

    def load_water_quality_state(self, file_path: str, pond_id: str) -> Optional[PondState]:
        self._clear_errors()
        path = Path(file_path)
        if not path.exists():
            self._add_error(0, "file", f"文件不存在: {file_path}")
            return None

        try:
            with open(path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                rows = list(reader)

            if not rows:
                self._add_error(0, "file", "CSV文件为空")
                return None

            row = rows[-1]
            row_num = len(rows) + 1

            ts = self._parse_datetime(row.get("timestamp", ""), row_num, "timestamp") or datetime.now()
            temperature = self._parse_float(row.get("temperature", "25.0"), row_num, "temperature")
            ph = self._parse_float(row.get("ph", "7.5"), row_num, "ph")
            ammonia = self._parse_float(row.get("ammonia_nitrogen", "0.0"), row_num, "ammonia_nitrogen")
            nitrite = self._parse_float(row.get("nitrite", "0.0"), row_num, "nitrite")
            salinity = self._parse_float(row.get("salinity", "0.0"), row_num, "salinity")
            do = self._parse_float(row.get("dissolved_oxygen", "6.0"), row_num, "dissolved_oxygen")

            turbidity = self._parse_float(row.get("turbidity", ""), row_num, "turbidity") if row.get("turbidity") else None
            alkalinity = self._parse_float(row.get("alkalinity", ""), row_num, "alkalinity") if row.get("alkalinity") else None
            hardness = self._parse_float(row.get("hardness", ""), row_num, "hardness") if row.get("hardness") else None

            try:
                state = PondState(
                    pond_id=pond_id,
                    timestamp=ts,
                    temperature=temperature,
                    ph=ph,
                    ammonia_nitrogen=ammonia,
                    nitrite=nitrite,
                    salinity=salinity,
                    dissolved_oxygen=do,
                    turbidity=turbidity,
                    alkalinity=alkalinity,
                    hardness=hardness,
                )
                return state
            except Exception as e:
                self._add_error(row_num, "state", f"水质状态验证失败: {str(e)}")
                return None

        except Exception as e:
            self._add_error(0, "file", f"读取文件失败: {str(e)}")
            return None

    def load_to_water_quality_params(self, file_path: str) -> Optional[WaterQualityParams]:
        self._clear_errors()
        path = Path(file_path)
        if not path.exists():
            self._add_error(0, "file", f"文件不存在: {file_path}")
            return None

        try:
            with open(path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                rows = list(reader)

            if not rows:
                self._add_error(0, "file", "CSV文件为空")
                return None

            row = rows[-1]
            row_num = len(rows) + 1

            try:
                params = WaterQualityParams(
                    temperature=self._parse_float(row.get("temperature", "25.0"), row_num, "temperature"),
                    ph=self._parse_float(row.get("ph", "7.5"), row_num, "ph"),
                    ammonia_nitrogen=self._parse_float(row.get("ammonia_nitrogen", "0.0"), row_num, "ammonia_nitrogen"),
                    nitrite=self._parse_float(row.get("nitrite", "0.0"), row_num, "nitrite"),
                    salinity=self._parse_float(row.get("salinity", "0.0"), row_num, "salinity"),
                    dissolved_oxygen=self._parse_float(row.get("dissolved_oxygen", "6.0"), row_num, "dissolved_oxygen"),
                    turbidity=self._parse_float(row.get("turbidity", ""), row_num, "turbidity") if row.get("turbidity") else None,
                    alkalinity=self._parse_float(row.get("alkalinity", ""), row_num, "alkalinity") if row.get("alkalinity") else None,
                    hardness=self._parse_float(row.get("hardness", ""), row_num, "hardness") if row.get("hardness") else None,
                )
                return params
            except Exception as e:
                self._add_error(row_num, "params", f"水质参数验证失败: {str(e)}")
                return None

        except Exception as e:
            self._add_error(0, "file", f"读取文件失败: {str(e)}")
            return None
