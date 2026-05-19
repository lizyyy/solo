import fnmatch
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set

from ..parsers.parser import ChangeType, ConfirmStatus, ParsedRecord
from ..tracker.source_tracker import TrackedRecord


class NotificationStatus(Enum):
    NEW = "新增通知"
    DEDUPLICATED = "已去重"
    CONFIRMED = "已确认"
    PENDING = "待确认"
    TIMEOUT = "已超时"
    NEED_REISSUE = "需补发"
    MISMATCH = "订阅不匹配"


@dataclass
class MatchResult:
    tracked_record: TrackedRecord
    status: NotificationStatus
    matched_subscription: Optional[str] = None
    timeout_hours: Optional[int] = None
    is_duplicate: bool = False
    duplicate_of: Optional[str] = None
    need_reissue: bool = False
    reissue_reason: Optional[str] = None
    match_score: int = 0
    extra: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.tracked_record.record_id,
            "api_path": self.tracked_record.record.api_path if self.tracked_record.record else None,
            "subscriber": self.tracked_record.record.subscriber if self.tracked_record.record else None,
            "batch_id": self.tracked_record.record.batch_id if self.tracked_record.record else None,
            "status": self.status.value,
            "matched_subscription": self.matched_subscription,
            "timeout_hours": self.timeout_hours,
            "is_duplicate": self.is_duplicate,
            "duplicate_of": self.duplicate_of,
            "need_reissue": self.need_reissue,
            "reissue_reason": self.reissue_reason,
            "match_score": self.match_score,
            "source_location": self.tracked_record.source_location.to_string(),
            **self.extra
        }


