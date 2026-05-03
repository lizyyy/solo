from dataclasses import dataclass
from datetime import datetime
from typing import List, Tuple, Optional
import math

from .geo import Point, haversine_distance
from .models import TrackPoint, Issue, IssueType, IssueSeverity
from .time_utils import time_diff_seconds, is_time_ordered


@dataclass
class RiskResult:
    issues: List[Issue] = None
    avg_speed_knots: float = 0.0
    max_speed_knots: float = 0.0
    min_speed_knots: float = 0.0
    speed_variance: float = 0.0
    has_out_of_order: bool = False
    out_of_order_count: int = 0
    speed_spike_count: int = 0


class RiskDetector:
    def __init__(
        self,
        track_points: List[TrackPoint],
        config: Optional[dict] = None
    ):
        self.track_points = track_points
        self.config = config or {}
        
        self.speed_spike_threshold_ratio = self.config.get('speed_spike_threshold_ratio', 2.0)
        self.speed_spike_threshold_abs = self.config.get('speed_spike_threshold_abs', 5.0)
        self.min_time_gap_seconds = self.config.get('min_time_gap_seconds', 1.0)
        self.issue_counter = 0
    
    def detect(self) -> RiskResult:
        result = RiskResult(issues=[])
        
        if not self.track_points:
            return result
        
        self._check_time_order(result)
        self._check_speed_spikes(result)
        self._calculate_speed_stats(result)
        
        return result
    
    def _check_time_order(self, result: RiskResult):
        timestamps = [tp.timestamp for tp in self.track_points]
        is_ordered, out_of_order_indices = is_time_ordered(timestamps)
        
        if not is_ordered:
            result.has_out_of_order = True
            result.out_of_order_count = len(out_of_order_indices)
            
            for idx in out_of_order_indices:
                if idx <= 0 or idx >= len(self.track_points):
                    continue
                
                prev_tp = self.track_points[idx - 1]
                curr_tp = self.track_points[idx]
                
                diff_seconds = time_diff_seconds(prev_tp.timestamp, curr_tp.timestamp)
                
                self.issue_counter += 1
                result.issues.append(Issue(
                    issue_id=f"ISSUE_{self.issue_counter:04d}",
                    issue_type=IssueType.OUT_OF_ORDER,
                    severity=IssueSeverity.HIGH,
                    description=f"轨迹时间乱序: 第{idx}点时间回退 {abs(diff_seconds):.1f}秒",
                    location=curr_tp.point,
                    start_time=curr_tp.timestamp,
                    related_track_index=[idx-1, idx],
                    metrics={
                        "time_diff_seconds": diff_seconds,
                        "prev_time": prev_tp.timestamp.isoformat(),
                        "curr_time": curr_tp.timestamp.isoformat()
                    }
                ))
    
    def _check_speed_spikes(self, result: RiskResult):
        if len(self.track_points) < 2:
            return
        
        speeds = []
        valid_speed_indices = []
        
        for i in range(len(self.track_points)):
            tp = self.track_points[i]
            if tp.speed > 0:
                speeds.append(tp.speed)
                valid_speed_indices.append(i)
        
        if len(speeds) < 3:
            return
        
        avg_speed = sum(speeds) / len(speeds)
        
        for i in range(1, len(self.track_points)):
            prev_tp = self.track_points[i-1]
            curr_tp = self.track_points[i]
            
            time_diff = time_diff_seconds(prev_tp.timestamp, curr_tp.timestamp)
            
            if time_diff < self.min_time_gap_seconds:
                continue
            
            if prev_tp.speed > 0 and curr_tp.speed > 0:
                speed_diff = abs(curr_tp.speed - prev_tp.speed)
                speed_ratio = max(curr_tp.speed, prev_tp.speed) / min(curr_tp.speed, prev_tp.speed) if min(curr_tp.speed, prev_tp.speed) > 0 else 0
                
                is_spike = (
                    speed_diff > self.speed_spike_threshold_abs or
                    (speed_ratio > self.speed_spike_threshold_ratio and speed_diff > 2.0)
                )
                
                if is_spike:
                    result.speed_spike_count += 1
                    
                    severity = self._speed_spike_severity(speed_diff, speed_ratio)
                    
                    self.issue_counter += 1
                    result.issues.append(Issue(
                        issue_id=f"ISSUE_{self.issue_counter:04d}",
                        issue_type=IssueType.SPEED_SPIKE,
                        severity=severity,
                        description=f"速度突变: {prev_tp.speed:.1f} -> {curr_tp.speed:.1f} 节 (变化 {speed_diff:.1f}节)",
                        location=curr_tp.point,
                        start_time=prev_tp.timestamp,
                        end_time=curr_tp.timestamp,
                        related_track_index=[i-1, i],
                        metrics={
                            "prev_speed_knots": prev_tp.speed,
                            "curr_speed_knots": curr_tp.speed,
                            "speed_diff_knots": speed_diff,
                            "speed_ratio": speed_ratio,
                            "time_diff_seconds": time_diff
                        }
                    ))
            
            if prev_tp.point and curr_tp.point and time_diff > 0:
                dist_m = haversine_distance(prev_tp.point, curr_tp.point)
                dist_nm = dist_m / 1852.0
                time_hours = time_diff / 3600.0
                
                if time_hours > 0:
                    calc_speed = dist_nm / time_hours
                    
                    if curr_tp.speed > 0:
                        speed_diff_from_calc = abs(curr_tp.speed - calc_speed)
                        
                        if speed_diff_from_calc > 5.0 and calc_speed > 0:
                            pos_mismatch_ratio = max(curr_tp.speed, calc_speed) / min(curr_tp.speed, calc_speed)
                            
                            if pos_mismatch_ratio > 2.0:
                                result.speed_spike_count += 1
                                
                                self.issue_counter += 1
                                result.issues.append(Issue(
                                    issue_id=f"ISSUE_{self.issue_counter:04d}",
                                    issue_type=IssueType.SPEED_SPIKE,
                                    severity=IssueSeverity.MEDIUM,
                                    description=f"位置与速度不匹配: 记录速度 {curr_tp.speed:.1f}节, 计算速度 {calc_speed:.1f}节",
                                    location=curr_tp.point,
                                    start_time=prev_tp.timestamp,
                                    end_time=curr_tp.timestamp,
                                    related_track_index=[i-1, i],
                                    metrics={
                                        "recorded_speed_knots": curr_tp.speed,
                                        "calculated_speed_knots": calc_speed,
                                        "distance_nm": dist_nm,
                                        "time_hours": time_hours
                                    }
                                ))
    
    def _calculate_speed_stats(self, result: RiskResult):
        valid_speeds = [tp.speed for tp in self.track_points if tp.speed > 0]
        
        if not valid_speeds:
            return
        
        result.avg_speed_knots = sum(valid_speeds) / len(valid_speeds)
        result.max_speed_knots = max(valid_speeds)
        result.min_speed_knots = min(valid_speeds)
        
        if len(valid_speeds) > 1:
            variance = sum((s - result.avg_speed_knots) ** 2 for s in valid_speeds) / len(valid_speeds)
            result.speed_variance = variance
    
    def _speed_spike_severity(self, speed_diff_knots: float, ratio: float) -> IssueSeverity:
        if speed_diff_knots > 10 or ratio > 5:
            return IssueSeverity.CRITICAL
        elif speed_diff_knots > 5 or ratio > 3:
            return IssueSeverity.HIGH
        elif speed_diff_knots > 3 or ratio > 2:
            return IssueSeverity.MEDIUM
        else:
            return IssueSeverity.LOW
