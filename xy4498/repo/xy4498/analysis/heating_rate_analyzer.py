import numpy as np
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass

from models import TemperatureLog, HeatingRate


class HeatingRateAnalyzer:
    """升温速率分析器"""
    
    DEFAULT_ACCEPTABLE_RATE_MIN = 0.5  # 最低可接受升温速率 (°C/分钟)
    DEFAULT_ACCEPTABLE_RATE_MAX = 5.0  # 最高可接受升温速率 (°C/分钟)
    
    def __init__(self, 
                 acceptable_rate_min: float = DEFAULT_ACCEPTABLE_RATE_MIN,
                 acceptable_rate_max: float = DEFAULT_ACCEPTABLE_RATE_MAX,
                 segment_size: int = 10):
        """
        初始化升温速率分析器
        
        Args:
            acceptable_rate_min: 最低可接受升温速率
            acceptable_rate_max: 最高可接受升温速率
            segment_size: 分析段大小（数据点数）
        """
        self.acceptable_rate_min = acceptable_rate_min
        self.acceptable_rate_max = acceptable_rate_max
        self.segment_size = segment_size
        self.results: List[HeatingRate] = []
    
    def analyze(self, 
                temperature_logs: List[TemperatureLog],
                target_rates: Optional[List[Dict[str, Any]]] = None) -> List[HeatingRate]:
        """
        分析升温速率
        
        Args:
            temperature_logs: 温度日志列表
            target_rates: 目标升温速率配置，格式为：
                [
                    {'start_time': 0, 'end_time': 60, 'rate': 2.0},
                    ...
                ]
        
        Returns:
            升温速率分析结果列表
        """
        self.results = []
        
        if len(temperature_logs) < 2:
            return self.results
        
        sorted_logs = sorted(temperature_logs, key=lambda x: x.time)
        
        for i in range(0, len(sorted_logs) - 1, max(1, self.segment_size - 1)):
            end_idx = min(i + self.segment_size, len(sorted_logs) - 1)
            
            if end_idx <= i:
                continue
            
            start_log = sorted_logs[i]
            end_log = sorted_logs[end_idx]
            
            time_diff = end_log.time - start_log.time
            temp_diff = end_log.temperature - start_log.temperature
            
            if time_diff <= 0:
                continue
            
            rate = temp_diff / time_diff
            
            target_rate = None
            deviation = None
            
            if target_rates:
                for target in target_rates:
                    if (target.get('start_time', 0) <= start_log.time 
                        and target.get('end_time', float('inf')) >= end_log.time):
                        target_rate = target.get('rate')
                        if target_rate is not None:
                            deviation = rate - target_rate
                        break
            
            is_acceptable = self._is_rate_acceptable(rate, target_rate)
            
            segment_name = f"{start_log.time:.1f}-{end_log.time:.1f}分钟"
            
            heating_rate = HeatingRate(
                time_segment=segment_name,
                start_time=start_log.time,
                end_time=end_log.time,
                start_temp=start_log.temperature,
                end_temp=end_log.temperature,
                rate=rate,
                target_rate=target_rate,
                deviation=deviation,
                is_acceptable=is_acceptable
            )
            
            self.results.append(heating_rate)
        
        return self.results
    
    def _is_rate_acceptable(self, rate: float, target_rate: Optional[float]) -> bool:
        """检查升温速率是否可接受"""
        if target_rate is not None:
            tolerance = target_rate * 0.3
            return abs(rate - target_rate) <= tolerance
        
        return self.acceptable_rate_min <= rate <= self.acceptable_rate_max
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取升温速率统计信息"""
        if not self.results:
            return {
                'count': 0,
                'avg_rate': None,
                'max_rate': None,
                'min_rate': None,
                'unacceptable_count': 0
            }
        
        rates = [r.rate for r in self.results]
        unacceptable = [r for r in self.results if not r.is_acceptable]
        
        return {
            'count': len(self.results),
            'avg_rate': sum(rates) / len(rates),
            'max_rate': max(rates),
            'min_rate': min(rates),
            'unacceptable_count': len(unacceptable),
            'unacceptable_segments': [
                {
                    'segment': r.time_segment,
                    'rate': r.rate,
                    'target': r.target_rate
                } for r in unacceptable
            ]
        }
    
    def find_high_risk_segments(self, threshold: float = 3.0) -> List[HeatingRate]:
        """
        找出高风险时段（升温速率超过阈值）
        
        Args:
            threshold: 高风险阈值
        
        Returns:
            高风险时段列表
        """
        return [r for r in self.results if r.rate > threshold]
    
    def find_low_rate_segments(self, threshold: float = 0.5) -> List[HeatingRate]:
        """
        找出升温过慢的时段
        
        Args:
            threshold: 低速率阈值
        
        Returns:
            低速率时段列表
        """
        return [r for r in self.results if r.rate < threshold]
