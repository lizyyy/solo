import pandas as pd
import numpy as np
from datetime import timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from .data_parser import ThermocoupleData, KilnPosition


@dataclass
class HeatingRateResult:
    """升温速率计算结果"""
    time: pd.DatetimeIndex
    rates: pd.Series
    max_rate: float
    avg_rate: float
    rate_periods: List[Dict[str, Any]]


@dataclass
class HoldingSegment:
    """保温段数据"""
    start_time: pd.Timestamp
    end_time: pd.Timestamp
    start_temp: float
    end_temp: float
    target_temp: float
    duration_minutes: float
    temp_variation: float
    deviation_from_target: float
    is_sufficient: bool


@dataclass
class ThermalExposureResult:
    """热暴露计算结果"""
    position_id: str
    total_heat_exposure: float
    peak_temperature: float
    time_above_threshold: Dict[str, float]
    temperature_variance: float


@dataclass
class CurveCalculationResult:
    """曲线计算综合结果"""
    thermocouple_name: str
    heating_rates: HeatingRateResult
    holding_segments: List[HoldingSegment]
    thermal_summary: Dict[str, Any]
    peak_temperature: float
    total_firing_duration_minutes: float
    time_to_peak_minutes: float


class CurveCalculator:
    """
    曲线计算器 - 计算升温速率、保温段偏差、热暴露差异
    
    主要功能:
    1. 计算升温速率 (℃/分钟 或 ℃/小时)
    2. 检测保温段并计算与目标温度的偏差
    3. 计算不同窑位的热暴露差异
    """
    
    def __init__(self, target_holding_temp: Optional[float] = None, 
                 min_holding_duration_min: float = 10.0,
                 temp_variation_threshold: float = 10.0):
        """
        初始化曲线计算器
        
        Args:
            target_holding_temp: 目标保温温度 (可选)
            min_holding_duration_min: 最小保温段时长 (分钟)
            temp_variation_threshold: 保温段温度变化阈值 (℃)
        """
        self.target_holding_temp = target_holding_temp
        self.min_holding_duration_min = min_holding_duration_min
        self.temp_variation_threshold = temp_variation_threshold
        
    def calculate_heating_rate(self, thermocouple_data: ThermocoupleData, 
                                time_unit: str = 'hour') -> HeatingRateResult:
        """
        计算升温速率
        
        Args:
            thermocouple_data: 热电偶数据
            time_unit: 时间单位 ('minute' 或 'hour')
            
        Returns:
            HeatingRateResult对象
        """
        df = thermocouple_data.data_frame.copy()
        df = df.sort_index()
        
        time_diff = df.index.to_series().diff().dt.total_seconds()
        temp_diff = df['temperature'].diff()
        
        if time_unit == 'hour':
            rates = (temp_diff / time_diff) * 3600
        else:
            rates = (temp_diff / time_diff) * 60
        
        rates = rates.dropna()
        
        valid_rates = rates[(rates > -500) & (rates < 500)]
        
        rate_periods = self._identify_rate_periods(rates, time_unit)
        
        return HeatingRateResult(
            time=valid_rates.index,
            rates=valid_rates,
            max_rate=float(valid_rates.max()) if len(valid_rates) > 0 else 0.0,
            avg_rate=float(valid_rates.mean()) if len(valid_rates) > 0 else 0.0,
            rate_periods=rate_periods
        )
    
    def _identify_rate_periods(self, rates: pd.Series, time_unit: str) -> List[Dict[str, Any]]:
        """识别不同的升温速率阶段"""
        if len(rates) == 0:
            return []
        
        periods = []
        current_phase = None
        phase_start = rates.index[0]
        phase_rates = []
        
        rate_threshold = 5 if time_unit == 'hour' else 0.1
        
        for time, rate in rates.items():
            if rate > rate_threshold:
                phase = 'heating'
            elif rate < -rate_threshold:
                phase = 'cooling'
            else:
                phase = 'holding'
            
            if current_phase is None:
                current_phase = phase
                phase_start = time
                phase_rates = [rate]
            elif phase == current_phase:
                phase_rates.append(rate)
            else:
                if phase_rates:
                    duration = (time - phase_start).total_seconds() / 60
                    periods.append({
                        'phase': current_phase,
                        'start_time': phase_start,
                        'end_time': time,
                        'duration_minutes': duration,
                        'avg_rate': np.mean(phase_rates),
                        'max_rate': np.max(phase_rates) if phase_rates else 0,
                        'min_rate': np.min(phase_rates) if phase_rates else 0
                    })
                current_phase = phase
                phase_start = time
                phase_rates = [rate]
        
        if phase_rates:
            duration = (rates.index[-1] - phase_start).total_seconds() / 60
            periods.append({
                'phase': current_phase,
                'start_time': phase_start,
                'end_time': rates.index[-1],
                'duration_minutes': duration,
                'avg_rate': np.mean(phase_rates),
                'max_rate': np.max(phase_rates) if phase_rates else 0,
                'min_rate': np.min(phase_rates) if phase_rates else 0
            })
        
        return periods
    
    def detect_holding_segments(self, thermocouple_data: ThermocoupleData,
                                  target_temp: Optional[float] = None) -> List[HoldingSegment]:
        """
        检测保温段并计算偏差
        
        Args:
            thermocouple_data: 热电偶数据
            target_temp: 目标保温温度 (可选，覆盖初始化时的设置)
            
        Returns:
            保温段列表
        """
        df = thermocouple_data.data_frame.copy()
        df = df.sort_index()
        
        actual_target = target_temp if target_temp is not None else self.target_holding_temp
        
        if actual_target is None:
            peak_temp = df['temperature'].max()
            actual_target = peak_temp
        
        holding_segments = []
        in_holding = False
        holding_start = None
        holding_temps = []
        
        temp_diff = df['temperature'].diff().abs()
        
        for i, (time, temp) in enumerate(df['temperature'].items()):
            near_target = abs(temp - actual_target) <= self.temp_variation_threshold
            
            if i > 0:
                temp_change = temp_diff.iloc[i]
            else:
                temp_change = 0
            
            stable_temp = temp_change <= 2.0
            
            if near_target and stable_temp:
                if not in_holding:
                    in_holding = True
                    holding_start = time
                    holding_temps = [temp]
                else:
                    holding_temps.append(temp)
            else:
                if in_holding:
                    duration = (time - holding_start).total_seconds() / 60
                    
                    if duration >= self.min_holding_duration_min:
                        avg_temp = np.mean(holding_temps)
                        temp_var = np.max(holding_temps) - np.min(holding_temps)
                        
                        holding_segments.append(HoldingSegment(
                            start_time=holding_start,
                            end_time=time,
                            start_temp=holding_temps[0],
                            end_temp=holding_temps[-1],
                            target_temp=actual_target,
                            duration_minutes=duration,
                            temp_variation=temp_var,
                            deviation_from_target=avg_temp - actual_target,
                            is_sufficient=duration >= self.min_holding_duration_min
                        ))
                    
                    in_holding = False
                    holding_temps = []
        
        if in_holding and holding_temps:
            duration = (df.index[-1] - holding_start).total_seconds() / 60
            
            if duration >= self.min_holding_duration_min:
                avg_temp = np.mean(holding_temps)
                temp_var = np.max(holding_temps) - np.min(holding_temps)
                
                holding_segments.append(HoldingSegment(
                    start_time=holding_start,
                    end_time=df.index[-1],
                    start_temp=holding_temps[0],
                    end_temp=holding_temps[-1],
                    target_temp=actual_target,
                    duration_minutes=duration,
                    temp_variation=temp_var,
                    deviation_from_target=avg_temp - actual_target,
                    is_sufficient=duration >= self.min_holding_duration_min
                ))
        
        return holding_segments
    
    def calculate_thermal_exposure(self, thermocouple_data: ThermocoupleData,
                                     position_id: str,
                                     thresholds: Optional[List[float]] = None) -> ThermalExposureResult:
        """
        计算热暴露
        
        Args:
            thermocouple_data: 热电偶数据
            position_id: 窑位ID
            thresholds: 温度阈值列表 (℃)，默认 [500, 800, 1000, 1200]
            
        Returns:
            ThermalExposureResult对象
        """
        if thresholds is None:
            thresholds = [500, 800, 1000, 1200]
        
        df = thermocouple_data.data_frame.copy()
        df = df.sort_index()
        
        peak_temp = df['temperature'].max()
        
        time_above_threshold = {}
        for threshold in thresholds:
            above_threshold = df[df['temperature'] >= threshold]
            if len(above_threshold) > 1:
                duration = (above_threshold.index[-1] - above_threshold.index[0]).total_seconds() / 60
            else:
                duration = 0.0
            time_above_threshold[f"above_{threshold}C"] = duration
        
        total_duration = (df.index[-1] - df.index[0]).total_seconds() / 60
        
        temp_array = df['temperature'].values
        time_array = df.index.to_series().diff().dt.total_seconds().cumsum().fillna(0).values
        
        if len(time_array) > 1:
            time_deltas = np.diff(time_array)
            avg_temps = (temp_array[:-1] + temp_array[1:]) / 2
            heat_exposure = np.sum(avg_temps * time_deltas / 3600)
        else:
            heat_exposure = 0.0
        
        temp_variance = float(df['temperature'].var()) if len(df) > 1 else 0.0
        
        return ThermalExposureResult(
            position_id=position_id,
            total_heat_exposure=heat_exposure,
            peak_temperature=float(peak_temp),
            time_above_threshold=time_above_threshold,
            temperature_variance=temp_variance
        )
    
    def compare_multiple_thermocouples(self, thermocouples: Dict[str, ThermocoupleData],
                                          positions: Dict[str, KilnPosition]) -> Dict[str, Any]:
        """
        比较多个热电偶的热暴露差异
        
        Args:
            thermocouples: 热电偶数据字典
            positions: 窑位数据字典
            
        Returns:
            比较结果字典
        """
        exposures = {}
        for pos_id, position in positions.items():
            tc_id = position.thermocouple_id
            if tc_id in thermocouples:
                exposure = self.calculate_thermal_exposure(thermocouples[tc_id], pos_id)
                exposures[pos_id] = {
                    'position_name': position.name,
                    'position_coords': (position.position_x, position.position_y, position.position_z),
                    'peak_temperature': exposure.peak_temperature,
                    'total_heat_exposure': exposure.total_heat_exposure,
                    'time_above_threshold': exposure.time_above_threshold
                }
        
        if len(exposures) >= 2:
            exposures_list = list(exposures.values())
            peaks = [e['peak_temperature'] for e in exposures_list]
            heat_exposures = [e['total_heat_exposure'] for e in exposures_list]
            
            comparison = {
                'max_peak_difference': max(peaks) - min(peaks),
                'peak_temperatures': {pos_id: exp['peak_temperature'] for pos_id, exp in exposures.items()},
                'heat_exposure_difference': max(heat_exposures) - min(heat_exposures) if heat_exposures else 0,
                'heat_exposures': {pos_id: exp['total_heat_exposure'] for pos_id, exp in exposures.items()}
            }
        else:
            comparison = {
                'max_peak_difference': 0,
                'peak_temperatures': {},
                'heat_exposure_difference': 0,
                'heat_exposures': {}
            }
        
        return {
            'individual_exposures': exposures,
            'comparison': comparison
        }
    
    def calculate_full_curve(self, thermocouple_data: ThermocoupleData,
                               target_holding_temp: Optional[float] = None) -> CurveCalculationResult:
        """
        计算完整曲线分析结果
        
        Args:
            thermocouple_data: 热电偶数据
            target_holding_temp: 目标保温温度
            
        Returns:
            CurveCalculationResult综合结果
        """
        df = thermocouple_data.data_frame.copy()
        df = df.sort_index()
        
        heating_rates = self.calculate_heating_rate(thermocouple_data)
        holding_segments = self.detect_holding_segments(
            thermocouple_data, target_holding_temp or self.target_holding_temp
        )
        
        peak_temp = df['temperature'].max()
        peak_idx = df['temperature'].idxmax()
        
        total_duration = (df.index[-1] - df.index[0]).total_seconds() / 60
        time_to_peak = (peak_idx - df.index[0]).total_seconds() / 60
        
        thermal_summary = {
            'max_temperature': float(peak_temp),
            'min_temperature': float(df['temperature'].min()),
            'avg_temperature': float(df['temperature'].mean()),
            'temperature_range': float(peak_temp - df['temperature'].min()),
            'total_duration_minutes': total_duration,
            'time_to_peak_minutes': time_to_peak
        }
        
        return CurveCalculationResult(
            thermocouple_name=thermocouple_data.name,
            heating_rates=heating_rates,
            holding_segments=holding_segments,
            thermal_summary=thermal_summary,
            peak_temperature=float(peak_temp),
            total_firing_duration_minutes=total_duration,
            time_to_peak_minutes=time_to_peak
        )
