from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any
import pandas as pd


@dataclass
class WeatherRecord:
    timestamp: datetime
    site_id: str
    temperature: Optional[float] = None  # 摄氏度
    humidity: Optional[float] = None  # 百分比
    wind_speed: Optional[float] = None  # m/s
    wind_direction: Optional[float] = None  # 度
    rainfall: Optional[float] = None  # mm
    barometric_pressure: Optional[float] = None  # hPa
    is_missing: bool = False
    is_valid: bool = True
    validation_errors: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'timestamp': self.timestamp,
            'site_id': self.site_id,
            'temperature': self.temperature,
            'humidity': self.humidity,
            'wind_speed': self.wind_speed,
            'wind_direction': self.wind_direction,
            'rainfall': self.rainfall,
            'barometric_pressure': self.barometric_pressure,
            'is_missing': self.is_missing,
            'is_valid': self.is_valid,
            'validation_errors': self.validation_errors
        }


@dataclass
class WeatherData:
    site_id: str
    records: List[WeatherRecord]
    sampling_interval_seconds: int = 60  # 默认采样间隔1分钟
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __post_init__(self):
        if self.records:
            self.records.sort(key=lambda x: x.timestamp)
    
    @property
    def start_time(self) -> Optional[datetime]:
        if self.records:
            return self.records[0].timestamp
        return None
    
    @property
    def end_time(self) -> Optional[datetime]:
        if self.records:
            return self.records[-1].timestamp
        return None
    
    @property
    def total_records(self) -> int:
        return len(self.records)
    
    @property
    def valid_records(self) -> int:
        return sum(1 for r in self.records if r.is_valid)
    
    @property
    def missing_records(self) -> int:
        return sum(1 for r in self.records if r.is_missing)
    
    def get_dataframe(self) -> pd.DataFrame:
        if not self.records:
            return pd.DataFrame()
        
        data = []
        for rec in self.records:
            data.append({
                'timestamp': rec.timestamp,
                'site_id': rec.site_id,
                'temperature': rec.temperature,
                'humidity': rec.humidity,
                'wind_speed': rec.wind_speed,
                'wind_direction': rec.wind_direction,
                'rainfall': rec.rainfall,
                'barometric_pressure': rec.barometric_pressure,
                'is_missing': rec.is_missing,
                'is_valid': rec.is_valid
            })
        
        df = pd.DataFrame(data)
        if not df.empty:
            df = df.set_index('timestamp')
        return df
    
    def filter_by_time(self, start_time: datetime, end_time: datetime) -> 'WeatherData':
        filtered = [
            r for r in self.records
            if start_time <= r.timestamp <= end_time
        ]
        return WeatherData(
            site_id=self.site_id,
            records=filtered,
            sampling_interval_seconds=self.sampling_interval_seconds,
            metadata=self.metadata.copy()
        )
    
    def has_significant_weather(self, start_time: datetime, end_time: datetime) -> Dict[str, Any]:
        """检查指定时间段内是否有显著天气变化（可能影响噪声测量）"""
        filtered = self.filter_by_time(start_time, end_time)
        
        if not filtered.records:
            return {
                'has_significant_weather': False,
                'reason': '无天气数据'
            }
        
        wind_speeds = [r.wind_speed for r in filtered.records 
                       if r.is_valid and not r.is_missing and r.wind_speed is not None]
        rainfalls = [r.rainfall for r in filtered.records 
                     if r.is_valid and not r.is_missing and r.rainfall is not None]
        
        issues = []
        
        if wind_speeds:
            max_wind = max(wind_speeds)
            if max_wind > 10.0:  # 风速超过10m/s可能影响
                issues.append(f'强风 (最大: {max_wind:.1f} m/s)')
        
        if rainfalls:
            total_rain = sum(rainfalls)
            if total_rain > 0.5:  # 有降雨
                issues.append(f'降雨 (累计: {total_rain:.1f} mm)')
        
        return {
            'has_significant_weather': len(issues) > 0,
            'issues': issues,
            'max_wind_speed': max(wind_speeds) if wind_speeds else None,
            'total_rainfall': sum(rainfalls) if rainfalls else 0.0
        }
