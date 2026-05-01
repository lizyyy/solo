"""
阶段切分模块 - 按补料事件切分生长期、稳定期、衰退期
"""
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


class GrowthPhase(Enum):
    """生长阶段枚举"""
    LAG = "lag"
    EXPONENTIAL = "exponential"
    STATIONARY = "stationary"
    DECLINE = "decline"
    FEED = "feed"


@dataclass
class PhaseSegment:
    """阶段段"""
    phase: GrowthPhase
    start_time: datetime
    end_time: datetime
    start_index: int
    end_index: int
    duration_hours: float
    feed_event: Optional[Dict[str, Any]] = None
    statistics: Optional[Dict[str, Any]] = None


@dataclass
class PhaseSegmentationResult:
    """阶段切分结果"""
    segments: List[PhaseSegment]
    total_phases: Dict[str, int]
    time_range: Dict[str, datetime]
    feed_events: List[Dict[str, Any]]


class PhaseSegmenter:
    """阶段切分器"""
    
    def __init__(self, config: Any = None):
        self.config = config
        self.min_segment_duration = 0.5
    
    def segment_by_growth(
        self,
        merged_data: List[Dict[str, Any]],
        feed_events: List[Dict[str, Any]]
    ) -> PhaseSegmentationResult:
        """
        基于生长数据切分阶段
        
        Args:
            merged_data: 合并后的校准数据
            feed_events: 补料事件列表
            
        Returns:
            PhaseSegmentationResult对象
        """
        if not merged_data:
            return PhaseSegmentationResult(
                segments=[],
                total_phases={},
                time_range={},
                feed_events=feed_events
            )
        
        od_data = self._extract_od_series(merged_data)
        
        growth_phases = self._detect_growth_phases(od_data, merged_data)
        
        segments = self._integrate_feed_events(
            growth_phases, feed_events, merged_data
        )
        
        segments = self._merge_short_segments(segments)
        
        for segment in segments:
            segment.statistics = self._calculate_segment_statistics(
                segment, merged_data
            )
        
        total_phases = {}
        for segment in segments:
            phase_name = segment.phase.value
            total_phases[phase_name] = total_phases.get(phase_name, 0) + 1
        
        time_range = {
            "start": merged_data[0]["datetime"],
            "end": merged_data[-1]["datetime"]
        }
        
        return PhaseSegmentationResult(
            segments=segments,
            total_phases=total_phases,
            time_range=time_range,
            feed_events=feed_events
        )
    
    def _extract_od_series(self, merged_data: List[Dict[str, Any]]) -> List[Tuple[datetime, float]]:
        """
        提取OD600时间序列
        
        Args:
            merged_data: 合并后的数据
            
        Returns:
            (时间, OD值)元组列表
        """
        od_series = []
        for point in merged_data:
            if point.get("od600") is not None and point["od600"] > 0:
                od_series.append((point["datetime"], point["od600"]))
        return od_series
    
    def _detect_growth_phases(
        self,
        od_data: List[Tuple[datetime, float]],
        merged_data: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        检测生长阶段
        
        基于OD600的变化率检测：
        - 滞后期: 生长速率接近0
        - 指数期: 生长速率最大且稳定
        - 稳定期: 生长速率降为0
        - 衰退期: 生长速率为负
        
        Args:
            od_data: OD600数据
            merged_data: 完整数据
            
        Returns:
            阶段定义列表
        """
        if len(od_data) < 3:
            return [{
                "phase": GrowthPhase.LAG,
                "start_index": 0,
                "end_index": len(merged_data) - 1
            }]
        
        times = np.array([(t - od_data[0][0]).total_seconds() / 3600 for t, _ in od_data])
        od_values = np.array([od for _, od in od_data])
        
        growth_rates = self._calculate_growth_rates(times, od_values)
        
        phases = []
        current_phase = None
        phase_start_idx = 0
        
        for i, rate in enumerate(growth_rates):
            data_idx = self._find_closest_data_index(merged_data, od_data[i][0])
            
            if rate is None:
                continue
            
            phase = self._classify_phase_by_rate(rate, od_values[i])
            
            if phase != current_phase:
                if current_phase is not None:
                    phases.append({
                        "phase": current_phase,
                        "start_index": phase_start_idx,
                        "end_index": data_idx - 1 if data_idx > 0 else 0
                    })
                current_phase = phase
                phase_start_idx = data_idx
        
        if current_phase is not None and phase_start_idx < len(merged_data):
            phases.append({
                "phase": current_phase,
                "start_index": phase_start_idx,
                "end_index": len(merged_data) - 1
            })
        
        if not phases:
            phases = [{
                "phase": GrowthPhase.LAG,
                "start_index": 0,
                "end_index": len(merged_data) - 1
            }]
        
        return phases
    
    def _calculate_growth_rates(self, times: np.ndarray, od_values: np.ndarray) -> List[Optional[float]]:
        """
        计算比生长速率
        
        μ = d(ln(OD))/dt
        
        Args:
            times: 时间数组（小时）
            od_values: OD值数组
            
        Returns:
            生长速率列表
        """
        rates: List[Optional[float]] = []
        
        if len(times) < 2:
            return [None] * len(times)
        
        ln_od = np.log(od_values)
        
        for i in range(len(times)):
            if i == 0:
                if len(times) > 1:
                    dt = times[1] - times[0]
                    if dt > 0:
                        rate = (ln_od[1] - ln_od[0]) / dt
                        rates.append(rate)
                    else:
                        rates.append(None)
                else:
                    rates.append(None)
            elif i == len(times) - 1:
                dt = times[i] - times[i-1]
                if dt > 0:
                    rate = (ln_od[i] - ln_od[i-1]) / dt
                    rates.append(rate)
                else:
                    rates.append(None)
            else:
                dt = times[i+1] - times[i-1]
                if dt > 0:
                    rate = (ln_od[i+1] - ln_od[i-1]) / dt
                    rates.append(rate)
                else:
                    rates.append(None)
        
        return rates
    
    def _classify_phase_by_rate(self, growth_rate: float, current_od: float) -> GrowthPhase:
        """
        根据生长速率分类阶段
        
        Args:
            growth_rate: 比生长速率
            current_od: 当前OD值
            
        Returns:
            生长阶段
        """
        lag_threshold = 0.02
        stationary_threshold = 0.01
        decline_threshold = -0.005
        
        if current_od < 0.1:
            return GrowthPhase.LAG
        
        if growth_rate < decline_threshold:
            return GrowthPhase.DECLINE
        elif growth_rate < stationary_threshold:
            return GrowthPhase.STATIONARY
        elif growth_rate < lag_threshold:
            return GrowthPhase.LAG
        else:
            return GrowthPhase.EXPONENTIAL
    
    def _find_closest_data_index(self, merged_data: List[Dict[str, Any]], target_time: datetime) -> int:
        """
        查找最接近目标时间的数据索引
        
        Args:
            merged_data: 合并后的数据
            target_time: 目标时间
            
        Returns:
            索引
        """
        min_diff = float('inf')
        best_idx = 0
        
        for i, point in enumerate(merged_data):
            diff = abs((point["datetime"] - target_time).total_seconds())
            if diff < min_diff:
                min_diff = diff
                best_idx = i
        
        return best_idx
    
    def _integrate_feed_events(
        self,
        growth_phases: List[Dict[str, Any]],
        feed_events: List[Dict[str, Any]],
        merged_data: List[Dict[str, Any]]
    ) -> List[PhaseSegment]:
        """
        整合补料事件到阶段切分中
        
        Args:
            growth_phases: 生长阶段
            feed_events: 补料事件
            merged_data: 完整数据
            
        Returns:
            阶段段列表
        """
        segments: List[PhaseSegment] = []
        
        all_boundaries = set()
        
        for phase in growth_phases:
            all_boundaries.add(phase["start_index"])
            all_boundaries.add(phase["end_index"] + 1)
        
        feed_boundaries = {}
        for feed in feed_events:
            feed_time = datetime.fromisoformat(feed["time"])
            idx = self._find_closest_data_index(merged_data, feed_time)
            feed_boundaries[idx] = feed
            all_boundaries.add(idx)
        
        sorted_boundaries = sorted(all_boundaries)
        sorted_boundaries = [b for b in sorted_boundaries if b < len(merged_data)]
        if len(merged_data) - 1 not in sorted_boundaries:
            sorted_boundaries.append(len(merged_data) - 1)
        
        for i in range(len(sorted_boundaries) - 1):
            start_idx = sorted_boundaries[i]
            end_idx = sorted_boundaries[i + 1] - 1
            
            if start_idx > end_idx:
                end_idx = start_idx
            
            end_idx = min(end_idx, len(merged_data) - 1)
            
            phase = self._determine_phase_at_index(growth_phases, start_idx)
            feed_event = feed_boundaries.get(start_idx)
            
            if feed_event:
                phase = GrowthPhase.FEED
            
            start_time = merged_data[start_idx]["datetime"]
            end_time = merged_data[end_idx]["datetime"]
            duration = (end_time - start_time).total_seconds() / 3600
            
            segment = PhaseSegment(
                phase=phase,
                start_time=start_time,
                end_time=end_time,
                start_index=start_idx,
                end_index=end_idx,
                duration_hours=duration,
                feed_event=feed_event
            )
            segments.append(segment)
        
        return segments
    
    def _determine_phase_at_index(
        self,
        growth_phases: List[Dict[str, Any]],
        index: int
    ) -> GrowthPhase:
        """
        确定指定索引处的阶段
        
        Args:
            growth_phases: 生长阶段列表
            index: 数据索引
            
        Returns:
            生长阶段
        """
        for phase in growth_phases:
            if phase["start_index"] <= index <= phase["end_index"]:
                return phase["phase"]
        
        if growth_phases:
            return growth_phases[-1]["phase"]
        return GrowthPhase.LAG
    
    def _merge_short_segments(self, segments: List[PhaseSegment]) -> List[PhaseSegment]:
        """
        合并过短的阶段
        
        Args:
            segments: 阶段段列表
            
        Returns:
            合并后的列表
        """
        if len(segments) < 2:
            return segments
        
        merged: List[PhaseSegment] = []
        current = segments[0]
        
        for next_seg in segments[1:]:
            if (current.duration_hours < self.min_segment_duration and 
                current.phase == next_seg.phase):
                current = PhaseSegment(
                    phase=current.phase,
                    start_time=current.start_time,
                    end_time=next_seg.end_time,
                    start_index=current.start_index,
                    end_index=next_seg.end_index,
                    duration_hours=(next_seg.end_time - current.start_time).total_seconds() / 3600,
                    feed_event=current.feed_event or next_seg.feed_event
                )
            elif (current.duration_hours < self.min_segment_duration and 
                  current.phase != GrowthPhase.FEED and
                  next_seg.phase != GrowthPhase.FEED):
                current = PhaseSegment(
                    phase=next_seg.phase,
                    start_time=current.start_time,
                    end_time=next_seg.end_time,
                    start_index=current.start_index,
                    end_index=next_seg.end_index,
                    duration_hours=(next_seg.end_time - current.start_time).total_seconds() / 3600,
                    feed_event=next_seg.feed_event
                )
            else:
                merged.append(current)
                current = next_seg
        
        merged.append(current)
        return merged
    
    def _calculate_segment_statistics(
        self,
        segment: PhaseSegment,
        merged_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        计算阶段的统计数据
        
        Args:
            segment: 阶段段
            merged_data: 完整数据
            
        Returns:
            统计数据字典
        """
        segment_data = merged_data[segment.start_index:segment.end_index + 1]
        
        if not segment_data:
            return {}
        
        ph_values = [p["ph"] for p in segment_data if p.get("ph") is not None]
        temp_values = [p["temperature"] for p in segment_data if p.get("temperature") is not None]
        do_values = [p["dissolved_oxygen"] for p in segment_data if p.get("dissolved_oxygen") is not None]
        od_values = [p["od600"] for p in segment_data if p.get("od600") is not None]
        
        stats = {
            "data_points": len(segment_data),
            "od600_points": len(od_values),
        }
        
        if ph_values:
            stats["ph"] = {
                "min": min(ph_values),
                "max": max(ph_values),
                "mean": sum(ph_values) / len(ph_values),
                "start": ph_values[0] if ph_values else None,
                "end": ph_values[-1] if ph_values else None
            }
        
        if temp_values:
            stats["temperature"] = {
                "min": min(temp_values),
                "max": max(temp_values),
                "mean": sum(temp_values) / len(temp_values)
            }
        
        if do_values:
            stats["dissolved_oxygen"] = {
                "min": min(do_values),
                "max": max(do_values),
                "mean": sum(do_values) / len(do_values)
            }
        
        if od_values:
            stats["od600"] = {
                "min": min(od_values),
                "max": max(od_values),
                "start": od_values[0],
                "end": od_values[-1]
            }
            if len(od_values) >= 2:
                stats["od600"]["growth"] = od_values[-1] - od_values[0]
        
        return stats


def segment_phases(
    calibration_result: Dict[str, Any],
    config: Any = None
) -> Dict[str, Any]:
    """
    执行阶段切分的主函数
    
    Args:
        calibration_result: 校准流水线的输出
        config: 配置对象
        
    Returns:
        包含阶段切分结果的字典
    """
    if "error" in calibration_result:
        return calibration_result
    
    merged_data = calibration_result.get("merged_data", [])
    feed_events = calibration_result.get("feed_events", [])
    
    if not merged_data:
        return {"error": "没有数据进行阶段切分"}
    
    segmenter = PhaseSegmenter(config)
    result = segmenter.segment_by_growth(merged_data, feed_events)
    
    segments_dict = []
    for segment in result.segments:
        seg_dict = {
            "phase": segment.phase.value,
            "start_time": segment.start_time.isoformat(),
            "end_time": segment.end_time.isoformat(),
            "start_index": segment.start_index,
            "end_index": segment.end_index,
            "duration_hours": round(segment.duration_hours, 2),
            "feed_event": segment.feed_event,
            "statistics": segment.statistics
        }
        segments_dict.append(seg_dict)
    
    return {
        "segments": segments_dict,
        "total_phases": result.total_phases,
        "time_range": {
            "start": result.time_range["start"].isoformat(),
            "end": result.time_range["end"].isoformat()
        },
        "feed_events": result.feed_events,
        "phase_summary": _generate_phase_summary(result.segments)
    }


def _generate_phase_summary(segments: List[PhaseSegment]) -> Dict[str, Any]:
    """
    生成阶段摘要
    
    Args:
        segments: 阶段段列表
        
    Returns:
        摘要字典
    """
    summary = {
        "total_duration_hours": 0.0,
        "phase_durations": {},
        "feed_count": 0
    }
    
    for segment in segments:
        phase_name = segment.phase.value
        summary["total_duration_hours"] += segment.duration_hours
        
        if phase_name not in summary["phase_durations"]:
            summary["phase_durations"][phase_name] = {
                "count": 0,
                "total_hours": 0.0
            }
        
        summary["phase_durations"][phase_name]["count"] += 1
        summary["phase_durations"][phase_name]["total_hours"] += segment.duration_hours
        
        if segment.feed_event:
            summary["feed_count"] += 1
    
    summary["total_duration_hours"] = round(summary["total_duration_hours"], 2)
    for phase_data in summary["phase_durations"].values():
        phase_data["total_hours"] = round(phase_data["total_hours"], 2)
    
    return summary
