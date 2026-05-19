from datetime import datetime
from typing import Dict, List, Tuple, Optional
from collections import defaultdict
from .models import (
    WebhookEvent,
    DualDeliveryResult,
    VerificationRule,
    SwitchConclusion,
    EventStatus,
    SwitchState,
)


class DualDeliveryMatcher:
    def __init__(self, old_endpoint: str, new_endpoint: str, rule: VerificationRule):
        self.old_endpoint = old_endpoint
        self.new_endpoint = new_endpoint
        self.rule = rule

    def match_events(self, events: List[WebhookEvent]) -> List[DualDeliveryResult]:
        grouped = self._group_by_event_id(events)
        results = []

        for event_id, event_group in sorted(grouped.items()):
            old_events = sorted([e for e in event_group if self.old_endpoint in e.endpoint], key=lambda x: x.timestamp)
            new_events = sorted([e for e in event_group if self.new_endpoint in e.endpoint], key=lambda x: x.timestamp)

            for old_event in old_events:
                matched_new = self._find_matching_new(old_event, new_events)
                results.append(self._create_result(event_id, old_event, matched_new))

            unmatched_new = [ne for ne in new_events if not any(
                self._is_within_window(oe, ne) for oe in old_events
            )]
            for new_event in unmatched_new:
                results.append(self._create_result(event_id, None, new_event))

        return sorted(results, key=lambda x: (x.old_timestamp or x.new_timestamp or datetime.min, x.event_id))

    def _group_by_event_id(self, events: List[WebhookEvent]) -> Dict[str, List[WebhookEvent]]:
        grouped: Dict[str, List[WebhookEvent]] = defaultdict(list)
        for event in events:
            if event.vendor == self.rule.vendor and event.event_type == self.rule.event_type:
                grouped[event.event_id].append(event)
        return grouped

    def _find_matching_new(self, old_event: WebhookEvent, new_events: List[WebhookEvent]) -> Optional[WebhookEvent]:
        for new_event in new_events:
            if self._is_within_window(old_event, new_event):
                return new_event
        return None

    def _is_within_window(self, event1: WebhookEvent, event2: WebhookEvent) -> bool:
        time_diff = abs((event1.timestamp - event2.timestamp).total_seconds())
        return time_diff <= self.rule.dual_delivery_window_seconds

    def _is_status_success(self, status_code: Optional[int]) -> bool:
        if status_code is None:
            return False
        return status_code in self.rule.success_status_codes

    def _create_result(self, event_id: str, old_event: Optional[WebhookEvent], new_event: Optional[WebhookEvent]) -> DualDeliveryResult:
        old_received = old_event is not None
        new_received = new_event is not None
        old_ts = old_event.timestamp if old_event else None
        new_ts = new_event.timestamp if new_event else None
        old_status_code = old_event.status_code if old_event else None
        new_status_code = new_event.status_code if new_event else None

        old_status_success = None
        if old_received:
            old_status_success = self._is_status_success(old_status_code)

        new_status_success = None
        if new_received:
            new_status_success = self._is_status_success(new_status_code)

        time_diff = None
        if old_ts and new_ts:
            time_diff = abs((new_ts - old_ts).total_seconds())

        within_window = True
        if time_diff is not None:
            within_window = time_diff <= self.rule.dual_delivery_window_seconds

        payload_match = None
        if old_event and new_event and old_event.payload_hash and new_event.payload_hash:
            payload_match = old_event.payload_hash == new_event.payload_hash

        is_verified = False
        if old_received and new_received and within_window:
            is_verified = True

            if self.rule.check_old_endpoint and not old_status_success:
                is_verified = False

            if not new_status_success:
                is_verified = False

            if self.rule.require_payload_match and payload_match is not None and not payload_match:
                is_verified = False

        if is_verified:
            status = EventStatus.VERIFIED
        elif old_received and new_received and within_window:
            status = EventStatus.DUAL_DELIVERED
        elif old_received and not new_received:
            status = EventStatus.MISSING_NEW
        elif not old_received and new_received:
            status = EventStatus.MISSING_OLD
        else:
            status = EventStatus.FAILED

        return DualDeliveryResult(
            event_id=event_id,
            event_type=self.rule.event_type,
            vendor=self.rule.vendor,
            old_received=old_received,
            new_received=new_received,
            old_timestamp=old_ts,
            new_timestamp=new_ts,
            old_status_code=old_status_code,
            new_status_code=new_status_code,
            old_status_success=old_status_success,
            new_status_success=new_status_success,
            payload_match=payload_match,
            within_window=within_window,
            status=status,
            time_diff_seconds=time_diff,
        )


