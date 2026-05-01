#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from enum import Enum


class AnomalyType(Enum):
    TIME_REVERSAL = "time_reversal"
    MISSING_COLUMN = "missing_column"
    VOLTAGE_STAGNANT = "voltage_stagnant"
    CURRENT_SPIKE = "current_spike"
    VOLTAGE_OVER_THRESHOLD = "voltage_over_threshold"
    VOLTAGE_UNDER_THRESHOLD = "voltage_under_threshold"
    INVALID_VALUE = "invalid_value"
    DUPLICATE_TIME = "duplicate_time"


class AnomalySeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class Anomaly:
    anomaly_type: AnomalyType
    severity: AnomalySeverity
    row_index: int
    time_seconds: float
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def type_name(self) -> str:
        type_names = {
            AnomalyType.TIME_REVERSAL: "时间倒退",
            AnomalyType.MISSING_COLUMN: "缺列",
            AnomalyType.VOLTAGE_STAGNANT: "电压停滞",
            AnomalyType.CURRENT_SPIKE: "电流尖峰",
            AnomalyType.VOLTAGE_OVER_THRESHOLD: "电压超过上限",
            AnomalyType.VOLTAGE_UNDER_THRESHOLD: "电压低于下限",
            AnomalyType.INVALID_VALUE: "无效值",
            AnomalyType.DUPLICATE_TIME: "重复时间戳",
        }
        return type_names.get(self.anomaly_type, str(self.anomaly_type.value))
    
    @property
    def severity_name(self) -> str:
        severity_names = {
            AnomalySeverity.LOW: "低",
            AnomalySeverity.MEDIUM: "中",
            AnomalySeverity.HIGH: "高",
            AnomalySeverity.CRITICAL: "严重",
        }
        return severity_names.get(self.severity, str(self.severity.value))


