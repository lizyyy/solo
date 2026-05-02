"""规则引擎模块 - 阈值检测、校准偏移、连续超温窗口、缺测规则"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict

from .data_parser import (
    TemperatureRecord, DoorEvent, CalibrationRecord, BatchRecord
)


class AnomalyType(Enum):
    """异常类型枚举"""
    OVER_TEMPERATURE = "over_temperature"
    UNDER_TEMPERATURE = "under_temperature"
    CONTINUOUS_OVERTEMP = "continuous_overtemp"
    CONTINUOUS_UNDERTEMP = "continuous_undertemp"
    MISSING_DATA = "missing_data"
    SENSOR_DRIFT = "sensor_drift"
    DOOR_OPEN_TOO_LONG = "door_open_too_long"
    RAPID_CHANGE = "rapid_change"


class AnomalySeverity(Enum):
    """异常严重程度"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class RuleConfig:
    """规则配置"""
    upper_temp_threshold: float = 8.0
    lower_temp_threshold: float = 2.0
    continuous_overtemp_window_minutes: int = 15
    continuous_undertemp_window_minutes: int = 15
    missing_data_threshold_minutes: int = 30
    rapid_change_threshold: float = 2.0
    long_door_opening_seconds: int = 180
    sensor_drift_threshold: float = 0.5


@dataclass
class AnomalySegment:
    """异常片段"""
    anomaly_id: str
    device_id: str
    anomaly_type: AnomalyType
    severity: AnomalySeverity
    
    start_time: datetime
    end_time: datetime
    duration_seconds: float
    
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    mean_value: Optional[float] = None
    
    related_events: List[Dict] = field(default_factory=list)
    description: str = ""
    
    reviewed: bool = False
    review_reason: str = ""
    review_notes: str = ""
    reviewed_by: str = ""
    reviewed_at: Optional[datetime] = None
    
    batch_overlaps: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict:
        return {
            'anomaly_id': self.anomaly_id,
            'device_id': self.device_id,
            'anomaly_type': self.anomaly_type.value,
            'severity': self.severity.value,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'duration_seconds': self.duration_seconds,
            'min_value': self.min_value,
            'max_value': self.max_value,
            'mean_value': self.mean_value,
            'related_events': self.related_events,
            'description': self.description,
            'reviewed': self.reviewed,
            'review_reason': self.review_reason,
            'review_notes': self.review_notes,
            'reviewed_by': self.reviewed_by,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'batch_overlaps': self.batch_overlaps
        }


