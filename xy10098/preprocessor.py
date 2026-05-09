import pandas as pd
import numpy as np
from datetime import datetime
from config import VALID_UNITS


class DataPreprocessor:
    def __init__(self):
        self.failed_records = []
    
    def preprocess(self, df):
        result = {
            'original_count': len(df),
            'valid_count': 0,
            'failed_count': 0,
            'failed_records': [],
            'processed_data': None,
            'statistics': {}
        }
        
        df = df.copy()
        initial_count = len(df)
        
        df, duplicates_removed = self._remove_duplicates(df)
        result['statistics']['duplicates_removed'] = duplicates_removed
        
        df, timestamp_failed = self._process_timestamps(df)
        self.failed_records.extend(timestamp_failed)
        result['statistics']['timestamp_failed'] = len(timestamp_failed)
        
        df, unit_failed = self._process_units(df)
        self.failed_records.extend(unit_failed)
        result['statistics']['unit_failed'] = len(unit_failed)
        
        df, missing_failed = self._handle_missing_data(df)
        self.failed_records.extend(missing_failed)
        result['statistics']['missing_values_failed'] = len(missing_failed)
        
        result['valid_count'] = len(df)
        result['failed_count'] = len(self.failed_records)
        result['failed_records'] = self.failed_records
        result['processed_data'] = df
        
        return result
    
    def _remove_duplicates(self, df):
        initial_count = len(df)
        df = df.drop_duplicates()
        duplicates_removed = initial_count - len(df)
        return df, duplicates_removed
    
    def _process_timestamps(self, df):
        failed = []
        valid_indices = []
        
        for idx, row in df.iterrows():
            try:
                if pd.isna(row.get('timestamp')):
                    failed.append({
                        'index': idx,
                        'data': row.to_dict(),
                        'reason': '时间戳缺失',
                        'category': 'timestamp'
                    })
                    continue
                
                ts = pd.to_datetime(row['timestamp'], errors='coerce')
                if pd.isna(ts):
                    failed.append({
                        'index': idx,
                        'data': row.to_dict(),
                        'reason': f'时间戳格式无效: {row["timestamp"]}',
                        'category': 'timestamp'
                    })
                    continue
                
                valid_indices.append(idx)
            except Exception as e:
                failed.append({
                    'index': idx,
                    'data': row.to_dict(),
                    'reason': f'时间戳处理异常: {str(e)}',
                    'category': 'timestamp'
                })
        
        df_valid = df.loc[valid_indices].copy()
        if 'timestamp' in df_valid.columns:
            df_valid['timestamp'] = pd.to_datetime(df_valid['timestamp'])
            df_valid = df_valid.sort_values('timestamp').reset_index(drop=True)
        
        return df_valid, failed
    
    def _process_units(self, df):
        failed = []
        valid_indices = []
        
        for idx, row in df.iterrows():
            try:
                unit = str(row.get('unit', '')).strip()
                
                if not unit:
                    valid_indices.append(idx)
                    continue
                
                is_valid = False
                for _, valid_list in VALID_UNITS.items():
                    if unit.lower() in [u.lower() for u in valid_list]:
                        is_valid = True
                        break
                
                if not is_valid:
                    failed.append({
                        'index': idx,
                        'data': row.to_dict(),
                        'reason': f'单位不支持: {unit}',
                        'category': 'unit'
                    })
                    continue
                
                if unit.lower() in ['°f', 'f', 'fahrenheit']:
                    if 'temperature' in df.columns and pd.notna(row['temperature']):
                        df.loc[idx, 'temperature'] = (row['temperature'] - 32) * 5/9
                        df.loc[idx, 'unit'] = '°C'
                
                valid_indices.append(idx)
            except Exception as e:
                failed.append({
                    'index': idx,
                    'data': row.to_dict(),
                    'reason': f'单位处理异常: {str(e)}',
                    'category': 'unit'
                })
        
        return df.loc[valid_indices].copy(), failed
    
    def _handle_missing_data(self, df):
        failed = []
        valid_indices = []
        
        for idx, row in df.iterrows():
            try:
                humidity = row.get('humidity')
                temperature = row.get('temperature')
                timestamp = row.get('timestamp')
                
                if pd.isna(humidity):
                    failed.append({
                        'index': idx,
                        'data': row.to_dict(),
                        'reason': '湿度数据缺失',
                        'category': 'missing_data'
                    })
                    continue
                
                valid_indices.append(idx)
            except Exception as e:
                failed.append({
                    'index': idx,
                    'data': row.to_dict(),
                    'reason': f'缺失值处理异常: {str(e)}',
                    'category': 'missing_data'
                })
        
        return df.loc[valid_indices].copy(), failed
