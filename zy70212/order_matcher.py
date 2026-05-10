from dataclasses import dataclass
from datetime import timedelta
from typing import List, Dict, Optional
from geopy.distance import geodesic

from config import config
from data_manager import DataManager, Order, TrajectoryPoint


@dataclass
class MatchResult:
    order_id: str
    driver_id: str
    matched_trajectories: List[TrajectoryPoint]
    start_point: Optional[TrajectoryPoint]
    end_point: Optional[TrajectoryPoint]
    actual_duration: int
    match_score: float
    match_reason: str
    
    def to_dict(self) -> Dict:
        return {
            "order_id": self.order_id,
            "driver_id": self.driver_id,
            "trajectory_count": len(self.matched_trajectories),
            "start_time": self.start_point.timestamp.isoformat() if self.start_point else None,
            "end_time": self.end_point.timestamp.isoformat() if self.end_point else None,
            "actual_duration_seconds": self.actual_duration,
            "match_score": self.match_score,
            "match_reason": self.match_reason
        }


class OrderMatcher:
    def __init__(self, data_manager: DataManager):
        self.data_manager = data_manager
        self.matches: Dict[str, MatchResult] = {}
    
    def _calculate_proximity(self, point: TrajectoryPoint, lat: float, lng: float) -> float:
        return geodesic((point.latitude, point.longitude), (lat, lng)).meters
    
    def _find_nearby_points(self, points: List[TrajectoryPoint], lat: float, 
                            lng: float, radius: float = 200) -> List[TrajectoryPoint]:
        return [p for p in points if self._calculate_proximity(p, lat, lng) <= radius]
    
    def match_order(self, order: Order) -> Optional[MatchResult]:
        driver_trajectories = self.data_manager.get_trajectories_by_driver(
            driver_id=order.driver_id,
            start_time=order.pickup_time - timedelta(seconds=config.MATCH_TIME_WINDOW),
            end_time=order.delivery_time + timedelta(seconds=config.MATCH_TIME_WINDOW)
        )
        
        if not driver_trajectories:
            return MatchResult(
                order_id=order.order_id,
                driver_id=order.driver_id,
                matched_trajectories=[],
                start_point=None,
                end_point=None,
                actual_duration=0,
                match_score=0.0,
                match_reason="未找到司机在订单时间范围内的轨迹"
            )
        
        origin_points = self._find_nearby_points(
            driver_trajectories, order.origin_lat, order.origin_lng
        )
        dest_points = self._find_nearby_points(
            driver_trajectories, order.dest_lat, order.dest_lng
        )
        
        if not origin_points:
            return MatchResult(
                order_id=order.order_id,
                driver_id=order.driver_id,
                matched_trajectories=driver_trajectories,
                start_point=None,
                end_point=None,
                actual_duration=0,
                match_score=0.3,
                match_reason="未在起点附近发现轨迹点"
            )
        
        if not dest_points:
            return MatchResult(
                order_id=order.order_id,
                driver_id=order.driver_id,
                matched_trajectories=driver_trajectories,
                start_point=min(origin_points, key=lambda p: p.timestamp),
                end_point=None,
                actual_duration=0,
                match_score=0.5,
                match_reason="未在终点附近发现轨迹点"
            )
        
        start_point = min(origin_points, key=lambda p: p.timestamp)
        end_point = max(dest_points, key=lambda p: p.timestamp)
        
        matched_trajectories = [
            p for p in driver_trajectories 
            if start_point.timestamp <= p.timestamp <= end_point.timestamp
        ]
        
        actual_duration = int((end_point.timestamp - start_point.timestamp).total_seconds()) if matched_trajectories else 0
        
        origin_distance = min(self._calculate_proximity(p, order.origin_lat, order.origin_lng) for p in origin_points)
        dest_distance = min(self._calculate_proximity(p, order.dest_lat, order.dest_lng) for p in dest_points)
        proximity_score = max(0, 1 - (origin_distance + dest_distance) / 400)
        
        time_match = 0.0
        if order.expected_duration > 0:
            time_ratio = actual_duration / order.expected_duration if order.expected_duration > 0 else 1.0
            time_match = max(0, 1 - abs(time_ratio - 1) / 2)
        
        trajectory_coverage = min(1.0, len(matched_trajectories) / 50)
        
        match_score = 0.5 * proximity_score + 0.3 * time_match + 0.2 * trajectory_coverage
        
        reason = f"匹配成功: 起点距离{origin_distance:.1f}米, 终点距离{dest_distance:.1f}米"
        
        result = MatchResult(
            order_id=order.order_id,
            driver_id=order.driver_id,
            matched_trajectories=matched_trajectories,
            start_point=start_point,
            end_point=end_point,
            actual_duration=actual_duration,
            match_score=match_score,
            match_reason=reason
        )
        
        self.matches[order.order_id] = result
        return result
    
    def match_all_orders(self) -> List[MatchResult]:
        results = []
        for order in self.data_manager.get_all_orders():
            result = self.match_order(order)
            if result:
                results.append(result)
        return results
    
    def get_match(self, order_id: str) -> Optional[MatchResult]:
        return self.matches.get(order_id)
