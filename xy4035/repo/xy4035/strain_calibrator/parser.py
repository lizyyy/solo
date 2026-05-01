import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Callable

import numpy as np
import pandas as pd

from .models import Unit, Sensor, SensorType


TIME_COLUMN_PATTERNS = [
    r"^time$",
    r"^timestamp$",
    r"^日期.*时间$",
    r"^时间$",
    r"^datetime$",
    r"^date.*time$",
]

TEMP_COLUMN_PATTERNS = [
    r"^temp",
    r"^温度",
    r"^temperature",
    r"^T_",
]

STRAIN_COLUMN_PATTERNS = [
    r"^strain",
    r"^应变",
    r"^SG_",
    r"^ε",
]

DISPLACEMENT_COLUMN_PATTERNS = [
    r"^disp",
    r"^位移",
    r"^LVDT",
    r"^D_",
]


class UnitConverter:
    CONVERSIONS: Dict[Tuple[Unit, Unit], Callable[[float], float]] = {
        (Unit.CELSIUS, Unit.FAHRENHEIT): lambda x: x * 9 / 5 + 32,
        (Unit.FAHRENHEIT, Unit.CELSIUS): lambda x: (x - 32) * 5 / 9,
        (Unit.METER, Unit.MILLIMETER): lambda x: x * 1000,
        (Unit.MILLIMETER, Unit.METER): lambda x: x / 1000,
        (Unit.NEWTON, Unit.KILONEWTON): lambda x: x / 1000,
        (Unit.KILONEWTON, Unit.NEWTON): lambda x: x * 1000,
    }

    @classmethod
    def convert(cls, value: float, from_unit: Unit, to_unit: Unit) -> float:
        if from_unit == to_unit:
            return value
        key = (from_unit, to_unit)
        if key in cls.CONVERSIONS:
            return cls.CONVERSIONS[key](value)
        raise ValueError(f"无法从 {from_unit} 转换到 {to_unit}")

    @classmethod
    def can_convert(cls, from_unit: Unit, to_unit: Unit) -> bool:
        if from_unit == to_unit:
            return True
        return (from_unit, to_unit) in cls.CONVERSIONS


class ColumnDetector:
    @staticmethod
    def matches_pattern(column_name: str, patterns: List[str]) -> bool:
        lower_name = column_name.lower().strip()
        for pattern in patterns:
            if re.match(pattern, lower_name, re.IGNORECASE):
                return True
        return False

    @classmethod
    def detect_time_column(cls, columns: List[str]) -> Optional[str]:
        for col in columns:
            if cls.matches_pattern(col, TIME_COLUMN_PATTERNS):
                return col
        for col in columns:
            if "time" in col.lower() or "时间" in col:
                return col
        return None

    @classmethod
    def detect_column_type(cls, column_name: str) -> Optional[SensorType]:
        if cls.matches_pattern(column_name, STRAIN_COLUMN_PATTERNS):
            return SensorType.STRAIN_GAUGE
        if cls.matches_pattern(column_name, DISPLACEMENT_COLUMN_PATTERNS):
            return SensorType.DISPLACEMENT_METER
        if cls.matches_pattern(column_name, TEMP_COLUMN_PATTERNS):
            return SensorType.TEMPERATURE_SENSOR
        return None

    @classmethod
    def extract_sensor_id(cls, column_name: str) -> str:
        match = re.search(r"(\d+)", column_name)
        if match:
            return match.group(1)
        return re.sub(r"^[A-Za-z_]+", "", column_name).strip() or column_name


