from typing import List
from datetime import datetime

from track_cleaner.rules.base import AnomalyRule, RuleResult, AnomalySeverity, AnomalyAction
from track_cleaner.models.track import Track
from track_cleaner.config import AppConfig
from track_cleaner.geo import calculate_speed


class SpeedAnomalyRule(AnomalyRule):
    
    @property
    def name(self) -> str:
        return "speed_anomaly"
    
    @property
    def description(self) -> str:
        return "检测瞬时速度不合理的点"
    
    def apply(self, track: Track, config: AppConfig) -> List[RuleResult]:
        results = []
        points = track.all_points
        speed_threshold = config.speed_threshold
        
        for idx in range(1, len(points)):
            prev_point = points[idx - 1]
            curr_point = points[idx]
            
            speed = calculate_speed(prev_point, curr_point)
            
            if speed is not None and speed > speed_threshold:
                result = RuleResult(
                    rule_name=self.name,
                    rule_description=self.description,
                    point_index=idx,
                    segment_index=None,
                    severity=AnomalySeverity.WARNING,
                    action=AnomalyAction.REMOVE,
                    message=f"速度异常: 第 {idx} 点速度为 {speed:.2f} km/h，超过阈值 {speed_threshold} km/h",
                    details={
                        "index": idx,
                        "speed_kmh": round(speed, 2),
                        "threshold_kmh": speed_threshold,
                    },
                )
                results.append(result)
        
        return results
