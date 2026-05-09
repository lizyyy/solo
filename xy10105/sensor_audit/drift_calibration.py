"""
漂移检测和校准模块
实现传感器长期漂移的检测和校准算法
"""
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
import pandas as pd
import numpy as np
from datetime import datetime
from scipy import stats
from enum import Enum

from .config import AuditConfig


class DriftStatus(Enum):
    """漂移状态"""
    NO_DRIFT = 'NO_DRIFT'
    LOW_DRIFT = 'LOW_DRIFT'
    MODERATE_DRIFT = 'MODERATE_DRIFT'
    SEVERE_DRIFT = 'SEVERE_DRIFT'


@dataclass
class DriftEvent:
    """
    漂移事件
    """
    sensor_id: str
    metric: str
    start_date: datetime
    end_date: datetime
    drift_magnitude: float
    drift_direction: str
    drift_rate: float
    status: DriftStatus
    window_start_idx: int
    window_end_idx: int
    baseline_mean: float
    current_mean: float
    p_value: Optional[float] = None


@dataclass
class CalibrationParameter:
    """
    校准参数
    """
    sensor_id: str
    metric: str
    slope: float
    intercept: float
    r_squared: float
    effective_date: datetime
    reference_value: float
    sensor_value: float
    confidence_interval: Optional[Tuple[float, float]] = None
    raw_model: Dict = field(default_factory=dict)


@dataclass
class DriftResult:
    """
    漂移分析结果
    """
    sensor_summary: Dict
    drift_events: List[DriftEvent]
    drift_statistics: Dict


@dataclass
class CalibrationResult:
    """
    校准结果
    """
    parameters: List[CalibrationParameter]
    calibrated_data: pd.DataFrame
    calibration_summary: Dict
    pre_calibration_stats: Dict
    post_calibration_stats: Dict


