import pandas as pd
import numpy as np
from typing import List, Dict, Any
from dataclasses import dataclass, field
from .config import Config, ColumnConfig, QCRules


@dataclass
class FailureRecord:
    row_index: int
    column: str
    value: Any
    failure_type: str
    reason: str
    timestamp: Any = None


@dataclass
class QCResult:
    cleaned_data: pd.DataFrame
    failures: List[FailureRecord] = field(default_factory=list)
    summary: Dict[str, int] = field(default_factory=dict)
    statistics: Dict[str, Any] = field(default_factory=dict)


class QualityController:
    FAILURE_MISSING = "missing_value"
    FAILURE_OUT_OF_RANGE = "out_of_range"
    FAILURE_FORMAT = "invalid_format"
    FAILURE_DUPLICATE = "duplicate"
    FAILURE_INCONSISTENT = "inconsistent"
    FAILURE_NEGATIVE = "negative_value"
    FAILURE_UNIT = "unit_issue"
    FAILURE_UNIT_UNSUPPORTED = "unsupported_unit"
    FAILURE_UNIT_UNRECOGNIZED = "unrecognized_unit"

    def __init__(self, config: Config):
        self.config = config
        self.cols = config.columns
        self.rules = config.quality_control
        self.failures: List[FailureRecord] = []
        self.summary: Dict[str, int] = {}
        self._init_summary()

    def _init_summary(self):
        self.summary = {
            'total_records': 0,
            'clean_records': 0,
            'failed_records': 0,
            self.FAILURE_MISSING: 0,
            self.FAILURE_OUT_OF_RANGE: 0,
            self.FAILURE_FORMAT: 0,
            self.FAILURE_DUPLICATE: 0,
            self.FAILURE_INCONSISTENT: 0,
            self.FAILURE_NEGATIVE: 0,
            self.FAILURE_UNIT: 0,
            self.FAILURE_UNIT_UNSUPPORTED: 0,
            self.FAILURE_UNIT_UNRECOGNIZED: 0,
        }

    def validate(self, df: pd.DataFrame, unit_infos: Dict = None) -> QCResult:
        df = df.copy()
        self.failures = []
        self._init_summary()
        
        self.summary['total_records'] = len(df)
        
        if unit_infos:
            df = self._check_unit_issues(df, unit_infos)
        
        df = self._check_missing_values(df)
        df = self._check_duplicates(df)
        df = self._check_timestamp(df)
        df = self._check_numeric_ranges(df)
        df = self._check_consistency(df)
        
        self.summary['clean_records'] = len(df)
        self.summary['failed_records'] = self.summary['total_records'] - len(df)
        
        statistics = self._calculate_statistics(df)
        
        return QCResult(
            cleaned_data=df,
            failures=self.failures.copy(),
            summary=self.summary.copy(),
            statistics=statistics
        )
    
    def _check_unit_issues(self, df: pd.DataFrame, unit_infos: Dict) -> pd.DataFrame:
        """
        检查单位换算产生的问题
        """
        invalid_indices = set()
        
        for col_name, unit_info in unit_infos.items():
            if col_name not in df.columns:
                continue
            
            conversion_results = unit_info.conversion_results
            
            for idx, conv_result in enumerate(conversion_results):
                if idx >= len(df):
                    continue
                
                original_idx = df.index[idx] if idx < len(df) else idx
                
                if conv_result.error:
                    if '不支持的单位换算' in conv_result.error:
                        self._add_failure(
                            original_idx,
                            col_name,
                            conv_result.original_value,
                            self.FAILURE_UNIT_UNSUPPORTED,
                            f"{conv_result.error} (原始值: {conv_result.original_value}, 检测到单位: {conv_result.detected_unit})"
                        )
                        invalid_indices.add(original_idx)
                    elif '无法识别单位' in conv_result.error:
                        self._add_failure(
                            original_idx,
                            col_name,
                            conv_result.original_value,
                            self.FAILURE_UNIT_UNRECOGNIZED,
                            f"{conv_result.error} (原始值: {conv_result.original_value})"
                        )
                        invalid_indices.add(original_idx)
                    elif '无法解析数值' in conv_result.error or '数值解析失败' in conv_result.error:
                        self._add_failure(
                            original_idx,
                            col_name,
                            conv_result.original_value,
                            self.FAILURE_FORMAT,
                            f"{conv_result.error} (原始值: {conv_result.original_value})"
                        )
                        invalid_indices.add(original_idx)
                elif conv_result.detected_unit is not None and conv_result.converted:
                    if conv_result.conversion_factor != 1.0:
                        self._add_failure(
                            original_idx,
                            col_name,
                            conv_result.original_value,
                            self.FAILURE_UNIT,
                            f"单位不一致: 检测到 '{conv_result.detected_unit}', 已换算为 {conv_result.target_unit} "
                            f"(换算系数: {conv_result.conversion_factor})"
                        )
        
        return df.drop(index=list(invalid_indices))

    def _check_missing_values(self, df: pd.DataFrame) -> pd.DataFrame:
        cols = self.cols
        critical_cols = [
            cols.timestamp,
            cols.charging_power,
            cols.energy_consumed
        ]
        
        missing_indices = []
        
        for idx, row in df.iterrows():
            for col in critical_cols:
                if col in df.columns and pd.isna(row[col]):
                    self._add_failure(
                        idx, col, row.get(col),
                        self.FAILURE_MISSING,
                        f"列 '{col}' 存在缺失值"
                    )
                    missing_indices.append(idx)
        
        missing_cols = df.columns[df.isna().any()].tolist()
        for col in missing_cols:
            missing_count = df[col].isna().sum()
            self.summary[self.FAILURE_MISSING] += missing_count
        
        return df.drop(index=list(set(missing_indices)))

    def _check_duplicates(self, df: pd.DataFrame) -> pd.DataFrame:
        check_cols = self.rules.duplicate_check_columns
        existing_check_cols = [c for c in check_cols if c in df.columns]
        
        if not existing_check_cols:
            return df
        
        duplicates = df.duplicated(subset=existing_check_cols, keep='first')
        duplicate_indices = df[duplicates].index
        
        for idx in duplicate_indices:
            row = df.loc[idx]
            self._add_failure(
                idx,
                ','.join(existing_check_cols),
                {c: row.get(c) for c in existing_check_cols},
                self.FAILURE_DUPLICATE,
                f"重复记录: {[str(row.get(c)) for c in existing_check_cols]}"
            )
            self.summary[self.FAILURE_DUPLICATE] += 1
        
        return df.drop(index=duplicate_indices)

    def _check_timestamp(self, df: pd.DataFrame) -> pd.DataFrame:
        if self.cols.timestamp not in df.columns:
            return df
        
        invalid_indices = []
        min_date = pd.to_datetime(self.rules.timestamp.min_date)
        max_date = pd.to_datetime(self.rules.timestamp.max_date)
        
        for idx, row in df.iterrows():
            ts = row[self.cols.timestamp]
            if pd.isna(ts):
                invalid_indices.append(idx)
                continue
            
            if not isinstance(ts, pd.Timestamp):
                self._add_failure(
                    idx, self.cols.timestamp, ts,
                    self.FAILURE_FORMAT,
                    f"时间戳格式无效: {ts}"
                )
                invalid_indices.append(idx)
                continue
            
            if ts < min_date or ts > max_date:
                self._add_failure(
                    idx, self.cols.timestamp, ts,
                    self.FAILURE_OUT_OF_RANGE,
                    f"时间戳超出范围 [{min_date.date()}, {max_date.date()}]: {ts}"
                )
                invalid_indices.append(idx)
        
        self.summary[self.FAILURE_FORMAT] += len([f for f in self.failures if f.failure_type == self.FAILURE_FORMAT])
        self.summary[self.FAILURE_OUT_OF_RANGE] += len([f for f in self.failures if f.failure_type == self.FAILURE_OUT_OF_RANGE and f.column == self.cols.timestamp])
        
        return df.drop(index=list(set(invalid_indices)))

    def _check_numeric_ranges(self, df: pd.DataFrame) -> pd.DataFrame:
        checks = [
            (self.cols.charging_power, self.rules.charging_power),
            (self.cols.energy_consumed, self.rules.energy_consumed),
            (self.cols.charging_duration, self.rules.charging_duration),
            (self.cols.electricity_price, self.rules.electricity_price),
        ]
        
        invalid_indices = set()
        
        for col_name, rules in checks:
            if col_name not in df.columns:
                continue
            
            min_val = rules.get('min_value', float('-inf'))
            max_val = rules.get('max_value', float('inf'))
            unit = rules.get('unit', '')
            
            for idx, row in df.iterrows():
                val = row[col_name]
                if pd.isna(val):
                    continue
                
                try:
                    val_float = float(val)
                except (ValueError, TypeError):
                    self._add_failure(
                        idx, col_name, val,
                        self.FAILURE_FORMAT,
                        f"列 '{col_name}' 数值格式无效"
                    )
                    invalid_indices.add(idx)
                    continue
                
                if val_float < 0:
                    self._add_failure(
                        idx, col_name, val,
                        self.FAILURE_NEGATIVE,
                        f"列 '{col_name}' 存在负值"
                    )
                    invalid_indices.add(idx)
                    continue
                
                if val_float < min_val or val_float > max_val:
                    self._add_failure(
                        idx, col_name, val,
                        self.FAILURE_OUT_OF_RANGE,
                        f"列 '{col_name}' 超出范围 [{min_val}, {max_val}] {unit}: {val}"
                    )
                    invalid_indices.add(idx)
        
        self.summary[self.FAILURE_NEGATIVE] += len([f for f in self.failures if f.failure_type == self.FAILURE_NEGATIVE])
        
        return df.drop(index=list(invalid_indices))

    def _check_consistency(self, df: pd.DataFrame) -> pd.DataFrame:
        cols = self.cols
        invalid_indices = set()
        
        if all(c in df.columns for c in [cols.energy_consumed, cols.charging_duration, cols.charging_power]):
            for idx, row in df.iterrows():
                energy = row[cols.energy_consumed]
                duration = row[cols.charging_duration]
                power = row[cols.charging_power]
                
                if pd.isna(energy) or pd.isna(duration) or pd.isna(power):
                    continue
                
                if duration > 0:
                    expected_power = (energy * 60) / duration
                    if abs(expected_power - power) > max(power * 0.5, 10):
                        self._add_failure(
                            idx,
                            'consistency',
                            {'energy': energy, 'duration': duration, 'power': power},
                            self.FAILURE_INCONSISTENT,
                            f"数据不一致: 能耗/时长 与功率不匹配"
                        )
                        invalid_indices.add(idx)
        
        self.summary[self.FAILURE_INCONSISTENT] += len([f for f in self.failures if f.failure_type == self.FAILURE_INCONSISTENT])
        
        return df.drop(index=list(invalid_indices))

    def _add_failure(self, row_index: int, column: str, value: Any,
                     failure_type: str, reason: str):
        self.failures.append(FailureRecord(
            row_index=row_index,
            column=column,
            value=value,
            failure_type=failure_type,
            reason=reason
        ))
        if failure_type in self.summary:
            self.summary[failure_type] += 1

    def _calculate_statistics(self, df: pd.DataFrame) -> Dict[str, Any]:
        stats = {}
        cols = self.cols
        
        if cols.timestamp in df.columns:
            stats['time_range'] = {
                'start': df[cols.timestamp].min(),
                'end': df[cols.timestamp].max(),
                'days': (df[cols.timestamp].max() - df[cols.timestamp].min()).days
            }
        
        numeric_cols = [
            cols.charging_power,
            cols.energy_consumed,
            cols.charging_duration,
            cols.electricity_price
        ]
        
        for col in numeric_cols:
            if col in df.columns:
                stats[col] = {
                    'count': df[col].count(),
                    'mean': df[col].mean(),
                    'std': df[col].std(),
                    'min': df[col].min(),
                    'max': df[col].max(),
                    'median': df[col].median()
                }
        
        if cols.station_id in df.columns:
            stats['stations'] = df[cols.station_id].nunique()
        
        if cols.charger_id in df.columns:
            stats['chargers'] = df[cols.charger_id].nunique()
        
        return stats
