from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from sla_models import (
    Ticket, SLARule, TimeDetail, TimeSegment, SLABreach,
    SLAReport, PauseRecord, CustomerReply, SLAStatus, PauseType
)
from calendar_engine import CalendarEngine
from sla_state_machine import SLAStateMachine


class TimeoutExplainer:
    def __init__(self, calendar_engine: CalendarEngine, state_machine: SLAStateMachine):
        self.calendar_engine = calendar_engine
        self.state_machine = state_machine

    def _format_duration(self, seconds: float) -> str:
        if seconds < 60:
            return f"{seconds:.1f}秒"
        elif seconds < 3600:
            return f"{seconds / 60:.1f}分钟"
        elif seconds < 86400:
            return f"{seconds / 3600:.1f}小时"
        else:
            return f"{seconds / 86400:.1f}天"

    def _get_contributing_factors(self, time_detail: TimeDetail) -> List[str]:
        factors = []
        total_excluded = (time_detail.paused_seconds + time_detail.holiday_seconds +
                          time_detail.weekend_seconds + time_detail.customer_pending_seconds)

        if time_detail.holiday_seconds > 0:
            factors.append(f"节假日扣除 {self._format_duration(time_detail.holiday_seconds)}")
        if time_detail.weekend_seconds > 0:
            factors.append(f"周末扣除 {self._format_duration(time_detail.weekend_seconds)}")
        if time_detail.paused_seconds > 0:
            factors.append(f"手动暂停 {self._format_duration(time_detail.paused_seconds)}")
        if time_detail.customer_pending_seconds > 0:
            factors.append(f"等待客户补充材料 {self._format_duration(time_detail.customer_pending_seconds)}")

        return factors

    def check_breaches(self, ticket: Ticket, rule: SLARule,
                        current_time: Optional[datetime] = None) -> List[SLABreach]:
        breaches = []
        current_time = current_time or datetime.now()
        start_time = ticket.started_at or ticket.created_at

        time_detail, segments = self.calendar_engine.calculate_effective_seconds(
            ticket.id, start_time, current_time, rule, include_segments=True
        )

        effective_elapsed = time_detail.effective_elapsed_seconds
        response_threshold = rule.response_time_hours * 3600
        resolution_threshold = rule.resolution_time_hours * 3600

        if ticket.started_at is None and effective_elapsed > response_threshold:
            exceeded = effective_elapsed - response_threshold
            breaches.append(SLABreach(
                breach_type="response_timeout",
                threshold_seconds=response_threshold,
                actual_seconds=effective_elapsed,
                exceeded_seconds=exceeded,
                breach_time=start_time + timedelta(seconds=response_threshold),
                explanation=(
                    f"响应超时: 应在 {self._format_duration(response_threshold)} 内响应，"
                    f"实际已用时 {self._format_duration(effective_elapsed)}，"
                    f"超出 {self._format_duration(exceeded)}"
                ),
                contributing_factors=self._get_contributing_factors(time_detail)
            ))

        if ticket.completed_at is None and effective_elapsed > resolution_threshold:
            exceeded = effective_elapsed - resolution_threshold
            breach_time = self.calendar_engine.calculate_deadline(start_time, rule, rule.resolution_time_hours)

            breaches.append(SLABreach(
                breach_type="resolution_timeout",
                threshold_seconds=resolution_threshold,
                actual_seconds=effective_elapsed,
                exceeded_seconds=exceeded,
                breach_time=breach_time,
                explanation=(
                    f"解决超时: 应在 {self._format_duration(resolution_threshold)} 内解决，"
                    f"实际已用时 {self._format_duration(effective_elapsed)}，"
                    f"超出 {self._format_duration(exceeded)}"
                ),
                contributing_factors=self._get_contributing_factors(time_detail)
            ))

        return breaches

    def explain_breach(self, breach: SLABreach, time_segments: List[TimeSegment]) -> str:
        explanation_parts = [breach.explanation]

        if breach.contributing_factors:
            explanation_parts.append("\n影响因素分析:")
            for factor in breach.contributing_factors:
                explanation_parts.append(f"  - {factor}")

        relevant_segments = [s for s in time_segments if s.segment_type != "working"]
        if relevant_segments:
            explanation_parts.append("\n时间扣除明细:")
            for seg in relevant_segments[:10]:
                explanation_parts.append(
                    f"  - {seg.description}: {seg.start_time.strftime('%Y-%m-%d %H:%M')} ~ "
                    f"{seg.end_time.strftime('%Y-%m-%d %H:%M')} ({self._format_duration(seg.duration_seconds)})"
                )
            if len(relevant_segments) > 10:
                explanation_parts.append(f"  ... 还有 {len(relevant_segments) - 10} 条扣除记录")

        return "\n".join(explanation_parts)

    def calculate_remaining_time(self, ticket: Ticket, rule: SLARule,
                                  current_time: Optional[datetime] = None) -> Tuple[float, Optional[datetime]]:
        current_time = current_time or datetime.now()
        start_time = ticket.started_at or ticket.created_at

        time_detail, _ = self.calendar_engine.calculate_effective_seconds(
            ticket.id, start_time, current_time, rule, include_segments=False
        )

        threshold = rule.resolution_time_hours * 3600
        remaining = threshold - time_detail.effective_elapsed_seconds

        if remaining <= 0:
            return remaining, None

        deadline = self.calendar_engine.calculate_deadline(current_time, rule, remaining / 3600)
        return remaining, deadline

    def generate_summary(self, ticket: Ticket, rule: SLARule,
                          time_detail: TimeDetail, breaches: List[SLABreach]) -> str:
        summary_parts = []

        status_desc = self.state_machine.describe_state(ticket.status)
        summary_parts.append(f"工单状态: {status_desc}")
        summary_parts.append(f"SLA规则: {rule.name} (优先级: {rule.priority.value})")

        summary_parts.append(f"\n时间统计:")
        summary_parts.append(f"  - 总耗时: {self._format_duration(time_detail.total_seconds)}")
        summary_parts.append(f"  - 有效工作时间: {self._format_duration(time_detail.effective_elapsed_seconds)}")
        summary_parts.append(f"  - 扣除时间总计: {self._format_duration(time_detail.total_seconds - time_detail.working_seconds)}")

        if time_detail.holiday_seconds > 0:
            summary_parts.append(f"    - 节假日: {self._format_duration(time_detail.holiday_seconds)}")
        if time_detail.weekend_seconds > 0:
            summary_parts.append(f"    - 周末: {self._format_duration(time_detail.weekend_seconds)}")
        if time_detail.paused_seconds > 0:
            summary_parts.append(f"    - 手动暂停: {self._format_duration(time_detail.paused_seconds)}")
        if time_detail.customer_pending_seconds > 0:
            summary_parts.append(f"    - 等待客户: {self._format_duration(time_detail.customer_pending_seconds)}")

        threshold = rule.resolution_time_hours * 3600
        remaining = threshold - time_detail.effective_elapsed_seconds

        if remaining > 0:
            _, deadline = self.calculate_remaining_time(ticket, rule)
            if deadline:
                summary_parts.append(f"\n剩余时间: {self._format_duration(remaining)}")
                summary_parts.append(f"预计截止: {deadline.strftime('%Y-%m-%d %H:%M:%S')}")
            else:
                summary_parts.append(f"\n剩余时间: {self._format_duration(remaining)}")
        else:
            summary_parts.append(f"\n⚠️  已超时 {self._format_duration(abs(remaining))}")

        if breaches:
            summary_parts.append(f"\n🚨 SLA违规 ({len(breaches)} 项):")
            for breach in breaches:
                summary_parts.append(f"  - {breach.explanation}")

        return "\n".join(summary_parts)

    def generate_report(self, ticket: Ticket, rule: SLARule,
                         current_time: Optional[datetime] = None,
                         include_segments: bool = True) -> SLAReport:
        current_time = current_time or datetime.now()
        start_time = ticket.started_at or ticket.created_at

        time_detail, time_segments = self.calendar_engine.calculate_effective_seconds(
            ticket.id, start_time, current_time, rule, include_segments=include_segments
        )

        remaining, _ = self.calculate_remaining_time(ticket, rule, current_time)
        time_detail.remaining_seconds = max(0, remaining)

        breaches = self.check_breaches(ticket, rule, current_time)

        pause_history = [p for p in self.calendar_engine.pause_records if p.ticket_id == ticket.id]
        customer_replies = [r for r in self.calendar_engine.customer_replies if r.ticket_id == ticket.id]

        summary = self.generate_summary(ticket, rule, time_detail, breaches)

        return SLAReport(
            ticket_id=ticket.id,
            ticket_title=ticket.title,
            sla_rule_name=rule.name,
            current_status=ticket.status,
            time_details=time_detail,
            time_segments=time_segments,
            breaches=breaches,
            pause_history=pause_history,
            customer_replies=customer_replies,
            is_breached=len(breaches) > 0,
            summary=summary
        )
