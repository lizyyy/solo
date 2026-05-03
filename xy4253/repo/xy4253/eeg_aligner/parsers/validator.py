from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
import uuid
import logging

from eeg_aligner.models import (
    EEGChannelSummary,
    StimulusEvent,
    SleepStageEpoch,
    ClockCalibration,
    ValidationIssue,
    IssueType,
    IssueSeverity,
    EventType,
)

logger = logging.getLogger(__name__)


class DataValidator:
    def __init__(self):
        self.issues: List[ValidationIssue] = []

    def validate_all(
        self,
        eeg_summaries: List[EEGChannelSummary],
        events: List[StimulusEvent],
        sleep_stages: List[SleepStageEpoch],
        clock_calibrations: List[ClockCalibration],
    ) -> bool:
        logger.info("Starting data validation")
        self.issues = []
        
        valid = True
        
        if eeg_summaries:
            if not self._validate_eeg_summaries(eeg_summaries):
                valid = False
        
        if events:
            if not self._validate_events(events):
                valid = False
        
        if sleep_stages:
            if not self._validate_sleep_stages(sleep_stages):
                valid = False
        
        if clock_calibrations:
            if not self._validate_clock_calibrations(clock_calibrations):
                valid = False
        
        if eeg_summaries and events:
            if not self._validate_timeline_consistency(eeg_summaries, events):
                valid = False
        
        logger.info(f"Validation complete: {len(self.issues)} issues found")
        return valid

    def _validate_eeg_summaries(self, summaries: List[EEGChannelSummary]) -> bool:
        logger.info(f"Validating {len(summaries)} EEG channel summaries")
        valid = True
        
        for summary in summaries:
            if summary.start_time >= summary.end_time:
                self._add_issue(
                    issue_type=IssueType.INVALID_TIMESTAMP,
                    severity=IssueSeverity.CRITICAL,
                    message=f"Channel {summary.channel_name}: start_time >= end_time",
                    details={
                        "channel": summary.channel_name,
                        "start_time": summary.start_time.isoformat(),
                        "end_time": summary.end_time.isoformat()
                    },
                    suggestion="Check the EEG recording timestamps"
                )
                valid = False
            
            if summary.sampling_rate <= 0:
                self._add_issue(
                    issue_type=IssueType.INVALID_TIMESTAMP,
                    severity=IssueSeverity.CRITICAL,
                    message=f"Channel {summary.channel_name}: invalid sampling rate {summary.sampling_rate}",
                    details={"channel": summary.channel_name, "sampling_rate": summary.sampling_rate},
                    suggestion="Verify the sampling rate configuration"
                )
                valid = False
            
            if summary.valid_samples > summary.total_samples:
                self._add_issue(
                    issue_type=IssueType.INVALID_TIMESTAMP,
                    severity=IssueSeverity.WARNING,
                    message=f"Channel {summary.channel_name}: valid_samples > total_samples",
                    details={
                        "channel": summary.channel_name,
                        "valid_samples": summary.valid_samples,
                        "total_samples": summary.total_samples
                    },
                    suggestion="Check the artifact detection output"
                )
                valid = False
            
            if not (0 <= summary.artifact_percentage <= 100):
                self._add_issue(
                    issue_type=IssueType.INVALID_TIMESTAMP,
                    severity=IssueSeverity.WARNING,
                    message=f"Channel {summary.channel_name}: artifact percentage out of range",
                    details={"channel": summary.channel_name, "artifact_percentage": summary.artifact_percentage},
                    suggestion="Artifact percentage should be between 0 and 100"
                )
                valid = False
        
        if len(summaries) > 1:
            first_start = min(s.start_time for s in summaries)
            last_end = max(s.end_time for s in summaries)
            
            for summary in summaries:
                if summary.start_time != first_start:
                    self._add_issue(
                        issue_type=IssueType.CLOCK_DRIFT,
                        severity=IssueSeverity.WARNING,
                        message=f"Channel {summary.channel_name} starts at different time than others",
                        details={
                            "channel": summary.channel_name,
                            "channel_start": summary.start_time.isoformat(),
                            "first_start": first_start.isoformat()
                        }
                    )
                
                if summary.end_time != last_end:
                    self._add_issue(
                        issue_type=IssueType.CLOCK_DRIFT,
                        severity=IssueSeverity.WARNING,
                        message=f"Channel {summary.channel_name} ends at different time than others",
                        details={
                            "channel": summary.channel_name,
                            "channel_end": summary.end_time.isoformat(),
                            "last_end": last_end.isoformat()
                        }
                    )
        
        return valid

    def _validate_events(self, events: List[StimulusEvent]) -> bool:
        logger.info(f"Validating {len(events)} events")
        valid = True
        
        event_times = [e.timestamp for e in events]
        for i in range(1, len(event_times)):
            if event_times[i] < event_times[i-1]:
                self._add_issue(
                    issue_type=IssueType.INVALID_TIMESTAMP,
                    severity=IssueSeverity.WARNING,
                    message=f"Events not in chronological order at index {i}",
                    details={
                        "prev_time": event_times[i-1].isoformat(),
                        "curr_time": event_times[i].isoformat()
                    },
                    suggestion="Events should be sorted by timestamp"
                )
        
        event_codes = {}
        for event in events:
            if event.event_code in event_codes:
                event_codes[event.event_code].append(event)
            else:
                event_codes[event.event_code] = [event]
        
        duplicate_intervals = {}
        for code, code_events in event_codes.items():
            if len(code_events) > 1:
                for i in range(len(code_events)):
                    for j in range(i + 1, len(code_events)):
                        delta = abs((code_events[i].timestamp - code_events[j].timestamp).total_seconds())
                        if delta < 0.001:
                            if code not in duplicate_intervals:
                                duplicate_intervals[code] = []
                            duplicate_intervals[code].append({
                                "event1": code_events[i].event_id,
                                "event2": code_events[j].event_id,
                                "timestamp": code_events[i].timestamp.isoformat(),
                                "delta_seconds": delta
                            })
        
        for code, duplicates in duplicate_intervals.items():
            for dup in duplicates:
                self._add_issue(
                    issue_type=IssueType.DUPLICATE_CODE,
                    severity=IssueSeverity.WARNING,
                    message=f"Duplicate event code {code} at nearly same time",
                    details=dup,
                    suggestion="Check for accidental double-triggering or verify if this is intentional"
                )
                valid = False
        
        for event in events:
            if event.duration_ms is not None and event.duration_ms < 0:
                self._add_issue(
                    issue_type=IssueType.INVALID_TIMESTAMP,
                    severity=IssueSeverity.WARNING,
                    message=f"Event {event.event_id} has negative duration",
                    details={"event_id": event.event_id, "duration_ms": event.duration_ms},
                    suggestion="Duration should be non-negative"
                )
        
        sync_events = [e for e in events if e.event_type == EventType.SYNC]
        if not sync_events:
            self._add_issue(
                issue_type=IssueType.CLOCK_DRIFT,
                severity=IssueSeverity.INFO,
                message="No sync events found. Clock alignment may be less accurate.",
                details={},
                suggestion="Consider adding sync events for better alignment accuracy"
            )
        
        return valid

    def _validate_sleep_stages(self, stages: List[SleepStageEpoch]) -> bool:
        logger.info(f"Validating {len(stages)} sleep stages")
        valid = True
        
        epochs_by_number = {}
        for stage in stages:
            if stage.epoch_number in epochs_by_number:
                epochs_by_number[stage.epoch_number].append(stage)
            else:
                epochs_by_number[stage.epoch_number] = [stage]
        
        for epoch_num, epochs in epochs_by_number.items():
            if len(epochs) > 1:
                self._add_issue(
                    issue_type=IssueType.STAGE_CONFLICT,
                    severity=IssueSeverity.CRITICAL,
                    message=f"Duplicate epoch number {epoch_num} found {len(epochs)} times",
                    details={"epoch_number": epoch_num, "count": len(epochs)},
                    suggestion="Remove duplicate epoch entries"
                )
                valid = False
        
        if stages:
            sorted_stages = sorted(stages, key=lambda s: s.epoch_number)
            
            expected_epoch = sorted_stages[0].epoch_number
            for stage in sorted_stages:
                if stage.epoch_number != expected_epoch:
                    missing = list(range(expected_epoch, stage.epoch_number))
                    for m in missing:
                        self._add_issue(
                            issue_type=IssueType.STAGE_CONFLICT,
                            severity=IssueSeverity.WARNING,
                            message=f"Missing epoch number {m}",
                            details={"missing_epoch": m},
                            suggestion="Check if epoch data was lost or skipped"
                        )
                        valid = False
                expected_epoch = stage.epoch_number + 1
            
            for i in range(len(sorted_stages) - 1):
                current = sorted_stages[i]
                next_stage = sorted_stages[i + 1]
                
                expected_gap = timedelta(seconds=current.duration_seconds)
                actual_gap = next_stage.start_time - current.end_time
                
                if abs(actual_gap.total_seconds()) > 0.1:
                    self._add_issue(
                        issue_type=IssueType.INVALID_TIMESTAMP,
                        severity=IssueSeverity.WARNING,
                        message=f"Time gap between epoch {current.epoch_number} and {next_stage.epoch_number}",
                        details={
                            "from_epoch": current.epoch_number,
                            "to_epoch": next_stage.epoch_number,
                            "gap_seconds": actual_gap.total_seconds()
                        },
                        suggestion="Check epoch timing alignment"
                    )
        
        return valid

    def _validate_clock_calibrations(self, calibrations: List[ClockCalibration]) -> bool:
        logger.info(f"Validating {len(calibrations)} clock calibrations")
        valid = True
        
        sorted_calib = sorted(calibrations, key=lambda c: c.calibration_time)
        
        for i, calib in enumerate(sorted_calib):
            if abs(calib.drift_ms) > 1000:
                self._add_issue(
                    issue_type=IssueType.CLOCK_DRIFT,
                    severity=IssueSeverity.WARNING,
                    message=f"Large clock drift detected ({calib.drift_ms:.1f} ms) at calibration {i+1}",
                    details={
                        "calibration_id": calib.calibration_id,
                        "drift_ms": calib.drift_ms,
                        "calibration_time": calib.calibration_time.isoformat()
                    },
                    suggestion="Large drift may indicate clock synchronization issues"
                )
        
        for i in range(len(sorted_calib) - 1):
            drift_change = abs(sorted_calib[i+1].drift_ms - sorted_calib[i].drift_ms)
            if drift_change > 500:
                self._add_issue(
                    issue_type=IssueType.CLOCK_DRIFT,
                    severity=IssueSeverity.WARNING,
                    message=f"Rapid drift change between calibrations ({drift_change:.1f} ms)",
                    details={
                        "from_calibration": sorted_calib[i].calibration_id,
                        "to_calibration": sorted_calib[i+1].calibration_id,
                        "change_ms": drift_change
                    },
                    suggestion="Check if clocks were reset or synchronization failed"
                )
        
        return valid

    def _validate_timeline_consistency(
        self,
        summaries: List[EEGChannelSummary],
        events: List[StimulusEvent]
    ) -> bool:
        logger.info("Validating timeline consistency")
        valid = True
        
        if not summaries or not events:
            return True
        
        eeg_start = min(s.start_time for s in summaries)
        eeg_end = max(s.end_time for s in summaries)
        
        events_before = [e for e in events if e.timestamp < eeg_start]
        events_after = [e for e in events if e.timestamp > eeg_end]
        
        if events_before:
            self._add_issue(
                issue_type=IssueType.CLOCK_DRIFT,
                severity=IssueSeverity.WARNING,
                message=f"{len(events_before)} events occur before EEG recording starts",
                details={
                    "count": len(events_before),
                    "eeg_start": eeg_start.isoformat(),
                    "first_event": min(e.timestamp for e in events_before).isoformat()
                },
                suggestion="Events may need alignment or check recording start time"
            )
            valid = False
        
        if events_after:
            self._add_issue(
                issue_type=IssueType.CLOCK_DRIFT,
                severity=IssueSeverity.WARNING,
                message=f"{len(events_after)} events occur after EEG recording ends",
                details={
                    "count": len(events_after),
                    "eeg_end": eeg_end.isoformat(),
                    "last_event": max(e.timestamp for e in events_after).isoformat()
                },
                suggestion="Events may need alignment or check recording end time"
            )
            valid = False
        
        return valid

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

    def get_issues(self) -> List[ValidationIssue]:
        return self.issues

    def get_issues_by_severity(self) -> Dict[IssueSeverity, List[ValidationIssue]]:
        result: Dict[IssueSeverity, List[ValidationIssue]] = {
            IssueSeverity.CRITICAL: [],
            IssueSeverity.WARNING: [],
            IssueSeverity.INFO: [],
        }
        for issue in self.issues:
            result[issue.severity].append(issue)
        return result