class AnomalyDetector:
    def __init__(
        self,
        voltage_min_v: float = 2.5,
        voltage_max_v: float = 4.5,
        current_spike_threshold_ma: float = 2000.0,
        current_spike_window: int = 3,
        voltage_stagnant_threshold_v: float = 0.005,
        voltage_stagnant_min_points: int = 10,
    ):
        self.voltage_min = voltage_min_v
        self.voltage_max = voltage_max_v
        self.current_spike_threshold = current_spike_threshold_ma
        self.current_spike_window = current_spike_window
        self.voltage_stagnant_threshold = voltage_stagnant_threshold_v
        self.voltage_stagnant_min_points = voltage_stagnant_min_points
    
    def detect_all(
        self,
        time: List[float],
        current: List[float],
        voltage: List[float],
        mapped_headers: Dict[str, str],
        parse_errors: List[str],
    ) -> List[Anomaly]:
        anomalies: List[Anomaly] = []
        
        anomalies.extend(self._detect_missing_columns(mapped_headers))
        anomalies.extend(self._detect_parse_errors(parse_errors, time))
        anomalies.extend(self._detect_time_anomalies(time))
        anomalies.extend(self._detect_voltage_thresholds(time, voltage))
        anomalies.extend(self._detect_current_spikes(time, current))
        anomalies.extend(self._detect_voltage_stagnant(time, voltage))
        
        anomalies.sort(key=lambda a: a.row_index)
        
        return anomalies
    
    def _detect_missing_columns(
        self,
        mapped_headers: Dict[str, str],
    ) -> List[Anomaly]:
        anomalies = []
        
        required_columns = ['time', 'current', 'voltage']
        for col in required_columns:
            if col not in mapped_headers:
                col_names = {
                    'time': '时间',
                    'current': '电流',
                    'voltage': '电压',
                }
                anomalies.append(Anomaly(
                    anomaly_type=AnomalyType.MISSING_COLUMN,
                    severity=AnomalySeverity.CRITICAL,
                    row_index=-1,
                    time_seconds=0.0,
                    message=f"缺少必要列: {col_names.get(col, col)}",
                    details={'missing_column': col},
                ))
        
        return anomalies
    
    def _detect_parse_errors(
        self,
        parse_errors: List[str],
        time: List[float],
    ) -> List[Anomaly]:
        anomalies = []
        
        for error in parse_errors:
            row_match = None
            if 'Row' in error:
                import re
                match = re.search(r'Row (\d+)', error)
                if match:
                    row_match = int(match.group(1))
            
            anomalies.append(Anomaly(
                anomaly_type=AnomalyType.INVALID_VALUE,
                severity=AnomalySeverity.MEDIUM,
                row_index=row_match - 1 if row_match else -1,
                time_seconds=0.0,
                message=f"解析错误: {error}",
                details={'parse_error': error},
            ))
        
        return anomalies
    
    def _detect_time_anomalies(
        self,
        time: List[float],
    ) -> List[Anomaly]:
        anomalies = []
        
        for i in range(1, len(time)):
            dt = time[i] - time[i - 1]
            
            if dt < 0:
                anomalies.append(Anomaly(
                    anomaly_type=AnomalyType.TIME_REVERSAL,
                    severity=AnomalySeverity.HIGH,
                    row_index=i,
                    time_seconds=time[i],
                    message=f"时间倒退: 前一时间戳 {time[i-1]:.3f}s, 当前 {time[i]:.3f}s, 倒退 {abs(dt):.3f}s",
                    details={
                        'previous_time': time[i - 1],
                        'current_time': time[i],
                        'delta': dt,
                    },
                ))
            elif dt == 0:
                anomalies.append(Anomaly(
                    anomaly_type=AnomalyType.DUPLICATE_TIME,
                    severity=AnomalySeverity.MEDIUM,
                    row_index=i,
                    time_seconds=time[i],
                    message=f"重复时间戳: 与前一行时间相同 ({time[i]:.3f}s)",
                    details={
                        'duplicate_time': time[i],
                    },
                ))
        
        return anomalies
    
    def _detect_voltage_thresholds(
        self,
        time: List[float],
        voltage: List[float],
    ) -> List[Anomaly]:
        anomalies = []
        
        for i in range(len(time)):
            v = voltage[i]
            
            if v > self.voltage_max:
                anomalies.append(Anomaly(
                    anomaly_type=AnomalyType.VOLTAGE_OVER_THRESHOLD,
                    severity=AnomalySeverity.HIGH,
                    row_index=i,
                    time_seconds=time[i],
                    message=f"电压超过上限: {v:.3f}V (阈值: {self.voltage_max:.2f}V)",
                    details={
                        'voltage': v,
                        'threshold': self.voltage_max,
                        'delta': v - self.voltage_max,
                    },
                ))
            
            if v < self.voltage_min:
                anomalies.append(Anomaly(
                    anomaly_type=AnomalyType.VOLTAGE_UNDER_THRESHOLD,
                    severity=AnomalySeverity.HIGH,
                    row_index=i,
                    time_seconds=time[i],
                    message=f"电压低于下限: {v:.3f}V (阈值: {self.voltage_min:.2f}V)",
                    details={
                        'voltage': v,
                        'threshold': self.voltage_min,
                        'delta': self.voltage_min - v,
                    },
                ))
        
        return anomalies
    
    def _detect_current_spikes(
        self,
        time: List[float],
        current: List[float],
    ) -> List[Anomaly]:
        anomalies = []
        
        n = len(time)
        if n < self.current_spike_window * 2 + 1:
            return anomalies
        
        for i in range(self.current_spike_window, n - self.current_spike_window):
            window_before = current[i - self.current_spike_window : i]
            window_after = current[i + 1 : i + 1 + self.current_spike_window]
            center = current[i]
            
            if not window_before or not window_after:
                continue
            
            avg_before = sum(window_before) / len(window_before)
            avg_after = sum(window_after) / len(window_after)
            baseline = (avg_before + avg_after) / 2
            
            delta = abs(center - baseline)
            
            if delta >= self.current_spike_threshold:
                severity = AnomalySeverity.MEDIUM
                if delta >= self.current_spike_threshold * 2:
                    severity = AnomalySeverity.HIGH
                if delta >= self.current_spike_threshold * 3:
                    severity = AnomalySeverity.CRITICAL
                
                anomalies.append(Anomaly(
                    anomaly_type=AnomalyType.CURRENT_SPIKE,
                    severity=severity,
                    row_index=i,
                    time_seconds=time[i],
                    message=f"电流尖峰: {center:.1f}mA (基线: {baseline:.1f}mA, 差值: {delta:.1f}mA)",
                    details={
                        'current_spike': center,
                        'baseline': baseline,
                        'delta': delta,
                        'window_size': self.current_spike_window,
                    },
                ))
        
        return anomalies
    
    def _detect_voltage_stagnant(
        self,
        time: List[float],
        voltage: List[float],
    ) -> List[Anomaly]:
        anomalies = []
        
        n = len(time)
        if n < self.voltage_stagnant_min_points:
            return anomalies
        
        stagnant_start = None
        stagnant_start_v = None
        
        for i in range(1, n):
            v_delta = abs(voltage[i] - voltage[i - 1])
            
            if v_delta <= self.voltage_stagnant_threshold:
                if stagnant_start is None:
                    stagnant_start = i - 1
                    stagnant_start_v = voltage[i - 1]
            else:
                if stagnant_start is not None:
                    duration_points = i - stagnant_start
                    if duration_points >= self.voltage_stagnant_min_points:
                        duration_seconds = time[i - 1] - time[stagnant_start]
                        v_range = max(voltage[stagnant_start:i]) - min(voltage[stagnant_start:i])
                        
                        anomalies.append(Anomaly(
                            anomaly_type=AnomalyType.VOLTAGE_STAGNANT,
                            severity=AnomalySeverity.MEDIUM,
                            row_index=stagnant_start,
                            time_seconds=time[stagnant_start],
                            message=f"电压停滞: 从行 {stagnant_start+1} 开始, 持续 {duration_seconds:.1f}s ({duration_points}个点), 电压变化 {v_range:.4f}V",
                            details={
                                'start_row': stagnant_start,
                                'end_row': i - 1,
                                'duration_points': duration_points,
                                'duration_seconds': duration_seconds,
                                'voltage_range': v_range,
                                'start_voltage': stagnant_start_v,
                                'end_voltage': voltage[i - 1],
                            },
                        ))
                    
                    stagnant_start = None
                    stagnant_start_v = None
        
        if stagnant_start is not None:
            duration_points = n - stagnant_start
            if duration_points >= self.voltage_stagnant_min_points:
                duration_seconds = time[-1] - time[stagnant_start]
                v_range = max(voltage[stagnant_start:]) - min(voltage[stagnant_start:])
                
                anomalies.append(Anomaly(
                    anomaly_type=AnomalyType.VOLTAGE_STAGNANT,
                    severity=AnomalySeverity.MEDIUM,
                    row_index=stagnant_start,
                    time_seconds=time[stagnant_start],
                    message=f"电压停滞: 从行 {stagnant_start+1} 开始, 持续 {duration_seconds:.1f}s ({duration_points}个点), 电压变化 {v_range:.4f}V",
                    details={
                        'start_row': stagnant_start,
                        'end_row': n - 1,
                        'duration_points': duration_points,
                        'duration_seconds': duration_seconds,
                        'voltage_range': v_range,
                        'start_voltage': stagnant_start_v,
                        'end_voltage': voltage[-1],
                    },
                ))
        
        return anomalies
    
    def get_anomaly_summary(self, anomalies: List[Anomaly]) -> Dict[str, Any]:
        by_type: Dict[str, int] = {}
        by_severity: Dict[str, int] = {
            'low': 0,
            'medium': 0,
            'high': 0,
            'critical': 0,
        }
        
        for anomaly in anomalies:
            type_name = anomaly.anomaly_type.value
            by_type[type_name] = by_type.get(type_name, 0) + 1
            
            severity_name = anomaly.severity.value
            if severity_name in by_severity:
                by_severity[severity_name] += 1
        
        return {
            'total': len(anomalies),
            'by_type': by_type,
            'by_severity': by_severity,
            'critical_count': by_severity.get('critical', 0),
            'high_count': by_severity.get('high', 0),
            'has_critical': by_severity.get('critical', 0) > 0,
        }
