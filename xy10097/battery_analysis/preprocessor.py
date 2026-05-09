"""数据预处理模块。"""

import pandas as pd
import numpy as np
import re
from typing import Dict, List, Optional, Tuple
from .config import AnalysisConfig
from .logger import AnalysisLogger, ErrorType


class DataPreprocessor:
    """数据预处理器。"""
    
    def __init__(self, config: AnalysisConfig, logger: Optional[AnalysisLogger] = None):
        self.config = config
        self.logger = logger or AnalysisLogger(
            log_to_file=config.log_to_file,
            log_file=config.log_file,
            log_level=config.log_level
        )
        self.unit_pattern = re.compile(r'([-+]?\d*\.?\d+)\s*([a-zA-Z]+)')
    
    def preprocess(self, df: pd.DataFrame, column_mapping: Dict[str, str]) -> pd.DataFrame:
        """
        执行完整的数据预处理流程。
        """
        if df is None or len(df) == 0:
            self.logger.error("预处理", "输入数据为空")
            return pd.DataFrame()
        
        df = df.copy()
        self.logger.info("预处理", f"开始预处理，原始数据: {len(df)} 行")
        
        df = self._normalize_columns(df, column_mapping)
        
        if 'battery_id' in df.columns:
            df = self._assign_battery_ids(df)
        
        df = self._convert_units(df)
        df = self._convert_numeric_types(df)
        df = self._handle_missing_values(df)
        df = self._sort_data(df)
        
        self.logger.info("预处理", f"预处理完成，处理后数据: {len(df)} 行")
        
        return df
    
    def _normalize_columns(self, df: pd.DataFrame, column_mapping: Dict[str, str]) -> pd.DataFrame:
        """标准化列名。"""
        rename_map = {}
        for std_name, actual_name in column_mapping.items():
            if actual_name in df.columns:
                rename_map[actual_name] = std_name
        
        if rename_map:
            df = df.rename(columns=rename_map)
            self.logger.info("预处理", f"列名标准化: {rename_map}")
        
        return df
    
    def _assign_battery_ids(self, df: pd.DataFrame) -> pd.DataFrame:
        """分配电池ID。"""
        if 'battery_id' not in df.columns:
            if '_battery_id' in df.columns:
                df['battery_id'] = df['_battery_id']
            elif '_sheet' in df.columns:
                df['battery_id'] = df['_sheet']
            else:
                df['battery_id'] = 'Battery_001'
        
        df['battery_id'] = df['battery_id'].astype(str).str.strip()
        
        unique_ids = df['battery_id'].nunique()
        self.logger.info("预处理", f"检测到 {unique_ids} 个电池样本")
        
        return df
    
    def _convert_units(self, df: pd.DataFrame) -> pd.DataFrame:
        """转换单位到标准格式（mAh）。"""
        if 'capacity' not in df.columns:
            return df
        
        original_dtype = df['capacity'].dtype
        
        if df['capacity'].dtype == object:
            df = self._parse_capacity_with_units(df)
        
        if df['capacity'].dtype in [np.float64, np.int64, float, int]:
            detected_unit = self._detect_unit(df['capacity'])
            if detected_unit != 'mAh':
                df = self._apply_unit_conversion(df, detected_unit)
        
        return df
    
    def _parse_capacity_with_units(self, df: pd.DataFrame) -> pd.DataFrame:
        """解析带单位的容量值。"""
        battery_units = {}
        battery_values = {}
        
        for battery_id, group in df.groupby('battery_id'):
            units = []
            values = []
            
            for idx, val in group['capacity'].items():
                if pd.isna(val):
                    continue
                
                val_str = str(val).strip()
                match = self.unit_pattern.search(val_str)
                
                if match:
                    num = float(match.group(1))
                    unit = match.group(2).lower()
                    values.append((idx, num))
                    units.append(unit)
                else:
                    try:
                        num = float(val_str)
                        values.append((idx, num))
                    except ValueError:
                        self.logger.log_sample_failure(
                            battery_id,
                            ErrorType.FORMAT_ERROR,
                            f"无法解析容量值: {val_str}"
                        )
            
            if units:
                from collections import Counter
                unit_counts = Counter(units)
                dominant_unit = unit_counts.most_common(1)[0][0]
                battery_units[battery_id] = dominant_unit
                
                for idx, val in values:
                    df.loc[idx, 'capacity'] = val
        
        self.logger.info(
            "单位转换",
            f"检测到的单位分布",
            battery_units
        )
        
        return df
    
    def _detect_unit(self, series: pd.Series) -> str:
        """基于数值范围检测单位。"""
        valid_values = series.dropna()
        if len(valid_values) == 0:
            return 'mAh'
        
        median_val = valid_values.median()
        
        if median_val < 10:
            return 'Ah'
        elif median_val >= 10:
            return 'mAh'
        
        return 'mAh'
    
    def _apply_unit_conversion(self, df: pd.DataFrame, detected_unit: str) -> pd.DataFrame:
        """应用单位转换。"""
        if detected_unit == 'Ah':
            df['capacity'] = df['capacity'] * 1000.0
            self.logger.info(
                "单位转换",
                f"将容量从 Ah 转换为 mAh (乘以 1000)"
            )
        elif detected_unit not in ['mAh', 'mah']:
            self.logger.warning(
                "单位转换",
                f"未知单位: {detected_unit}，保持原值"
            )
        
        return df
    
    def _convert_numeric_types(self, df: pd.DataFrame) -> pd.DataFrame:
        """转换数值类型。"""
        if 'cycle' in df.columns:
            df['cycle'] = pd.to_numeric(df['cycle'], errors='coerce')
        
        if 'capacity' in df.columns:
            df['capacity'] = pd.to_numeric(df['capacity'], errors='coerce')
        
        return df
    
    def _handle_missing_values(self, df: pd.DataFrame) -> pd.DataFrame:
        """处理缺失值。"""
        threshold = self.config.qc_rules.get('missing_value_threshold', 0.3)
        
        if 'battery_id' not in df.columns:
            return df
        
        valid_batteries = []
        for battery_id, group in df.groupby('battery_id'):
            total_count = len(group)
            
            if 'cycle' in group.columns:
                cycle_missing = group['cycle'].isna().sum()
                cycle_missing_ratio = cycle_missing / total_count if total_count > 0 else 1
                
                if cycle_missing_ratio > threshold:
                    self.logger.log_sample_failure(
                        battery_id,
                        ErrorType.MISSING_VALUE,
                        f"循环次数缺失比例过高: {cycle_missing_ratio:.1%}"
                    )
                    continue
            
            if 'capacity' in group.columns:
                cap_missing = group['capacity'].isna().sum()
                cap_missing_ratio = cap_missing / total_count if total_count > 0 else 1
                
                if cap_missing_ratio > threshold:
                    self.logger.log_sample_failure(
                        battery_id,
                        ErrorType.MISSING_VALUE,
                        f"容量缺失比例过高: {cap_missing_ratio:.1%}"
                    )
                    continue
            
            valid_batteries.append(battery_id)
        
        df_valid = df[df['battery_id'].isin(valid_batteries)].copy()
        
        if 'capacity' in df_valid.columns:
            df_valid['capacity'] = df_valid.groupby('battery_id')['capacity'].transform(
                lambda x: x.interpolate(method='linear').ffill().bfill()
            )
        
        removed = len(df) - len(df_valid)
        if removed > 0:
            self.logger.warning(
                "缺失值处理",
                f"移除 {removed} 行数据（来自高缺失率样本）"
            )
        
        return df_valid
    
    def _sort_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """按电池和循环次数排序。"""
        sort_cols = []
        if 'battery_id' in df.columns:
            sort_cols.append('battery_id')
        if 'cycle' in df.columns:
            sort_cols.append('cycle')
        
        if sort_cols:
            df = df.sort_values(sort_cols).reset_index(drop=True)
        
        return df