class RuleEngine:
    def __init__(self, timeout_hours: int = 24, subscriptions: Optional[List[str]] = None):
        self.timeout_hours = timeout_hours
        self.subscriptions = subscriptions or []
        self.match_results: List[MatchResult] = []
        self._seen_notifications: Set[str] = set()
        self._batch_first_notify: Dict[str, datetime] = {}

    def add_subscription(self, pattern: str):
        self.subscriptions.append(pattern)

    def set_timeout(self, hours: int):
        self.timeout_hours = hours

    def process(self, tracked_records: List[TrackedRecord]) -> List[MatchResult]:
        self.match_results = []
        self._seen_notifications = set()
        self._batch_first_notify = {}

        valid_records = [r for r in tracked_records if r.is_valid()]
        
        for tracked in sorted(valid_records, key=lambda x: (
            x.record.notify_time if x.record and x.record.notify_time else datetime.min,
            x.source_location.file_path,
            x.source_location.line_number
        )):
            result = self._process_record(tracked)
            self.match_results.append(result)

        return self._get_stable_sorted(self.match_results)

    def _process_record(self, tracked: TrackedRecord) -> MatchResult:
        record = tracked.record
        
        match_result = MatchResult(
            tracked_record=tracked,
            status=NotificationStatus.NEW
        )

        if not self._matches_subscription(record.api_path, record.subscriber):
            match_result.status = NotificationStatus.MISMATCH
            match_result.match_score = 0
            return match_result

        match_result.matched_subscription = self._find_matching_subscription(record.api_path, record.subscriber)
        match_result.match_score = 100

        dedup_key = tracked.deduplication_key
        if dedup_key in self._seen_notifications:
            match_result.is_duplicate = True
            match_result.status = NotificationStatus.DEDUPLICATED
            match_result.duplicate_of = dedup_key
            return match_result

        self._seen_notifications.add(dedup_key)

        batch_id = record.batch_id
        if batch_id not in self._batch_first_notify and record.notify_time:
            self._batch_first_notify[batch_id] = record.notify_time

        if record.confirm_status == ConfirmStatus.CONFIRMED:
            match_result.status = NotificationStatus.CONFIRMED
            return match_result

        if record.confirm_status == ConfirmStatus.TIMEOUT:
            match_result.status = NotificationStatus.TIMEOUT
            match_result.need_reissue = True
            match_result.reissue_reason = "标记已超时"
            return match_result

        is_timeout, actual_hours = self._check_timeout(record)
        if is_timeout:
            match_result.status = NotificationStatus.TIMEOUT
            match_result.timeout_hours = actual_hours
            match_result.need_reissue = True
            match_result.reissue_reason = f"超时{actual_hours}小时未确认"
            return match_result

        match_result.status = NotificationStatus.PENDING
        return match_result

    def _matches_subscription(self, api_path: str, subscriber: str) -> bool:
        if not self.subscriptions:
            return True

        for pattern in self.subscriptions:
            if self._pattern_match(pattern, api_path, subscriber):
                return True
        return False

    def _find_matching_subscription(self, api_path: str, subscriber: str) -> Optional[str]:
        if not self.subscriptions:
            return "*"

        for pattern in self.subscriptions:
            if self._pattern_match(pattern, api_path, subscriber):
                return pattern
        return None

    def _pattern_match(self, pattern: str, api_path: str, subscriber: str) -> bool:
        if ':' in pattern:
            sub_pattern, api_pattern = pattern.split(':', 1)
            return (fnmatch.fnmatch(subscriber, sub_pattern) and 
                    fnmatch.fnmatch(api_path, api_pattern))
        else:
            return fnmatch.fnmatch(api_path, pattern) or fnmatch.fnmatch(subscriber, pattern)

    def _check_timeout(self, record: ParsedRecord) -> tuple[bool, int]:
        if not record.notify_time:
            return False, 0

        base_time = self._batch_first_notify.get(record.batch_id, record.notify_time)
        now = datetime.now()
        delta = now - base_time
        hours_passed = int(delta.total_seconds() / 3600)

        if hours_passed > self.timeout_hours:
            return True, hours_passed
        return False, hours_passed

    def _get_stable_sorted(self, results: List[MatchResult]) -> List[MatchResult]:
        return sorted(results, key=lambda r: (
            r.tracked_record.source_location.file_path,
            r.tracked_record.source_location.line_number,
            r.tracked_record.record_id
        ))

    def get_results_by_status(self, status: NotificationStatus) -> List[MatchResult]:
        return self._get_stable_sorted([r for r in self.match_results if r.status == status])

    def get_timeout_records(self) -> List[MatchResult]:
        return self._get_stable_sorted([r for r in self.match_results if r.status == NotificationStatus.TIMEOUT])

    def get_pending_records(self) -> List[MatchResult]:
        return self._get_stable_sorted([r for r in self.match_results if r.status == NotificationStatus.PENDING])

    def get_confirmed_records(self) -> List[MatchResult]:
        return self._get_stable_sorted([r for r in self.match_results if r.status == NotificationStatus.CONFIRMED])

    def get_duplicates(self) -> List[MatchResult]:
        return self._get_stable_sorted([r for r in self.match_results if r.is_duplicate])

    def get_reissue_candidates(self) -> List[MatchResult]:
        return self._get_stable_sorted([r for r in self.match_results if r.need_reissue])

    def get_summary(self) -> Dict[str, Any]:
        total = len(self.match_results)
        by_status = {}
        for status in NotificationStatus:
            by_status[status.value] = len([r for r in self.match_results if r.status == status])
        
        return {
            "total": total,
            "by_status": by_status,
            "timeout_count": len(self.get_timeout_records()),
            "pending_count": len(self.get_pending_records()),
            "confirmed_count": len(self.get_confirmed_records()),
            "duplicate_count": len(self.get_duplicates()),
            "reissue_count": len(self.get_reissue_candidates()),
            "timeout_hours": self.timeout_hours,
            "subscription_count": len(self.subscriptions)
        }

    def group_by_subscriber(self) -> Dict[str, List[MatchResult]]:
        groups: Dict[str, List[MatchResult]] = {}
        for result in self.match_results:
            if result.tracked_record.record:
                subscriber = result.tracked_record.record.subscriber
                if subscriber not in groups:
                    groups[subscriber] = []
                groups[subscriber].append(result)
        
        for subscriber in groups:
            groups[subscriber] = self._get_stable_sorted(groups[subscriber])
        
        return dict(sorted(groups.items()))

    def group_by_batch(self) -> Dict[str, List[MatchResult]]:
        groups: Dict[str, List[MatchResult]] = {}
        for result in self.match_results:
            if result.tracked_record.record:
                batch_id = result.tracked_record.record.batch_id
                if batch_id not in groups:
                    groups[batch_id] = []
                groups[batch_id].append(result)
        
        for batch_id in groups:
            groups[batch_id] = self._get_stable_sorted(groups[batch_id])
        
        return dict(sorted(groups.items()))
