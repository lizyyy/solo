# -*- coding: utf-8 -*-
"""
时序分析模块 - 时间轴对齐、压力骤降识别、声纹分析、传播延迟计算
"""

import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict, field
from collections import defaultdict
import math


@dataclass
class AnalysisResult:
    """分析结果"""
    aligned_data: List[Dict] = field(default_factory=list)
    pressure_anomalies: List[Dict] = field(default_factory=list)
    acoustic_anomalies: List[Dict] = field(default_factory=list)
    propagation_delays: List[Dict] = field(default_factory=list)
    filtered_anomalies: List[Dict] = field(default_factory=list)
    parameters: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict) -> "AnalysisResult":
        return cls(**data)
    
    def save(self, filepath: str):
        """保存到JSON文件"""
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, ensure_ascii=False, indent=2, default=str)
    
    @classmethod
    def load(cls, filepath: str) -> "AnalysisResult":
        """从JSON文件加载"""
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        return cls.from_dict(data)


class TimeSeriesAnalyzer:
    """时序分析器"""
    
    def __init__(self):
        self.pressure_threshold = 0.15  # 压力骤降阈值（15%）
        self.acoustic_threshold = 0.7    # 声纹异常阈值
        self.time_window_seconds = 300   # 时间对齐窗口（5分钟）
        self.network = None
        self._baseline_cache = {}
    
    def set_network(self, network: Any):
        """设置管网模型"""
        self.network = network
    
    def parse_timestamp(self, ts_str: str) -> Optional[datetime]:
        """解析时间戳字符串"""
        if not ts_str:
            return None
        
        try:
            # ISO格式
            return datetime.fromisoformat(ts_str)
        except ValueError:
            pass
        
        # 尝试其他格式
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y/%m/%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(ts_str, fmt)
            except ValueError:
                continue
        
        return None
    
    def align_time_series(self, 
                          pressure_data: List[Dict], 
                          acoustic_data: List[Dict]) -> List[Dict]:
        """
        时间轴对齐 - 将压力数据和声纹数据按时间窗口对齐
        
        策略：
        1. 找出所有时间点的范围
        2. 按固定时间窗口（默认5分钟）进行切片
        3. 在每个窗口内聚合数据
        """
        if not pressure_data and not acoustic_data:
            return []
        
        # 收集所有时间戳
        all_timestamps = []
        
        for item in pressure_data:
            ts = self.parse_timestamp(item.get("timestamp"))
            if ts:
                all_timestamps.append(ts)
        
        for item in acoustic_data:
            ts = self.parse_timestamp(item.get("timestamp"))
            if ts:
                all_timestamps.append(ts)
        
        if not all_timestamps:
            return []
        
        min_time = min(all_timestamps)
        max_time = max(all_timestamps)
        
        # 创建时间窗口
        time_windows = []
        current = min_time
        window_delta = timedelta(seconds=self.time_window_seconds)
        
        while current <= max_time:
            time_windows.append({
                "start": current,
                "end": current + window_delta,
                "center": current + window_delta / 2
            })
            current += window_delta
        
        # 为每个窗口分配数据
        aligned_result = []
        
        for window in time_windows:
            window_pressure = [
                p for p in pressure_data
                if self._is_in_window(p, window["start"], window["end"])
            ]
            
            window_acoustic = [
                a for a in acoustic_data
                if self._is_in_window(a, window["start"], window["end"])
            ]
            
            if window_pressure or window_acoustic:
                aligned_result.append({
                    "window_start": window["start"].isoformat(),
                    "window_end": window["end"].isoformat(),
                    "window_center": window["center"].isoformat(),
                    "pressure_data": window_pressure,
                    "acoustic_data": window_acoustic,
                    "pressure_count": len(window_pressure),
                    "acoustic_count": len(window_acoustic)
                })
        
        return aligned_result
    
    def _is_in_window(self, item: Dict, start: datetime, end: datetime) -> bool:
        """检查数据项是否在时间窗口内"""
        ts = self.parse_timestamp(item.get("timestamp"))
        if not ts:
            return False
        return start <= ts < end
    
    def detect_pressure_drop(self, pressure_data: List[Dict]) -> List[Dict]:
        """
        压力骤降检测
        
        检测逻辑：
        1. 按传感器分组
        2. 计算每个传感器的基线压力
        3. 检测超过阈值的压力下降
        4. 排除正常用水峰（在用水高峰时段的小幅波动）
        """
        anomalies = []
        
        if not pressure_data:
            return anomalies
        
        # 按传感器分组
        sensor_data = defaultdict(list)
        for item in pressure_data:
            sensor_id = item.get("sensor_id", "unknown")
            sensor_data[sensor_id].append(item)
        
        for sensor_id, data_list in sensor_data.items():
            if len(data_list) < 3:
                continue
            
            # 按时间排序
            data_list.sort(key=lambda x: x.get("timestamp", ""))
            
            # 计算基线压力（排除极端值后的平均值）
            pressures = [d.get("pressure", 0) for d in data_list if d.get("pressure") is not None]
            if len(pressures) < 5:
                continue
            
            # 排除最高和最低10%后计算基线
            pressures_sorted = sorted(pressures)
            n = len(pressures_sorted)
            trim_start = int(n * 0.1)
            trim_end = int(n * 0.9)
            if trim_end > trim_start:
                baseline = sum(pressures_sorted[trim_start:trim_end]) / (trim_end - trim_start)
            else:
                baseline = sum(pressures_sorted) / n
            
            self._baseline_cache[sensor_id] = baseline
            
            # 检测压力骤降
            for i in range(1, len(data_list)):
                prev_item = data_list[i-1]
                curr_item = data_list[i]
                
                prev_pressure = prev_item.get("pressure", 0)
                curr_pressure = curr_item.get("pressure", 0)
                
                if prev_pressure is None or curr_pressure is None:
                    continue
                
                # 计算压力变化
                drop_absolute = prev_pressure - curr_pressure
                drop_percent = drop_absolute / prev_pressure if prev_pressure > 0 else 0
                
                # 检测超过阈值的下降
                if curr_pressure < baseline * (1 - self.pressure_threshold):
                    # 检查是否为正常用水峰
                    is_normal_peak = self._is_normal_usage_peak(curr_item, prev_pressure, curr_pressure)
                    
                    anomaly = {
                        "timestamp": curr_item.get("timestamp"),
                        "sensor_id": sensor_id,
                        "previous_pressure": prev_pressure,
                        "current_pressure": curr_pressure,
                        "baseline_pressure": baseline,
                        "drop_absolute": drop_absolute,
                        "drop_percent": drop_percent,
                        "is_potential_leak": not is_normal_peak,
                        "confidence": self._calculate_confidence(drop_percent, baseline, curr_pressure),
                        "raw_data": curr_item
                    }
                    
                    anomalies.append(anomaly)
        
        # 按时间排序
        anomalies.sort(key=lambda x: x.get("timestamp", ""))
        
        return anomalies
    
    def _is_normal_usage_peak(self, item: Dict, prev_pressure: float, curr_pressure: float) -> bool:
        """
        判断是否为正常用水峰
        
        正常用水峰特征：
        1. 发生在典型用水时段（早晨6-8点，晚上18-22点）
        2. 压力下降相对平缓（不是骤降）
        3. 持续时间较短，之后会恢复
        """
        ts = self.parse_timestamp(item.get("timestamp"))
        if not ts:
            return False
        
        # 典型用水高峰时段
        hour = ts.hour
        is_peak_hour = (6 <= hour < 9) or (18 <= hour < 23)
        
        # 压力下降幅度较小（低于阈值的一半）
        drop_percent = (prev_pressure - curr_pressure) / prev_pressure if prev_pressure > 0 else 0
        is_small_drop = drop_percent < self.pressure_threshold * 0.5
        
        return is_peak_hour and is_small_drop
    
    def _calculate_confidence(self, drop_percent: float, baseline: float, current: float) -> float:
        """计算漏点置信度"""
        # 基于下降幅度的置信度
        drop_confidence = min(drop_percent / self.pressure_threshold, 1.0)
        
        # 基于偏离基线程度的置信度
        deviation = (baseline - current) / baseline if baseline > 0 else 0
        deviation_confidence = min(deviation / self.pressure_threshold, 1.0)
        
        # 综合置信度
        confidence = (drop_confidence * 0.6 + deviation_confidence * 0.4)
        
        return max(0.0, min(1.0, confidence))
    
    def detect_acoustic_anomaly(self, acoustic_data: List[Dict]) -> List[Dict]:
        """
        声纹异常检测
        
        检测逻辑：
        1. 分析声强水平
        2. 分析频率特征
        3. 检测异常模式（漏水声通常是连续的高频噪声）
        """
        anomalies = []
        
        if not acoustic_data:
            return anomalies
        
        # 按位置分组
        location_data = defaultdict(list)
        for item in acoustic_data:
            location = item.get("location", "unknown")
            location_data[location].append(item)
        
        for location, data_list in location_data.items():
            if len(data_list) < 2:
                continue
            
            # 按时间排序
            data_list.sort(key=lambda x: x.get("timestamp", ""))
            
            # 计算基线声强
            levels = [d.get("level", 0) for d in data_list if d.get("level") is not None]
            if len(levels) < 3:
                continue
            
            baseline_level = sum(levels) / len(levels)
            
            for item in data_list:
                level = item.get("level")
                if level is None:
                    continue
                
                # 计算异常分数
                anomaly_score = item.get("anomaly_score")
                if anomaly_score is None:
                    # 根据声强计算异常分数
                    level_ratio = level / baseline_level if baseline_level > 0 else 1.0
                    if level_ratio > 1.5:
                        anomaly_score = min((level_ratio - 1.0) / 2.0, 1.0)
                    else:
                        anomaly_score = 0.0
                
                # 检查频率特征（漏水通常有特定频率范围）
                frequency = item.get("frequency")
                freq_score = 0.0
                if frequency:
                    # 漏水声通常在100-1000Hz范围
                    if 100 <= frequency <= 1000:
                        freq_score = 0.3
                    elif 50 <= frequency <= 2000:
                        freq_score = 0.15
                
                # 综合异常分数
                total_score = anomaly_score * 0.7 + freq_score
                
                if total_score >= self.acoustic_threshold:
                    anomaly = {
                        "timestamp": item.get("timestamp"),
                        "location": location,
                        "level": level,
                        "baseline_level": baseline_level,
                        "level_ratio": level / baseline_level if baseline_level > 0 else 1.0,
                        "frequency": frequency,
                        "anomaly_score": total_score,
                        "is_potential_leak": total_score >= self.acoustic_threshold,
                        "confidence": total_score,
                        "device_id": item.get("device_id"),
                        "raw_data": item
                    }
                    
                    anomalies.append(anomaly)
        
        # 按时间排序
        anomalies.sort(key=lambda x: x.get("timestamp", ""))
        
        return anomalies
    
    def analyze_propagation_delay(self, 
                                   pressure_anomalies: List[Dict],
                                   network: Optional[Any] = None) -> List[Dict]:
        """
        传播延迟分析
        
        分析不同传感器检测到异常的时间差，用于定位漏点
        
        原理：
        1. 水锤波/压力波在管道中以特定速度传播
        2. 不同位置的传感器检测到异常的时间差可以用来计算漏点位置
        """
        propagation_delays = []
        
        if len(pressure_anomalies) < 2:
            return propagation_delays
        
        # 按时间分组（相近时间的异常可能是同一事件）
        time_groups = self._group_by_time(pressure_anomalies)
        
        for group in time_groups:
            if len(group) < 2:
                continue
            
            # 计算传感器之间的时间差
            for i in range(len(group)):
                for j in range(i + 1, len(group)):
                    item1 = group[i]
                    item2 = group[j]
                    
                    ts1 = self.parse_timestamp(item1.get("timestamp"))
                    ts2 = self.parse_timestamp(item2.get("timestamp"))
                    
                    if not ts1 or not ts2:
                        continue
                    
                    time_diff_seconds = abs((ts2 - ts1).total_seconds())
                    
                    # 如果有管网模型，可以计算理论传播时间
                    theoretical_delay = None
                    distance = None
                    
                    if network:
                        sensor1 = item1.get("sensor_id")
                        sensor2 = item2.get("sensor_id")
                        
                        # 计算传感器之间的距离和理论传播时间
                        distance, theoretical_delay = self._calculate_sensor_distance(
                            network, sensor1, sensor2
                        )
                    
                    propagation_delays.append({
                        "group_timestamp": min(item1.get("timestamp"), item2.get("timestamp")),
                        "sensor1": item1.get("sensor_id"),
                        "sensor2": item2.get("sensor_id"),
                        "time_diff_seconds": time_diff_seconds,
                        "theoretical_delay_seconds": theoretical_delay,
                        "distance_meters": distance,
                        "item1_data": item1,
                        "item2_data": item2,
                        "is_consistent": self._check_delay_consistency(
                            time_diff_seconds, theoretical_delay
                        )
                    })
        
        return propagation_delays
    
    def _group_by_time(self, anomalies: List[Dict]) -> List[List[Dict]]:
        """按时间分组异常事件"""
        if not anomalies:
            return []
        
        # 按时间排序
        sorted_anomalies = sorted(anomalies, key=lambda x: x.get("timestamp", ""))
        
        groups = []
        current_group = [sorted_anomalies[0]]
        
        for i in range(1, len(sorted_anomalies)):
            prev_ts = self.parse_timestamp(current_group[-1].get("timestamp"))
            curr_ts = self.parse_timestamp(sorted_anomalies[i].get("timestamp"))
            
            if prev_ts and curr_ts:
                time_diff = (curr_ts - prev_ts).total_seconds()
                
                # 如果时间差在30秒内，认为是同一事件
                if time_diff <= 30:
                    current_group.append(sorted_anomalies[i])
                    continue
            
            # 开始新的分组
            groups.append(current_group)
            current_group = [sorted_anomalies[i]]
        
        if current_group:
            groups.append(current_group)
        
        return groups
    
    def _calculate_sensor_distance(self, network: Any, 
                                    sensor1_id: str, sensor2_id: str) -> Tuple[Optional[float], Optional[float]]:
        """计算两个传感器之间的距离和理论传播时间"""
        if not network or not hasattr(network, "sensors"):
            return (None, None)
        
        sensor1 = network.sensors.get(sensor1_id)
        sensor2 = network.sensors.get(sensor2_id)
        
        if not sensor1 or not sensor2:
            return (None, None)
        
        # 简单计算欧氏距离
        dx = sensor1.x - sensor2.x
        dy = sensor1.y - sensor2.y
        distance = math.sqrt(dx * dx + dy * dy)
        
        # 平均波速（m/s）
        wave_speed = 1000.0
        
        # 理论传播时间
        theoretical_delay = distance / wave_speed if wave_speed > 0 else None
        
        return (distance, theoretical_delay)
    
    def _check_delay_consistency(self, actual_delay: float, 
                                  theoretical_delay: Optional[float]) -> bool:
        """检查传播延迟是否一致"""
        if theoretical_delay is None:
            return True  # 无法判断，默认一致
        
        # 允许20%的误差
        tolerance = 0.2
        lower = theoretical_delay * (1 - tolerance)
        upper = theoretical_delay * (1 + tolerance)
        
        return lower <= actual_delay <= upper
    
    def filter_normal_usage(self, 
                             pressure_anomalies: List[Dict],
                             acoustic_anomalies: List[Dict]) -> List[Dict]:
        """
        过滤正常用水峰，保留真正的漏点可疑事件
        
        过滤策略：
        1. 排除只发生在用水高峰时段的小幅度压力波动
        2. 排除没有声纹异常佐证的压力波动
        3. 排除持续时间过短的事件
        4. 合并同一事件的多个异常
        """
        filtered = []
        
        # 合并压力和声纹异常
        all_anomalies = []
        
        for anomaly in pressure_anomalies:
            all_anomalies.append({
                "type": "pressure",
                "timestamp": anomaly.get("timestamp"),
                "confidence": anomaly.get("confidence", 0),
                "is_potential_leak": anomaly.get("is_potential_leak", True),
                "data": anomaly
            })
        
        for anomaly in acoustic_anomalies:
            all_anomalies.append({
                "type": "acoustic",
                "timestamp": anomaly.get("timestamp"),
                "confidence": anomaly.get("confidence", 0),
                "is_potential_leak": anomaly.get("is_potential_leak", True),
                "data": anomaly
            })
        
        if not all_anomalies:
            return []
        
        # 按时间分组
        time_groups = self._group_anomalies_by_time(all_anomalies)
        
        for group in time_groups:
            # 检查组内是否同时有压力和声纹异常
            has_pressure = any(a["type"] == "pressure" for a in group)
            has_acoustic = any(a["type"] == "acoustic" for a in group)
            
            # 计算组合置信度
            pressure_items = [a for a in group if a["type"] == "pressure"]
            acoustic_items = [a for a in group if a["type"] == "acoustic"]
            
            max_pressure_conf = max((a["confidence"] for a in pressure_items), default=0)
            max_acoustic_conf = max((a["confidence"] for a in acoustic_items), default=0)
            
            # 组合置信度：两种证据都有时置信度更高
            if has_pressure and has_acoustic:
                combined_confidence = max_pressure_conf * 0.5 + max_acoustic_conf * 0.5 + 0.2
            elif has_pressure:
                combined_confidence = max_pressure_conf * 0.7
            else:
                combined_confidence = max_acoustic_conf * 0.6
            
            combined_confidence = min(combined_confidence, 1.0)
            
            # 过滤低置信度事件
            if combined_confidence < 0.3:
                continue
            
            # 检查是否为正常用水峰
            is_normal_peak = self._check_group_is_normal_peak(group)
            if is_normal_peak and combined_confidence < 0.6:
                continue
            
            # 创建合并的异常事件
            first_item = group[0]["data"]
            merged_event = {
                "event_timestamp": min(a["timestamp"] for a in group if a["timestamp"]),
                "event_end_timestamp": max(a["timestamp"] for a in group if a["timestamp"]),
                "has_pressure_anomaly": has_pressure,
                "has_acoustic_anomaly": has_acoustic,
                "combined_confidence": combined_confidence,
                "pressure_confidence": max_pressure_conf,
                "acoustic_confidence": max_acoustic_conf,
                "pressure_count": len(pressure_items),
                "acoustic_count": len(acoustic_items),
                "is_normal_usage_peak": is_normal_peak,
                "all_anomalies": group,
                "primary_data": first_item
            }
            
            filtered.append(merged_event)
        
        # 按置信度排序
        filtered.sort(key=lambda x: x["combined_confidence"], reverse=True)
        
        return filtered
    
    def _group_anomalies_by_time(self, anomalies: List[Dict]) -> List[List[Dict]]:
        """按时间分组异常"""
        if not anomalies:
            return []
        
        # 按时间排序
        sorted_anomalies = sorted(anomalies, key=lambda x: x.get("timestamp", ""))
        
        groups = []
        current_group = [sorted_anomalies[0]]
        
        for i in range(1, len(sorted_anomalies)):
            prev_ts = self.parse_timestamp(current_group[-1].get("timestamp"))
            curr_ts = self.parse_timestamp(sorted_anomalies[i].get("timestamp"))
            
            if prev_ts and curr_ts:
                time_diff = (curr_ts - prev_ts).total_seconds()
                
                # 如果时间差在5分钟内，认为是同一事件
                if time_diff <= 300:
                    current_group.append(sorted_anomalies[i])
                    continue
            
            groups.append(current_group)
            current_group = [sorted_anomalies[i]]
        
        if current_group:
            groups.append(current_group)
        
        return groups
    
    def _check_group_is_normal_peak(self, group: List[Dict]) -> bool:
        """检查组是否为正常用水峰"""
        if not group:
            return False
        
        # 获取事件时间
        timestamps = [a.get("timestamp") for a in group if a.get("timestamp")]
        if not timestamps:
            return False
        
        # 解析时间
        parsed_timestamps = [self.parse_timestamp(ts) for ts in timestamps]
        parsed_timestamps = [ts for ts in parsed_timestamps if ts]
        
        if not parsed_timestamps:
            return False
        
        # 检查是否在用水高峰时段
        avg_hour = sum(ts.hour for ts in parsed_timestamps) / len(parsed_timestamps)
        
        # 典型用水高峰：早晨6-9点，晚上18-22点
        is_morning_peak = 6 <= avg_hour < 9
        is_evening_peak = 18 <= avg_hour < 23
        
        # 检查置信度是否较低
        confidences = [a.get("confidence", 0) for a in group]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0
        
        # 如果在高峰时段且置信度较低，可能是正常用水峰
        return (is_morning_peak or is_evening_peak) and avg_confidence < 0.5
