"""CSV解析器 - 支持声级计导出格式"""

import csv
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

import numpy as np
import pandas as pd

from .models import MeasurementData, UnitType, ValidationResult, ValidationStatus


class CSVParseError(Exception):
    """CSV解析错误"""
    pass


class SoundLevelMeterParser:
    """声级计CSV解析器"""

    TIME_COLUMNS = ['time', 'Time', 't', 'T', '时间', '秒', 's']
    SPL_COLUMNS = ['spl', 'SPL', 'level', 'Level', '声压级', 'Lp', 'dB']
    BAND_COLUMNS = ['band', 'Band', '频段', '倍频程', 'octave', 'Octave']

    def __init__(self):
        self.metadata: Dict[str, Any] = {}
        self.warnings: List[str] = []

    def parse_file(self, file_path: Path) -> List[MeasurementData]:
        """
        解析CSV文件，可能包含多个测量数据（如不同频段）

        Args:
            file_path: CSV文件路径

        Returns:
            测量数据列表
        """
        self.metadata = {}
        self.warnings = []

        try:
            raw_content = self._read_file(file_path)
            metadata, data_start_line = self._extract_metadata(raw_content)
            self.metadata.update(metadata)

            df = self._read_data_frame(file_path, data_start_line)
            return self._extract_measurements(df, file_path)

        except Exception as e:
            raise CSVParseError(f"解析文件 {file_path} 失败: {str(e)}") from e

    def _read_file(self, file_path: Path) -> List[str]:
        """读取文件内容，尝试不同编码"""
        encodings = ['utf-8', 'gbk', 'gb2312', 'cp1252', 'latin1']
        for encoding in encodings:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    return f.readlines()
            except UnicodeDecodeError:
                continue
        raise CSVParseError(f"无法识别文件编码: {file_path}")

    def _extract_metadata(self, lines: List[str]) -> Tuple[Dict[str, Any], int]:
        """从文件开头提取元数据"""
        metadata = {}
        data_start_line = 0

        for i, line in enumerate(lines):
            line = line.strip()
            if not line:
                continue

            if self._is_data_line(line):
                data_start_line = i
                break

            meta = self._parse_metadata_line(line)
            if meta:
                metadata.update(meta)

        return metadata, data_start_line

    def _is_data_line(self, line: str) -> bool:
        """判断是否为数据行（包含数字）"""
        parts = re.split(r'[,;\t]', line)
        numeric_parts = [p for p in parts if re.match(r'^-?\d+(\.\d+)?$', p.strip())]
        return len(numeric_parts) >= 2

    def _parse_metadata_line(self, line: str) -> Optional[Dict[str, Any]]:
        """解析元数据行"""
        line = line.strip()

        if ':' in line:
            key, value = line.split(':', 1)
            key = key.strip().lower()
            value = value.strip()

            if 'sample' in key or 'rate' in key or '采样率' in key:
                sample_rate = self._extract_number(value)
                if sample_rate:
                    return {'sample_rate': sample_rate}

            if 'unit' in key or '单位' in key:
                unit = self._parse_unit(value)
                if unit:
                    return {'unit': unit}

            if 'date' in key or 'time' in key or '日期' in key or '时间' in key:
                dt = self._parse_datetime(value)
                if dt:
                    return {'start_time': dt}

            if 'room' in key or '房间' in key:
                return {'room': value}

            if 'point' in key or '测点' in key:
                return {'point': value}

            if 'band' in key or '频段' in key:
                return {'band': value}

            return {key: value}

        return None

    def _extract_number(self, text: str) -> Optional[float]:
        """从文本中提取数字"""
        match = re.search(r'(\d+\.?\d*)', text)
        if match:
            return float(match.group(1))
        return None

    def _parse_unit(self, text: str) -> Optional[UnitType]:
        """解析单位"""
        text = text.lower()
        if 'db(a)' in text or 'dba' in text:
            return UnitType.DB_A
        if 'db(c)' in text or 'dbc' in text:
            return UnitType.DB_C
        if 'db(z)' in text or 'dbz' in text:
            return UnitType.DB_Z
        if 'db' in text:
            return UnitType.DB
        return None

    def _parse_datetime(self, text: str) -> Optional[datetime]:
        """解析日期时间"""
        formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y/%m/%d %H:%M:%S',
            '%d-%m-%Y %H:%M:%S',
            '%Y-%m-%d',
            '%Y/%m/%d',
        ]
        for fmt in formats:
            try:
                return datetime.strptime(text.strip(), fmt)
            except ValueError:
                continue
        return None

    def _read_data_frame(self, file_path: Path, skip_rows: int) -> pd.DataFrame:
        """读取数据为DataFrame"""
        encodings = ['utf-8', 'gbk', 'gb2312', 'cp1252']
        delimiters = [',', ';', '\t']

        for encoding in encodings:
            for delimiter in delimiters:
                try:
                    df = pd.read_csv(
                        file_path,
                        sep=delimiter,
                        skiprows=skip_rows,
                        encoding=encoding,
                        engine='python'
                    )
                    if len(df.columns) >= 2:
                        return df
                except Exception:
                    continue

        raise CSVParseError(f"无法解析CSV数据: {file_path}")

    def _extract_measurements(self, df: pd.DataFrame, file_path: Path) -> List[MeasurementData]:
        """从DataFrame提取测量数据"""
        time_col = self._find_time_column(df)
        if time_col is None:
            raise CSVParseError(f"未找到时间列: {df.columns.tolist()}")

        spl_cols = self._find_spl_columns(df)
        if not spl_cols:
            raise CSVParseError(f"未找到声压级列: {df.columns.tolist()}")

        measurements = []
        for spl_col in spl_cols:
            measurement = self._create_measurement(df, time_col, spl_col, file_path)
            measurements.append(measurement)

        return measurements

    def _find_time_column(self, df: pd.DataFrame) -> Optional[str]:
        """查找时间列"""
        for col in df.columns:
            col_lower = str(col).lower().strip()
            for pattern in self.TIME_COLUMNS:
                if pattern.lower() in col_lower:
                    return col
            if df[col].dtype in ['int64', 'float64']:
                is_monotonic = df[col].is_monotonic_increasing or df[col].is_monotonic_decreasing
                if is_monotonic and len(df[col].unique()) == len(df[col]):
                    return col
        return None

    def _find_spl_columns(self, df: pd.DataFrame) -> List[str]:
        """查找声压级列"""
        spl_cols = []
        for col in df.columns:
            col_lower = str(col).lower().strip()
            for pattern in self.SPL_COLUMNS:
                if pattern.lower() in col_lower:
                    spl_cols.append(col)
                    break

        if not spl_cols:
            numeric_cols = df.select_dtypes(include=['int64', 'float64']).columns.tolist()
            if len(numeric_cols) >= 2:
                time_col = self._find_time_column(df)
                spl_cols = [c for c in numeric_cols if c != time_col]

        return spl_cols

    def _create_measurement(
        self,
        df: pd.DataFrame,
        time_col: str,
        spl_col: str,
        file_path: Path
    ) -> MeasurementData:
        """创建测量数据对象"""
        time_data = self._clean_time_data(df[time_col].values)
        spl_data = self._clean_spl_data(df[spl_col].values)

        if len(time_data) != len(spl_data):
            min_len = min(len(time_data), len(spl_data))
            time_data = time_data[:min_len]
            spl_data = spl_data[:min_len]
            self.warnings.append(f"时间与声压级数据长度不一致，已截断")

        sample_rate = self._infer_sample_rate(time_data)
        unit = self.metadata.get('unit', UnitType.DB_A)
        start_time = self.metadata.get('start_time')

        band = self._extract_band_from_column(spl_col)

        return MeasurementData(
            time=time_data,
            spl=spl_data,
            sample_rate=sample_rate,
            unit=unit,
            start_time=start_time,
            metadata={
                'file_name': file_path.name,
                'file_path': str(file_path),
                'band': band,
                'column_name': spl_col,
                **self.metadata
            }
        )

    def _clean_time_data(self, data: np.ndarray) -> np.ndarray:
        """清理时间数据"""
        data = np.asarray(data, dtype=np.float64)
        data = data[~np.isnan(data)]
        if not np.all(np.diff(data) >= 0):
            sort_idx = np.argsort(data)
            data = data[sort_idx]
        return data

    def _clean_spl_data(self, data: np.ndarray) -> np.ndarray:
        """清理声压级数据"""
        data = np.asarray(data, dtype=np.float64)
        data[np.isnan(data)] = np.nan
        return data

    def _infer_sample_rate(self, time_data: np.ndarray) -> float:
        """从时间数据推断采样率"""
        if len(time_data) < 2:
            return 1.0

        diffs = np.diff(time_data)
        median_diff = np.median(diffs)

        if median_diff <= 0:
            return 1.0

        return 1.0 / median_diff

    def _extract_band_from_column(self, col_name: str) -> Optional[str]:
        """从列名提取频段信息"""
        patterns = [
            r'(\d+)\s*[Hh][Zz]',
            r'(\d+k)\s*[Hh][Zz]',
            r'(\d+\.?\d*[kK]?)\s*[Hh][Zz]',
        ]

        for pattern in patterns:
            match = re.search(pattern, str(col_name))
            if match:
                return match.group(1) + 'Hz'

        col_lower = str(col_name).lower()
        if '125' in col_lower:
            return '125Hz'
        if '250' in col_lower:
            return '250Hz'
        if '500' in col_lower:
            return '500Hz'
        if '1k' in col_lower or '1000' in col_lower:
            return '1000Hz'
        if '2k' in col_lower or '2000' in col_lower:
            return '2000Hz'
        if '4k' in col_lower or '4000' in col_lower:
            return '4000Hz'
        if '8k' in col_lower or '8000' in col_lower:
            return '8000Hz'

        return None


def parse_csv_file(file_path: Path) -> Tuple[List[MeasurementData], ValidationResult]:
    """
    解析CSV文件的便捷函数

    Args:
        file_path: CSV文件路径

    Returns:
        (测量数据列表, 校验结果)
    """
    validation = ValidationResult(status=ValidationStatus.PASS)
    parser = SoundLevelMeterParser()

    try:
        measurements = parser.parse_file(file_path)

        for warning in parser.warnings:
            validation.add_warning(warning)

        return measurements, validation

    except CSVParseError as e:
        validation.add_error(str(e))
        return [], validation
