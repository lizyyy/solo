"""
质量控制模块
实现缺失、重复、单位、异常值检测等质控规则
"""
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
import pandas as pd
import numpy as np
from enum import Enum

from .config import AuditConfig


class QCStatus(Enum):
    """质控状态"""
    PASS = 'PASS'
    WARNING = 'WARNING'
    FAIL = 'FAIL'


@dataclass
class QCIssue:
    """
    单个质控问题
    """
    index: int
    issue_type: str
    column: Optional[str]
    sensor_id: Optional[str]
    message: str
    value: Any = None
    severity: str = 'MEDIUM'
    action: str = 'MARK'


@dataclass
class QCResult:
    """
    质控结果汇总
    """
    total_records: int
    valid_records: int
    invalid_records: int
    issues: List[QCIssue]
    statistics: Dict
    quality_score: float
    
    def get_issues_by_type(self, issue_type: str) -> List[QCIssue]:
        return [i for i in self.issues if i.issue_type == issue_type]
    
    def get_issues_by_sensor(self, sensor_id: str) -> List[QCIssue]:
        return [i for i in self.issues if i.sensor_id == sensor_id]
    
    def get_issue_summary(self) -> Dict:
        summary = {}
        for issue in self.issues:
            issue_type = issue.issue_type
            if issue_type not in summary:
                summary[issue_type] = {'count': 0, 'examples': []}
            summary[issue_type]['count'] += 1
            if len(summary[issue_type]['examples']) < 5:
                summary[issue_type]['examples'].append({
                    'index': issue.index,
                    'message': issue.message
                })
        return summary


