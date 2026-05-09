import os
import pandas as pd
import numpy as np
from typing import Optional, Tuple, Dict, List
from dataclasses import dataclass
from config import AppConfig


@dataclass
class LoadResult:
    data: Optional[pd.DataFrame]
    success: bool
    errors: List[str]
    warnings: List[str]
    column_mapping: Dict[str, str]


class DataLoader:
    def __init__(self, config: AppConfig):
        self.config = config
        self.unit_mapping = config.unit_mapping

    def _detect_format(self, file_path: str) -> str:
        ext = os.path.splitext(file_path)[1].lower()
        if ext in ['.xlsx', '.xls']:
            return 'excel'
        elif ext == '.csv':
            return 'csv'
        raise ValueError(f"不支持的文件格式: {ext}")

    def _load_file(self, file_path: str) -> pd.DataFrame:
        fmt = self._detect_format(file_path)
        if fmt == 'excel':
            df = pd.read_excel(file_path)
        else:
            try:
                df = pd.read_csv(file_path, encoding='utf-8')
            except UnicodeDecodeError:
                df = pd.read_csv(file_path, encoding='gbk')
        return df

    def _normalize_columns(self, columns: List[str]) -> Dict[str, str]:
        mapping = {}
        normalized = {}
        for col in columns:
            col_lower = str(col).strip().lower()
            normalized[col] = col_lower

        def find_match(target_list: List[str]) -> Optional[str]:
            for col, col_lower in normalized.items():
                for pattern in target_list:
                    if pattern.lower() in col_lower or col_lower in pattern.lower():
                        return col
            return None

        mapping['inverter_id'] = find_match(self.unit_mapping.inverter_id)
        mapping['timestamp'] = find_match(self.unit_mapping.timestamp)
        mapping['irradiance'] = find_match(self.unit_mapping.irradiance)
        mapping['temperature'] = find_match(self.unit_mapping.temperature)
        mapping['generation'] = find_match(self.unit_mapping.generation)
        mapping['capacity'] = find_match(self.unit_mapping.capacity)

        return mapping

    def _convert_units(self, df: pd.DataFrame, errors: List[str], warnings: List[str]) -> pd.DataFrame:
        if 'timestamp' in df.columns:
            try:
                df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
            except Exception as e:
                errors.append(f"时间列转换失败: {str(e)}")

        numeric_cols = ['irradiance', 'temperature', 'generation', 'capacity']
        for col in numeric_cols:
            if col in df.columns:
                original_dtype = df[col].dtype
                if df[col].dtype == object:
                    df[col] = pd.to_numeric(df[col], errors='coerce')
                    coerced_count = df[col].isna().sum()
                    if coerced_count > 0:
                        warnings.append(f"列 {col} 有 {coerced_count} 个非数值被转换为缺失值")

        if 'irradiance' in df.columns:
            q99 = df['irradiance'].quantile(0.99)
            if q99 > 1500:
                if df['irradiance'].max() > 15000:
                    df['irradiance'] = df['irradiance'] / 10.0
                    warnings.append("检测到辐照度单位可能为 mWh/m²，已转换为 W/m² (除以10)")
                elif df['irradiance'].max() > 1500 and df['irradiance'].quantile(0.75) < 2:
                    df['irradiance'] = df['irradiance'] * 1000
                    warnings.append("检测到辐照度单位可能为 kWh/m²，已转换为 W/m² (乘以1000)")

        if 'generation' in df.columns:
            q99 = df['generation'].quantile(0.99)
            if 'capacity' in df.columns:
                capacity_q50 = df['capacity'].quantile(0.5)
                if capacity_q50 > 0:
                    gen_ratio = q99 / capacity_q50
                    if gen_ratio > 100:
                        df['generation'] = df['generation'] / 1000
                        warnings.append("检测到发电量单位可能为 Wh，已转换为 kWh (除以1000)")

        return df

    def load(self, file_path: str) -> LoadResult:
        errors = []
        warnings = []
        column_mapping = {}

        try:
            if not os.path.exists(file_path):
                errors.append(f"文件不存在: {file_path}")
                return LoadResult(None, False, errors, warnings, column_mapping)

            df = self._load_file(file_path)
            warnings.append(f"成功加载 {len(df)} 行数据，{len(df.columns)} 列")

            column_mapping = self._normalize_columns(df.columns.tolist())

            required_cols = ['inverter_id', 'timestamp', 'irradiance', 'temperature', 'generation']
            missing = [c for c in required_cols if column_mapping.get(c) is None]
            if missing:
                errors.append(f"缺少必要的列: {missing}")
                return LoadResult(None, False, errors, warnings, column_mapping)

            df_renamed = pd.DataFrame()
            for standard_col, original_col in column_mapping.items():
                if original_col is not None:
                    df_renamed[standard_col] = df[original_col]

            df_renamed = self._convert_units(df_renamed, errors, warnings)

            return LoadResult(df_renamed, True, errors, warnings, column_mapping)

        except Exception as e:
            errors.append(f"加载文件时发生未知错误: {str(e)}")
            return LoadResult(None, False, errors, warnings, column_mapping)
