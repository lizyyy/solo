from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple
import logging
import uuid

from eeg_aligner.models import (
    StimulusEvent,
    SleepStageEpoch,
    SleepStage,
    ValidationIssue,
    IssueType,
    IssueSeverity,
    EventType,
)

logger = logging.getLogger(__name__)


class StageRuleEngine:
    CRITICAL_STAGES = {SleepStage.REM, SleepStage.N3}
    
    def __init__(self):
        self.issues: List[ValidationIssue] = []

    def check_stages(
        self,
        events: List[StimulusEvent],
        sleep_stages: List[SleepStageEpoch],
        use_aligned_timestamps: bool = True,
    ) -> Tuple[List[ValidationIssue], List[Dict]]:
        logger.info("Checking sleep stage conflicts")
        self.issues = []
        
        stage_conflicts = []
        
        if not sleep_stages:
            logger.info("No sleep stages available for checking")
            return self.issues.copy(), stage_conflicts
        
        self._check_epoch_continuity(sleep_stages)
        stage_conflicts.extend(self._check_event_stage_conflicts(
            events, sleep_stages, use_aligned_timestamps
        ))
        self._check_stage_transitions(sleep_stages)
        
        return self.issues.copy(), stage_conflicts

    def _check_epoch_continuity(self, sleep_stages: List[SleepStageEpoch]):
        sorted_stages = sorted(sleep_stages, key=lambda s: s.epoch_number)
        
        if len(sorted_stages) <= 1:
            return
        
        for i in range(len(sorted_stages) - 1):
            current = sorted_stages[i]
            next_stage = sorted_stages[i + 1]
            
            expected_epoch = current.epoch_number + 1
            if next_stage.epoch_number != expected_epoch:
                missing = list(range(expected_epoch, next_stage.epoch_number))
                for m in missing:
                    self._add_issue(
                        issue_type=IssueType.STAGE_CONFLICT,
                        severity=IssueSeverity.WARNING,
                        message=f"Missing epoch number {m}",
                        details={
                            "missing_epoch": m,
                            "before_epoch": current.epoch_number,
                            "after_epoch": next_stage.epoch_number,
                        },
                        suggestion="Check if epoch data was lost or if numbering is incorrect"
                    )
            
            expected_gap = timedelta(seconds=current.duration_seconds)
            actual_gap = next_stage.start_time - current.end_time
            
            if abs(actual_gap.total_seconds()) > 0.5:
                if actual_gap.total_seconds() > 0:
                    self._add_issue(
                        issue_type=IssueType.STAGE_CONFLICT,
                        severity=IssueSeverity.WARNING,
                        message=f"Gap of {actual_gap.total_seconds():.2f}s between epoch {current.epoch_number} and {next_stage.epoch_number}",
                        details={
                            "from_epoch": current.epoch_number,
                            "to_epoch": next_stage.epoch_number,
                            "gap_seconds": actual_gap.total_seconds(),
                        },
                        suggestion="Check for missing data or timestamp alignment issues"
                    )
                else:
                    self._add_issue(
                        issue_type=IssueType.STAGE_CONFLICT,
                        severity=IssueSeverity.WARNING,
                        message=f"Overlap of {abs(actual_gap.total_seconds()):.2f}s between epoch {current.epoch_number} and {next_stage.epoch_number}",
                        details={
                            "from_epoch": current.epoch_number,
                            "to_epoch": next_stage.epoch_number,
                            "overlap_seconds": abs(actual_gap.total_seconds()),
                        },
                        suggestion="Check epoch timing for alignment issues"
                    )

    def _check_event_stage_conflicts(
        self,
        events: List[StimulusEvent],
        sleep_stages: List[SleepStageEpoch],
        use_aligned_timestamps: bool,
    ) -> List[Dict]:
        stage_conflicts = []
        
        def get_time(e: StimulusEvent) -> datetime:
            if use_aligned_timestamps and e.aligned_timestamp:
                return e.aligned_timestamp
            return e.timestamp
        
        sorted_stages = sorted(sleep_stages, key=lambda s: s.start_time)
        
        for event in events:
            if not event.is_valid:
                continue
            
            event_time = get_time(event)
            
            containing_epoch = None
            for stage in sorted_stages:
                if stage.start_time <= event_time <= stage.end_time:
                    containing_epoch = stage
                    break
            
            if not containing_epoch:
                self._add_issue(
                    issue_type=IssueType.STAGE_CONFLICT,
                    severity=IssueSeverity.WARNING,
                    message=f"Event {event.event_code} at {event_time} does not fall within any sleep epoch",
                    details={
                        "event_id": event.event_id,
                        "event_code": event.event_code,
                        "event_time": event_time.isoformat(),
                        "first_epoch_start": sorted_stages[0].start_time.isoformat(),
                        "last_epoch_end": sorted_stages[-1].end_time.isoformat(),
                    },
                    suggestion="Check event alignment or if epochs cover the full recording"
                )
                continue
            
            conflict_info = {
                "event_id": event.event_id,
                "event_code": event.event_code,
                "event_time": event_time.isoformat(),
                "epoch_number": containing_epoch.epoch_number,
                "epoch_stage": containing_epoch.stage.value,
                "epoch_start": containing_epoch.start_time.isoformat(),
                "epoch_end": containing_epoch.end_time.isoformat(),
            }
            
            if event.event_type == EventType.STIMULUS:
                if containing_epoch.stage in self.CRITICAL_STAGES:
                    if containing_epoch.stage == SleepStage.REM:
                        self._add_issue(
                            issue_type=IssueType.STAGE_CONFLICT,
                            severity=IssueSeverity.INFO,
                            message=f"Stimulus event {event.event_code} during REM sleep (epoch {containing_epoch.epoch_number})",
                            details=conflict_info,
                            suggestion="Note: REM sleep stimuli may have different responses"
                        )
                        stage_conflicts.append(conflict_info)
                    elif containing_epoch.stage == SleepStage.N3:
                        self._add_issue(
                            issue_type=IssueType.STAGE_CONFLICT,
                            severity=IssueSeverity.INFO,
                            message=f"Stimulus event {event.event_code} during N3 sleep (epoch {containing_epoch.epoch_number})",
                            details=conflict_info,
                            suggestion="Note: N3 sleep stimuli may require arousal considerations"
                        )
                        stage_conflicts.append(conflict_info)
            
            if containing_epoch.stage == SleepStage.MOVEMENT:
                self._add_issue(
                    issue_type=IssueType.STAGE_CONFLICT,
                    severity=IssueSeverity.WARNING,
                    message=f"Event {event.event_code} during movement epoch {containing_epoch.epoch_number}",
                    details=conflict_info,
                    suggestion="Movement epochs may have artifacts - verify data quality"
                )
                stage_conflicts.append(conflict_info)
            
            if containing_epoch.stage == SleepStage.UNKNOWN:
                self._add_issue(
                    issue_type=IssueType.STAGE_CONFLICT,
                    severity=IssueSeverity.WARNING,
                    message=f"Event {event.event_code} during unknown stage epoch {containing_epoch.epoch_number}",
                    details=conflict_info,
                    suggestion="Verify sleep stage scoring for this epoch"
                )
                stage_conflicts.append(conflict_info)
        
        return stage_conflicts

    def _check_stage_transitions(self, sleep_stages: List[SleepStageEpoch]):
        sorted_stages = sorted(sleep_stages, key=lambda s: s.epoch_number)
        
        if len(sorted_stages) <= 2:
            return
        
        for i in range(len(sorted_stages) - 1):
            current = sorted_stages[i]
            next_stage = sorted_stages[i + 1]
            
            if current.stage == SleepStage.WAKE and next_stage.stage == SleepStage.REM:
                self._add_issue(
                    issue_type=IssueType.STAGE_CONFLICT,
                    severity=IssueSeverity.INFO,
                    message=f"Direct transition from Wake to REM at epoch {current.epoch_number} -> {next_stage.epoch_number}",
                    details={
                        "from_epoch": current.epoch_number,
                        "from_stage": current.stage.value,
                        "to_epoch": next_stage.epoch_number,
                        "to_stage": next_stage.stage.value,
                    },
                    suggestion="This may indicate SOREMP - verify if this is expected"
                )
            
            if current.stage == SleepStage.N3 and next_stage.stage == SleepStage.WAKE:
                self._add_issue(
                    issue_type=IssueType.STAGE_CONFLICT,
                    severity=IssueSeverity.INFO,
                    message=f"Direct transition from N3 to Wake at epoch {current.epoch_number} -> {next_stage.epoch_number}",
                    details={
                        "from_epoch": current.epoch_number,
                        "from_stage": current.stage.value,
                        "to_epoch": next_stage.epoch_number,
                        "to_stage": next_stage.stage.value,
                    },
                    suggestion="This may indicate arousal - verify if this is expected"
                )

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