class CSVParser:
    TIME_FORMATS = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S.%f",
        "%m/%d/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
    ]

    def __init__(self):
        self.column_detector = ColumnDetector()

    def parse_time(self, time_str: str) -> Optional[datetime]:
        if pd.isna(time_str) or time_str == "":
            return None
        if isinstance(time_str, datetime):
            return time_str
        if isinstance(time_str, (int, float)):
            try:
                return datetime.fromtimestamp(time_str)
            except (ValueError, OSError):
                return None

        time_str = str(time_str).strip()
        for fmt in self.TIME_FORMATS:
            try:
                return datetime.strptime(time_str, fmt)
            except (ValueError, TypeError):
                continue
        try:
            return pd.to_datetime(time_str).to_pydatetime()
        except (ValueError, TypeError):
            return None

    def parse_csv(
        self,
        file_path: Path,
        encoding: str = "utf-8",
        skip_rows: int = 0,
        delimiter: Optional[str] = None,
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        if delimiter is None:
            delimiter = self._detect_delimiter(file_path, encoding)

        df = pd.read_csv(
            file_path,
            encoding=encoding,
            skiprows=skip_rows,
            delimiter=delimiter,
            engine="python",
        )

        metadata = self._extract_metadata(df)
        return df, metadata

    def _detect_delimiter(self, file_path: Path, encoding: str) -> str:
        with open(file_path, "r", encoding=encoding, errors="ignore") as f:
            first_line = f.readline()
            if "," in first_line:
                return ","
            if ";" in first_line:
                return ";"
            if "\t" in first_line:
                return "\t"
            return ","

    def _extract_metadata(self, df: pd.DataFrame) -> Dict[str, Any]:
        time_col = self.column_detector.detect_time_column(list(df.columns))

        sensor_columns: List[Dict[str, Any]] = []
        for col in df.columns:
            if col == time_col:
                continue
            col_type = self.column_detector.detect_column_type(col)
            sensor_id = self.column_detector.extract_sensor_id(col)
            sensor_columns.append({
                "column_name": col,
                "sensor_id": sensor_id,
                "type": col_type,
            })

        return {
            "columns": list(df.columns),
            "time_column": time_col,
            "sensor_columns": sensor_columns,
            "row_count": len(df),
            "column_count": len(df.columns),
        }

    def normalize_time_column(
        self,
        df: pd.DataFrame,
        time_column: Optional[str] = None,
    ) -> Tuple[pd.DataFrame, List[Dict[str, Any]]]:
        errors: List[Dict[str, Any]] = []

        if time_column is None:
            time_column = self.column_detector.detect_time_column(list(df.columns))

        if time_column is None:
            if "index" in df.columns.lower():
                time_column = "index"
            else:
                df["_time"] = pd.to_datetime(df.index, errors="coerce")
                time_column = "_time"

        df["_parsed_time"] = df[time_column].apply(self.parse_time)

        invalid_rows = df[df["_parsed_time"].isna()].index.tolist()
        for idx in invalid_rows:
            errors.append({
                "row": int(idx),
                "column": time_column,
                "value": str(df.loc[idx, time_column]),
                "reason": "无法解析时间格式",
            })

        df = df.dropna(subset=["_parsed_time"])
        df = df.rename(columns={"_parsed_time": "_time"})

        if "_time" in df.columns:
            df = df.set_index("_time")
            df = df.drop(columns=[time_column], errors="ignore")
            df = df.drop(columns=["_parsed_time"], errors="ignore")

        return df, errors

    def extract_sensor_data(
        self,
        df: pd.DataFrame,
        sensors: List[Sensor],
    ) -> Tuple[pd.DataFrame, List[Dict[str, Any]]]:
        result_df = df.copy()
        errors: List[Dict[str, Any]] = []
        column_map: Dict[str, str] = {}

        for sensor in sensors:
            found = False
            for col in df.columns:
                col_sensor_id = self.column_detector.extract_sensor_id(col)
                if col_sensor_id == sensor.sensor_id or col == sensor.name:
                    column_map[col] = sensor.sensor_id
                    found = True
                    break

            if not found:
                errors.append({
                    "sensor_id": sensor.sensor_id,
                    "reason": "在数据中未找到对应列",
                })

        result_df = result_df.rename(columns=column_map)

        for sensor in sensors:
            if sensor.sensor_id in result_df.columns:
                result_df[sensor.sensor_id] = pd.to_numeric(
                    result_df[sensor.sensor_id], errors="coerce"
                )
                invalid_count = result_df[sensor.sensor_id].isna().sum()
                if invalid_count > 0:
                    errors.append({
                        "sensor_id": sensor.sensor_id,
                        "reason": f"存在 {invalid_count} 个非数值数据",
                    })

        return result_df, errors
