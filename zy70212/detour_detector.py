from dataclasses import dataclass
from datetime import timedelta
from typing import List, Dict, Optional
from enum import Enum
from geopy.distance import geodesic

from config import config
from data_manager import Order, TrajectoryPoint
from order_matcher import MatchResult


class AnomalyType(Enum):
    DETOUR_DISTANCE = "距离超限"
    DETOUR_TIME = "时间超限"
    STATIONARY_LONG = "长时间停留"
    PATH_DEVIATION = "路径偏离"
    SPEED_EXCEPTION = "速度异常"


@dataclass
class DetourSegment:
    start_index: int
    end_index: int
    segment_distance: float
    segment_time: int
    anomaly_type: AnomalyType
    description: str
    
    def to_dict(self) -> Dict:
        return {
            "start_index": self.start_index,
            "end_index": self.end_index,
            "segment_distance_meters": round(self.segment_distance, 2),
            "segment_time_seconds": self.segment_time,
            "anomaly_type": self.anomaly_type.value,
            "description": self.description
        }


@dataclass
class DetourAnalysis:
    order_id: str
    driver_id: str
    actual_distance: float
    planned_distance: float
    distance_ratio: float
    actual_duration: int
    expected_duration: int
    time_ratio: float
    detour_distance: float
    detour_segments: List[DetourSegment]
    stationary_segments: List[Dict]
    overall_risk_score: float
    conclusions: List[str]
    
    def to_dict(self) -> Dict:
        return {
            "order_id": self.order_id,
            "driver_id": self.driver_id,
            "actual_distance_meters": round(self.actual_distance, 2),
            "planned_distance_meters": round(self.planned_distance, 2),
            "distance_ratio": round(self.distance_ratio, 3),
            "actual_duration_seconds": self.actual_duration,
            "expected_duration_seconds": self.expected_duration,
            "time_ratio": round(self.time_ratio, 3),
            "detour_distance_meters": round(self.detour_distance, 2),
            "detour_segments_count": len(self.detour_segments),
            "detour_segments": [s.to_dict() for s in self.detour_segments],
            "stationary_segments_count": len(self.stationary_segments),
            "stationary_segments": self.stationary_segments,
            "overall_risk_score": round(self.overall_risk_score, 2),
            "conclusions": self.conclusions
        }


