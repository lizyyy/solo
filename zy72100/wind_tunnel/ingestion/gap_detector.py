from datetime import datetime, timedelta
from typing import List, Tuple

from ..models.models import SensorRecord, DataGap


class GapDetector:
    def __init__(self, expected_interval_sec: float = 1.0, tolerance_ratio: float = 2.5):
        self.expected_interval = expected_interval_sec
        self.tolerance_ratio = tolerance_ratio
        self.gaps: List[DataGap] = []

    def detect(self, records: List[SensorRecord]) -> List[DataGap]:
        if len(records) < 2:
            return []

        sorted_records = sorted(records, key=lambda r: r.timestamp)
        gaps = []

        for i in range(1, len(sorted_records)):
            prev = sorted_records[i - 1]
            curr = sorted_records[i]
            gap_sec = (curr.timestamp - prev.timestamp).total_seconds()

            if gap_sec > self.expected_interval * self.tolerance_ratio:
                gap = DataGap(
                    start_time=prev.timestamp,
                    end_time=curr.timestamp,
                    expected_interval_sec=self.expected_interval,
                    actual_gap_sec=gap_sec,
                )
                gaps.append(gap)
                prev.is_gap = True
                curr.is_gap = True

        self.gaps = gaps
        return gaps

    def flag_records_in_gaps(self, records: List[SensorRecord]) -> List[SensorRecord]:
        for gap in self.gaps:
            for rec in records:
                if gap.start_time <= rec.timestamp <= gap.end_time:
                    rec.is_gap = True
        return records

    def gap_summary(self) -> List[dict]:
        return [
            {
                "gap_id": g.gap_id,
                "start": g.start_time.isoformat(),
                "end": g.end_time.isoformat(),
                "expected_sec": g.expected_interval_sec,
                "actual_sec": g.actual_gap_sec,
                "missing_samples": int(g.actual_gap_sec / g.expected_interval_sec) - 1,
            }
            for g in self.gaps
        ]
