"""
数据加载和预处理模块
负责从CSV文件加载传感器数据并进行初步的格式转换
"""
from typing import Optional, Dict, List
from pathlib import Path
import pandas as pd
import numpy as np
from dataclasses import dataclass

from .config import AuditConfig


@dataclass
class LoadedData:
    """
    已加载数据容器
    """
    raw_data: pd.DataFrame
    processed_data: pd.DataFrame
    data_summary: Dict
    unit_conversions: Dict
    parsing_issues: List[Dict]
    
    @property
    def sensor_ids(self) -> List:
        return self.processed_data['sensor_id'].unique().tolist()
    
    @property
    def date_range(self) -> tuple:
        ts = self.processed_data['timestamp']
        return (ts.min(), ts.max())


class DataLoader:
    """
    数据加载器
    负责加载CSV数据、解析字段、处理单位转换
    """
    
    def __init__(self, config: AuditConfig):
        self.config = config
        self.loaded_data: Optional[LoadedData] = None
    
    def load_csv(self, file_path: str) -> LoadedData:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        raw_data = pd.read_csv(file_path, low_memory=False)
        
        processed_data, unit_conversions, parsing_issues = self._preprocess(raw_data.copy())
        
        data_summary = self._generate_summary(raw_data, processed_data)
        
        self.loaded_data = LoadedData(
            raw_data=raw_data,
            processed_data=processed_data,
            data_summary=data_summary,
            unit_conversions=unit_conversions,
            parsing_issues=parsing_issues
        )
        
        return self.loaded_data
    
    def _preprocess(self, df: pd.DataFrame) -> tuple:
        unit_conversions = {}
        parsing_issues = []
        
        df = self._rename_columns(df)
        
        if 'timestamp' in df.columns:
            df['timestamp'], ts_issues = self._parse_timestamps(df['timestamp'])
            parsing_issues.extend(ts_issues)
        
        if 'temperature' in df.columns:
            df['temperature'], temp_conv = self._normalize_temperature(df['temperature'])
            unit_conversions['temperature'] = temp_conv
        
        if 'humidity' in df.columns:
            df['humidity'], hum_conv = self._normalize_humidity(df['humidity'])
            unit_conversions['humidity'] = hum_conv
        
        for col in ['sensor_id', 'location', 'batch_id']:
            if col in df.columns:
                df[col] = df[col].astype(str).str.strip()
        
        return df, unit_conversions, parsing_issues
    
    def _rename_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        column_mapping = {
            'sensor': 'sensor_id',
            'sensorid': 'sensor_id',
            'id': 'sensor_id',
            'time': 'timestamp',
            'datetime': 'timestamp',
            '日期时间': 'timestamp',
            'temp': 'temperature',
            'temp_c': 'temperature',
            'temp_f': 'temperature',
            '温度': 'temperature',
            'hum': 'humidity',
            'humidity_rh': 'humidity',
            '相对湿度': 'humidity',
            '地点': 'location',
            'batch': 'batch_id',
            '批次': 'batch_id',
        }
        
        lower_cols = {c.lower(): c for c in df.columns}
        rename_dict = {}
        
        for src, dst in column_mapping.items():
            if src.lower() in lower_cols:
                rename_dict[lower_cols[src.lower()]] = dst
        
        return df.rename(columns=rename_dict)
    
    def _parse_timestamps(self, series: pd.Series) -> tuple:
        issues = []
        parsed = pd.to_datetime(
            series,
            format=self.config.timestamp_format,
            errors='coerce',
            utc=bool(self.config.timezone)
        )
        
        invalid_count = parsed.isna().sum()
        if invalid_count > 0:
            invalid_indices = series[parsed.isna()].head(10).index.tolist()
            issues.append({
                'type': 'timestamp_parse',
                'count': int(invalid_count),
                'example_indices': invalid_indices,
                'message': f"有 {invalid_count} 个时间戳无法解析"
            })
        
        return parsed, issues
    
    def _normalize_temperature(self, series: pd.Series) -> tuple:
        conversions = {'from_unit': None, 'to_unit': self.config.default_temperature_unit, 'converted': 0}
        
        numeric_series = pd.to_numeric(series, errors='coerce')
        
        if numeric_series.isna().sum() < len(series) * 0.5:
            return numeric_series, conversions
        
        conversions['from_unit'] = 'mixed'
        parsed_values = []
        
        for idx, val in series.items():
            if pd.isna(val):
                parsed_values.append(np.nan)
                continue
            
            val_str = str(val).strip()
            num_str = val_str
            unit = None
            
            if 'C' in val_str.upper():
                unit = 'C'
                num_str = val_str.upper().replace('C', '').replace('°', '').replace('摄氏度', '').strip()
            elif 'F' in val_str.upper():
                unit = 'F'
                num_str = val_str.upper().replace('F', '').replace('°', '').replace('华氏度', '').strip()
            
            try:
                num_val = float(num_str)
                if unit == 'F':
                    num_val = (num_val - 32) * 5 / 9
                    conversions['converted'] += 1
                parsed_values.append(num_val)
            except ValueError:
                parsed_values.append(np.nan)
        
        return pd.Series(parsed_values, index=series.index, dtype=float), conversions
    
    def _normalize_humidity(self, series: pd.Series) -> tuple:
        conversions = {'from_unit': None, 'to_unit': self.config.default_humidity_unit, 'converted': 0}
        
        numeric_series = pd.to_numeric(series, errors='coerce')
        
        if numeric_series.isna().sum() < len(series) * 0.5:
            return numeric_series, conversions
        
        parsed_values = []
        
        for idx, val in series.items():
            if pd.isna(val):
                parsed_values.append(np.nan)
                continue
            
            val_str = str(val).strip().replace('%', '').replace('RH', '').replace('rh', '').strip()
            
            try:
                num_val = float(val_str)
                parsed_values.append(num_val)
            except ValueError:
                parsed_values.append(np.nan)
        
        return pd.Series(parsed_values, index=series.index, dtype=float), conversions
    
    def _generate_summary(self, raw: pd.DataFrame, processed: pd.DataFrame) -> Dict:
        summary = {
            'raw_rows': len(raw),
            'raw_columns': len(raw.columns),
            'processed_rows': len(processed),
            'processed_columns': len(processed.columns),
            'sensor_count': processed['sensor_id'].nunique() if 'sensor_id' in processed.columns else 0,
            'location_count': processed['location'].nunique() if 'location' in processed.columns else 0,
            'batch_count': processed['batch_id'].nunique() if 'batch_id' in processed.columns else 0,
        }
        
        if 'timestamp' in processed.columns:
            valid_ts = processed['timestamp'].dropna()
            if len(valid_ts) > 0:
                summary['date_start'] = valid_ts.min().isoformat()
                summary['date_end'] = valid_ts.max().isoformat()
                summary['total_duration_days'] = (valid_ts.max() - valid_ts.min()).days
        
        return summary
    
    def get_loaded_data(self) -> Optional[LoadedData]:
        return self.loaded_data
