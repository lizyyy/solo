import os
from datetime import datetime, date, timedelta
from typing import List, Tuple, Optional, Dict, Any, Set
import copy

import pytz

from src.models import Event, RecurrenceType, ValidationError


DEFAULT_TARGET_TIMEZONE = pytz.timezone('Asia/Shanghai')
DEFAULT_RECURRENCE_LIMIT = 100
DEFAULT_RECURRENCE_UNTIL_MONTHS = 12


class EventNormalizer:
    def __init__(self, target_timezone=None, recurrence_limit=DEFAULT_RECURRENCE_LIMIT,
                 recurrence_until_months=DEFAULT_RECURRENCE_UNTIL_MONTHS):
        self.target_timezone = target_timezone or DEFAULT_TARGET_TIMEZONE
        self.recurrence_limit = recurrence_limit
        self.recurrence_until_months = recurrence_until_months
        self.validation_errors: List[ValidationError] = []

    def normalize_events(self, events: List[Event]) -> Tuple[List[Event], List[ValidationError]]:
        self.validation_errors = []
        normalized_events: List[Event] = []
        
        for event in events:
            try:
                normalized = self._normalize_single_event(event)
                normalized_events.append(normalized)
            except Exception as e:
                self._add_error(event.source_file, None, event.title, 
                               "normalization_error", f"规范化事件失败: {str(e)}")
        
        return normalized_events, self.validation_errors

    def expand_recurrences(self, events: List[Event]) -> Tuple[List[Event], List[ValidationError]]:
        self.validation_errors = []
        all_events: List[Event] = []
        
        for event in events:
            if event.recurrence_rule and not event.is_expanded:
                expanded = self._expand_recurrence(event)
                all_events.extend(expanded)
            else:
                all_events.append(event)
        
        return all_events, self.validation_errors

    def _normalize_single_event(self, event: Event) -> Event:
        normalized = copy.deepcopy(event)
        
        normalized.start = self._convert_to_timezone(normalized.start, event.source_file, event.title)
        normalized.end = self._convert_to_timezone(normalized.end, event.source_file, event.title)
        
        for i, ex_date in enumerate(normalized.exceptions):
            normalized.exceptions[i] = self._convert_to_timezone(ex_date, event.source_file, event.title)
        
        if normalized.recurrence_rule and normalized.recurrence_rule.until:
            normalized.recurrence_rule.until = self._convert_to_timezone(
                normalized.recurrence_rule.until, event.source_file, event.title
            )
        
        self._normalize_all_day(normalized)
        
        return normalized

    def _convert_to_timezone(self, dt: datetime, source_file: str, event_title: Optional[str]) -> datetime:
        if dt is None:
            return dt
        
        if dt.tzinfo is None:
            self._add_error(source_file, None, event_title,
                           "naive_datetime", f"检测到无时区信息的时间，假设为 {self.target_timezone.zone}",
                           severity="warning")
            dt = self.target_timezone.localize(dt)
        
        try:
            return dt.astimezone(self.target_timezone)
        except Exception as e:
            self._add_error(source_file, None, event_title,
                           "timezone_convert_error", f"时区转换失败: {str(e)}", severity="warning")
            return dt

    def _normalize_all_day(self, event: Event):
        if event.all_day:
            if event.start:
                event.start = event.start.replace(hour=0, minute=0, second=0, microsecond=0)
            if event.end:
                if event.end.date() == event.start.date():
                    event.end = event.end.replace(hour=23, minute=59, second=59, microsecond=999999)
                else:
                    end_date = event.end.date()
                    event.end = datetime.combine(end_date, datetime.max.time().replace(microsecond=999999))
                    event.end = self.target_timezone.localize(event.end) if event.end.tzinfo is None else event.end

    def _expand_recurrence(self, event: Event) -> List[Event]:
        expanded_events: List[Event] = []
        rule = event.recurrence_rule
        
        if rule is None:
            return [event]
        
        duration = event.end - event.start
        start_date = event.start
        
        until_date = rule.until
        if until_date is None:
            if rule.count is None:
                until_date = start_date + timedelta(days=self.recurrence_until_months * 30)
            else:
                until_date = start_date + timedelta(days=365 * 10)
        
        exception_dates = set()
        for ex_date in event.exceptions:
            exception_dates.add(ex_date.date())
        
        generated_count = 0
        max_count = rule.count or self.recurrence_limit
        
        current_date = start_date
        
        while generated_count < max_count and current_date <= until_date:
            is_exception = False
            for ex_date in exception_dates:
                if current_date.date() == ex_date:
                    is_exception = True
                    break
            
            if not is_exception and self._matches_rule(current_date, rule, start_date):
                new_event = event.clone()
                new_event.start = current_date
                new_event.end = current_date + duration
                new_event.is_expanded = True
                new_event.original_start = start_date
                new_event.original_end = event.end
                new_event.recurrence_rule = None
                expanded_events.append(new_event)
                generated_count += 1
            
            current_date = self._get_next_date(current_date, rule)
            
            if (current_date - start_date).days > 365 * 10:
                self._add_error(event.source_file, None, event.title,
                               "recurrence_limit", f"重复事件展开超过 10 年限制，已停止")
                break
        
        return expanded_events

    def _matches_rule(self, current_date: datetime, rule, start_date: datetime) -> bool:
        if rule.by_month:
            if current_date.month not in rule.by_month:
                return False
        
        if rule.by_month_day:
            if current_date.day not in rule.by_month_day:
                return False
        
        if rule.by_day:
            weekday = self._get_ical_weekday(current_date.weekday())
            if weekday not in rule.by_day and not any(d for d in rule.by_day if not d[0].isdigit()):
                matched = False
                for day_spec in rule.by_day:
                    if day_spec[0].isdigit():
                        num = int(''.join([c for c in day_spec if c.isdigit()]))
                        day = ''.join([c for c in day_spec if not c.isdigit()])
                        if self._get_ical_weekday(current_date.weekday()) == day:
                            week_of_month = (current_date.day - 1) // 7 + 1
                            if num == week_of_month or (num < 0 and num == week_of_month - 5 - (1 if current_date.day > 28 else 0)):
                                matched = True
                                break
                if not matched:
                    return False
            elif weekday not in rule.by_day:
                return False
        
        if rule.by_set_pos:
            pass
        
        return True

    def _get_next_date(self, current_date: datetime, rule) -> datetime:
        interval = rule.interval or 1
        
        if rule.freq == RecurrenceType.DAILY:
            return current_date + timedelta(days=interval)
        
        elif rule.freq == RecurrenceType.WEEKLY:
            if rule.by_day:
                return self._get_next_weekly_date(current_date, rule)
            return current_date + timedelta(weeks=interval)
        
        elif rule.freq == RecurrenceType.MONTHLY:
            return self._add_months(current_date, interval)
        
        elif rule.freq == RecurrenceType.YEARLY:
            try:
                return current_date.replace(year=current_date.year + interval)
            except ValueError:
                if current_date.month == 2 and current_date.day == 29:
                    return current_date.replace(year=current_date.year + interval, month=2, day=28)
                return current_date + timedelta(days=365 * interval)
        
        return current_date + timedelta(days=1)

    def _get_next_weekly_date(self, current_date: datetime, rule) -> datetime:
        if not rule.by_day:
            return current_date + timedelta(weeks=rule.interval)
        
        day_order = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
        current_weekday = current_date.weekday()
        
        by_day_indices = []
        for day_spec in rule.by_day:
            day = ''.join([c for c in day_spec if not c.isdigit()])
            if day in day_order:
                by_day_indices.append(day_order.index(day))
        
        if not by_day_indices:
            return current_date + timedelta(weeks=rule.interval)
        
        by_day_indices.sort()
        
        for day_idx in by_day_indices:
            if day_idx > current_weekday:
                delta = day_idx - current_weekday
                return current_date + timedelta(days=delta)
        
        first_day = by_day_indices[0]
        days_to_next_week = 7 - current_weekday + first_day
        weeks_to_skip = (rule.interval - 1) * 7
        return current_date + timedelta(days=days_to_next_week + weeks_to_skip)

    def _add_months(self, dt: datetime, months: int) -> datetime:
        month = dt.month - 1 + months
        year = dt.year + month // 12
        month = month % 12 + 1
        day = min(dt.day, [31, 29 if (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
        try:
            return dt.replace(year=year, month=month, day=day)
        except ValueError:
            return dt + timedelta(days=30 * months)

    def _get_ical_weekday(self, python_weekday: int) -> str:
        mapping = {0: 'MO', 1: 'TU', 2: 'WE', 3: 'TH', 4: 'FR', 5: 'SA', 6: 'SU'}
        return mapping.get(python_weekday, 'MO')

    def _add_error(self, source_file: str, line_number: Optional[int], event_title: Optional[str],
                   error_type: str, message: str, severity: str = "error"):
        self.validation_errors.append(ValidationError(
            source_file=source_file,
            line_number=line_number,
            event_title=event_title,
            error_type=error_type,
            message=message,
            severity=severity,
        ))