class QualityController:
    """
    质量控制器
    实现一系列质控检查规则
    """
    
    def __init__(self, config: AuditConfig):
        self.config = config
        self.mask_columns = ['_qc_flag', '_qc_issues', '_qc_status', '_is_valid']
    
    def run_all_checks(self, df: pd.DataFrame) -> QCResult:
        df = df.copy()
        
        for col in self.mask_columns:
            df[col] = None
        
        issues: List[QCIssue] = []
        
        issues.extend(self._check_missing_values(df))
        issues.extend(self._check_duplicates(df))
        issues.extend(self._check_range_outliers(df))
        issues.extend(self._check_statistical_outliers(df))
        issues.extend(self._check_temporal_breaks(df))
        
        result = self._compile_results(df, issues)
        return result
    
    def _check_missing_values(self, df: pd.DataFrame) -> List[QCIssue]:
        issues = []
        critical_columns = ['sensor_id', 'timestamp', 'temperature', 'humidity']
        
        for col in critical_columns:
            if col not in df.columns:
                continue
            
            missing_mask = df[col].isna()
            missing_indices = df[missing_mask].index.tolist()
            
            for idx in missing_indices[:1000]:
                row = df.loc[idx]
                issues.append(QCIssue(
                    index=int(idx),
                    issue_type='MISSING_VALUE',
                    column=col,
                    sensor_id=str(row.get('sensor_id', 'UNKNOWN')),
                    message=f"列 '{col}' 存在缺失值",
                    severity='HIGH' if col in ['sensor_id', 'timestamp'] else 'MEDIUM',
                    action='EXCLUDE' if col in ['sensor_id', 'timestamp'] else 'IMPUTE'
                ))
                
                if idx in df.index:
                    df.at[idx, '_qc_flag'] = 'MISSING'
                    df.at[idx, '_is_valid'] = False
        
        return issues
    
    def _check_duplicates(self, df: pd.DataFrame) -> List[QCIssue]:
        issues = []
        
        check_cols = [c for c in self.config.duplicate_check_columns if c in df.columns]
        
        if len(check_cols) < 2:
            return issues
        
        duplicate_mask = df.duplicated(subset=check_cols, keep='first')
        duplicate_indices = df[duplicate_mask].index.tolist()
        
        for idx in duplicate_indices:
            row = df.loc[idx]
            issues.append(QCIssue(
                index=int(idx),
                issue_type='DUPLICATE_RECORD',
                column='_all',
                sensor_id=str(row.get('sensor_id', 'UNKNOWN')),
                message=f"在列 {check_cols} 上存在重复记录",
                value=None,
                severity='MEDIUM',
                action='REMOVE'
            ))
            
            if idx in df.index:
                df.at[idx, '_qc_flag'] = 'DUPLICATE'
                df.at[idx, '_is_valid'] = False
        
        return issues
    
    def _check_range_outliers(self, df: pd.DataFrame) -> List[QCIssue]:
        issues = []
        
        if 'temperature' in df.columns:
            temp_min, temp_max = self.config.temperature_range
            outlier_mask = (df['temperature'] < temp_min) | (df['temperature'] > temp_max)
            outlier_mask = outlier_mask & df['temperature'].notna()
            
            for idx in df[outlier_mask].index.tolist():
                val = df.at[idx, 'temperature']
                row = df.loc[idx]
                issues.append(QCIssue(
                    index=int(idx),
                    issue_type='RANGE_OUTLIER',
                    column='temperature',
                    sensor_id=str(row.get('sensor_id', 'UNKNOWN')),
                    message=f"温度值 {val} 超出有效范围 [{temp_min}, {temp_max}]",
                    value=val,
                    severity='MEDIUM',
                    action='MARK'
                ))
                
                if idx in df.index:
                    df.at[idx, '_qc_flag'] = 'RANGE_OUTLIER'
        
        if 'humidity' in df.columns:
            hum_min, hum_max = self.config.humidity_range
            outlier_mask = (df['humidity'] < hum_min) | (df['humidity'] > hum_max)
            outlier_mask = outlier_mask & df['humidity'].notna()
            
            for idx in df[outlier_mask].index.tolist():
                val = df.at[idx, 'humidity']
                row = df.loc[idx]
                issues.append(QCIssue(
                    index=int(idx),
                    issue_type='RANGE_OUTLIER',
                    column='humidity',
                    sensor_id=str(row.get('sensor_id', 'UNKNOWN')),
                    message=f"湿度值 {val} 超出有效范围 [{hum_min}, {hum_max}]",
                    value=val,
                    severity='MEDIUM',
                    action='MARK'
                ))
                
                if idx in df.index:
                    df.at[idx, '_qc_flag'] = 'RANGE_OUTLIER'
        
        return issues
    
    def _check_statistical_outliers(self, df: pd.DataFrame) -> List[QCIssue]:
        issues = []
        
        for metric in ['temperature', 'humidity']:
            if metric not in df.columns:
                continue
            
            if 'sensor_id' not in df.columns:
                continue
            
            for sensor_id in df['sensor_id'].dropna().unique():
                sensor_mask = df['sensor_id'] == sensor_id
                sensor_data = df.loc[sensor_mask, metric].dropna()
                
                if len(sensor_data) < 10:
                    continue
                
                q1 = sensor_data.quantile(0.25)
                q3 = sensor_data.quantile(0.75)
                iqr = q3 - q1
                iqr_threshold = self.config.iqr_multiplier
                
                lower_bound = q1 - iqr_threshold * iqr
                upper_bound = q3 + iqr_threshold * iqr
                
                outlier_mask = (df[metric] < lower_bound) | (df[metric] > upper_bound)
                outlier_mask = outlier_mask & sensor_mask & df[metric].notna()
                
                for idx in df[outlier_mask].index.tolist():
                    val = df.at[idx, metric]
                    issues.append(QCIssue(
                        index=int(idx),
                        issue_type='STATISTICAL_OUTLIER',
                        column=metric,
                        sensor_id=str(sensor_id),
                        message=f"{metric}值 {val} 为统计异常值 (IQR: [{lower_bound:.2f}, {upper_bound:.2f}])",
                        value=val,
                        severity='LOW',
                        action='MARK'
                    ))
        
        return issues
    
    def _check_temporal_breaks(self, df: pd.DataFrame) -> List[QCIssue]:
        issues = []
        
        if 'timestamp' not in df.columns or 'sensor_id' not in df.columns:
            return issues
        
        for sensor_id in df['sensor_id'].dropna().unique():
            sensor_mask = df['sensor_id'] == sensor_id
            sensor_data = df.loc[sensor_mask].sort_values('timestamp')
            
            if len(sensor_data) < 2:
                continue
            
            for metric in ['temperature', 'humidity']:
                if metric not in sensor_data.columns:
                    continue
                
                threshold = (self.config.temperature_delta_threshold 
                           if metric == 'temperature' 
                           else self.config.humidity_delta_threshold)
                
                values = sensor_data[metric].values
                timestamps = sensor_data['timestamp'].values
                indices = sensor_data.index.values
                
                for i in range(1, len(sensor_data)):
                    prev_val = values[i-1]
                    curr_val = values[i]
                    
                    if pd.isna(prev_val) or pd.isna(curr_val):
                        continue
                    
                    time_diff = (timestamps[i] - timestamps[i-1]).astype('timedelta64[h]').astype(float)
                    
                    if time_diff <= 0:
                        continue
                    
                    delta = abs(curr_val - prev_val)
                    
                    if delta > threshold * max(1, time_diff / 24):
                        idx = indices[i]
                        row = df.loc[idx]
                        issues.append(QCIssue(
                            index=int(idx),
                            issue_type='TEMPORAL_BREAK',
                            column=metric,
                            sensor_id=str(sensor_id),
                            message=f"{metric}在时间点突变，变化值: {delta:.2f} (阈值: {threshold:.2f}/24h)",
                            value={'delta': delta, 'threshold': threshold},
                            severity='LOW',
                            action='REVIEW'
                        ))
        
        return issues
    
    def _compile_results(self, df: pd.DataFrame, issues: List[QCIssue]) -> QCResult:
        statistics = {
            'missing_values': len([i for i in issues if i.issue_type == 'MISSING_VALUE']),
            'duplicates': len([i for i in issues if i.issue_type == 'DUPLICATE_RECORD']),
            'range_outliers': len([i for i in issues if i.issue_type == 'RANGE_OUTLIER']),
            'statistical_outliers': len([i for i in issues if i.issue_type == 'STATISTICAL_OUTLIER']),
            'temporal_breaks': len([i for i in issues if i.issue_type == 'TEMPORAL_BREAK']),
        }
        
        total = len(df)
        critical_issues = len([i for i in issues if i.severity == 'HIGH'])
        valid = total - critical_issues
        invalid = critical_issues
        
        if total == 0:
            quality_score = 0.0
        else:
            weight_missing = 3.0 if 'sensor_id' in df.columns or 'timestamp' in df.columns else 1.0
            weight_duplicate = 2.0
            weight_range = 1.0
            weight_statistical = 0.5
            weight_temporal = 0.3
            
            total_weight = (
                statistics['missing_values'] * weight_missing +
                statistics['duplicates'] * weight_duplicate +
                statistics['range_outliers'] * weight_range +
                statistics['statistical_outliers'] * weight_statistical +
                statistics['temporal_breaks'] * weight_temporal
            )
            
            penalty = min(1.0, total_weight / (total * 2.0) if total > 0 else 1.0)
            quality_score = max(0.0, 100.0 * (1.0 - penalty))
        
        return QCResult(
            total_records=total,
            valid_records=valid,
            invalid_records=invalid,
            issues=issues,
            statistics=statistics,
            quality_score=quality_score
        )
    
    def get_valid_data(self, df: pd.DataFrame, qc_result: QCResult) -> pd.DataFrame:
        df = df.copy()
        
        if '_is_valid' not in df.columns:
            df['_is_valid'] = True
        
        for issue in qc_result.issues:
            if issue.action in ['EXCLUDE', 'REMOVE'] and issue.index < len(df):
                df.at[issue.index, '_is_valid'] = False
        
        valid_mask = df['_is_valid'].fillna(True)
        return df[valid_mask]
