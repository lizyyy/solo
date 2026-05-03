"""
潮汐插值模块 - 将离散潮汐记录插值为连续时间序列
"""
from datetime import datetime, timedelta
from typing import List, Optional

import numpy as np
from scipy.interpolate import interp1d

from ..models import TidalRecord


class TideInterpolator:
    """潮汐插值器"""
    
    def __init__(self, tidal_records: List[TidalRecord]):
        """
        初始化潮汐插值器
        
        Args:
            tidal_records: 潮汐记录列表，需要按时间排序
        """
        if len(tidal_records) < 2:
            raise ValueError("潮汐记录数量不足，至少需要2个记录才能插值")
        
        # 确保记录按时间排序
        self.records = sorted(tidal_records, key=lambda r: r.time)
        
        # 提取时间和潮高数据
        self.times = np.array([(r.time - self.records[0].time).total_seconds() for r in self.records])
        self.heights = np.array([r.height for r in self.records])
        
        # 创建插值函数（使用三次样条插值）
        self.interp_func = interp1d(
            self.times, 
            self.heights, 
            kind='cubic', 
            fill_value='extrapolate',
            bounds_error=False
        )
    
    def get_height_at_time(self, target_time: datetime) -> float:
        """
        获取指定时间点的潮高
        
        Args:
            target_time: 目标时间
            
        Returns:
            插值计算的潮高（米）
        """
        # 计算目标时间相对于第一个记录的秒数
        target_seconds = (target_time - self.records[0].time).total_seconds()
        
        # 使用插值函数计算潮高
        height = self.interp_func(target_seconds)
        
        # 确保返回浮点数
        return float(height)
    
    def get_heights_in_range(
        self, 
        start_time: datetime, 
        end_time: datetime, 
        interval_minutes: int = 1
    ) -> List[TidalRecord]:
        """
        获取指定时间范围内的潮高序列
        
        Args:
            start_time: 开始时间
            end_time: 结束时间
            interval_minutes: 采样间隔（分钟）
            
        Returns:
            潮高记录列表
        """
        records = []
        current_time = start_time
        
        while current_time <= end_time:
            height = self.get_height_at_time(current_time)
            records.append(TidalRecord(time=current_time, height=height))
            current_time += timedelta(minutes=interval_minutes)
        
        return records
    
    def find_safe_windows(
        self, 
        required_depth: float, 
        start_time: datetime, 
        end_time: datetime,
        safety_margin: float = 0.3
    ) -> List[dict]:
        """
        查找安全潮窗（潮高满足吃水要求的时间段）
        
        Args:
            required_depth: 所需最小水深（吃水 + 安全余量）
            start_time: 搜索开始时间
            end_time: 搜索结束时间
            safety_margin: 额外安全余量（米），默认0.3米
            
        Returns:
            安全潮窗列表，每个窗口包含 start_time, end_time, min_height, max_height
        """
        # 实际需要的水深 = 所需最小水深 + 额外安全余量
        actual_required = required_depth + safety_margin
        
        # 以1分钟为间隔采样
        samples = self.get_heights_in_range(start_time, end_time, interval_minutes=1)
        
        safe_windows = []
        current_window_start = None
        current_window_min = float('inf')
        current_window_max = float('-inf')
        
        for sample in samples:
            if sample.height >= actual_required:
                # 潮高满足要求
                if current_window_start is None:
                    # 开始新窗口
                    current_window_start = sample.time
                    current_window_min = sample.height
                    current_window_max = sample.height
                else:
                    # 更新当前窗口
                    current_window_min = min(current_window_min, sample.height)
                    current_window_max = max(current_window_max, sample.height)
            else:
                # 潮高不满足要求
                if current_window_start is not None:
                    # 结束当前窗口
                    safe_windows.append({
                        'start_time': current_window_start,
                        'end_time': sample.time - timedelta(minutes=1),
                        'min_height': current_window_min,
                        'max_height': current_window_max,
                        'required_depth': actual_required
                    })
                    current_window_start = None
        
        # 处理最后一个可能的窗口
        if current_window_start is not None:
            safe_windows.append({
                'start_time': current_window_start,
                'end_time': samples[-1].time,
                'min_height': current_window_min,
                'max_height': current_window_max,
                'required_depth': actual_required
            })
        
        # 过滤掉时长过短的窗口（少于30分钟）
        min_duration = timedelta(minutes=30)
        filtered_windows = [
            w for w in safe_windows 
            if (w['end_time'] - w['start_time']) >= min_duration
        ]
        
        return filtered_windows
