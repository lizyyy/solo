from datetime import datetime, timedelta, time
from typing import List, Tuple, Optional
import pytz
from sla_models import Holiday, SLARule, PauseRecord, CustomerReply, TimeDetail, TimeSegment, PauseType


class CalendarEngine:
    def __init__(self, default_timezone: str = "Asia/Shanghai"):
        self.default_timezone = default_timezone
        self.holidays: List[Holiday] = []
        self.pause_records: List[PauseRecord] = []
        self.customer_replies: List[CustomerReply] = []

    def add_holiday(self, holiday: Holiday):
        for i, existing in enumerate(self.holidays):
            if existing.id == holiday.id:
                self.holidays[i] = holiday
                self.holidays.sort(key=lambda h: h.start_time)
                return
        self.holidays.append(holiday)
        self.holidays.sort(key=lambda h: h.start_time)

    def add_holidays(self, holidays: List[Holiday]):
        for holiday in holidays:
            self.add_holiday(holiday)

    def add_pause_record(self, pause: PauseRecord):
        for i, existing in enumerate(self.pause_records):
            if existing.id == pause.id:
                self.pause_records[i] = pause
                self.pause_records.sort(key=lambda p: p.start_time)
                return
        self.pause_records.append(pause)
        self.pause_records.sort(key=lambda p: p.start_time)

    def add_pause_records(self, pauses: List[PauseRecord]):
        for pause in pauses:
            self.add_pause_record(pause)

    def add_customer_reply(self, reply: CustomerReply):
        self.customer_replies.append(reply)
        self.customer_replies.sort(key=lambda r: r.reply_time)

    def add_customer_replies(self, replies: List[CustomerReply]):
        for reply in replies:
            self.add_customer_reply(reply)

    def _to_timezone(self, dt: datetime, tz_name: str) -> datetime:
        if dt.tzinfo is None:
            tz = pytz.timezone(tz_name)
            return tz.localize(dt)
        return dt.astimezone(pytz.timezone(tz_name))

    def _is_weekend(self, dt: datetime, tz_name: str) -> bool:
        dt_tz = self._to_timezone(dt, tz_name)
        return dt_tz.weekday() >= 5

    def _is_within_working_hours(self, dt: datetime, rule: SLARule) -> bool:
        dt_tz = self._to_timezone(dt, rule.timezone)
        hour = dt_tz.hour
        minute = dt_tz.minute
        current_minutes = hour * 60 + minute
        start_minutes = rule.working_hours_start * 60
        end_minutes = rule.working_hours_end * 60
        return start_minutes <= current_minutes < end_minutes

    def _get_holiday_overlap(self, start: datetime, end: datetime, tz_name: str) -> List[Tuple[datetime, datetime, str]]:
        overlaps = []
        start_tz = self._to_timezone(start, tz_name)
        end_tz = self._to_timezone(end, tz_name)

        for holiday in self.holidays:
            h_start = self._to_timezone(holiday.start_time, holiday.timezone)
            h_end = self._to_timezone(holiday.end_time, holiday.timezone)

            overlap_start = max(start_tz, h_start)
            overlap_end = min(end_tz, h_end)

            if overlap_start < overlap_end:
                overlaps.append((overlap_start, overlap_end, holiday.name))

        return overlaps

    def _get_weekend_periods(self, start: datetime, end: datetime, tz_name: str) -> List[Tuple[datetime, datetime]]:
        periods = []
        start_tz = self._to_timezone(start, tz_name)
        end_tz = self._to_timezone(end, tz_name)

        current = start_tz.replace(hour=0, minute=0, second=0, microsecond=0)
        while current < end_tz:
            if current.weekday() >= 5:
                day_start = max(current, start_tz)
                day_end = min(current + timedelta(days=1), end_tz)
                if day_start < day_end:
                    periods.append((day_start, day_end))
            current += timedelta(days=1)

        return periods

    def _get_pause_overlaps(self, ticket_id: str, start: datetime, end: datetime, tz_name: str) -> List[Tuple[datetime, datetime, str, PauseType]]:
        overlaps = []
        start_tz = self._to_timezone(start, tz_name)
        end_tz = self._to_timezone(end, tz_name)

        for pause in self.pause_records:
            if pause.ticket_id != ticket_id:
                continue

            p_start = self._to_timezone(pause.start_time, tz_name)
            p_end = self._to_timezone(pause.end_time, tz_name) if pause.end_time else end_tz

            if not pause.is_active and pause.end_time is None:
                continue

            overlap_start = max(start_tz, p_start)
            overlap_end = min(end_tz, p_end)

            if overlap_start < overlap_end:
                overlaps.append((overlap_start, overlap_end, pause.reason, pause.pause_type))

        return overlaps

    def _get_customer_pending_periods(self, ticket_id: str, start: datetime, end: datetime,
                                       rule: SLARule) -> List[Tuple[datetime, datetime]]:
        periods = []
        start_tz = self._to_timezone(start, rule.timezone)
        end_tz = self._to_timezone(end, rule.timezone)

        ticket_replies = [r for r in self.customer_replies if r.ticket_id == ticket_id]
        ticket_pauses = [p for p in self.pause_records
                         if p.ticket_id == ticket_id and p.pause_type == PauseType.CUSTOMER_PENDING]

        for pause in ticket_pauses:
            p_start = self._to_timezone(pause.start_time, rule.timezone)
            p_end = self._to_timezone(pause.end_time, rule.timezone) if pause.end_time else end_tz

            overlap_start = max(start_tz, p_start)
            overlap_end = min(end_tz, p_end)

            if overlap_start < overlap_end:
                periods.append((overlap_start, overlap_end))

        return periods

    def _merge_periods(self, periods: List[Tuple[datetime, datetime]]) -> List[Tuple[datetime, datetime]]:
        if not periods:
            return []

        sorted_periods = sorted(periods, key=lambda x: x[0])
        merged = [sorted_periods[0]]

        for current_start, current_end in sorted_periods[1:]:
            last_start, last_end = merged[-1]
            if current_start <= last_end:
                merged[-1] = (last_start, max(last_end, current_end))
            else:
                merged.append((current_start, current_end))

        return merged

    def calculate_effective_seconds(self, ticket_id: str, start: datetime, end: datetime,
                                     rule: SLARule, include_segments: bool = False) -> Tuple[TimeDetail, List[TimeSegment]]:
        tz_name = rule.timezone
        start_tz = self._to_timezone(start, tz_name)
        end_tz = self._to_timezone(end, tz_name)

        if end_tz < start_tz:
            start_tz, end_tz = end_tz, start_tz

        total_seconds = (end_tz - start_tz).total_seconds()

        if total_seconds <= 0:
            time_detail = TimeDetail(
                total_seconds=0.0,
                working_seconds=0.0,
                paused_seconds=0.0,
                holiday_seconds=0.0,
                weekend_seconds=0.0,
                customer_pending_seconds=0.0,
                remaining_seconds=0.0,
                effective_elapsed_seconds=0.0
            )
            return time_detail, []

        excluded_periods: List[Tuple[datetime, datetime, str]] = []

        if rule.consider_holidays:
            for h_start, h_end, h_name in self._get_holiday_overlap(start, end, tz_name):
                excluded_periods.append((h_start, h_end, f"节假日: {h_name}"))

        if rule.consider_weekends:
            for w_start, w_end in self._get_weekend_periods(start, end, tz_name):
                excluded_periods.append((w_start, w_end, "周末"))

        for p_start, p_end, p_reason, p_type in self._get_pause_overlaps(ticket_id, start, end, tz_name):
            excluded_periods.append((p_start, p_end, f"{p_type.value}: {p_reason}"))

        for cp_start, cp_end in self._get_customer_pending_periods(ticket_id, start, end, rule):
            excluded_periods.append((cp_start, cp_end, "等待客户补充材料"))

        merged_excluded = self._merge_periods([(s, e) for s, e, _ in excluded_periods])

        working_seconds = 0.0
        holiday_seconds = 0.0
        weekend_seconds = 0.0
        paused_seconds = 0.0
        customer_pending_seconds = 0.0
        segments: List[TimeSegment] = []

        current = start_tz
        excluded_idx = 0

        while current < end_tz:
            if excluded_idx < len(merged_excluded):
                excl_start, excl_end = merged_excluded[excluded_idx]
                if current >= excl_start and current < excl_end:
                    duration = (min(excl_end, end_tz) - current).total_seconds()

                    excluded_type = "other"
                    excluded_desc = "排除时间"
                    for s, e, desc in excluded_periods:
                        if s <= current < e:
                            excluded_desc = desc
                            if desc.startswith("节假日"):
                                excluded_type = "holiday"
                                holiday_seconds += duration
                            elif desc == "周末":
                                excluded_type = "weekend"
                                weekend_seconds += duration
                            elif desc.startswith("等待客户") or "CUSTOMER_PENDING" in desc.upper() or desc.startswith("customer_pending"):
                                excluded_type = "customer_pending"
                                customer_pending_seconds += duration
                            elif "暂停" in desc or "PAUSE" in desc.upper() or "MANUAL_PAUSE" in desc.upper() or "SYSTEM_MAINTENANCE" in desc.upper():
                                excluded_type = "paused"
                                paused_seconds += duration
                            else:
                                excluded_type = "paused"
                                paused_seconds += duration
                            break

                    if include_segments:
                        segments.append(TimeSegment(
                            segment_type=excluded_type,
                            start_time=current,
                            end_time=min(excl_end, end_tz),
                            duration_seconds=duration,
                            description=excluded_desc
                        ))

                    current = min(excl_end, end_tz)
                    excluded_idx += 1
                    continue
                elif current < excl_start:
                    segment_end = min(excl_start, end_tz)
                else:
                    excluded_idx += 1
                    continue
            else:
                segment_end = end_tz

            if current < segment_end:
                if self._is_within_working_hours(current, rule):
                    day_start = current.replace(hour=rule.working_hours_start, minute=0, second=0, microsecond=0)
                    day_end = current.replace(hour=rule.working_hours_end, minute=0, second=0, microsecond=0)

                    effective_start = max(current, day_start)
                    effective_end = min(segment_end, day_end)

                    if effective_start < effective_end:
                        duration = (effective_end - effective_start).total_seconds()
                        working_seconds += duration

                        if include_segments:
                            segments.append(TimeSegment(
                                segment_type="working",
                                start_time=effective_start,
                                end_time=effective_end,
                                duration_seconds=duration,
                                description="工作时间"
                            ))

                    next_day = current.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
                    current = min(next_day, segment_end)
                else:
                    next_working_start = self._get_next_working_start(current, rule)
                    current = min(next_working_start, segment_end)
            else:
                current = segment_end

        effective_elapsed_seconds = working_seconds
        total_paused_seconds = paused_seconds + holiday_seconds + weekend_seconds + customer_pending_seconds

        time_detail = TimeDetail(
            total_seconds=total_seconds,
            working_seconds=working_seconds,
            paused_seconds=paused_seconds,
            holiday_seconds=holiday_seconds,
            weekend_seconds=weekend_seconds,
            customer_pending_seconds=customer_pending_seconds,
            remaining_seconds=0.0,
            effective_elapsed_seconds=effective_elapsed_seconds
        )

        return time_detail, segments

    def _get_next_working_start(self, dt: datetime, rule: SLARule) -> datetime:
        dt_tz = self._to_timezone(dt, rule.timezone)
        current = dt_tz

        while True:
            if current.weekday() < 5 and not self._is_holiday(current, rule.timezone):
                work_start = current.replace(hour=rule.working_hours_start, minute=0, second=0, microsecond=0)
                if work_start > dt_tz:
                    return work_start
            current = current.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)

    def _is_holiday(self, dt: datetime, tz_name: str) -> bool:
        dt_tz = self._to_timezone(dt, tz_name)
        for holiday in self.holidays:
            h_start = self._to_timezone(holiday.start_time, holiday.timezone)
            h_end = self._to_timezone(holiday.end_time, holiday.timezone)
            if h_start <= dt_tz < h_end:
                return True
        return False

    def calculate_deadline(self, start: datetime, rule: SLARule, hours: float) -> datetime:
        tz_name = rule.timezone
        start_tz = self._to_timezone(start, tz_name)
        remaining_seconds = hours * 3600
        current = start_tz

        while remaining_seconds > 0:
            if rule.consider_weekends and current.weekday() >= 5:
                current = current.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
                continue

            if rule.consider_holidays and self._is_holiday(current, tz_name):
                current = current.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
                continue

            work_start = current.replace(hour=rule.working_hours_start, minute=0, second=0, microsecond=0)
            work_end = current.replace(hour=rule.working_hours_end, minute=0, second=0, microsecond=0)

            effective_start = max(current, work_start)
            if effective_start >= work_end:
                current = current.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
                continue

            available_seconds = (work_end - effective_start).total_seconds()

            if available_seconds >= remaining_seconds:
                return effective_start + timedelta(seconds=remaining_seconds)
            else:
                remaining_seconds -= available_seconds
                current = current.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)

        return current
