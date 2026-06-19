from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Callable, Tuple
from models import (
    SolarTrackingBracketError,
    ManualInspectionNote,
    SafetyThreshold,
    ErrorStatus,
    VersionHistory,
)
import copy


MIN_SAMPLING_DURATION_MINUTES = 30.0


@dataclass
class BoundaryCheckResult:
    passed: bool
    violations: List[str]
    human_messages: List[str]
    suggested_status: ErrorStatus
    auto_fixable: bool = False
    suggested_fix: Optional[Dict[str, Any]] = None


class BoundaryRuleEngine:
    def __init__(self, threshold: SafetyThreshold):
        self.threshold = threshold
        self.rules: List[Callable] = [
            self._check_sampling_duration,
            self._check_azimuth_error,
            self._check_elevation_error,
            self._check_tracking_accuracy,
            self._check_sampling_time_presence,
        ]

    def evaluate_note(
        self, note: ManualInspectionNote
    ) -> BoundaryCheckResult:
        all_violations: List[str] = []
        all_human_messages: List[str] = []
        suggested_status = ErrorStatus.PENDING_REVIEW
        auto_fixable = False
        suggested_fix: Optional[Dict[str, Any]] = None

        for rule in self.rules:
            result = rule(note)
            if not result.passed:
                all_violations.extend(result.violations)
                all_human_messages.extend(result.human_messages)
                if result.suggested_status == ErrorStatus.ABNORMAL:
                    suggested_status = ErrorStatus.ABNORMAL
                if result.auto_fixable:
                    auto_fixable = True
                    if result.suggested_fix:
                        suggested_fix = result.suggested_fix

        if not all_violations:
            suggested_status = ErrorStatus.NORMAL

        return BoundaryCheckResult(
            passed=len(all_violations) == 0,
            violations=all_violations,
            human_messages=all_human_messages,
            suggested_status=suggested_status,
            auto_fixable=auto_fixable,
            suggested_fix=suggested_fix,
        )

    def _check_sampling_time_presence(
        self, note: ManualInspectionNote
    ) -> BoundaryCheckResult:
        violations: List[str] = []
        human_messages: List[str] = []

        if note.sampling_start_time is None and note.sampling_end_time is None:
            violations.append("SAMPLING_TIME_MISSING_BOTH")
            human_messages.append("采样开始时间和结束时间都没填，请检查手写巡检备注")
        elif note.sampling_start_time is None:
            violations.append("SAMPLING_START_MISSING")
            human_messages.append("缺采样开始时间，没法算时长，请补全")
        elif note.sampling_end_time is None:
            violations.append("SAMPLING_END_MISSING")
            human_messages.append("缺采样结束时间，没法算时长，请补全")

        return BoundaryCheckResult(
            passed=len(violations) == 0,
            violations=violations,
            human_messages=human_messages,
            suggested_status=ErrorStatus.PENDING_REVIEW,
        )

    def _check_sampling_duration(
        self, note: ManualInspectionNote
    ) -> BoundaryCheckResult:
        violations: List[str] = []
        human_messages: List[str] = []
        auto_fixable = False
        suggested_fix: Optional[Dict[str, Any]] = None

        duration = note.calculate_sampling_duration()
        if duration is None:
            return BoundaryCheckResult(
                passed=True,
                violations=[],
                human_messages=[],
                suggested_status=ErrorStatus.NORMAL,
            )

        if duration < MIN_SAMPLING_DURATION_MINUTES:
            missing_minutes = MIN_SAMPLING_DURATION_MINUTES - duration
            violations.append(f"SAMPLING_DURATION_TOO_SHORT_{duration:.1f}min")
            human_messages.append(
                f"采样时间缺了{missing_minutes:.0f}分钟"
                f"（只有{duration:.0f}分钟，要求至少30分钟）"
                f"，请质检员复核后再处理"
            )
            auto_fixable = False

        return BoundaryCheckResult(
            passed=len(violations) == 0,
            violations=violations,
            human_messages=human_messages,
            suggested_status=ErrorStatus.PENDING_REVIEW,
            auto_fixable=auto_fixable,
            suggested_fix=suggested_fix,
        )

    def _check_azimuth_error(
        self, note: ManualInspectionNote
    ) -> BoundaryCheckResult:
        violations: List[str] = []
        human_messages: List[str] = []

        if note.azimuth_error is not None:
            if note.azimuth_error > self.threshold.azimuth_max:
                violations.append(f"AZIMUTH_EXCEEDS_{note.azimuth_error}")
                human_messages.append(
                    f"方位角误差{note.azimuth_error}°"
                    f"超过安全阈值{self.threshold.azimuth_max}°，请重点关注"
                )

        return BoundaryCheckResult(
            passed=len(violations) == 0,
            violations=violations,
            human_messages=human_messages,
            suggested_status=ErrorStatus.ABNORMAL
            if violations
            else ErrorStatus.NORMAL,
        )

    def _check_elevation_error(
        self, note: ManualInspectionNote
    ) -> BoundaryCheckResult:
        violations: List[str] = []
        human_messages: List[str] = []

        if note.elevation_error is not None:
            if note.elevation_error > self.threshold.elevation_max:
                violations.append(f"ELEVATION_EXCEEDS_{note.elevation_error}")
                human_messages.append(
                    f"俯仰角误差{note.elevation_error}°"
                    f"超过安全阈值{self.threshold.elevation_max}°，请重点关注"
                )

        return BoundaryCheckResult(
            passed=len(violations) == 0,
            violations=violations,
            human_messages=human_messages,
            suggested_status=ErrorStatus.ABNORMAL
            if violations
            else ErrorStatus.NORMAL,
        )

    def _check_tracking_accuracy(
        self, note: ManualInspectionNote
    ) -> BoundaryCheckResult:
        violations: List[str] = []
        human_messages: List[str] = []

        if note.tracking_accuracy is not None:
            if note.tracking_accuracy < self.threshold.tracking_accuracy_min:
                violations.append(f"TRACKING_ACCURACY_LOW_{note.tracking_accuracy}")
                human_messages.append(
                    f"跟踪准确率{note.tracking_accuracy}%"
                    f"低于要求的{self.threshold.tracking_accuracy_min}%，请检查设备"
                )

        return BoundaryCheckResult(
            passed=len(violations) == 0,
            violations=violations,
            human_messages=human_messages,
            suggested_status=ErrorStatus.ABNORMAL
            if violations
            else ErrorStatus.NORMAL,
        )

    def create_error_from_note(
        self, note: ManualInspectionNote, batch_id: str
    ) -> SolarTrackingBracketError:
        check_result = self.evaluate_note(note)

        error = SolarTrackingBracketError(
            error_id=f"ERR_{note.note_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            bracket_id=note.bracket_id,
            note_id=note.note_id,
            inspection_date=note.inspection_date,
            azimuth_error=note.azimuth_error,
            elevation_error=note.elevation_error,
            tracking_accuracy=note.tracking_accuracy,
            sampling_start_time=note.sampling_start_time,
            sampling_end_time=note.sampling_end_time,
            sampling_duration_minutes=note.sampling_duration_minutes,
            status=check_result.suggested_status,
            boundary_violations=check_result.violations,
            human_readable_issues=check_result.human_messages,
            import_batch_id=batch_id,
            source_note_hash=note.content_hash(),
        )
        return error

    def apply_fix(
        self,
        error: SolarTrackingBracketError,
        fix_data: Dict[str, Any],
        modified_by: str,
        modification_reason: str,
    ) -> Tuple[SolarTrackingBracketError, VersionHistory]:
        before_data = copy.deepcopy(error.to_dict())
        fields_changed: List[str] = []

        new_error = copy.deepcopy(error)

        for key, value in fix_data.items():
            if hasattr(new_error, key):
                old_value = getattr(new_error, key)
                if old_value != value:
                    setattr(new_error, key, value)
                    fields_changed.append(key)

        if "sampling_start_time" in fix_data or "sampling_end_time" in fix_data:
            if new_error.sampling_start_time and new_error.sampling_end_time:
                delta = new_error.sampling_end_time - new_error.sampling_start_time
                new_error.sampling_duration_minutes = delta.total_seconds() / 60.0
                fields_changed.append("sampling_duration_minutes")

        new_error.version += 1
        new_error.updated_at = datetime.now()
        new_error.status = ErrorStatus.MODIFIED

        after_data = copy.deepcopy(new_error.to_dict())

        history = VersionHistory(
            error_id=new_error.error_id,
            version=new_error.version,
            before_data=before_data,
            after_data=after_data,
            modified_by=modified_by,
            modification_reason=modification_reason,
            fields_changed=fields_changed,
        )

        return new_error, history

    def rollback(
        self,
        current_error: SolarTrackingBracketError,
        history: VersionHistory,
        modified_by: str,
    ) -> Tuple[SolarTrackingBracketError, VersionHistory]:
        before_data = copy.deepcopy(current_error.to_dict())

        new_error = copy.deepcopy(current_error)

        before_snapshot = history.before_data
        for key, value in before_snapshot.items():
            if key in ["created_at", "updated_at", "version"]:
                continue
            if key == "status":
                value = ErrorStatus(value)
            if key == "data_source":
                from models import DataSource
                value = DataSource(value)
            if key in ["sampling_start_time", "sampling_end_time", "review_time"]:
                if value:
                    value = datetime.fromisoformat(value)
            if hasattr(new_error, key):
                setattr(new_error, key, value)

        new_error.version += 1
        new_error.updated_at = datetime.now()
        new_error.status = ErrorStatus.ROLLED_BACK

        new_error = self.re_evaluate(new_error)

        after_data = copy.deepcopy(new_error.to_dict())

        rollback_history = VersionHistory(
            error_id=new_error.error_id,
            version=new_error.version,
            before_data=before_data,
            after_data=after_data,
            modified_by=modified_by,
            modification_reason=f"回滚到版本 {history.version}",
            fields_changed=history.fields_changed,
        )

        return new_error, rollback_history

    @staticmethod
    def find_user_initiated_history(
        history_list: List["VersionHistory"],
    ) -> Optional["VersionHistory"]:
        system_markers = (
            "system_import_update",
            "回滚到版本",
        )
        for h in reversed(history_list):
            if any(marker in h.modified_by for marker in system_markers):
                continue
            if any(marker in h.modification_reason for marker in system_markers):
                continue
            return h
        if history_list:
            return history_list[-1]
        return None

    def re_evaluate(self, error: SolarTrackingBracketError) -> SolarTrackingBracketError:
        note = ManualInspectionNote(
            note_id=error.note_id,
            inspection_date=error.inspection_date,
            inspector="recheck",
            bracket_id=error.bracket_id,
            azimuth_error=error.azimuth_error,
            elevation_error=error.elevation_error,
            sampling_start_time=error.sampling_start_time,
            sampling_end_time=error.sampling_end_time,
            tracking_accuracy=error.tracking_accuracy,
        )

        check_result = self.evaluate_note(note)
        error.boundary_violations = check_result.violations
        error.human_readable_issues = check_result.human_messages
        error.updated_at = datetime.now()

        return error

    def reviewer_confirm(
        self,
        error: SolarTrackingBracketError,
        reviewer: str,
        comment: str,
        mark_as_normal: bool = False,
    ) -> SolarTrackingBracketError:
        error.review_by = reviewer
        error.review_time = datetime.now()
        error.review_comment = comment

        if mark_as_normal:
            error.status = ErrorStatus.NORMAL
        else:
            if error.boundary_violations:
                has_duration_issue = any(
                    v.startswith("SAMPLING_DURATION_TOO_SHORT")
                    for v in error.boundary_violations
                )
                if has_duration_issue and comment.strip():
                    pass

        error.updated_at = datetime.now()
        return error
