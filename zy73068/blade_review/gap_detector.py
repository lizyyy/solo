from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional

from .models import BladeReport, InspectionRecord, ReviewStatus, SuspensionRecord


@dataclass
class GapInfo:
    blade_id: str = ""
    gap_start: Optional[datetime] = None
    gap_end: Optional[datetime] = None
    duration: Optional[timedelta] = None
    severity: str = "minor"


class GapDetector:
    def __init__(self, max_gap_hours: float = 24.0) -> None:
        self.max_gap = timedelta(hours=max_gap_hours)
        self.max_gap_hours = max_gap_hours

    def detect_gaps(
        self, records: list[InspectionRecord]
    ) -> list[GapInfo]:
        if len(records) < 2:
            return []
        sorted_recs = sorted(records, key=lambda r: r.timestamp)
        gaps: list[GapInfo] = []
        for i in range(1, len(sorted_recs)):
            prev = sorted_recs[i - 1]
            curr = sorted_recs[i]
            delta = curr.timestamp - prev.timestamp
            if delta > self.max_gap:
                severity = self._classify_severity(delta)
                gaps.append(
                    GapInfo(
                        blade_id=curr.blade_id,
                        gap_start=prev.timestamp,
                        gap_end=curr.timestamp,
                        duration=delta,
                        severity=severity,
                    )
                )
        return gaps

    def check_and_suspend(
        self, report: BladeReport
    ) -> list[SuspensionRecord]:
        gaps = self.detect_gaps(report.records)
        if not gaps:
            return []
        suspensions: list[SuspensionRecord] = []
        for gap in gaps:
            suspension = SuspensionRecord(
                report_id=report.report_id,
                reason=f"sampling_gap_{gap.severity}",
                gap_start=gap.gap_start,
                gap_end=gap.gap_end,
            )
            suspensions.append(suspension)
            report.suspensions.append(suspension)
        report.status = ReviewStatus.SUSPENDED
        return suspensions

    def resolve_suspension(
        self,
        report: BladeReport,
        suspension_id: str,
        resolved_by: str,
        resolution_note: str,
    ) -> bool:
        for susp in report.suspensions:
            if susp.suspension_id == suspension_id and not susp.resolved:
                susp.resolved = True
                susp.resolved_by = resolved_by
                susp.resolution_note = resolution_note
                break
        else:
            return False
        all_resolved = all(s.resolved for s in report.suspensions)
        if all_resolved and report.status == ReviewStatus.SUSPENDED:
            report.status = ReviewStatus.IN_REVIEW
        return True

    def _classify_severity(self, delta: timedelta) -> str:
        hours = delta.total_seconds() / 3600
        if hours > self.max_gap_hours * 3:
            return "critical"
        if hours > self.max_gap_hours * 1.5:
            return "major"
        return "minor"