class RulesEngine:
    """规则引擎 - 检测各类温度异常"""
    
    def __init__(self, config: Optional[RuleConfig] = None):
        self.config = config or RuleConfig()
        self._anomaly_counter = defaultdict(int)
    
    def set_config(self, **kwargs):
        """更新配置"""
        for key, value in kwargs.items():
            if hasattr(self.config, key):
                setattr(self.config, key, value)
    
    def apply_calibration_offset(
        self, 
        record: TemperatureRecord,
        calibration_records: List[CalibrationRecord]
    ) -> Tuple[pd.Series, float]:
        """应用校准偏移"""
        if not calibration_records:
            return record.temperatures.copy(), 0.0
        
        valid_cals = [c for c in calibration_records if c.is_valid]
        if not valid_cals:
            return record.temperatures.copy(), 0.0
        
        valid_cals.sort(key=lambda c: c.calibration_date, reverse=True)
        latest_cal = valid_cals[0]
        offset = latest_cal.offset_value
        
        calibrated_temps = record.temperatures + offset
        return calibrated_temps, offset
    
    def detect_threshold_anomalies(
        self,
        device_id: str,
        timestamps: pd.DatetimeIndex,
        temperatures: pd.Series,
        upper_threshold: Optional[float] = None,
        lower_threshold: Optional[float] = None
    ) -> List[AnomalySegment]:
        """检测阈值异常（瞬时超温/低温）"""
        upper = upper_threshold if upper_threshold is not None else self.config.upper_temp_threshold
        lower = lower_threshold if lower_threshold is not None else self.config.lower_temp_threshold
        
        anomalies = []
        
        over_mask = temperatures > upper
        under_mask = temperatures < lower
        
        def find_continuous_segments(mask: pd.Series, is_over: bool) -> List[Tuple[int, int]]:
            segments = []
            in_segment = False
            start_idx = None
            
            for i, val in enumerate(mask):
                if val and not in_segment:
                    in_segment = True
                    start_idx = i
                elif not val and in_segment:
                    if start_idx is not None:
                        segments.append((start_idx, i - 1))
                    in_segment = False
                    start_idx = None
            
            if in_segment and start_idx is not None:
                segments.append((start_idx, len(mask) - 1))
            
            return segments
        
        over_segments = find_continuous_segments(over_mask.values, True)
        for start_idx, end_idx in over_segments:
            seg_temps = temperatures.iloc[start_idx:end_idx+1]
            seg_times = timestamps[start_idx:end_idx+1]
            
            duration = (seg_times[-1] - seg_times[0]).total_seconds()
            
            severity = AnomalySeverity.LOW
            if seg_temps.max() > upper + 2:
                severity = AnomalySeverity.MEDIUM
            if seg_temps.max() > upper + 5:
                severity = AnomalySeverity.HIGH
            
            self._anomaly_counter[device_id] += 1
            anomaly = AnomalySegment(
                anomaly_id=f"{device_id}_over_{self._anomaly_counter[device_id]}",
                device_id=device_id,
                anomaly_type=AnomalyType.OVER_TEMPERATURE,
                severity=severity,
                start_time=seg_times[0],
                end_time=seg_times[-1],
                duration_seconds=duration,
                min_value=float(seg_temps.min()),
                max_value=float(seg_temps.max()),
                mean_value=float(seg_temps.mean()),
                description=f"超温: {seg_temps.max():.2f}°C > 阈值 {upper}°C, 持续 {duration/60:.1f}分钟"
            )
            anomalies.append(anomaly)
        
        under_segments = find_continuous_segments(under_mask.values, False)
        for start_idx, end_idx in under_segments:
            seg_temps = temperatures.iloc[start_idx:end_idx+1]
            seg_times = timestamps[start_idx:end_idx+1]
            
            duration = (seg_times[-1] - seg_times[0]).total_seconds()
            
            severity = AnomalySeverity.LOW
            if seg_temps.min() < lower - 2:
                severity = AnomalySeverity.MEDIUM
            if seg_temps.min() < lower - 5:
                severity = AnomalySeverity.HIGH
            
            self._anomaly_counter[device_id] += 1
            anomaly = AnomalySegment(
                anomaly_id=f"{device_id}_under_{self._anomaly_counter[device_id]}",
                device_id=device_id,
                anomaly_type=AnomalyType.UNDER_TEMPERATURE,
                severity=severity,
                start_time=seg_times[0],
                end_time=seg_times[-1],
                duration_seconds=duration,
                min_value=float(seg_temps.min()),
                max_value=float(seg_temps.max()),
                mean_value=float(seg_temps.mean()),
                description=f"低温: {seg_temps.min():.2f}°C < 阈值 {lower}°C, 持续 {duration/60:.1f}分钟"
            )
            anomalies.append(anomaly)
        
        return anomalies
    
    def detect_continuous_anomalies(
        self,
        device_id: str,
        timestamps: pd.DatetimeIndex,
        temperatures: pd.Series,
        threshold_anomalies: List[AnomalySegment]
    ) -> List[AnomalySegment]:
        """检测连续超温/低温异常"""
        anomalies = []
        
        over_window_seconds = self.config.continuous_overtemp_window_minutes * 60
        under_window_seconds = self.config.continuous_undertemp_window_minutes * 60
        
        for anomaly in threshold_anomalies:
            if anomaly.anomaly_type == AnomalyType.OVER_TEMPERATURE:
                if anomaly.duration_seconds >= over_window_seconds:
                    self._anomaly_counter[device_id] += 1
                    continuous_anomaly = AnomalySegment(
                        anomaly_id=f"{device_id}_cont_over_{self._anomaly_counter[device_id]}",
                        device_id=device_id,
                        anomaly_type=AnomalyType.CONTINUOUS_OVERTEMP,
                        severity=AnomalySeverity.CRITICAL,
                        start_time=anomaly.start_time,
                        end_time=anomaly.end_time,
                        duration_seconds=anomaly.duration_seconds,
                        min_value=anomaly.min_value,
                        max_value=anomaly.max_value,
                        mean_value=anomaly.mean_value,
                        description=f"连续超温: 持续 {anomaly.duration_seconds/60:.1f}分钟 >= 阈值 {over_window_seconds/60:.0f}分钟, 最高 {anomaly.max_value:.2f}°C"
                    )
                    anomalies.append(continuous_anomaly)
            
            elif anomaly.anomaly_type == AnomalyType.UNDER_TEMPERATURE:
                if anomaly.duration_seconds >= under_window_seconds:
                    self._anomaly_counter[device_id] += 1
                    continuous_anomaly = AnomalySegment(
                        anomaly_id=f"{device_id}_cont_under_{self._anomaly_counter[device_id]}",
                        device_id=device_id,
                        anomaly_type=AnomalyType.CONTINUOUS_UNDERTEMP,
                        severity=AnomalySeverity.CRITICAL,
                        start_time=anomaly.start_time,
                        end_time=anomaly.end_time,
                        duration_seconds=anomaly.duration_seconds,
                        min_value=anomaly.min_value,
                        max_value=anomaly.max_value,
                        mean_value=anomaly.mean_value,
                        description=f"连续低温: 持续 {anomaly.duration_seconds/60:.1f}分钟 >= 阈值 {under_window_seconds/60:.0f}分钟, 最低 {anomaly.min_value:.2f}°C"
                    )
                    anomalies.append(continuous_anomaly)
        
        return anomalies
    
    def detect_missing_data(
        self,
        device_id: str,
        timestamps: pd.DatetimeIndex,
        temperatures: pd.Series
    ) -> List[AnomalySegment]:
        """检测数据缺失异常"""
        anomalies = []
        
        threshold_seconds = self.config.missing_data_threshold_minutes * 60
        
        df = pd.DataFrame({
            'timestamp': timestamps,
            'temperature': temperatures
        })
        df = df.sort_values('timestamp')
        
        df['time_diff'] = df['timestamp'].diff()
        
        large_gaps = df[df['time_diff'] > pd.Timedelta(seconds=threshold_seconds)]
        
        for idx, row in large_gaps.iterrows():
            if idx == 0:
                continue
            
            prev_idx = idx - 1
            prev_time = df.iloc[prev_idx]['timestamp']
            current_time = row['timestamp']
            gap_seconds = row['time_diff'].total_seconds()
            
            self._anomaly_counter[device_id] += 1
            anomaly = AnomalySegment(
                anomaly_id=f"{device_id}_missing_{self._anomaly_counter[device_id]}",
                device_id=device_id,
                anomaly_type=AnomalyType.MISSING_DATA,
                severity=AnomalySeverity.MEDIUM,
                start_time=prev_time,
                end_time=current_time,
                duration_seconds=gap_seconds,
                description=f"数据缺失: 间隔 {gap_seconds/60:.1f}分钟 > 阈值 {threshold_seconds/60:.0f}分钟"
            )
            anomalies.append(anomaly)
        
        nan_mask = temperatures.isna()
        if nan_mask.any():
            nan_segments = []
            in_segment = False
            start_idx = None
            
            for i, is_nan in enumerate(nan_mask):
                if is_nan and not in_segment:
                    in_segment = True
                    start_idx = i
                elif not is_nan and in_segment:
                    if start_idx is not None:
                        nan_segments.append((start_idx, i - 1))
                    in_segment = False
                    start_idx = None
            
            if in_segment and start_idx is not None:
                nan_segments.append((start_idx, len(nan_mask) - 1))
            
            for start_idx, end_idx in nan_segments:
                seg_times = timestamps[start_idx:end_idx+1]
                if len(seg_times) >= 2:
                    duration = (seg_times[-1] - seg_times[0]).total_seconds()
                    
                    if duration >= threshold_seconds:
                        self._anomaly_counter[device_id] += 1
                        anomaly = AnomalySegment(
                            anomaly_id=f"{device_id}_missing_{self._anomaly_counter[device_id]}",
                            device_id=device_id,
                            anomaly_type=AnomalyType.MISSING_DATA,
                            severity=AnomalySeverity.MEDIUM,
                            start_time=seg_times[0],
                            end_time=seg_times[-1],
                            duration_seconds=duration,
                            description=f"数据缺失(NaN): 持续 {duration/60:.1f}分钟 > 阈值 {threshold_seconds/60:.0f}分钟"
                        )
                        anomalies.append(anomaly)
        
        return anomalies
    
    def detect_rapid_change(
        self,
        device_id: str,
        timestamps: pd.DatetimeIndex,
        temperatures: pd.Series
    ) -> List[AnomalySegment]:
        """检测温度快速变化"""
        anomalies = []
        
        threshold = self.config.rapid_change_threshold
        
        df = pd.DataFrame({
            'timestamp': timestamps,
            'temperature': temperatures
        }).dropna()
        
        if len(df) < 2:
            return anomalies
        
        df['temp_diff'] = df['temperature'].diff().abs()
        df['time_diff_min'] = df['timestamp'].diff().dt.total_seconds() / 60
        
        rapid_changes = df[
            (df['temp_diff'] > threshold) & 
            (df['time_diff_min'] <= 10)
        ]
        
        for idx, row in rapid_changes.iterrows():
            if idx == 0:
                continue
            
            prev_idx = idx - 1
            prev_time = df.iloc[prev_idx]['timestamp']
            current_time = row['timestamp']
            prev_temp = df.iloc[prev_idx]['temperature']
            current_temp = row['temperature']
            
            self._anomaly_counter[device_id] += 1
            anomaly = AnomalySegment(
                anomaly_id=f"{device_id}_rapid_{self._anomaly_counter[device_id]}",
                device_id=device_id,
                anomaly_type=AnomalyType.RAPID_CHANGE,
                severity=AnomalySeverity.MEDIUM,
                start_time=prev_time,
                end_time=current_time,
                duration_seconds=row['time_diff_min'] * 60,
                min_value=min(prev_temp, current_temp),
                max_value=max(prev_temp, current_temp),
                description=f"温度骤变: {row['temp_diff']:.2f}°C > 阈值 {threshold}°C, 时间间隔 {row['time_diff_min']:.1f}分钟"
            )
            anomalies.append(anomaly)
        
        return anomalies
    
    def detect_long_door_openings(
        self,
        device_id: str,
        door_events: List[DoorEvent]
    ) -> List[AnomalySegment]:
        """检测长时间开门事件"""
        anomalies = []
        
        threshold_seconds = self.config.long_door_opening_seconds
        
        device_events = [e for e in door_events if e.device_id == device_id]
        
        for event in device_events:
            duration = event.duration.total_seconds()
            
            if duration > threshold_seconds:
                self._anomaly_counter[device_id] += 1
                anomaly = AnomalySegment(
                    anomaly_id=f"{device_id}_door_{self._anomaly_counter[device_id]}",
                    device_id=device_id,
                    anomaly_type=AnomalyType.DOOR_OPEN_TOO_LONG,
                    severity=AnomalySeverity.MEDIUM,
                    start_time=event.open_time,
                    end_time=event.close_time or event.open_time,
                    duration_seconds=duration,
                    related_events=[{
                        'event_id': event.event_id,
                        'event_type': event.event_type,
                        'notes': event.notes
                    }],
                    description=f"长时间开门: 持续 {duration/60:.1f}分钟 > 阈值 {threshold_seconds/60:.0f}分钟"
                )
                anomalies.append(anomaly)
        
        return anomalies
    
    def run_all_checks(
        self,
        parsed_data: Dict,
        apply_calibration: bool = True
    ) -> Dict[str, Any]:
        """运行所有规则检查"""
        all_anomalies = []
        anomaly_stats = defaultdict(lambda: defaultdict(int))
        device_calibration_offsets = {}
        
        temp_records = parsed_data.get('temperature_records', {})
        door_events = parsed_data.get('door_events', [])
        calibration_records = parsed_data.get('calibration_records', {})
        batch_records = parsed_data.get('batch_records', [])
        
        for device_id, record in temp_records.items():
            temperatures = record.temperatures
            timestamps = record.timestamps
            
            offset = 0.0
            if apply_calibration and device_id in calibration_records:
                temperatures, offset = self.apply_calibration_offset(
                    record, calibration_records[device_id]
                )
                device_calibration_offsets[device_id] = offset
            
            threshold_anomalies = self.detect_threshold_anomalies(
                device_id, timestamps, temperatures
            )
            all_anomalies.extend(threshold_anomalies)
            for a in threshold_anomalies:
                anomaly_stats[device_id][a.anomaly_type.value] += 1
                anomaly_stats[device_id]['total'] += 1
            
            continuous_anomalies = self.detect_continuous_anomalies(
                device_id, timestamps, temperatures, threshold_anomalies
            )
            all_anomalies.extend(continuous_anomalies)
            for a in continuous_anomalies:
                anomaly_stats[device_id][a.anomaly_type.value] += 1
                anomaly_stats[device_id]['total'] += 1
            
            missing_anomalies = self.detect_missing_data(
                device_id, timestamps, temperatures
            )
            all_anomalies.extend(missing_anomalies)
            for a in missing_anomalies:
                anomaly_stats[device_id][a.anomaly_type.value] += 1
                anomaly_stats[device_id]['total'] += 1
            
            rapid_anomalies = self.detect_rapid_change(
                device_id, timestamps, temperatures
            )
            all_anomalies.extend(rapid_anomalies)
            for a in rapid_anomalies:
                anomaly_stats[device_id][a.anomaly_type.value] += 1
                anomaly_stats[device_id]['total'] += 1
            
            door_anomalies = self.detect_long_door_openings(device_id, door_events)
            all_anomalies.extend(door_anomalies)
            for a in door_anomalies:
                anomaly_stats[device_id][a.anomaly_type.value] += 1
                anomaly_stats[device_id]['total'] += 1
        
        for anomaly in all_anomalies:
            overlapping_batches = []
            for batch in batch_records:
                if batch.device_id != anomaly.device_id:
                    continue
                
                overlap_start = max(anomaly.start_time, batch.start_time)
                overlap_end = min(anomaly.end_time, batch.end_time)
                
                if overlap_start < overlap_end:
                    overlapping_batches.append(batch.batch_id)
            
            if overlapping_batches:
                anomaly.batch_overlaps = overlapping_batches
        
        anomaly_stats_dict = {k: dict(v) for k, v in anomaly_stats.items()}
        
        return {
            'anomalies': all_anomalies,
            'anomaly_stats': anomaly_stats_dict,
            'calibration_offsets': device_calibration_offsets,
            'config': self.config
        }
    
    def review_anomaly(
        self,
        anomaly: AnomalySegment,
        reason: str,
        notes: str = "",
        reviewed_by: str = ""
    ) -> AnomalySegment:
        """人工复核异常"""
        anomaly.reviewed = True
        anomaly.review_reason = reason
        anomaly.review_notes = notes
        anomaly.reviewed_by = reviewed_by
        anomaly.reviewed_at = datetime.now()
        return anomaly
