from typing import List
from datetime import datetime

from track_cleaner.rules.base import AnomalyRule, RuleResult, AnomalySeverity, AnomalyAction
from track_cleaner.models.track import Track
from track_cleaner.config import AppConfig


class BreakpointRule(AnomalyRule):
    
    @property
    def name(self) -> str:
        return "breakpoint"
    
    @property
    def description(self) -> str:
        return "检测长时间断点"
    
    def apply(self, track: Track, config: AppConfig) -> List[RuleResult]:
        results = []
        points = track.all_points
        breakpoint_threshold = config.breakpoint_threshold
        
        for idx in range(1, len(points)):
            prev_point = points[idx - 1]
            curr_point = points[idx]
            
            if (prev_point.timestamp is not None and 
                curr_point.timestamp is not None):
                
                time_diff = (curr_point.timestamp - prev_point.timestamp).total_seconds()
                
                if time_diff > breakpoint_threshold:
                    result = RuleResult(
                        rule_name=self.name,
                        rule_description=self.description,
                        point_index=idx,
                        segment_index=None,
                        severity=AnomalySeverity.INFO,
                        action=AnomalyAction.SPLIT,
                        message=f"检测到断点: 第 {idx} 点与前一点间隔 {time_diff:.0f} 秒，超过阈值 {breakpoint_threshold} 秒",
                        details={
                            "index": idx,
                            "time_diff_seconds": time_diff,
                            "threshold_seconds": breakpoint_threshold,
                            "prev_timestamp": prev_point.timestamp.isoformat(),
                            "curr_timestamp": curr_point.timestamp.isoformat(),
                        },
                    )
                    results.append(result)
        
        return results
