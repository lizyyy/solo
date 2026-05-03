from datetime import datetime, timedelta
from typing import List, Optional, Set, Dict, Any
import logging
import uuid

from eeg_aligner.models import (
    StimulusEvent,
    SleepStageEpoch,
    CheckResult,
    ValidationIssue,
    IssueType,
    IssueSeverity,
    EventType,
)
from eeg_aligner.rules.code_rules import CodeRuleEngine
from eeg_aligner.rules.stage_rules import StageRuleEngine
from eeg_aligner.rules.artifact_rules import ArtifactRuleEngine

logger = logging.getLogger(__name__)


class CheckEngine:
    def __init__(
        self,
        expected_codes: Optional[List[int]] = None,
        min_interval_ms: float = 10.0,
        max_artifact_overlap_ratio: float = 0.5,
    ):
        self.expected_codes = expected_codes or []
        self.min_interval_ms = min_interval_ms
        self.max_artifact_overlap_ratio = max_artifact_overlap_ratio
        
        self.issues: List[ValidationIssue] = []
        
        self.code_engine = CodeRuleEngine(
            expected_codes=expected_codes,
            min_interval_ms=min_interval_ms
        )
        self.stage_engine = StageRuleEngine()
        self.artifact_engine = ArtifactRuleEngine(
            max_overlap_ratio=max_artifact_overlap_ratio
        )

    def check_all(
        self,
        events: List[StimulusEvent],
        sleep_stages: List[SleepStageEpoch],
        use_aligned_timestamps: bool = True,
    ) -> CheckResult:
        logger.info("Starting comprehensive data check")
        self.issues = []
        
        valid_events = [e for e in events if e.is_valid]
        
        code_issues, missing_codes, duplicate_codes = self.code_engine.check_codes(
            events, use_aligned_timestamps
        )
        self.issues.extend(code_issues)
        
        stage_issues, stage_conflicts = self.stage_engine.check_stages(
            events, sleep_stages, use_aligned_timestamps
        )
        self.issues.extend(stage_issues)
        
        artifact_issues, artifact_overlaps = self.artifact_engine.check_artifacts(
            events, sleep_stages, use_aligned_timestamps
        )
        self.issues.extend(artifact_issues)
        
        critical_count = sum(1 for i in self.issues if i.severity == IssueSeverity.CRITICAL)
        warning_count = sum(1 for i in self.issues if i.severity == IssueSeverity.WARNING)
        info_count = sum(1 for i in self.issues if i.severity == IssueSeverity.INFO)
        
        result = CheckResult(
            total_events=len(events),
            valid_events=len(valid_events),
            total_epochs=len(sleep_stages),
            issues=self.issues.copy(),
            missing_codes=missing_codes,
            duplicate_codes=duplicate_codes,
            stage_conflicts=stage_conflicts,
            artifact_overlaps=artifact_overlaps,
            critical_issue_count=critical_count,
            warning_issue_count=warning_count,
            info_issue_count=info_count,
        )
        
        logger.info(f"Check complete: {len(self.issues)} issues found")
        logger.info(f"  Critical: {critical_count}, Warning: {warning_count}, Info: {info_count}")
        logger.info(f"  Missing codes: {len(missing_codes)}, Duplicate codes: {len(duplicate_codes)}")
        logger.info(f"  Stage conflicts: {len(stage_conflicts)}, Artifact overlaps: {len(artifact_overlaps)}")
        
        return result

    def get_issues_by_type(self) -> Dict[IssueType, List[ValidationIssue]]:
        result: Dict[IssueType, List[ValidationIssue]] = {}
        for issue in self.issues:
            if issue.issue_type not in result:
                result[issue.issue_type] = []
            result[issue.issue_type].append(issue)
        return result

    def get_issues_by_severity(self) -> Dict[IssueSeverity, List[ValidationIssue]]:
        result: Dict[IssueSeverity, List[ValidationIssue]] = {
            IssueSeverity.CRITICAL: [],
            IssueSeverity.WARNING: [],
            IssueSeverity.INFO: [],
        }
        for issue in self.issues:
            result[issue.severity].append(issue)
        return result