class DriftDetector:
    """
    漂移检测器
    检测传感器的长期漂移
    """
    
    def __init__(self, config: AuditConfig):
        self.config = config
    
    def detect_drift(self, df: pd.DataFrame) -> DriftResult:
        drift_events: List[DriftEvent] = []
        sensor_summary: Dict = {}
        
        if 'sensor_id' not in df.columns or 'timestamp' not in df.columns:
            return DriftResult(sensor_summary={}, drift_events=[], drift_statistics={})
        
        for sensor_id in df['sensor_id'].dropna().unique():
            sensor_mask = df['sensor_id'] == sensor_id
            sensor_data = df[sensor_mask].sort_values('timestamp').copy()
            
            if len(sensor_data) < self.config.drift_window_size * 2:
                sensor_summary[sensor_id] = {
                    'available': False,
                    'reason': f"数据量不足，需要至少 {self.config.drift_window_size * 2} 条记录"
                }
                continue
            
            sensor_summary[sensor_id] = {
                'available': True,
                'total_records': len(sensor_data),
                'temperature_drift': None,
                'humidity_drift': None,
            }
            
            for metric in ['temperature', 'humidity']:
                if metric not in sensor_data.columns:
                    continue
                
                events = self._detect_metric_drift(
                    sensor_data, 
                    sensor_id, 
                    metric
                )
                drift_events.extend(events)
                
                if events:
                    severity = max([e.status.value for e in events], key=lambda x: [
                        'NO_DRIFT', 'LOW_DRIFT', 'MODERATE_DRIFT', 'SEVERE_DRIFT'
                    ].index(x))
                    sensor_summary[sensor_id][f'{metric}_drift'] = {
                        'events_count': len(events),
                        'max_severity': severity,
                        'total_drift': sum([abs(e.drift_magnitude) for e in events])
                    }
        
        drift_statistics = self._calculate_drift_statistics(drift_events, df)
        
        return DriftResult(
            sensor_summary=sensor_summary,
            drift_events=drift_events,
            drift_statistics=drift_statistics
        )
    
    def _detect_metric_drift(
        self, 
        sensor_data: pd.DataFrame, 
        sensor_id: str, 
        metric: str
    ) -> List[DriftEvent]:
        events: List[DriftEvent] = []
        window_size = self.config.drift_window_size
        
        data = sensor_data[[metric, 'timestamp']].dropna()
        if len(data) < window_size * 2:
            return events
        
        values = data[metric].values
        timestamps = data['timestamp'].values
        
        baseline_window = values[:window_size]
        baseline_mean = np.mean(baseline_window)
        baseline_std = np.std(baseline_window) if len(baseline_window) > 1 else 1.0
        
        threshold = (self.config.drift_threshold_temp 
                    if metric == 'temperature' 
                    else self.config.drift_threshold_humidity)
        
        for i in range(window_size, len(values), window_size // 2):
            end_idx = min(i + window_size, len(values))
            current_window = values[i:end_idx]
            
            if len(current_window) < window_size // 2:
                continue
            
            current_mean = np.mean(current_window)
            drift_magnitude = current_mean - baseline_mean
            
            try:
                t_stat, p_value = stats.ttest_ind(
                    baseline_window, 
                    current_window,
                    equal_var=False
                )
            except:
                p_value = None
            
            if abs(drift_magnitude) >= threshold:
                relative_drift = abs(drift_magnitude) / (abs(baseline_mean) + 1e-10)
                
                if relative_drift < 0.05:
                    status = DriftStatus.LOW_DRIFT
                elif relative_drift < 0.15:
                    status = DriftStatus.MODERATE_DRIFT
                else:
                    status = DriftStatus.SEVERE_DRIFT
                
                start_ts = timestamps[i]
                end_ts = timestamps[end_idx - 1] if end_idx - 1 < len(timestamps) else timestamps[-1]
                
                time_diff_days = (end_ts - start_ts).astype('timedelta64[D]').astype(float)
                drift_rate = drift_magnitude / max(time_diff_days, 1)
                
                events.append(DriftEvent(
                    sensor_id=str(sensor_id),
                    metric=metric,
                    start_date=pd.Timestamp(start_ts).to_pydatetime(),
                    end_date=pd.Timestamp(end_ts).to_pydatetime(),
                    drift_magnitude=float(drift_magnitude),
                    drift_direction='UP' if drift_magnitude > 0 else 'DOWN',
                    drift_rate=float(drift_rate),
                    status=status,
                    window_start_idx=i,
                    window_end_idx=end_idx,
                    baseline_mean=float(baseline_mean),
                    current_mean=float(current_mean),
                    p_value=float(p_value) if p_value is not None else None
                ))
        
        return events
    
    def _calculate_drift_statistics(
        self, 
        events: List[DriftEvent], 
        df: pd.DataFrame
    ) -> Dict:
        stats_dict = {
            'total_events': len(events),
            'by_metric': {},
            'by_severity': {},
            'by_sensor': {},
            'avg_drift_magnitude': 0.0,
        }
        
        for event in events:
            metric = event.metric
            if metric not in stats_dict['by_metric']:
                stats_dict['by_metric'][metric] = {
                    'count': 0, 'total_drift': 0.0, 'avg_drift': 0.0
                }
            stats_dict['by_metric'][metric]['count'] += 1
            stats_dict['by_metric'][metric]['total_drift'] += abs(event.drift_magnitude)
            
            severity = event.status.value
            if severity not in stats_dict['by_severity']:
                stats_dict['by_severity'][severity] = 0
            stats_dict['by_severity'][severity] += 1
            
            sensor = event.sensor_id
            if sensor not in stats_dict['by_sensor']:
                stats_dict['by_sensor'][sensor] = {'count': 0, 'metrics': {}}
            stats_dict['by_sensor'][sensor]['count'] += 1
            if metric not in stats_dict['by_sensor'][sensor]['metrics']:
                stats_dict['by_sensor'][sensor]['metrics'][metric] = 0
            stats_dict['by_sensor'][sensor]['metrics'][metric] += 1
        
        for metric in stats_dict['by_metric']:
            if stats_dict['by_metric'][metric]['count'] > 0:
                stats_dict['by_metric'][metric]['avg_drift'] = (
                    stats_dict['by_metric'][metric]['total_drift'] / 
                    stats_dict['by_metric'][metric]['count']
                )
        
        if events:
            stats_dict['avg_drift_magnitude'] = sum(
                abs(e.drift_magnitude) for e in events
            ) / len(events)
        
        return stats_dict


class Calibrator:
    """
    校准器
    对漂移的传感器数据进行校准
    """
    
    def __init__(self, config: AuditConfig):
        self.config = config
    
    def calibrate(
        self, 
        df: pd.DataFrame, 
        drift_result: DriftResult,
        reference_sensor_id: Optional[str] = None
    ) -> CalibrationResult:
        df = df.copy()
        
        if 'sensor_id' not in df.columns:
            return self._empty_result(df)
        
        ref_sensor = reference_sensor_id or self.config.calibration_reference_sensor
        
        parameters: List[CalibrationParameter] = []
        pre_calibration_stats = self._calculate_statistics(df)
        
        for sensor_id in df['sensor_id'].dropna().unique():
            sensor_mask = df['sensor_id'] == sensor_id
            
            if ref_sensor and sensor_id == ref_sensor:
                continue
            
            sensor_params = self._calibrate_sensor(
                df, sensor_id, ref_sensor, drift_result
            )
            parameters.extend(sensor_params)
            
            self._apply_calibration(df, sensor_mask, sensor_params)
        
        post_calibration_stats = self._calculate_statistics(df)
        
        summary = self._generate_calibration_summary(
            parameters, pre_calibration_stats, post_calibration_stats
        )
        
        return CalibrationResult(
            parameters=parameters,
            calibrated_data=df,
            calibration_summary=summary,
            pre_calibration_stats=pre_calibration_stats,
            post_calibration_stats=post_calibration_stats
        )
    
    def _calibrate_sensor(
        self,
        df: pd.DataFrame,
        sensor_id: str,
        ref_sensor: Optional[str],
        drift_result: DriftResult
    ) -> List[CalibrationParameter]:
        parameters: List[CalibrationParameter] = []
        sensor_mask = df['sensor_id'] == sensor_id
        
        if ref_sensor and ref_sensor in df['sensor_id'].values:
            ref_mask = df['sensor_id'] == ref_sensor
            
            for metric in ['temperature', 'humidity']:
                if metric not in df.columns:
                    continue
                
                common_ts = self._find_common_timestamps(
                    df[sensor_mask], df[ref_mask]
                )
                
                if len(common_ts) < 10:
                    continue
                
                sensor_vals = df.loc[sensor_mask & df['timestamp'].isin(common_ts), metric].values
                ref_vals = df.loc[ref_mask & df['timestamp'].isin(common_ts), metric].values
                
                valid_mask = ~np.isnan(sensor_vals) & ~np.isnan(ref_vals)
                sensor_vals = sensor_vals[valid_mask]
                ref_vals = ref_vals[valid_mask]
                
                if len(sensor_vals) < 10:
                    continue
                
                slope, intercept, r_value, p_value, std_err = stats.linregress(
                    sensor_vals, ref_vals
                )
                
                ts_values = df.loc[sensor_mask, 'timestamp'].dropna()
                effective_date = ts_values.min() if len(ts_values) > 0 else pd.Timestamp.now()
                
                params = CalibrationParameter(
                    sensor_id=str(sensor_id),
                    metric=metric,
                    slope=float(slope),
                    intercept=float(intercept),
                    r_squared=float(r_value ** 2),
                    effective_date=pd.Timestamp(effective_date).to_pydatetime(),
                    reference_value=float(np.mean(ref_vals)),
                    sensor_value=float(np.mean(sensor_vals)),
                    raw_model={
                        'p_value': float(p_value),
                        'std_err': float(std_err),
                        'sample_count': len(sensor_vals)
                    }
                )
                parameters.append(params)
        
        else:
            for metric in ['temperature', 'humidity']:
                sensor_events = [
                    e for e in drift_result.drift_events 
                    if e.sensor_id == sensor_id and e.metric == metric
                ]
                
                if not sensor_events:
                    continue
                
                total_drift = sum(e.drift_magnitude for e in sensor_events)
                baseline = sensor_events[0].baseline_mean if sensor_events else 0
                
                params = CalibrationParameter(
                    sensor_id=str(sensor_id),
                    metric=metric,
                    slope=1.0,
                    intercept=float(-total_drift),
                    r_squared=1.0,
                    effective_date=pd.Timestamp.now().to_pydatetime(),
                    reference_value=float(baseline),
                    sensor_value=float(baseline + total_drift),
                    raw_model={'method': 'drift_based', 'events_count': len(sensor_events)}
                )
                parameters.append(params)
        
        return parameters
    
    def _find_common_timestamps(self, df1: pd.DataFrame, df2: pd.DataFrame) -> List:
        ts1 = set(df1['timestamp'].dropna().astype('int64'))
        ts2 = set(df2['timestamp'].dropna().astype('int64'))
        common = ts1.intersection(ts2)
        return [pd.Timestamp(ts) for ts in common]
    
    def _apply_calibration(
        self, 
        df: pd.DataFrame, 
        sensor_mask: pd.Series,
        parameters: List[CalibrationParameter]
    ) -> None:
        for param in parameters:
            metric = param.metric
            if metric not in df.columns:
                continue
            
            metric_mask = sensor_mask & df[metric].notna()
            
            original_col = f'{metric}_original'
            if original_col not in df.columns:
                df[original_col] = df[metric]
            
            df.loc[metric_mask, metric] = (
                df.loc[metric_mask, metric] * param.slope + param.intercept
            )
    
    def _calculate_statistics(self, df: pd.DataFrame) -> Dict:
        stats_dict = {'by_sensor': {}}
        
        if 'sensor_id' not in df.columns:
            return stats_dict
        
        for sensor_id in df['sensor_id'].dropna().unique():
            sensor_mask = df['sensor_id'] == sensor_id
            stats_dict['by_sensor'][sensor_id] = {}
            
            for metric in ['temperature', 'humidity']:
                if metric not in df.columns:
                    continue
                
                values = df.loc[sensor_mask, metric].dropna()
                if len(values) > 0:
                    stats_dict['by_sensor'][sensor_id][metric] = {
                        'mean': float(values.mean()),
                        'std': float(values.std()),
                        'min': float(values.min()),
                        'max': float(values.max()),
                        'count': int(len(values))
                    }
        
        return stats_dict
    
    def _generate_calibration_summary(
        self,
        parameters: List[CalibrationParameter],
        pre_stats: Dict,
        post_stats: Dict
    ) -> Dict:
        summary = {
            'total_parameters': len(parameters),
            'by_metric': {},
            'by_sensor': {},
            'average_r_squared': 0.0,
        }
        
        for param in parameters:
            metric = param.metric
            if metric not in summary['by_metric']:
                summary['by_metric'][metric] = []
            summary['by_metric'][metric].append(param.r_squared)
            
            sensor = param.sensor_id
            if sensor not in summary['by_sensor']:
                summary['by_sensor'][sensor] = []
            summary['by_sensor'][sensor].append(metric)
        
        avg_rs = []
        for metric in summary['by_metric']:
            if summary['by_metric'][metric]:
                avg_rs.extend(summary['by_metric'][metric])
        
        if avg_rs:
            summary['average_r_squared'] = sum(avg_rs) / len(avg_rs)
        
        return summary
    
    def _empty_result(self, df: pd.DataFrame) -> CalibrationResult:
        return CalibrationResult(
            parameters=[],
            calibrated_data=df,
            calibration_summary={'error': '无法进行校准：缺少sensor_id列'},
            pre_calibration_stats={},
            post_calibration_stats={}
        )
