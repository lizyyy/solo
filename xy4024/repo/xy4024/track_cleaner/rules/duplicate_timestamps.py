from typing import List
from datetime import datetime

from track_cleaner.rules.base import AnomalyRule, RuleResult, AnomalySeverity, AnomalyAction
from track_cleaner.models.track import Track
from track_cleaner.config import AppConfig


class DuplicateTimestampRule(AnomalyRule):
    
    @property
    def name(self) -> str:
        return "duplicate_timestamp"
    
    @property
    def description(self) -> str:
        return "检测重复的时间戳"
    
    def apply(self, track: Track, config: AppConfig) -> List[RuleResult]:
        results = []
        points = track.all_points
        
        seen_timestamps = {}
        
        for idx, point in enumerate(points):
            if point.timestamp is not None:
                ts = point.timestamp
                if ts in seen_timestamps:
                    first_idx = seen_timestamps[ts]
                    result = RuleResult(
                        rule_name=self.name,
                        rule_description=self.description,
                        point_index=idx,
                        segment_index=None,
                        severity=AnomalySeverity.WARNING,
                        action=AnomalyAction.REMOVE,
                        message=f"时间戳重复: {ts} (与第 {first_idx} 点重复)",
                        details={
                            "duplicate_index": idx,
                            "first_index": first_idx,
                            "timestamp": ts.isoformat(),
                        },
                    )
                    results.append(result)
                else:
                    seen_timestamps[ts] = idx
        
        return results
