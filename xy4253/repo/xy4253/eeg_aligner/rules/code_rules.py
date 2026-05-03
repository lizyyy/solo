from datetime import datetime, timedelta
from typing import List, Optional, Set, Dict, Any, Tuple
import logging
import uuid

from eeg_aligner.models import (
    StimulusEvent,
    ValidationIssue,
    IssueType,
    IssueSeverity,
    EventType,
)

logger = logging.getLogger(__name__)


class CodeRuleEngine:
    def __init__(
        self,
        expected_codes: Optional[List[int]] = None,
        min_interval_ms: float = 10.0,
    ):
        self.expected_codes = expected_codes or []
        self.min_interval_ms = min_interval_ms
        self.issues: List[ValidationIssue] = []

    def check_codes(
        self,
        events: List[StimulusEvent],
        use_aligned_timestamps: bool = True,
    ) -> Tuple[List[ValidationIssue], List[int], List[int]]:
        logger.info("Checking event codes")
        self.issues = []
        
        missing_codes = self._check_missing_codes(events)
        duplicate_codes = self._check_duplicate_codes(events, use_aligned_timestamps)
        self._check_invalid_intervals(events, use_aligned_timestamps)
        self._check_code_sequence(events, use_aligned_timestamps)
        
        return self.issues.copy(), missing_codes, duplicate_codes

    def _check_missing_codes(self, events: List[StimulusEvent]) -> List[int]:
        if not self.expected_codes:
            return []
        
        actual_codes = {e.event_code for e in events if e.is_valid}
        missing = []
        
        for code in self.expected_codes:
            if code not in actual_codes:
                missing.append(code)
                self._add_issue(
                    issue_type=IssueType.MISSING_CODE,
                    severity=IssueSeverity.CRITICAL,
                    message=f"Expected event code {code} not found in recording",
                    details={
                        "missing_code": code,
                        "expected_codes": self.expected_codes,
                    },
                    suggestion="Check if the stimulus was properly triggered or if events were lost"
                )
        
        if missing:
            logger.warning(f"Found {len(missing)} missing expected codes")
        
        return missing

    def _check_duplicate_codes(
        self,
        events: List[StimulusEvent],
        use_aligned_timestamps: bool,
    ) -> List[int]:
        valid_events = [e for e in events if e.is_valid]
        
        def get_time(e: StimulusEvent) -> datetime:
            if use_aligned_timestamps and e.aligned_timestamp:
                return e.aligned_timestamp
            return e.timestamp
        
        code_groups: Dict[int, List[StimulusEvent]] = {}
        for event in valid_events:
            if event.event_code not in code_groups:
                code_groups[event.event_code] = []
            code_groups[event.event_code].append(event)
        
        duplicate_codes = []
        for code, code_events in code_groups.items():
            if len(code_events) <= 1:
                continue
            
            code_events_sorted = sorted(code_events, key=get_time)
            
            for i in range(len(code_events_sorted)):
                for j in range(i + 1, len(code_events_sorted)):
                    time_i = get_time(code_events_sorted[i])
                    time_j = get_time(code_events_sorted[j])
                    delta_ms = abs((time_j - time_i).total_seconds() * 1000)
                    
                    if delta_ms < self.min_interval_ms:
                        if code not in duplicate_codes:
                            duplicate_codes.append(code)
                        
                        self._add_issue(
                            issue_type=IssueType.DUPLICATE_CODE,
                            severity=IssueSeverity.WARNING,
                            message=f"Duplicate event code {code} within {delta_ms:.1f} ms",
                            details={
                                "event_code": code,
                                "event1_id": code_events_sorted[i].event_id,
                                "event1_time": time_i.isoformat(),
                                "event2_id": code_events_sorted[j].event_id,
                                "event2_time": time_j.isoformat(),
                                "interval_ms": delta_ms,
                            },
                            suggestion="Check for accidental double-triggering or verify if this is intentional"
                        )
        
        if duplicate_codes:
            logger.warning(f"Found {len(duplicate_codes)} codes with potential duplicates")
        
        return duplicate_codes

    def _check_invalid_intervals(
        self,
        events: List[StimulusEvent],
        use_aligned_timestamps: bool,
    ):
        valid_events = [e for e in events if e.is_valid]
        if len(valid_events) < 2:
            return
        
        def get_time(e: StimulusEvent) -> datetime:
            if use_aligned_timestamps and e.aligned_timestamp:
                return e.aligned_timestamp
            return e.timestamp
        
        sorted_events = sorted(valid_events, key=get_time)
        
        for i in range(len(sorted_events) - 1):
            current = sorted_events[i]
            next_event = sorted_events[i + 1]
            
            current_time = get_time(current)
            next_time = get_time(next_event)
            
            interval_ms = (next_time - current_time).total_seconds() * 1000
            
            if interval_ms < 0:
                self._add_issue(
                    issue_type=IssueType.INVALID_TIMESTAMP,
                    severity=IssueSeverity.WARNING,
                    message="Events not in chronological order after sorting",
                    details={
                        "event1_id": current.event_id,
                        "event1_time": current_time.isoformat(),
                        "event2_id": next_event.event_id,
                        "event2_time": next_time.isoformat(),
                        "negative_interval_ms": interval_ms,
                    },
                    suggestion="Check event timestamps for clock synchronization issues"
                )
            elif interval_ms < self.min_interval_ms:
                self._add_issue(
                    issue_type=IssueType.INVALID_TIMESTAMP,
                    severity=IssueSeverity.INFO,
                    message=f"Events {current.event_code} and {next_event.event_code} "
                            f"occur within {interval_ms:.1f} ms (minimum: {self.min_interval_ms} ms)",
                    details={
                        "event1_id": current.event_id,
                        "event1_code": current.event_code,
                        "event2_id": next_event.event_id,
                        "event2_code": next_event.event_code,
                        "interval_ms": interval_ms,
                    },
                    suggestion="Short intervals may indicate timing issues but could be valid"
                )

    def _check_code_sequence(
        self,
        events: List[StimulusEvent],
        use_aligned_timestamps: bool,
    ):
        valid_events = [e for e in events if e.is_valid]
        if len(valid_events) < 2:
            return
        
        def get_time(e: StimulusEvent) -> datetime:
            if use_aligned_timestamps and e.aligned_timestamp:
                return e.aligned_timestamp
            return e.timestamp
        
        sorted_events = sorted(valid_events, key=get_time)
        
        sync_codes = [e.event_code for e in sorted_events if e.event_type == EventType.SYNC]
        if sync_codes and sorted_events[0].event_type != EventType.SYNC:
            first_sync_idx = next(i for i, e in enumerate(sorted_events) if e.event_type == EventType.SYNC)
            events_before_sync = sorted_events[:first_sync_idx]
            
            self._add_issue(
                issue_type=IssueType.CLOCK_DRIFT,
                severity=IssueSeverity.WARNING,
                message=f"{len(events_before_sync)} events occur before first sync event",
                details={
                    "events_before_sync": len(events_before_sync),
                    "first_sync_time": get_time(sorted_events[first_sync_idx]).isoformat(),
                },
                suggestion="Events before sync may have inaccurate timing - consider adding sync at start"
            )

    def _add_issue(
        self,
        issue_type: IssueType,
        severity: IssueSeverity,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        suggestion: str = ""
    ):
        issue = ValidationIssue(
            issue_id=str(uuid.uuid4()),
            issue_type=issue_type,
            severity=severity,
            message=message,
            details=details or {},
            suggestion=suggestion
        )
        self.issues.append(issue)
