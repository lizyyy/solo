from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple, Optional
import logging
import uuid

from eeg_aligner.models import (
    StimulusEvent,
    SleepStageEpoch,
    ValidationIssue,
    IssueType,
    IssueSeverity,
    EventType,
)

logger = logging.getLogger(__name__)


class ArtifactRuleEngine:
    def __init__(self, max_overlap_ratio: float = 0.5, default_event_duration_ms: float = 100.0):
        self.max_overlap_ratio = max_overlap_ratio
        self.default_event_duration_ms = default_event_duration_ms
        self.issues: List[ValidationIssue] = []

    def check_artifacts(
        self,
        events: List[StimulusEvent],
        sleep_stages: List[SleepStageEpoch],
        use_aligned_timestamps: bool = True,
    ) -> Tuple[List[ValidationIssue], List[Dict]]:
        logger.info("Checking artifact overlaps and issues")
        self.issues = []
        
        artifact_overlaps = []
        
        artifact_events = [e for e in events if e.is_artifact or e.event_type == EventType.ARTIFACT]
        logger.info(f"Found {len(artifact_events)} explicit artifact events")
        
        artifact_overlaps.extend(self._check_artifact_event_overlaps(
            events, artifact_events, use_aligned_timestamps
        ))
        
        self._check_stimulus_artifact_closeness(events, use_aligned_timestamps)
        
        if sleep_stages:
            artifact_overlaps.extend(self._check_epoch_artifact_overlaps(
                events, sleep_stages, use_aligned_timestamps
            ))
        
        return self.issues.copy(), artifact_overlaps

    def _check_artifact_event_overlaps(
        self,
        all_events: List[StimulusEvent],
        artifact_events: List[StimulusEvent],
        use_aligned_timestamps: bool,
    ) -> List[Dict]:
        overlaps = []
        
        def get_time(e: StimulusEvent) -> datetime:
            if use_aligned_timestamps and e.aligned_timestamp:
                return e.aligned_timestamp
            return e.timestamp
        
        def get_duration(e: StimulusEvent) -> float:
            return e.duration_ms if e.duration_ms else self.default_event_duration_ms
        
        valid_events = [e for e in all_events if e.is_valid]
        valid_events_sorted = sorted(valid_events, key=get_time)
        
        for artifact in artifact_events:
            if not artifact.is_valid:
                continue
            
            artifact_start = get_time(artifact)
            artifact_duration = get_duration(artifact)
            artifact_end = artifact_start + timedelta(milliseconds=artifact_duration)
            
            for event in valid_events_sorted:
                if event.event_id == artifact.event_id:
                    continue
                
                event_start = get_time(event)
                event_duration = get_duration(event)
                event_end = event_start + timedelta(milliseconds=event_duration)
                
                overlap_start = max(artifact_start, event_start)
                overlap_end = min(artifact_end, event_end)
                
                if overlap_start < overlap_end:
                    overlap_ms = (overlap_end - overlap_start).total_seconds() * 1000
                    event_total_ms = event_duration
                    overlap_ratio = overlap_ms / event_total_ms if event_total_ms > 0 else 0
                    
                    overlap_info = {
                        "artifact_event_id": artifact.event_id,
                        "artifact_code": artifact.event_code,
                        "artifact_start": artifact_start.isoformat(),
                        "artifact_end": artifact_end.isoformat(),
                        "overlapping_event_id": event.event_id,
                        "overlapping_event_code": event.event_code,
                        "overlap_start": overlap_start.isoformat(),
                        "overlap_end": overlap_end.isoformat(),
                        "overlap_ms": overlap_ms,
                        "overlap_ratio": overlap_ratio,
                    }
                    
                    if overlap_ratio > self.max_overlap_ratio:
                        self._add_issue(
                            issue_type=IssueType.ARTIFACT_OVERLAP,
                            severity=IssueSeverity.CRITICAL,
                            message=f"Event {event.event_code} overlaps {overlap_ratio:.0%} with artifact - invalid for analysis",
                            details=overlap_info,
                            suggestion="This event should be excluded from analysis due to significant artifact overlap"
                        )
                        overlaps.append(overlap_info)
                    elif overlap_ratio > 0:
                        self._add_issue(
                            issue_type=IssueType.ARTIFACT_OVERLAP,
                            severity=IssueSeverity.WARNING,
                            message=f"Event {event.event_code} overlaps {overlap_ratio:.0%} with artifact",
                            details=overlap_info,
                            suggestion="Consider reviewing this event for potential artifact contamination"
                        )
                        overlaps.append(overlap_info)
        
        return overlaps

    def _check_stimulus_artifact_closeness(
        self,
        events: List[StimulusEvent],
        use_aligned_timestamps: bool,
    ):
        def get_time(e: StimulusEvent) -> datetime:
            if use_aligned_timestamps and e.aligned_timestamp:
                return e.aligned_timestamp
            return e.timestamp
        
        valid_events = [e for e in events if e.is_valid]
        valid_events_sorted = sorted(valid_events, key=get_time)
        
        artifact_indices = [
            i for i, e in enumerate(valid_events_sorted)
            if e.is_artifact or e.event_type == EventType.ARTIFACT
        ]
        
        for art_idx in artifact_indices:
            artifact = valid_events_sorted[art_idx]
            artifact_time = get_time(artifact)
            
            if art_idx > 0:
                prev_event = valid_events_sorted[art_idx - 1]
                if prev_event.event_type == EventType.STIMULUS:
                    prev_time = get_time(prev_event)
                    delta_ms = (artifact_time - prev_time).total_seconds() * 1000
                    
                    if delta_ms < 500:
                        self._add_issue(
                            issue_type=IssueType.ARTIFACT_OVERLAP,
                            severity=IssueSeverity.WARNING,
                            message=f"Artifact occurs {delta_ms:.0f}ms after stimulus {prev_event.event_code} - may be related",
                            details={
                                "stimulus_event_id": prev_event.event_id,
                                "stimulus_code": prev_event.event_code,
                                "stimulus_time": prev_time.isoformat(),
                                "artifact_event_id": artifact.event_id,
                                "artifact_code": artifact.event_code,
                                "artifact_time": artifact_time.isoformat(),
                                "delta_ms": delta_ms,
                            },
                            suggestion="Check if artifact was caused by the stimulus"
                        )
            
            if art_idx < len(valid_events_sorted) - 1:
                next_event = valid_events_sorted[art_idx + 1]
                if next_event.event_type == EventType.STIMULUS:
                    next_time = get_time(next_event)
                    delta_ms = (next_time - artifact_time).total_seconds() * 1000
                    
                    if delta_ms < 500:
                        self._add_issue(
                            issue_type=IssueType.ARTIFACT_OVERLAP,
                            severity=IssueSeverity.WARNING,
                            message=f"Stimulus {next_event.event_code} occurs {delta_ms:.0f}ms after artifact - may be contaminated",
                            details={
                                "artifact_event_id": artifact.event_id,
                                "artifact_code": artifact.event_code,
                                "artifact_time": artifact_time.isoformat(),
                                "stimulus_event_id": next_event.event_id,
                                "stimulus_code": next_event.event_code,
                                "stimulus_time": next_time.isoformat(),
                                "delta_ms": delta_ms,
                            },
                            suggestion="Consider if this stimulus should be excluded due to artifact proximity"
                        )

    def _check_epoch_artifact_overlaps(
        self,
        events: List[StimulusEvent],
        sleep_stages: List[SleepStageEpoch],
        use_aligned_timestamps: bool,
    ) -> List[Dict]:
        overlaps = []
        
        def get_time(e: StimulusEvent) -> datetime:
            if use_aligned_timestamps and e.aligned_timestamp:
                return e.aligned_timestamp
            return e.timestamp
        
        high_artifact_epochs = [
            stage for stage in sleep_stages
            if stage.stage.value in ["M", "?"] or (stage.confidence < 0.5)
        ]
        
        for stage in high_artifact_epochs:
            for event in events:
                if not event.is_valid:
                    continue
                
                event_time = get_time(event)
                
                if stage.start_time <= event_time <= stage.end_time:
                    if event.event_type == EventType.STIMULUS:
                        overlap_info = {
                            "epoch_number": stage.epoch_number,
                            "epoch_stage": stage.stage.value,
                            "epoch_confidence": stage.confidence,
                            "epoch_start": stage.start_time.isoformat(),
                            "epoch_end": stage.end_time.isoformat(),
                            "event_id": event.event_id,
                            "event_code": event.event_code,
                            "event_time": event_time.isoformat(),
                        }
                        
                        if stage.stage.value == "M":
                            self._add_issue(
                                issue_type=IssueType.ARTIFACT_OVERLAP,
                                severity=IssueSeverity.WARNING,
                                message=f"Stimulus {event.event_code} during movement epoch {stage.epoch_number}",
                                details=overlap_info,
                                suggestion="Movement epochs often contain artifacts - verify data quality"
                            )
                            overlaps.append(overlap_info)
                        
                        if stage.confidence < 0.5:
                            self._add_issue(
                                issue_type=IssueType.ARTIFACT_OVERLAP,
                                severity=IssueSeverity.INFO,
                                message=f"Stimulus {event.event_code} in epoch {stage.epoch_number} with low scoring confidence ({stage.confidence:.0%})",
                                details=overlap_info,
                                suggestion="Review sleep stage scoring for this epoch"
                            )
        
        return overlaps

    def _add_issue(
        self,
        issue_type: IssueType,
        severity: IssueSeverity,
        message: str,
        details: Dict,
        suggestion: str = ""
    ):
        issue = ValidationIssue(
            issue_id=str(uuid.uuid4()),
            issue_type=issue_type,
            severity=severity,
            message=message,
            details=details,
            suggestion=suggestion
        )
        self.issues.append(issue)