class DetourDetector:
    def __init__(self):
        pass
    
    def _calculate_trajectory_distance(self, points: List[TrajectoryPoint]) -> float:
        if len(points) < 2:
            return 0.0
        
        total = 0.0
        for i in range(1, len(points)):
            prev = (points[i-1].latitude, points[i-1].longitude)
            curr = (points[i].latitude, points[i].longitude)
            total += geodesic(prev, curr).meters
        return total
    
    def _detect_stationary_segments(self, points: List[TrajectoryPoint]) -> List[Dict]:
        stationary = []
        i = 0
        
        while i < len(points):
            start_i = i
            j = i + 1
            stationary_points = [points[i]]
            
            while j < len(points):
                dist = geodesic(
                    (points[start_i].latitude, points[start_i].longitude),
                    (points[j].latitude, points[j].longitude)
                ).meters
                
                if dist < 50:
                    stationary_points.append(points[j])
                    j += 1
                else:
                    break
            
            if j - start_i >= 2:
                duration = int((points[j-1].timestamp - points[start_i].timestamp).total_seconds())
                if duration >= config.STATIONARY_TIME_THRESHOLD:
                    stationary.append({
                        "start_index": start_i,
                        "end_index": j - 1,
                        "start_time": points[start_i].timestamp.isoformat(),
                        "end_time": points[j-1].timestamp.isoformat(),
                        "duration_seconds": duration,
                        "location": {
                            "latitude": points[start_i].latitude,
                            "longitude": points[start_i].longitude
                        },
                        "radius_meters": 50
                    })
            
            i = j
        
        return stationary
    
    def _detect_detour_segments(self, points: List[TrajectoryPoint], 
                                order: Order, 
                                planned_distance: float) -> List[DetourSegment]:
        segments = []
        if len(points) < 10:
            return segments
        
        window_size = 5
        for i in range(0, len(points) - window_size, window_size // 2):
            window = points[i:i + window_size]
            window_distance = self._calculate_trajectory_distance(window)
            
            if window_distance < 100:
                continue
            
            start_point = window[0]
            end_point = window[-1]
            
            direct_distance = geodesic(
                (start_point.latitude, start_point.longitude),
                (end_point.latitude, end_point.longitude)
            ).meters
            
            if direct_distance == 0:
                continue
            
            ratio = window_distance / direct_distance
            
            if ratio > 2.0:
                segment_time = int((end_point.timestamp - start_point.timestamp).total_seconds())
                segments.append(DetourSegment(
                    start_index=i,
                    end_index=i + window_size - 1,
                    segment_distance=window_distance,
                    segment_time=segment_time,
                    anomaly_type=AnomalyType.PATH_DEVIATION,
                    description=f"路径迂回: 实际{window_distance:.0f}米 vs 直线{direct_distance:.0f}米, 绕行{ratio-1:.1%}"
                ))
        
        return segments
    
    def _calculate_risk_score(self, distance_ratio: float, time_ratio: float,
                              detour_segments: List[DetourSegment],
                              stationary_segments: List[Dict]) -> float:
        risk = 0.0
        
        if distance_ratio > config.DETOUR_DISTANCE_THRESHOLD:
            risk += 30 * (distance_ratio / config.DETOUR_DISTANCE_THRESHOLD - 1)
        
        if time_ratio > config.DETOUR_TIME_RATIO:
            risk += 30 * (time_ratio / config.DETOUR_TIME_RATIO - 1)
        
        risk += len(detour_segments) * 15
        
        for seg in stationary_segments:
            duration_min = seg["duration_seconds"] / 60
            if duration_min >= 15:
                risk += min(25, duration_min * 0.5)
        
        return min(100, risk)
    
    def _generate_conclusions(self, analysis: 'DetourAnalysis', 
                              order: Order) -> List[str]:
        conclusions = []
        
        if analysis.distance_ratio >= config.DETOUR_DISTANCE_THRESHOLD:
            excess = analysis.actual_distance - analysis.planned_distance
            conclusions.append(
                f"【距离异常】实际行驶{analysis.actual_distance/1000:.2f}公里, "
                f"超出计划{excess/1000:.2f}公里, 超出比例{(analysis.distance_ratio-1)*100:.1f}%"
            )
        
        if analysis.time_ratio >= config.DETOUR_TIME_RATIO:
            excess = analysis.actual_duration - analysis.expected_duration
            conclusions.append(
                f"【时间异常】实际用时{analysis.actual_duration/60:.1f}分钟, "
                f"超出预期{excess/60:.1f}分钟, 超出比例{(analysis.time_ratio-1)*100:.1f}%"
            )
        
        if analysis.detour_segments:
            total_detour = sum(s.segment_distance for s in analysis.detour_segments)
            conclusions.append(
                f"【路径偏离】检测到{len(analysis.detour_segments)}处绕行路段, "
                f"总绕行距离约{total_detour/1000:.2f}公里"
            )
        
        if analysis.stationary_segments:
            total_stationary = sum(s["duration_seconds"] for s in analysis.stationary_segments)
            conclusions.append(
                f"【停留异常】检测到{len(analysis.stationary_segments)}处长时间停留, "
                f"累计{total_stationary/60:.1f}分钟"
            )
        
        if not conclusions:
            conclusions.append("【正常】未检测到明显异常")
        
        return conclusions
    
    def analyze(self, match_result: MatchResult, order: Order) -> Optional[DetourAnalysis]:
        if not match_result.matched_trajectories:
            return None
        
        points = match_result.matched_trajectories
        
        actual_distance = self._calculate_trajectory_distance(points)
        planned_distance = order.planned_distance * 1000 if order.planned_distance > 0 else actual_distance
        
        actual_duration = match_result.actual_duration
        expected_duration = order.expected_duration if order.expected_duration > 0 else actual_duration
        
        distance_ratio = actual_distance / planned_distance if planned_distance > 0 else 1.0
        time_ratio = actual_duration / expected_duration if expected_duration > 0 else 1.0
        
        detour_distance = max(0, actual_distance - planned_distance)
        
        stationary_segments = self._detect_stationary_segments(points)
        detour_segments = self._detect_detour_segments(points, order, planned_distance)
        
        risk_score = self._calculate_risk_score(
            distance_ratio, time_ratio, detour_segments, stationary_segments
        )
        
        analysis = DetourAnalysis(
            order_id=order.order_id,
            driver_id=order.driver_id,
            actual_distance=actual_distance,
            planned_distance=planned_distance,
            distance_ratio=distance_ratio,
            actual_duration=actual_duration,
            expected_duration=expected_duration,
            time_ratio=time_ratio,
            detour_distance=detour_distance,
            detour_segments=detour_segments,
            stationary_segments=stationary_segments,
            overall_risk_score=risk_score,
            conclusions=[]
        )
        
        analysis.conclusions = self._generate_conclusions(analysis, order)
        
        return analysis
