"""
时钟同步模块 - 用于时间校准和时间漂移检测
"""
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
import numpy as np


@dataclass
class TimeDriftInfo:
    """时间漂移信息"""
    source_name: str
    reference_name: str
    total_drift: float  # 总漂移（秒）
    drift_rate: float   # 漂移率（秒/秒）
    max_drift: float    # 最大漂移
    min_drift: float    # 最小漂移
    average_drift: float  # 平均漂移
    drift_points: List[Tuple[float, float]]  # 漂移点列表（参考时间, 漂移值）
    is_synchronized: bool = False
    synchronization_offset: Optional[float] = None


@dataclass
class SynchronizationResult:
    """同步结果"""
    reference_source: str
    synchronized_sources: List[str]
    drift_info: Dict[str, TimeDriftInfo]
    time_range: Tuple[float, float]
    synchronization_quality: float  # 0-1，1表示完美同步


class ClockSynchronizer:
    """时钟同步器"""
    
    def __init__(self, max_acceptable_drift: float = 0.1):
        """
        初始化时钟同步器
        
        Args:
            max_acceptable_drift: 最大可接受的时间漂移（秒）
        """
        self.max_acceptable_drift = max_acceptable_drift
        self.time_series: Dict[str, List[float]] = {}
        self.reference_source: Optional[str] = None
        
    def add_time_series(self, source_name: str, timestamps: List[float]):
        """
        添加时间序列数据
        
        Args:
            source_name: 数据源名称
            timestamps: 时间戳列表
        """
        if not timestamps:
            raise ValueError(f"时间序列为空: {source_name}")
        
        # 确保时间戳已排序
        sorted_timestamps = sorted(timestamps)
        self.time_series[source_name] = sorted_timestamps
        
    def set_reference(self, source_name: str):
        """
        设置参考时钟源
        
        Args:
            source_name: 数据源名称
        """
        if source_name not in self.time_series:
            raise ValueError(f"未知的数据源: {source_name}")
        
        self.reference_source = source_name
        
    def auto_detect_reference(self) -> str:
        """
        自动检测最佳参考时钟源
        
        选择时间戳数量最多、时间范围最广的数据源作为参考
        
        Returns:
            最佳参考数据源名称
        """
        if not self.time_series:
            raise ValueError("没有可用的时间序列")
        
        # 评分标准：
        # 1. 时间戳数量（权重40%）
        # 2. 时间范围（权重30%）
        # 3. 时间戳均匀性（权重30%）
        
        scores = {}
        
        for source_name, timestamps in self.time_series.items():
            count_score = len(timestamps)
            
            time_range = timestamps[-1] - timestamps[0]
            
            # 计算时间戳均匀性
            if len(timestamps) > 1:
                intervals = [timestamps[i+1] - timestamps[i] for i in range(len(timestamps)-1)]
                avg_interval = sum(intervals) / len(intervals)
                variance = sum((x - avg_interval) ** 2 for x in intervals) / len(intervals)
                uniformity = 1.0 / (1.0 + variance)  # 方差越小，均匀性越高
            else:
                uniformity = 0
            
            scores[source_name] = {
                "count": count_score,
                "range": time_range,
                "uniformity": uniformity
            }
        
        # 归一化评分
        max_count = max(s["count"] for s in scores.values()) if scores else 1
        max_range = max(s["range"] for s in scores.values()) if scores else 1
        
        final_scores = {}
        for source_name, s in scores.items():
            count_norm = s["count"] / max_count if max_count > 0 else 0
            range_norm = s["range"] / max_range if max_range > 0 else 0
            uniformity_norm = s["uniformity"]
            
            final_score = (count_norm * 0.4) + (range_norm * 0.3) + (uniformity_norm * 0.3)
            final_scores[source_name] = final_score
        
        # 选择评分最高的
        best_source = max(final_scores, key=final_scores.get)
        self.reference_source = best_source
        
        return best_source
    
    def analyze_time_drift(self, source_name: str, reference_name: Optional[str] = None) -> TimeDriftInfo:
        """
        分析时间漂移
        
        Args:
            source_name: 要分析的数据源名称
            reference_name: 参考数据源名称，如果为None则使用默认参考源
            
        Returns:
            时间漂移信息
        """
        if source_name not in self.time_series:
            raise ValueError(f"未知的数据源: {source_name}")
        
        # 确定参考源
        ref_name = reference_name or self.reference_source
        if ref_name is None:
            # 自动选择参考源
            ref_name = self.auto_detect_reference()
        
        if ref_name not in self.time_series:
            raise ValueError(f"未知的参考数据源: {ref_name}")
        
        if source_name == ref_name:
            # 自身比较，没有漂移
            return TimeDriftInfo(
                source_name=source_name,
                reference_name=ref_name,
                total_drift=0.0,
                drift_rate=0.0,
                max_drift=0.0,
                min_drift=0.0,
                average_drift=0.0,
                drift_points=[],
                is_synchronized=True,
                synchronization_offset=0.0
            )
        
        source_timestamps = self.time_series[source_name]
        reference_timestamps = self.time_series[ref_name]
        
        # 找到重叠的时间范围
        source_start, source_end = source_timestamps[0], source_timestamps[-1]
        ref_start, ref_end = reference_timestamps[0], reference_timestamps[-1]
        
        overlap_start = max(source_start, ref_start)
        overlap_end = min(source_end, ref_end)
        
        if overlap_start >= overlap_end:
            # 没有重叠时间范围
            return TimeDriftInfo(
                source_name=source_name,
                reference_name=ref_name,
                total_drift=float('inf'),
                drift_rate=float('inf'),
                max_drift=float('inf'),
                min_drift=float('-inf'),
                average_drift=float('inf'),
                drift_points=[],
                is_synchronized=False,
                synchronization_offset=None
            )
        
        # 计算漂移点
        drift_points = []
        
        # 使用插值法计算漂移
        # 对于源中的每个时间戳，找到参考中最近的时间戳
        
        for src_ts in source_timestamps:
            if overlap_start <= src_ts <= overlap_end:
                # 在参考时间戳中找到最接近的时间
                closest_idx = np.searchsorted(reference_timestamps, src_ts)
                
                if closest_idx == 0:
                    ref_ts = reference_timestamps[0]
                elif closest_idx == len(reference_timestamps):
                    ref_ts = reference_timestamps[-1]
                else:
                    # 在两个点之间插值
                    before = reference_timestamps[closest_idx - 1]
                    after = reference_timestamps[closest_idx]
                    
                    # 线性插值
                    if after != before:
                        ratio = (src_ts - before) / (after - before)
                        ref_ts = before + ratio * (after - before)
                    else:
                        ref_ts = before
                
                # 计算漂移
                drift = src_ts - ref_ts
                drift_points.append((src_ts, drift))
        
        if not drift_points:
            return TimeDriftInfo(
                source_name=source_name,
                reference_name=ref_name,
                total_drift=0.0,
                drift_rate=0.0,
                max_drift=0.0,
                min_drift=0.0,
                average_drift=0.0,
                drift_points=[],
                is_synchronized=True,
                synchronization_offset=0.0
            )
        
        # 计算统计信息
        drifts = [d for _, d in drift_points]
        
        total_drift = drift_points[-1][1] - drift_points[0][1]
        time_duration = drift_points[-1][0] - drift_points[0][0]
        
        drift_rate = total_drift / time_duration if time_duration > 0 else 0.0
        
        max_drift = max(drifts)
        min_drift = min(drifts)
        average_drift = sum(drifts) / len(drifts)
        
        # 检查是否同步
        is_synchronized = abs(average_drift) <= self.max_acceptable_drift
        
        # 计算同步偏移（平均漂移）
        synchronization_offset = average_drift if is_synchronized else None
        
        return TimeDriftInfo(
            source_name=source_name,
            reference_name=ref_name,
            total_drift=total_drift,
            drift_rate=drift_rate,
            max_drift=max_drift,
            min_drift=min_drift,
            average_drift=average_drift,
            drift_points=drift_points,
            is_synchronized=is_synchronized,
            synchronization_offset=synchronization_offset
        )
    
    def synchronize_all(self) -> SynchronizationResult:
        """
        同步所有数据源
        
        Returns:
            同步结果
        """
        if not self.time_series:
            raise ValueError("没有可用的时间序列")
        
        # 确保有参考源
        if self.reference_source is None:
            self.auto_detect_reference()
        
        if self.reference_source is None:
            raise ValueError("无法确定参考数据源")
        
        # 分析每个数据源的漂移
        drift_info = {}
        for source_name in self.time_series.keys():
            info = self.analyze_time_drift(source_name)
            drift_info[source_name] = info
        
        # 计算时间范围
        all_starts = [ts[0] for ts in self.time_series.values()]
        all_ends = [ts[-1] for ts in self.time_series.values()]
        
        time_range = (min(all_starts), max(all_ends))
        
        # 计算同步质量
        # 基于平均漂移和漂移率
        quality_scores = []
        for info in drift_info.values():
            if info.is_synchronized:
                # 同步质量与平均漂移成反比
                drift_factor = 1.0 - min(1.0, abs(info.average_drift) / self.max_acceptable_drift)
                quality_scores.append(drift_factor)
            else:
                quality_scores.append(0.0)
        
        synchronization_quality = sum(quality_scores) / len(quality_scores) if quality_scores else 0.0
        
        return SynchronizationResult(
            reference_source=self.reference_source,
            synchronized_sources=list(self.time_series.keys()),
            drift_info=drift_info,
            time_range=time_range,
            synchronization_quality=synchronization_quality
        )
    
    def get_synchronized_timestamp(self, source_name: str, original_timestamp: float) -> float:
        """
        获取同步后的时间戳
        
        Args:
            source_name: 数据源名称
            original_timestamp: 原始时间戳
            
        Returns:
            同步后的时间戳（基于参考时钟）
        """
        if source_name not in self.time_series:
            raise ValueError(f"未知的数据源: {source_name}")
        
        if self.reference_source is None:
            self.auto_detect_reference()
        
        if self.reference_source is None:
            raise ValueError("无法确定参考数据源")
        
        if source_name == self.reference_source:
            return original_timestamp
        
        # 获取漂移信息
        drift_info = self.analyze_time_drift(source_name)
        
        # 使用平均漂移进行修正
        if drift_info.synchronization_offset is not None:
            return original_timestamp - drift_info.synchronization_offset
        
        # 如果没有同步偏移，使用线性插值
        if not drift_info.drift_points:
            return original_timestamp
        
        # 找到最接近的漂移点
        drift_timestamps = [t for t, _ in drift_info.drift_points]
        drift_values = [d for _, d in drift_info.drift_points]
        
        idx = np.searchsorted(drift_timestamps, original_timestamp)
        
        if idx == 0:
            drift = drift_values[0]
        elif idx == len(drift_timestamps):
            drift = drift_values[-1]
        else:
            # 线性插值
            t_before, d_before = drift_timestamps[idx-1], drift_values[idx-1]
            t_after, d_after = drift_timestamps[idx], drift_values[idx]
            
            if t_after != t_before:
                ratio = (original_timestamp - t_before) / (t_after - t_before)
                drift = d_before + ratio * (d_after - d_before)
            else:
                drift = d_before
        
        # 应用漂移修正
        return original_timestamp - drift
    
    def validate_frame_order(self, source_name: str) -> Dict[str, Any]:
        """
        验证帧顺序
        
        Args:
            source_name: 数据源名称
            
        Returns:
            验证结果
        """
        if source_name not in self.time_series:
            raise ValueError(f"未知的数据源: {source_name}")
        
        timestamps = self.time_series[source_name]
        
        # 检查时间戳是否非递减
        out_of_order_count = 0
        out_of_order_indices = []
        
        for i in range(1, len(timestamps)):
            if timestamps[i] < timestamps[i-1]:
                out_of_order_count += 1
                out_of_order_indices.append(i)
        
        # 计算时间间隔统计
        if len(timestamps) > 1:
            intervals = [timestamps[i] - timestamps[i-1] for i in range(1, len(timestamps))]
            avg_interval = sum(intervals) / len(intervals)
            max_interval = max(intervals)
            min_interval = min(intervals)
            
            # 检测异常大的间隔（可能表示丢帧）
            threshold = avg_interval * 3.0  # 3倍平均间隔
            large_intervals = [i for i, interval in enumerate(intervals) if interval > threshold]
        else:
            avg_interval = 0
            max_interval = 0
            min_interval = 0
            large_intervals = []
        
        return {
            "source_name": source_name,
            "total_frames": len(timestamps),
            "out_of_order_count": out_of_order_count,
            "out_of_order_indices": out_of_order_indices,
            "is_ordered": out_of_order_count == 0,
            "time_intervals": {
                "average": avg_interval,
                "max": max_interval,
                "min": min_interval
            },
            "potential_missing_frames": {
                "count": len(large_intervals),
                "indices": large_intervals
            }
        }
    
    def get_statistics(self) -> Dict[str, Any]:
        """
        获取时钟同步统计信息
        
        Returns:
            统计信息字典
        """
        if not self.time_series:
            return {
                "total_sources": 0,
                "reference_source": None,
                "source_statistics": {},
                "overall_time_range": None
            }
        
        source_stats = {}
        all_starts = []
        all_ends = []
        
        for source_name, timestamps in self.time_series.items():
            start = timestamps[0]
            end = timestamps[-1]
            duration = end - start
            
            all_starts.append(start)
            all_ends.append(end)
            
            # 计算帧率
            if duration > 0:
                frame_rate = len(timestamps) / duration
            else:
                frame_rate = 0
            
            source_stats[source_name] = {
                "frame_count": len(timestamps),
                "time_range": {
                    "start": start,
                    "end": end,
                    "duration": duration
                },
                "average_frame_rate": frame_rate
            }
        
        return {
            "total_sources": len(self.time_series),
            "reference_source": self.reference_source,
            "source_statistics": source_stats,
            "overall_time_range": {
                "start": min(all_starts),
                "end": max(all_ends),
                "duration": max(all_ends) - min(all_starts)
            }
        }
