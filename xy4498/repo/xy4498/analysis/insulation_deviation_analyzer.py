import numpy as np
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass

from models import TemperatureLog, InsulationDeviation


class InsulationDeviationAnalyzer:
    """保温偏差分析器"""
    
    DEFAULT_TEMP_TOLERANCE = 10.0  # 默认温度容差 (°C)
    DEFAULT_DURATION_TOLERANCE = 10.0  # 默认时长容差 (%)
    
    def __init__(self,
                 temp_tolerance: float = DEFAULT_TEMP_TOLERANCE,
                 duration_tolerance: float = DEFAULT_DURATION_TOLERANCE):
        """
        初始化保温偏差分析器
        
        Args:
            temp_tolerance: 温度容差 (°C)
            duration_tolerance: 时长容差 (%)
        """
        self.temp_tolerance = temp_tolerance
        self.duration_tolerance = duration_tolerance
        self.results: List[InsulationDeviation] = []
    
    def analyze(self,
                temperature_logs: List[TemperatureLog],
                target_stages: List[Dict[str, Any]]) -> List[InsulationDeviation]:
        """
        分析保温偏差
        
        Args:
            temperature_logs: 温度日志列表
            target_stages: 目标保温阶段配置，格式为：
                [
                    {
                        'name': '低温保温',
                        'target_temp': 600,
                        'target_duration': 30,  # 分钟
                        'start_time_approx': 60,  # 预计开始时间（分钟）
                        'end_time_approx': 90  # 预计结束时间（分钟）
                    },
                    ...
                ]
        
        Returns:
            保温偏差分析结果列表
        """
        self.results = []
        
        if len(temperature_logs) < 2:
            return self.results
        
        sorted_logs = sorted(temperature_logs, key=lambda x: x.time)
        
        for stage in target_stages:
            stage_name = stage.get('name', '未命名阶段')
            target_temp = stage.get('target_temp')
            target_duration = stage.get('target_duration')
            
            if target_temp is None or target_duration is None:
                continue
            
            start_time_approx = stage.get('start_time_approx', 0)
            end_time_approx = stage.get('end_time_approx', float('inf'))
            
            insulation_logs = [
                log for log in sorted_logs
                if start_time_approx <= log.time <= end_time_approx
            ]
            
            if not insulation_logs:
                insulation_logs = sorted_logs
            
            actual_temp, actual_duration = self._calculate_actual_insulation(
                insulation_logs, target_temp
            )
            
            temp_deviation = actual_temp - target_temp
            duration_deviation = actual_duration - target_duration
            
            is_acceptable = self._is_deviation_acceptable(
                temp_deviation, duration_deviation, target_temp, target_duration
            )
            
            insulation_deviation = InsulationDeviation(
                insulation_stage=stage_name,
                target_temp=target_temp,
                actual_temp=actual_temp,
                temp_deviation=temp_deviation,
                target_duration=target_duration,
                actual_duration=actual_duration,
                duration_deviation=duration_deviation,
                is_acceptable=is_acceptable
            )
            
            self.results.append(insulation_deviation)
        
        return self.results
    
    def _calculate_actual_insulation(self,
                                      logs: List[TemperatureLog],
                                      target_temp: float,
                                      temp_window: float = 30.0) -> Tuple[float, float]:
        """
        计算实际保温温度和时长
        
        Args:
            logs: 温度日志
            target_temp: 目标温度
            temp_window: 温度窗口（在目标温度±temp_window范围内视为保温阶段）
        
        Returns:
            (实际平均温度, 实际保温时长)
        """
        if not logs:
            return 0.0, 0.0
        
        insulation_logs = [
            log for log in logs
            if abs(log.temperature - target_temp) <= temp_window
        ]
        
        if not insulation_logs:
            return logs[0].temperature if logs else 0.0, 0.0
        
        avg_temp = sum(log.temperature for log in insulation_logs) / len(insulation_logs)
        
        sorted_insulation = sorted(insulation_logs, key=lambda x: x.time)
        duration = sorted_insulation[-1].time - sorted_insulation[0].time
        
        return avg_temp, max(duration, 0)
    
    def _is_deviation_acceptable(self,
                                  temp_deviation: float,
                                  duration_deviation: float,
                                  target_temp: float,
                                  target_duration: float) -> bool:
        """检查偏差是否可接受"""
        temp_ok = abs(temp_deviation) <= self.temp_tolerance
        
        duration_tolerance_abs = target_duration * (self.duration_tolerance / 100)
        duration_ok = abs(duration_deviation) <= duration_tolerance_abs
        
        return temp_ok and duration_ok
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取保温偏差统计信息"""
        if not self.results:
            return {
                'count': 0,
                'avg_temp_deviation': None,
                'avg_duration_deviation': None,
                'unacceptable_count': 0
            }
        
        temp_deviations = [r.temp_deviation for r in self.results]
        duration_deviations = [r.duration_deviation for r in self.results]
        unacceptable = [r for r in self.results if not r.is_acceptable]
        
        return {
            'count': len(self.results),
            'avg_temp_deviation': sum(temp_deviations) / len(temp_deviations),
            'max_temp_deviation': max(temp_deviations, key=abs),
            'avg_duration_deviation': sum(duration_deviations) / len(duration_deviations),
            'unacceptable_count': len(unacceptable),
            'unacceptable_stages': [
                {
                    'stage': r.insulation_stage,
                    'temp_deviation': r.temp_deviation,
                    'duration_deviation': r.duration_deviation
                } for r in unacceptable
            ]
        }
    
    def find_problematic_stages(self) -> List[InsulationDeviation]:
        """找出有问题的保温阶段"""
        return [r for r in self.results if not r.is_acceptable]
    
    def analyze_by_temp_range(self,
                               temperature_logs: List[TemperatureLog],
                               temp_ranges: List[Tuple[float, float, str]]) -> List[Dict[str, Any]]:
        """
        按温度范围分析保温情况
        
        Args:
            temperature_logs: 温度日志
            temp_ranges: 温度范围列表 [(min_temp, max_temp, name), ...]
        
        Returns:
            各温度范围的分析结果
        """
        sorted_logs = sorted(temperature_logs, key=lambda x: x.time)
        results = []
        
        for min_temp, max_temp, name in temp_ranges:
            logs_in_range = [
                log for log in sorted_logs
                if min_temp <= log.temperature <= max_temp
            ]
            
            if logs_in_range:
                avg_temp = sum(log.temperature for log in logs_in_range) / len(logs_in_range)
                sorted_range = sorted(logs_in_range, key=lambda x: x.time)
                duration = sorted_range[-1].time - sorted_range[0].time
                
                results.append({
                    'name': name,
                    'min_temp': min_temp,
                    'max_temp': max_temp,
                    'actual_avg_temp': avg_temp,
                    'duration': duration,
                    'data_points': len(logs_in_range)
                })
        
        return results
