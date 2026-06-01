import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional
from datetime import datetime, timedelta
from pathlib import Path
import sys
sys.path.append(str(Path(__file__).parent.parent))
from config import VALID_DIRECTIONS, WARNING_MESSAGES


class DataValidator:
    def __init__(self):
        self.warnings = []
        self.errors = []
        self.validation_report = {}
        
    def check_empty_values(self, df: pd.DataFrame) -> Dict:
        empty_mask = df.isnull().any(axis=1)
        empty_rows = df[empty_mask].index.tolist()
        empty_cols = df.columns[df.isnull().any()].tolist()
        
        result = {
            'has_empty': len(empty_rows) > 0,
            'empty_rows': empty_rows,
            'empty_columns': empty_cols,
            'empty_count': len(empty_rows)
        }
        
        if result['has_empty']:
            self.warnings.append({
                'type': 'empty_value',
                'message': WARNING_MESSAGES['empty_value'],
                'details': f"发现 {len(empty_rows)} 行空值，涉及列: {', '.join(empty_cols)}",
                'rows': empty_rows
            })
            
        return result
    
    def check_duplicates(self, df: pd.DataFrame) -> Dict:
        duplicate_mask = df.duplicated(keep=False)
        duplicate_rows = df[duplicate_mask].index.tolist()
        
        result = {
            'has_duplicates': len(duplicate_rows) > 0,
            'duplicate_rows': duplicate_rows,
            'duplicate_count': len(duplicate_rows)
        }
        
        if result['has_duplicates']:
            self.warnings.append({
                'type': 'duplicate_record',
                'message': WARNING_MESSAGES['duplicate_record'],
                'details': f"发现 {len(duplicate_rows)} 行重复记录",
                'rows': duplicate_rows
            })
            
        return result
    
    def check_direction(self, df: pd.DataFrame, direction_col: str) -> Dict:
        if direction_col not in df.columns:
            return {'valid': True, 'ambiguous_count': 0, 'ambiguous_values': []}
            
        directions = df[direction_col].astype(str).str.strip()
        ambiguous = directions[~directions.isin(VALID_DIRECTIONS) & (directions != '') & (directions != 'nan')]
        
        result = {
            'valid': len(ambiguous) == 0,
            'ambiguous_count': len(ambiguous),
            'ambiguous_values': ambiguous.unique().tolist()
        }
        
        if not result['valid']:
            self.warnings.append({
                'type': 'direction_ambiguous',
                'message': WARNING_MESSAGES['direction_ambiguous'],
                'details': f"无法识别的方向值: {', '.join(result['ambiguous_values'])}"
            })
            
        return result
    
    def check_time_series(self, df: pd.DataFrame, time_col: str, 
                          max_gap_minutes: int = 60) -> Dict:
        if time_col not in df.columns:
            return {'valid': True, 'gaps': [], 'out_of_order': False}
            
        try:
            times = pd.to_datetime(df[time_col])
        except:
            return {'valid': False, 'gaps': [], 'out_of_order': False, 'error': '时间格式无法解析'}
            
        time_diff = times.diff()
        gaps = []
        for i, diff in enumerate(time_diff[1:], 1):
            if diff > timedelta(minutes=max_gap_minutes):
                gaps.append({
                    'row': i,
                    'gap_minutes': diff.total_seconds() / 60,
                    'from_time': times.iloc[i-1],
                    'to_time': times.iloc[i]
                })
                
        out_of_order = (times.diff().dt.total_seconds() < 0).any()
        
        result = {
            'valid': len(gaps) == 0 and not out_of_order,
            'gaps': gaps,
            'out_of_order': out_of_order
        }
        
        if len(gaps) > 0:
            self.warnings.append({
                'type': 'time_gap',
                'message': WARNING_MESSAGES['time_gap'],
                'details': f"发现 {len(gaps)} 处时间间隔异常，最大间隔: {max(g['gap_minutes'] for g in gaps):.1f} 分钟"
            })
            
        if out_of_order:
            self.warnings.append({
                'type': 'time_out_of_order',
                'message': WARNING_MESSAGES['time_out_of_order'],
                'details': "记录未按时间顺序排列"
            })
            
        return result
    
    def check_boundary_values(self, df: pd.DataFrame, value_col: str,
                             min_value: float, max_value: float,
                             threshold_percent: float = 0.05) -> Dict:
        if value_col not in df.columns:
            return {'has_boundary': False, 'boundary_rows': []}
            
        values = pd.to_numeric(df[value_col], errors='coerce')
        threshold_range = (max_value - min_value) * threshold_percent
        
        near_min = values < (min_value + threshold_range)
        near_max = values > (max_value - threshold_range)
        boundary_mask = near_min | near_max
        
        boundary_rows = df[boundary_mask].index.tolist()
        boundary_details = []
        for idx in boundary_rows:
            val = values.iloc[idx]
            position = '接近最小值' if near_min.iloc[idx] else '接近最大值'
            boundary_details.append({
                'row': idx,
                'value': val,
                'position': position
            })
            
        result = {
            'has_boundary': len(boundary_rows) > 0,
            'boundary_rows': boundary_rows,
            'boundary_details': boundary_details
        }
        
        if result['has_boundary']:
            self.warnings.append({
                'type': 'boundary_value',
                'message': WARNING_MESSAGES['boundary_value'],
                'details': f"发现 {len(boundary_rows)} 条边界记录，范围: [{min_value}, {max_value}]",
                'rows': boundary_rows
            })
            
        return result
    
    def validate_all(self, df: pd.DataFrame, time_col: str = None, 
                     value_col: str = None, direction_col: str = None,
                     min_value: float = None, max_value: float = None) -> Dict:
        self.warnings = []
        self.errors = []
        
        report = {}
        
        report['empty_values'] = self.check_empty_values(df)
        report['duplicates'] = self.check_duplicates(df)
        
        if direction_col:
            report['direction'] = self.check_direction(df, direction_col)
            
        if time_col:
            report['time_series'] = self.check_time_series(df, time_col)
            
        if value_col and min_value is not None and max_value is not None:
            report['boundary'] = self.check_boundary_values(df, value_col, min_value, max_value)
            
        self.validation_report = report
        return report
    
    def get_warnings(self) -> List[Dict]:
        return self.warnings
    
    def has_warnings(self) -> bool:
        return len(self.warnings) > 0
