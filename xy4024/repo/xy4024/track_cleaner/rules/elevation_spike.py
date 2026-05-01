from typing import List
from datetime import datetime

from track_cleaner.rules.base import AnomalyRule, RuleResult, AnomalySeverity, AnomalyAction
from track_cleaner.models.track import Track
from track_cleaner.config import AppConfig


class ElevationSpikeRule(AnomalyRule):
    
    @property
    def name(self) -> str:
        return "elevation_spike"
    
    @property
    def description(self) -> str:
        return "检测海拔尖峰"
    
    def apply(self, track: Track, config: AppConfig) -> List[RuleResult]:
        results = []
        points = track.all_points
        elevation_threshold = config.elevation_spike_threshold
        
        for idx in range(1, len(points) - 1):
            prev_point = points[idx - 1]
            curr_point = points[idx]
            next_point = points[idx + 1]
            
            if (prev_point.elevation is not None and
                curr_point.elevation is not None and
                next_point.elevation is not None):
                
                elev_up = curr_point.elevation - prev_point.elevation
                elev_down = curr_point.elevation - next_point.elevation
                
                if (elev_up > elevation_threshold and 
                    elev_down > elevation_threshold):
                    
                    result = RuleResult(
                        rule_name=self.name,
                        rule_description=self.description,
                        point_index=idx,
                        segment_index=None,
                        severity=AnomalySeverity.WARNING,
                        action=AnomalyAction.REMOVE,
                        message=f"海拔尖峰: 第 {idx} 点海拔 {curr_point.elevation:.1f}m，比前后分别高出 {elev_up:.1f}m 和 {elev_down:.1f}m",
                        details={
                            "index": idx,
                            "elevation": curr_point.elevation,
                            "rise_prev": round(elev_up, 1),
                            "rise_next": round(elev_down, 1),
                            "threshold": elevation_threshold,
                        },
                    )
                    results.append(result)
                
                elif (elev_up < -elevation_threshold and 
                      elev_down < -elevation_threshold):
                    
                    result = RuleResult(
                        rule_name=self.name,
                        rule_description=self.description,
                        point_index=idx,
                        segment_index=None,
                        severity=AnomalySeverity.WARNING,
                        action=AnomalyAction.REMOVE,
                        message=f"海拔深谷: 第 {idx} 点海拔 {curr_point.elevation:.1f}m，比前后分别低出 {abs(elev_up):.1f}m 和 {abs(elev_down):.1f}m",
                        details={
                            "index": idx,
                            "elevation": curr_point.elevation,
                            "drop_prev": round(abs(elev_up), 1),
                            "drop_next": round(abs(elev_down), 1),
                            "threshold": elevation_threshold,
                        },
                    )
                    results.append(result)
        
        return results
