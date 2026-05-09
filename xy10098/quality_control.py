import pandas as pd
import numpy as np
from config import (
    TEMPERATURE_MIN, TEMPERATURE_MAX,
    HUMIDITY_MIN, HUMIDITY_MAX
)


class QualityControl:
    def __init__(self):
        self.quality_issues = []
        self.passed_data = None
        self.failed_data = []
        
    def run_qc(self, df):
        if df is None or len(df) == 0:
            return {
                'passed_count': 0,
                'failed_count': 0,
                'passed_data': pd.DataFrame(),
                'failed_records': [],
                'quality_report': {}
            }
        
        df = df.copy()
        initial_count = len(df)
        
        df, failed_range = self._check_range_validation(df)
        df, failed_anomaly = self._check_anomalies(df)
        df, failed_consistency = self._check_consistency(df)
        
        all_failed = failed_range + failed_anomaly + failed_consistency
        
        report = {
            'total_samples': initial_count,
            'passed_samples': len(df),
            'failed_samples': len(all_failed),
            'range_failures': len(failed_range),
            'anomaly_failures': len(failed_anomaly),
            'consistency_failures': len(failed_consistency),
            'pass_rate': len(df) / initial_count if initial_count > 0 else 0
        }
        
        return {
            'passed_count': len(df),
            'failed_count': len(all_failed),
            'passed_data': df,
            'failed_records': all_failed,
            'quality_report': report
        }
    
    def _check_range_validation(self, df):
        failed = []
        valid_indices = []
        
        for idx, row in df.iterrows():
            issues = []
            
            humidity = row.get('humidity')
            if pd.notna(humidity):
                if humidity < HUMIDITY_MIN or humidity > HUMIDITY_MAX:
                    issues.append(f'湿度超出范围: {humidity}% (有效范围: {HUMIDITY_MIN}-{HUMIDITY_MAX}%)')
            
            temperature = row.get('temperature')
            if pd.notna(temperature):
                if temperature < TEMPERATURE_MIN or temperature > TEMPERATURE_MAX:
                    issues.append(f'温度超出范围: {temperature}°C (有效范围: {TEMPERATURE_MIN}-{TEMPERATURE_MAX}°C)')
            
            if issues:
                failed.append({
                    'index': idx,
                    'data': row.to_dict(),
                    'reason': '; '.join(issues),
                    'category': 'range_validation'
                })
            else:
                valid_indices.append(idx)
        
        return df.loc[valid_indices].copy(), failed
    
    def _check_anomalies(self, df):
        failed = []
        valid_indices = []
        
        if len(df) < 5:
            return df, []
        
        humidity_mean = df['humidity'].mean()
        humidity_std = df['humidity'].std()
        z_threshold = 3.0
        
        temp_mean = df['temperature'].mean()
        temp_std = df['temperature'].std()
        
        for idx, row in df.iterrows():
            issues = []
            
            humidity = row.get('humidity')
            if pd.notna(humidity) and humidity_std > 0:
                z_score = (humidity - humidity_mean) / humidity_std
                if abs(z_score) > z_threshold:
                    issues.append(f'湿度异常值 (Z分数: {z_score:.2f})')
            
            temperature = row.get('temperature')
            if pd.notna(temperature) and temp_std > 0:
                z_score = (temperature - temp_mean) / temp_std
                if abs(z_score) > z_threshold:
                    issues.append(f'温度异常值 (Z分数: {z_score:.2f})')
            
            if issues:
                failed.append({
                    'index': idx,
                    'data': row.to_dict(),
                    'reason': '; '.join(issues),
                    'category': 'anomaly_detection'
                })
            else:
                valid_indices.append(idx)
        
        return df.loc[valid_indices].copy(), failed
    
    def _check_consistency(self, df):
        failed = []
        valid_indices = []
        
        if len(df) < 2:
            return df, []
        
        df_sorted = df.sort_values('timestamp')
        df_sorted['humidity_change'] = df_sorted['humidity'].diff().abs()
        df_sorted['temp_change'] = df_sorted['temperature'].diff().abs()
        
        max_humidity_change = 20.0
        max_temp_change = 10.0
        
        for idx, row in df_sorted.iterrows():
            issues = []
            
            if pd.notna(row.get('humidity_change')):
                if row['humidity_change'] > max_humidity_change:
                    issues.append(f'湿度骤变: {row["humidity_change"]:.2f}%')
            
            if pd.notna(row.get('temp_change')):
                if row['temp_change'] > max_temp_change:
                    issues.append(f'温度骤变: {row["temp_change"]:.2f}°C')
            
            if issues:
                failed.append({
                    'index': idx,
                    'data': row.to_dict(),
                    'reason': '; '.join(issues),
                    'category': 'consistency_check'
                })
            else:
                valid_indices.append(idx)
        
        return df_sorted.loc[valid_indices].copy().drop(columns=['humidity_change', 'temp_change'], errors='ignore'), failed
