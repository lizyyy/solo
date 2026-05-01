from typing import List
from datetime import datetime

from track_cleaner.rules.base import AnomalyRule, RuleResult, AnomalySeverity, AnomalyAction
from track_cleaner.models.track import Track
from track_cleaner.config import AppConfig


class MissingCoordinatesRule(AnomalyRule):
    
    @property
    def name(self) -> str:
        return "missing_coordinates"
    
    @property
    def description(self) -> str:
        return "检测坐标缺失的点"
    
    def apply(self, track: Track, config: AppConfig) -> List[RuleResult]:
        results = []
        points = track.all_points
        
        for idx, point in enumerate(points):
            issues = []
            
            if point.latitude is None:
                issues.append("纬度缺失")
            if point.longitude is None:
                issues.append("经度缺失")
            
            if issues:
                result = RuleResult(
                    rule_name=self.name,
                    rule_description=self.description,
                    point_index=idx,
                    segment_index=None,
                    severity=AnomalySeverity.ERROR,
                    action=AnomalyAction.REMOVE,
                    message=f"坐标缺失: 第 {idx} 点 {', '.join(issues)}",
                    details={
                        "index": idx,
                        "issues": issues,
                        "latitude": point.latitude,
                        "longitude": point.longitude,
                    },
                )
                results.append(result)
        
        return results
