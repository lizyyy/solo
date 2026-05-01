from typing import List
from datetime import datetime

from track_cleaner.rules.base import AnomalyRule, RuleResult, AnomalySeverity, AnomalyAction
from track_cleaner.models.track import Track
from track_cleaner.config import AppConfig


class OutOfOrderTimestampRule(AnomalyRule):
    
    @property
    def name(self) -> str:
        return "out_of_order_timestamp"
    
    @property
    def description(self) -> str:
        return "检测时间倒序的点"
    
    def apply(self, track: Track, config: AppConfig) -> List[RuleResult]:
        results = []
        points = track.all_points
        
        for idx in range(1, len(points)):
            prev_point = points[idx - 1]
            curr_point = points[idx]
            
            if (prev_point.timestamp is not None and 
                curr_point.timestamp is not None and
                curr_point.timestamp < prev_point.timestamp):
                
                result = RuleResult(
                    rule_name=self.name,
                    rule_description=self.description,
                    point_index=idx,
                    segment_index=None,
                    severity=AnomalySeverity.ERROR,
                    action=AnomalyAction.REMOVE,
                    message=f"时间倒序: 第 {idx} 点时间 ({curr_point.timestamp}) 早于前一点 ({prev_point.timestamp})",
                    details={
                        "index": idx,
                        "prev_timestamp": prev_point.timestamp.isoformat(),
                        "curr_timestamp": curr_point.timestamp.isoformat(),
                        "time_diff_seconds": (prev_point.timestamp - curr_point.timestamp).total_seconds(),
                    },
                )
                results.append(result)
        
        return results