class SwitchStateMachine:
    def __init__(self, rule: VerificationRule):
        self.rule = rule
        self.state = SwitchState.INIT
        self.consecutive_success = 0
        self.max_consecutive_success = 0

    def process_results(self, results: List[DualDeliveryResult]) -> Tuple[SwitchState, SwitchConclusion]:
        sorted_results = sorted(results, key=lambda x: x.old_timestamp or x.new_timestamp or datetime.min)

        if not sorted_results:
            self.state = SwitchState.INIT
            return self.state, self._create_conclusion([], 0, 0)

        self.state = SwitchState.DUAL_DELIVERY

        verified_count = 0
        failed_count = 0

        for result in sorted_results:
            if result.status == EventStatus.VERIFIED:
                verified_count += 1
                self.consecutive_success += 1
                self.max_consecutive_success = max(self.max_consecutive_success, self.consecutive_success)
            else:
                failed_count += 1
                self.consecutive_success = 0

        total_events = len(sorted_results)
        success_rate = verified_count / total_events if total_events > 0 else 0.0

        if success_rate >= self.rule.min_success_rate:
            self.state = SwitchState.VERIFYING

            if self.max_consecutive_success >= self.rule.required_consecutive_success:
                self.state = SwitchState.READY_TO_SWITCH
        else:
            self.state = SwitchState.ROLLBACK

        return self.state, self._create_conclusion(sorted_results, verified_count, failed_count)

    def _create_conclusion(self, results: List[DualDeliveryResult], verified_count: int, failed_count: int) -> SwitchConclusion:
        total_events = len(results)
        success_rate = verified_count / total_events if total_events > 0 else 0.0

        can_switch = self.state == SwitchState.READY_TO_SWITCH

        if can_switch:
            recommendation = "可以切换到新webhook地址"
        elif self.state == SwitchState.ROLLBACK:
            recommendation = "验证失败，建议保持旧地址或排查问题后重试"
        elif self.state == SwitchState.VERIFYING:
            recommendation = f"验证中，成功率{success_rate:.2%}，但未达到连续成功要求"
        else:
            recommendation = "双投进行中，需收集更多数据"

        details = {
            "consecutive_success": self.consecutive_success,
            "max_consecutive_success": self.max_consecutive_success,
            "required_consecutive_success": self.rule.required_consecutive_success,
            "min_success_rate": self.rule.min_success_rate,
        }

        return SwitchConclusion(
            vendor=self.rule.vendor,
            event_type=self.rule.event_type,
            state=self.state,
            can_switch=can_switch,
            success_rate=success_rate,
            verified_count=verified_count,
            failed_count=failed_count,
            total_events=total_events,
            recommendation=recommendation,
            details=details,
        )


class VerificationEngine:
    def __init__(self, old_endpoint: str, new_endpoint: str, rules: List[VerificationRule]):
        self.old_endpoint = old_endpoint
        self.new_endpoint = new_endpoint
        self.rules = { (r.vendor, r.event_type): r for r in rules }

    def verify(self, events: List[WebhookEvent]) -> Dict[Tuple[str, str], Dict]:
        results_by_key: Dict[Tuple[str, str], Dict] = {}

        for (vendor, event_type), rule in self.rules.items():
            matcher = DualDeliveryMatcher(self.old_endpoint, self.new_endpoint, rule)
            matched_results = matcher.match_events(events)

            state_machine = SwitchStateMachine(rule)
            state, conclusion = state_machine.process_results(matched_results)

            results_by_key[(vendor, event_type)] = {
                "rule": rule,
                "dual_delivery_results": matched_results,
                "state": state,
                "conclusion": conclusion,
            }

        return results_by_key
