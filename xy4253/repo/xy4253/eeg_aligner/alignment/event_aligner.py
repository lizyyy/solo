from datetime import datetime, timedelta
from typing import List, Optional, Tuple
import logging
import uuid

from eeg_aligner.models import (
    StimulusEvent,
    ClockCalibration,
    EEGChannelSummary,
    AlignmentResult,
    ValidationIssue,
    IssueType,
    IssueSeverity,
)
from eeg_aligner.alignment.clock_drift import ClockDriftEstimator, DriftEstimate

logger = logging.getLogger(__name__)


class EventAligner:
    def __init__(self):
        self.drift_estimator = ClockDriftEstimator()
        self.issues: List[ValidationIssue] = []

    def align_events(
        self,
        events: List[StimulusEvent],
        calibrations: List[ClockCalibration],
        eeg_summaries: List[EEGChannelSummary],
        force_method: Optional[str] = None,
    ) -> Tuple[List[StimulusEvent], AlignmentResult]:
        logger.info("Starting event alignment")
        self.issues = []
        
        drift_estimate = self.drift_estimator.estimate_drift(events, calibrations, eeg_summaries)
        
        self.issues.extend(drift_estimate.issues)
        
        if force_method:
            logger.info(f"Forcing alignment method: {force_method}")
        
        aligned_events = self._apply_alignment(events, drift_estimate, eeg_summaries)
        
        sync_points_clean = []
        for sp in drift_estimate.sync_points:
            clean_sp = {}
            for k, v in sp.items():
                if isinstance(v, datetime):
                    clean_sp[k] = v.isoformat()
                else:
                    clean_sp[k] = v
            sync_points_clean.append(clean_sp)
        
        result = AlignmentResult(
            drift_estimate_ms=drift_estimate.drift_ms,
            drift_confidence=drift_estimate.drift_confidence,
            alignment_method=drift_estimate.method,
            sync_points=sync_points_clean,
            aligned_events_count=len(aligned_events),
            issues=self.issues.copy()
        )
        
        logger.info(f"Aligned {len(aligned_events)} events with method: {drift_estimate.method}")
        logger.info(f"Estimated drift: {drift_estimate.drift_ms:.2f} ms (confidence: {drift_estimate.drift_confidence:.0%})")
        
        return aligned_events, result

    def _apply_alignment(
        self,
        events: List[StimulusEvent],
        drift_estimate: DriftEstimate,
        eeg_summaries: List[EEGChannelSummary],
    ) -> List[StimulusEvent]:
        aligned_events = []
        
        for event in events:
            aligned_event = StimulusEvent(
                event_id=event.event_id,
                event_code=event.event_code,
                event_type=event.event_type,
                timestamp=event.timestamp,
                eeg_timestamp=event.eeg_timestamp,
                duration_ms=event.duration_ms,
                description=event.description,
                metadata=event.metadata.copy(),
                is_artifact=event.is_artifact,
                is_valid=event.is_valid,
                issues=event.issues.copy()
            )
            
            if drift_estimate.method == "linear_regression" and eeg_summaries:
                aligned_timestamp = self._apply_linear_alignment(
                    event, drift_estimate, eeg_summaries
                )
            elif drift_estimate.method == "single_point":
                aligned_timestamp = self._apply_single_point_alignment(event, drift_estimate)
            else:
                aligned_timestamp = self._apply_constant_offset_alignment(event, drift_estimate)
            
            aligned_event.aligned_timestamp = aligned_timestamp
            aligned_events.append(aligned_event)
        
        self._validate_aligned_timestamps(aligned_events, eeg_summaries)
        
        return aligned_events

    def _apply_linear_alignment(
        self,
        event: StimulusEvent,
        drift_estimate: DriftEstimate,
        eeg_summaries: List[EEGChannelSummary],
    ) -> datetime:
        if eeg_summaries:
            ref_time = min(s.start_time for s in eeg_summaries)
        else:
            ref_time = event.timestamp
        
        elapsed_seconds = (event.timestamp - ref_time).total_seconds()
        
        if elapsed_seconds < 0:
            self._add_issue(
                issue_type=IssueType.CLOCK_DRIFT,
                severity=IssueSeverity.WARNING,
                message=f"Event {event.event_id} occurs before reference time",
                details={
                    "event_id": event.event_id,
                    "event_time": event.timestamp.isoformat(),
                    "ref_time": ref_time.isoformat()
                }
            )
        
        current_drift_ms = drift_estimate.intercept_ms + (drift_estimate.slope_ppm * elapsed_seconds / 1e6) * 1000
        
        return event.timestamp + timedelta(milliseconds=current_drift_ms)

    def _apply_single_point_alignment(
        self,
        event: StimulusEvent,
        drift_estimate: DriftEstimate,
    ) -> datetime:
        return event.timestamp + timedelta(milliseconds=drift_estimate.intercept_ms)

    def _apply_constant_offset_alignment(
        self,
        event: StimulusEvent,
        drift_estimate: DriftEstimate,
    ) -> datetime:
        return event.timestamp + timedelta(milliseconds=drift_estimate.drift_ms)

    def _validate_aligned_timestamps(
        self,
        events: List[StimulusEvent],
        eeg_summaries: List[EEGChannelSummary],
    ):
        if not eeg_summaries or not events:
            return
        
        eeg_start = min(s.start_time for s in eeg_summaries)
        eeg_end = max(s.end_time for s in eeg_summaries)
        
        aligned_starts = [e.aligned_timestamp for e in events if e.aligned_timestamp]
        if not aligned_starts:
            return
        
        aligned_before = [e for e in events if e.aligned_timestamp and e.aligned_timestamp < eeg_start]
        aligned_after = [e for e in events if e.aligned_timestamp and e.aligned_timestamp > eeg_end]
        
        if aligned_before:
            self._add_issue(
                issue_type=IssueType.CLOCK_DRIFT,
                severity=IssueSeverity.WARNING,
                message=f"After alignment, {len(aligned_before)} events still occur before EEG recording",
                details={
                    "count": len(aligned_before),
                    "eeg_start": eeg_start.isoformat(),
                    "first_aligned": min(aligned_starts).isoformat()
                },
                suggestion="Check calibration data or consider manual adjustment"
            )
        
        if aligned_after:
            self._add_issue(
                issue_type=IssueType.CLOCK_DRIFT,
                severity=IssueSeverity.WARNING,
                message=f"After alignment, {len(aligned_after)} events still occur after EEG recording",
                details={
                    "count": len(aligned_after),
                    "eeg_end": eeg_end.isoformat(),
                    "last_aligned": max(aligned_starts).isoformat()
                },
                suggestion="Check calibration data or consider manual adjustment"
            )

    def _add_issue(
        self,
        issue_type: IssueType,
        severity: IssueSeverity,
        message: str,
        details: Optional[dict] = None,
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

    def get_issues(self) -> List[ValidationIssue]:
        return self.issues
