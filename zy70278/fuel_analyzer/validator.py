import pandas as pd
from typing import List, Tuple, Dict, Any
from dataclasses import dataclass


@dataclass
class ValidationResult:
    valid_rows: pd.DataFrame
    invalid_rows: pd.DataFrame
    missing_column_records: List[Dict[str, Any]]
    duplicate_records: List[Dict[str, Any]]
    negative_value_records: List[Dict[str, Any]]
    
    @property
    def total_issues(self) -> int:
        return (
            len(self.missing_column_records) +
            len(self.duplicate_records) +
            len(self.negative_value_records)
        )


class DataValidator:
    """数据校验器"""
    
    def __init__(self):
        self.required_columns = [
            'record_id', 'vehicle_id', 'vehicle_type', 'plate_number',
            'date', 'fuel_consumption', 'route_mileage', 'load_weight',
            'idle_time', 'driver_name', 'route_name'
        ]
        
        self.numeric_columns = [
            'fuel_consumption', 'route_mileage', 'load_weight', 'idle_time'
        ]
    
    def validate(self, df: pd.DataFrame) -> ValidationResult:
        missing_issues = self._check_missing_columns(df)
        duplicate_issues, unique_df = self._check_duplicates(df)
        negative_issues = self._check_negative_values(unique_df)
        
        valid_mask = pd.Series(True, index=unique_df.index)
        invalid_indices = set()
        
        for issue in missing_issues:
            invalid_indices.add(issue['row_index'])
            valid_mask.loc[issue['row_index']] = False
        
        for issue in negative_issues:
            invalid_indices.add(issue['row_index'])
            valid_mask.loc[issue['row_index']] = False
        
        valid_df = unique_df[valid_mask].copy()
        invalid_df = unique_df[~valid_mask].copy()
        
        return ValidationResult(
            valid_rows=valid_df,
            invalid_rows=invalid_df,
            missing_column_records=missing_issues,
            duplicate_records=duplicate_issues,
            negative_value_records=negative_issues
        )
    
    def _check_missing_columns(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        issues = []
        
        for idx, row in df.iterrows():
            for col in self.required_columns:
                if col not in df.columns or pd.isna(row.get(col)):
                    issues.append({
                        'row_index': idx,
                        'record_id': row.get('record_id', 'Unknown'),
                        'missing_field': col,
                        'description': f"缺失关键字段: {col}"
                    })
        
        for col in self.numeric_columns:
            if col in df.columns:
                for idx, row in df.iterrows():
                    val = row.get(col)
                    if pd.isna(val) or (isinstance(val, str) and val.strip() == ''):
                        issues.append({
                            'row_index': idx,
                            'record_id': row.get('record_id', 'Unknown'),
                            'missing_field': col,
                            'description': f"数值字段缺失或为空: {col}"
                        })
        
        return issues
    
    def _check_duplicates(self, df: pd.DataFrame) -> Tuple[List[Dict[str, Any]], pd.DataFrame]:
        issues = []
        unique_df = df.copy()
        
        key_columns = ['vehicle_id', 'date', 'route_name']
        if all(col in df.columns for col in key_columns):
            duplicates = df[df.duplicated(subset=key_columns, keep=False)]
            
            if not duplicates.empty:
                duplicate_groups = duplicates.groupby(key_columns)
                
                for group_keys, group in duplicate_groups:
                    if len(group) > 1:
                        first_idx = group.index[0]
                        duplicate_indices = group.index[1:].tolist()
                        
                        for dup_idx in duplicate_indices:
                            issues.append({
                                'row_index': dup_idx,
                                'record_id': df.at[dup_idx, 'record_id'],
                                'original_record_id': df.at[first_idx, 'record_id'],
                                'duplicate_keys': {k: v for k, v in zip(key_columns, group_keys)},
                                'description': f"重复数据: 与记录 {df.at[first_idx, 'record_id']} 重复"
                            })
                        
                        unique_df = unique_df.drop(duplicate_indices)
        
        return issues, unique_df
    
    def _check_negative_values(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        issues = []
        
        for col in self.numeric_columns:
            if col in df.columns:
                for idx, row in df.iterrows():
                    val = row.get(col)
                    if pd.notna(val) and isinstance(val, (int, float)) and val < 0:
                        issues.append({
                            'row_index': idx,
                            'record_id': row.get('record_id', 'Unknown'),
                            'field': col,
                            'value': val,
                            'description': f"数值异常: {col} = {val} (不能为负数)"
                        })
        
        return issues