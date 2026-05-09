import pandas as pd
import numpy as np
from typing import Dict, List, Any
import re


class QualityControl:
    def __init__(
        self,
        min_threshold: float = 30.0,
        max_threshold: float = 120.0,
        outlier_method: str = "IQR方法",
        expected_interval: float = 1.0
    ):
        self.min_threshold = min_threshold
        self.max_threshold = max_threshold
        self.outlier_method = outlier_method
        self.expected_interval = expected_interval
        self.failed_records: List[Dict[str, Any]] = []
    
    def validate(
        self,
        df: pd.DataFrame,
        time_col: str,
        noise_col: str
    ) -> Dict[str, Any]:
        df = df.copy()
        self.failed_records = []
        
        total_samples = len(df)
        missing_count = 0
        duplicate_count = 0
        out_of_range_count = 0
        outlier_count = 0
        break_count = 0
        unit_issues: List[str] = []
        
        valid_indices = set(range(len(df)))
        original_values = df[noise_col].copy()
        
        missing_mask = df[[time_col, noise_col]].isnull().any(axis=1)
        for idx in df[missing_mask].index:
            missing_count += 1
            valid_indices.discard(idx)
            self.failed_records.append({
                'index': idx,
                'timestamp': str(df.loc[idx, time_col]) if pd.notna(df.loc[idx, time_col]) else '缺失',
                'original_value': str(df.loc[idx, noise_col]) if pd.notna(df.loc[idx, noise_col]) else '缺失',
                'reason': '数据缺失'
            })
        
        numeric_noise = df[noise_col].apply(self._convert_to_numeric)
        non_numeric_mask = numeric_noise.isna() & df[noise_col].notna()
        for idx in df[non_numeric_mask].index:
            if idx in valid_indices:
                valid_indices.discard(idx)
                self.failed_records.append({
                    'index': idx,
                    'timestamp': str(df.loc[idx, time_col]),
                    'original_value': str(df.loc[idx, noise_col]),
                    'reason': '非数值格式'
                })
        
        numeric_values = df[noise_col].astype(str).apply(self._extract_numeric)
        has_units = df[noise_col].astype(str).apply(lambda x: bool(re.search(r'[a-zA-Z]+', x)))
        if has_units.any():
            unique_units = df[noise_col][has_units].astype(str).apply(
                lambda x: ''.join(re.findall(r'[a-zA-Z]+', x))
            ).unique()
            unit_issues = list(unique_units)
        
        df['_numeric_noise'] = numeric_values
        df['_numeric_noise'] = pd.to_numeric(df['_numeric_noise'], errors='coerce')
        
        duplicate_mask = df.duplicated(subset=[time_col, noise_col], keep='first')
        for idx in df[duplicate_mask].index:
            if idx in valid_indices:
                duplicate_count += 1
                valid_indices.discard(idx)
                self.failed_records.append({
                    'index': idx,
                    'timestamp': str(df.loc[idx, time_col]),
                    'original_value': str(original_values[idx]),
                    'reason': '重复记录'
                })
        
        valid_data_mask = df['_numeric_noise'].notna() & df[time_col].notna()
        valid_for_range = df[valid_data_mask & pd.Series([i in valid_indices for i in df.index])]
        
        if len(valid_for_range) > 0:
            out_of_range_mask = (
                (valid_for_range['_numeric_noise'] < self.min_threshold) |
                (valid_for_range['_numeric_noise'] > self.max_threshold)
            )
            for idx in valid_for_range[out_of_range_mask].index:
                if idx in valid_indices:
                    out_of_range_count += 1
                    valid_indices.discard(idx)
                    value = valid_for_range.loc[idx, '_numeric_noise']
                    self.failed_records.append({
                        'index': idx,
                        'timestamp': str(valid_for_range.loc[idx, time_col]),
                        'original_value': str(original_values[idx]),
                        'reason': f"超出范围 [{self.min_threshold}-{self.max_threshold}] dB"
                    })
        
        still_valid = df[pd.Series([i in valid_indices for i in df.index])]
        still_valid = still_valid[still_valid['_numeric_noise'].notna()]
        
        if len(still_valid) > 0 and self.outlier_method != "不检测":
            outlier_indices = self._detect_outliers(still_valid['_numeric_noise'], still_valid.index)
            for idx in outlier_indices:
                if idx in valid_indices:
                    outlier_count += 1
                    valid_indices.discard(idx)
                    self.failed_records.append({
                        'index': idx,
                        'timestamp': str(df.loc[idx, time_col]),
                        'original_value': str(original_values[idx]),
                        'reason': f"统计异常值 ({self.outlier_method})"
                    })
        
        try:
            time_series = pd.to_datetime(df[time_col], errors='coerce')
            valid_times = time_series.dropna()
            if len(valid_times) > 1:
                time_diff = valid_times.sort_values().diff().dropna()
                expected_diff = pd.Timedelta(seconds=self.expected_interval)
                breaks = time_diff[time_diff > expected_diff * 2]
                break_count = len(breaks)
        except Exception:
            break_count = 0
        
        valid_df = df.iloc[list(valid_indices)].copy()
        if len(valid_df) > 0:
            valid_df = valid_df.drop(columns=['_numeric_noise'], errors='ignore')
            valid_df[noise_col] = valid_df[noise_col].apply(
                lambda x: pd.to_numeric(self._extract_numeric(str(x)), errors='coerce')
            )
            valid_df = valid_df[valid_df[noise_col].notna()]
            try:
                valid_df[time_col] = pd.to_datetime(valid_df[time_col])
            except Exception:
                pass
        
        return {
            'total_samples': total_samples,
            'valid_samples': len(valid_df),
            'invalid_samples': total_samples - len(valid_df),
            'missing_count': missing_count,
            'duplicate_count': duplicate_count,
            'out_of_range_count': out_of_range_count,
            'outlier_count': outlier_count,
            'break_count': break_count,
            'unit_issues': unit_issues,
            'failed_records': self.failed_records,
            'valid_data': valid_df
        }
    
    def _convert_to_numeric(self, value: Any) -> float:
        if pd.isna(value):
            return np.nan
        try:
            return float(value)
        except (ValueError, TypeError):
            extracted = self._extract_numeric(str(value))
            try:
                return float(extracted)
            except (ValueError, TypeError):
                return np.nan
    
    def _extract_numeric(self, value: str) -> str:
        match = re.search(r'[-+]?\d*\.?\d+', str(value))
        return match.group() if match else value
    
    def _detect_outliers(self, values: pd.Series, indices: pd.Index) -> List[int]:
        if len(values) < 4:
            return []
        
        if self.outlier_method == "IQR方法":
            Q1 = values.quantile(0.25)
            Q3 = values.quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 3.0 * IQR
            upper_bound = Q3 + 3.0 * IQR
            outlier_mask = (values < lower_bound) | (values > upper_bound)
        else:
            z_scores = np.abs((values - values.mean()) / values.std())
            outlier_mask = z_scores > 3.0
        
        return list(indices[outlier_mask])
