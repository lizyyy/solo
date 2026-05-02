"""指标计算模块 - 温度统计、开门统计、批次暴露时长等核心指标计算"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from collections import defaultdict

from .data_parser import (
    TemperatureRecord, DoorEvent, CalibrationRecord, BatchRecord
)


@dataclass
class TemperatureMetrics:
    """温度指标统计"""
    device_id: str
    total_records: int
    valid_records: int
    missing_records: int
    
    min_temp: float
    max_temp: float
    mean_temp: float
    median_temp: float
    std_temp: float
    
    temp_range: float
    fluctuation_rate: float
    
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_hours: float = 0.0
    
    percentiles: Dict[int, float] = field(default_factory=dict)
    hourly_stats: Dict[str, Dict] = field(default_factory=dict)


@dataclass
class DoorMetrics:
    """开门事件指标统计"""
    device_id: str
    total_openings: int
    total_duration_seconds: float
    avg_duration_seconds: float
    max_duration_seconds: float
    min_duration_seconds: float
    
    openings_by_hour: Dict[int, int] = field(default_factory=dict)
    long_openings_count: int = 0
    avg_time_between_openings_minutes: float = 0.0


@dataclass
class BatchExposureMetrics:
    """批次暴露指标"""
    batch_id: str
    product_name: str
    device_id: str
    
    total_exposure_duration_seconds: float
    exposure_during_open_doors_seconds: float
    exposure_during_temperature_anomalies_seconds: float
    
    start_time: datetime
    end_time: datetime
    
    door_events_overlap: int = 0
    temperature_anomalies_overlap: int = 0
    risk_level: str = "normal"


class MetricsCalculator:
    """指标计算器"""
    
    def __init__(self):
        pass
    
    def calculate_temperature_metrics(
        self, 
        record: TemperatureRecord,
        hourly_agg: bool = True
    ) -> TemperatureMetrics:
        """计算温度统计指标"""
        temps = record.temperatures
        timestamps = record.timestamps
        
        valid_mask = temps.notna()
        valid_temps = temps[valid_mask]
        
        if len(valid_temps) == 0:
            return TemperatureMetrics(
                device_id=record.device_id,
                total_records=len(temps),
                valid_records=0,
                missing_records=len(temps),
                min_temp=np.nan,
                max_temp=np.nan,
                mean_temp=np.nan,
                median_temp=np.nan,
                std_temp=np.nan,
                temp_range=np.nan,
                fluctuation_rate=np.nan
            )
        
        min_temp = float(valid_temps.min())
        max_temp = float(valid_temps.max())
        mean_temp = float(valid_temps.mean())
        median_temp = float(valid_temps.median())
        std_temp = float(valid_temps.std())
        
        temp_range = max_temp - min_temp
        
        if mean_temp != 0:
            fluctuation_rate = (std_temp / abs(mean_temp)) * 100
        else:
            fluctuation_rate = 0.0
        
        percentiles = {}
        for p in [25, 50, 75, 90, 95, 99]:
            try:
                percentiles[p] = float(np.percentile(valid_temps, p))
            except Exception:
                percentiles[p] = np.nan
        
        hourly_stats = {}
        if hourly_agg and len(timestamps) > 0:
            df = pd.DataFrame({
                'timestamp': timestamps,
                'temperature': temps
            })
            df = df.dropna()
            
            if not df.empty:
                df['hour'] = df['timestamp'].dt.floor('h')
                hourly_groups = df.groupby('hour')
                
                for hour, group in hourly_groups:
                    hourly_stats[str(hour)] = {
                        'min': float(group['temperature'].min()),
                        'max': float(group['temperature'].max()),
                        'mean': float(group['temperature'].mean()),
                        'count': int(len(group))
                    }
        
        duration_hours = 0.0
        if record.start_time and record.end_time:
            duration_hours = (record.end_time - record.start_time).total_seconds() / 3600
        
        return TemperatureMetrics(
            device_id=record.device_id,
            total_records=len(temps),
            valid_records=int(valid_mask.sum()),
            missing_records=int((~valid_mask).sum()),
            min_temp=min_temp,
            max_temp=max_temp,
            mean_temp=mean_temp,
            median_temp=median_temp,
            std_temp=std_temp,
            temp_range=temp_range,
            fluctuation_rate=fluctuation_rate,
            start_time=record.start_time,
            end_time=record.end_time,
            duration_hours=duration_hours,
            percentiles=percentiles,
            hourly_stats=hourly_stats
        )
    
    def calculate_door_metrics(
        self,
        device_id: str,
        door_events: List[DoorEvent],
        long_opening_threshold_seconds: float = 180.0
    ) -> DoorMetrics:
        """计算开门事件指标"""
        device_events = [e for e in door_events if e.device_id == device_id]
        
        if not device_events:
            return DoorMetrics(
                device_id=device_id,
                total_openings=0,
                total_duration_seconds=0.0,
                avg_duration_seconds=0.0,
                max_duration_seconds=0.0,
                min_duration_seconds=0.0
            )
        
        durations = []
        for event in device_events:
            if event.close_time:
                dur = (event.close_time - event.open_time).total_seconds()
                durations.append(dur)
            elif event.duration_seconds:
                durations.append(event.duration_seconds)
        
        if not durations:
            durations = [0.0]
        
        total_duration = sum(durations)
        avg_duration = total_duration / len(durations) if durations else 0.0
        max_duration = max(durations) if durations else 0.0
        min_duration = min(durations) if durations else 0.0
        
        openings_by_hour = defaultdict(int)
        for event in device_events:
            hour = event.open_time.hour
            openings_by_hour[hour] += 1
        
        long_openings = sum(1 for d in durations if d > long_opening_threshold_seconds)
        
        avg_time_between = 0.0
        if len(device_events) > 1:
            sorted_events = sorted(device_events, key=lambda e: e.open_time)
            intervals = []
            for i in range(1, len(sorted_events)):
                interval = (sorted_events[i].open_time - sorted_events[i-1].open_time).total_seconds()
                intervals.append(interval)
            if intervals:
                avg_time_between = (sum(intervals) / len(intervals)) / 60
        
        return DoorMetrics(
            device_id=device_id,
            total_openings=len(device_events),
            total_duration_seconds=total_duration,
            avg_duration_seconds=avg_duration,
            max_duration_seconds=max_duration,
            min_duration_seconds=min_duration,
            openings_by_hour=dict(openings_by_hour),
            long_openings_count=long_openings,
            avg_time_between_openings_minutes=avg_time_between
        )
    
    def calculate_batch_exposure(
        self,
        batch: BatchRecord,
        temperature_records: Dict[str, TemperatureRecord],
        door_events: List[DoorEvent],
        temperature_anomalies: List[Dict] = None
    ) -> BatchExposureMetrics:
        """计算批次暴露指标"""
        device_id = batch.device_id
        record = temperature_records.get(device_id)
        
        total_exposure = (batch.end_time - batch.start_time).total_seconds()
        
        door_overlap_seconds = 0.0
        door_overlap_count = 0
        
        for event in door_events:
            if event.device_id != device_id:
                continue
            
            event_start = event.open_time
            if event.close_time:
                event_end = event.close_time
            elif event.duration_seconds:
                event_end = event_start + timedelta(seconds=event.duration_seconds)
            else:
                continue
            
            overlap_start = max(batch.start_time, event_start)
            overlap_end = min(batch.end_time, event_end)
            
            if overlap_start < overlap_end:
                door_overlap_seconds += (overlap_end - overlap_start).total_seconds()
                door_overlap_count += 1
        
        temp_anomaly_overlap_seconds = 0.0
        temp_anomaly_overlap_count = 0
        
        if temperature_anomalies:
            for anomaly in temperature_anomalies:
                if anomaly.get('device_id') != device_id:
                    continue
                
                anomaly_start = anomaly.get('start_time')
                anomaly_end = anomaly.get('end_time')
                
                if not anomaly_start or not anomaly_end:
                    continue
                
                overlap_start = max(batch.start_time, anomaly_start)
                overlap_end = min(batch.end_time, anomaly_end)
                
                if overlap_start < overlap_end:
                    temp_anomaly_overlap_seconds += (overlap_end - overlap_start).total_seconds()
                    temp_anomaly_overlap_count += 1
        
        risk_level = "normal"
        risk_factors = 0
        
        if door_overlap_seconds > 300:
            risk_factors += 1
        if temp_anomaly_overlap_seconds > 300:
            risk_factors += 1
        if door_overlap_count > 3:
            risk_factors += 1
        
        if risk_factors >= 3:
            risk_level = "high"
        elif risk_factors >= 1:
            risk_level = "medium"
        
        return BatchExposureMetrics(
            batch_id=batch.batch_id,
            product_name=batch.product_name,
            device_id=device_id,
            total_exposure_duration_seconds=total_exposure,
            exposure_during_open_doors_seconds=door_overlap_seconds,
            exposure_during_temperature_anomalies_seconds=temp_anomaly_overlap_seconds,
            start_time=batch.start_time,
            end_time=batch.end_time,
            door_events_overlap=door_overlap_count,
            temperature_anomalies_overlap=temp_anomaly_overlap_count,
            risk_level=risk_level
        )
    
    def calculate_all_metrics(
        self,
        parsed_data: Dict,
        anomalies: List[Dict] = None
    ) -> Dict[str, Any]:
        """计算所有指标"""
        temp_records = parsed_data.get('temperature_records', {})
        door_events = parsed_data.get('door_events', [])
        batch_records = parsed_data.get('batch_records', [])
        
        temperature_metrics = {}
        for device_id, record in temp_records.items():
            temperature_metrics[device_id] = self.calculate_temperature_metrics(record)
        
        door_metrics = {}
        device_ids = set(temp_records.keys())
        device_ids.update([e.device_id for e in door_events])
        
        for device_id in device_ids:
            door_metrics[device_id] = self.calculate_door_metrics(device_id, door_events)
        
        batch_metrics = {}
        for batch in batch_records:
            batch_metrics[batch.batch_id] = self.calculate_batch_exposure(
                batch, temp_records, door_events, anomalies
            )
        
        return {
            'temperature_metrics': temperature_metrics,
            'door_metrics': door_metrics,
            'batch_metrics': batch_metrics
        }
    
    def rank_devices(
        self,
        temperature_metrics: Dict[str, TemperatureMetrics],
        door_metrics: Dict[str, DoorMetrics],
        anomaly_counts: Dict[str, int] = None
    ) -> pd.DataFrame:
        """设备综合排行"""
        anomaly_counts = anomaly_counts or {}
        
        rows = []
        for device_id in set(list(temperature_metrics.keys()) + list(door_metrics.keys())):
            temp_m = temperature_metrics.get(device_id)
            door_m = door_metrics.get(device_id)
            
            score = 100.0
            issues = []
            
            if temp_m:
                if temp_m.fluctuation_rate > 10:
                    score -= 15
                    issues.append(f"温度波动大({temp_m.fluctuation_rate:.1f}%)")
                
                if temp_m.missing_records > temp_m.total_records * 0.1:
                    score -= 10
                    issues.append(f"数据缺失较多({temp_m.missing_records}条)")
                
                if temp_m.std_temp > 2.0:
                    score -= 10
                    issues.append(f"温度标准差大({temp_m.std_temp:.2f}°C)")
            
            if door_m:
                if door_m.long_openings_count > 2:
                    score -= 15
                    issues.append(f"长时间开门({door_m.long_openings_count}次)")
                
                if door_m.total_openings > 10:
                    score -= 5
                    issues.append(f"开门频繁({door_m.total_openings}次)")
            
            anomaly_count = anomaly_counts.get(device_id, 0)
            if anomaly_count > 0:
                score -= min(anomaly_count * 5, 30)
                issues.append(f"异常事件({anomaly_count}次)")
            
            rows.append({
                'device_id': device_id,
                'score': max(0, score),
                'issues_count': len(issues),
                'issues': '; '.join(issues) if issues else '无',
                'fluctuation_rate': temp_m.fluctuation_rate if temp_m else None,
                'total_openings': door_m.total_openings if door_m else 0,
                'anomaly_count': anomaly_count
            })
        
        df = pd.DataFrame(rows)
        df = df.sort_values('score', ascending=False).reset_index(drop=True)
        df['rank'] = df.index + 1
        
        return df
