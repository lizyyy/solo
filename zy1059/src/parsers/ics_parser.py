import os
from datetime import datetime, date, timezone, timedelta
from typing import List, Tuple, Optional, Any
import uuid

from icalendar import Calendar, Event as ICalEvent
import pytz

from src.models import Event, EventStatus, RecurrenceType, RecurrenceRule, ValidationError


DEFAULT_TIMEZONE = pytz.timezone('Asia/Shanghai')


class ICSParser:
    def __init__(self, default_timezone=None):
        self.default_timezone = default_timezone or DEFAULT_TIMEZONE
        self.validation_errors: List[ValidationError] = []

    def parse_file(self, file_path: str) -> Tuple[List[Event], List[ValidationError]]:
        self.validation_errors = []
        events: List[Event] = []
        
        if not os.path.exists(file_path):
            self._add_error(file_path, None, None, "file_not_found", f"文件不存在: {file_path}")
            return [], self.validation_errors
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except UnicodeDecodeError:
            with open(file_path, 'r', encoding='gbk') as f:
                content = f.read()
        except Exception as e:
            self._add_error(file_path, None, None, "read_error", f"读取文件失败: {str(e)}")
            return [], self.validation_errors

        try:
            cal = Calendar.from_ical(content)
        except Exception as e:
            self._add_error(file_path, None, None, "parse_error", f"解析 ICS 失败: {str(e)}")
            return [], self.validation_errors

        file_name = os.path.basename(file_path)
        
        for component in cal.walk():
            if component.name == "VEVENT":
                try:
                    event = self._parse_event(component, file_name, file_path)
                    if event:
                        events.append(event)
                except Exception as e:
                    event_title = str(component.get('summary', '未知事件'))
                    self._add_error(file_path, None, event_title, "event_parse_error", f"解析事件失败: {str(e)}")

        return events, self.validation_errors

    def _parse_event(self, component: ICalEvent, file_name: str, file_path: str) -> Optional[Event]:
        uid = str(component.get('uid', f"{uuid.uuid4()}@schedule-cleaner.local"))
        title = str(component.get('summary', ''))
        
        if not title.strip():
            self._add_error(file_path, None, None, "missing_title", "事件缺少标题")
        
        start_dt, all_day = self._parse_datetime(component.get('dtstart'), file_path)
        end_dt = self._parse_end_time(component, start_dt, all_day, file_path)
        
        if start_dt is None:
            self._add_error(file_path, None, title, "missing_start", "事件缺少开始时间")
            return None
        
        if end_dt is None:
            self._add_error(file_path, None, title, "missing_end", "事件缺少结束时间")
            end_dt = start_dt + timedelta(hours=1)
        
        event = Event(
            uid=uid,
            title=title,
            start=start_dt,
            end=end_dt,
            source_file=file_name,
            all_day=all_day,
        )
        
        event.location = self._get_str(component, 'location')
        event.description = self._get_str(component, 'description')
        
        status = self._get_str(component, 'status')
        if status:
            status_map = {
                'CONFIRMED': EventStatus.ACTIVE,
                'TENTATIVE': EventStatus.TENTATIVE,
                'CANCELLED': EventStatus.CANCELLED,
            }
            event.status = status_map.get(status.upper(), EventStatus.ACTIVE)
        
        organizer = component.get('organizer')
        if organizer:
            event.organizer = str(organizer)
        
        attendees = component.get('attendee', [])
        if attendees:
            if not isinstance(attendees, list):
                attendees = [attendees]
            event.attendees = [str(a) for a in attendees]
        
        rrule = component.get('rrule')
        if rrule:
            event.recurrence_rule = self._parse_rrule(rrule, file_path, title)
        
        recurrence_id = component.get('recurrence-id')
        if recurrence_id:
            rid_dt, _ = self._parse_datetime(recurrence_id, file_path)
            event.recurrence_id = rid_dt
        
        exdates = component.get('exdate', [])
        if exdates:
            if not isinstance(exdates, list):
                exdates = [exdates]
            for exdate in exdates:
                    ex_dt, _ = self._parse_datetime(exdate, file_path)
                    if ex_dt:
                        event.exceptions.append(ex_dt)
        
        return event

    def _parse_datetime(self, value: Any, file_path: str) -> Tuple[Optional[datetime], bool]:
        if value is None:
            return None, False
        
        dt = value.dt
        
        if isinstance(dt, date) and not isinstance(dt, datetime):
            all_day = True
            dt = datetime.combine(dt, datetime.min.time())
            if dt.tzinfo is None:
                dt = self.default_timezone.localize(dt)
            return dt, all_day
        
        if isinstance(dt, datetime):
            if dt.tzinfo is None:
                self._add_error(file_path, None, None, "naive_datetime", 
                               f"检测到无时区信息的时间，使用默认时区: {self.default_timezone.zone}")
                dt = self.default_timezone.localize(dt)
            return dt, False
        
        return None, False

    def _parse_end_time(self, component: ICalEvent, start_dt: Optional[datetime], all_day: bool, file_path: str) -> Optional[datetime]:
        dtend = component.get('dtend')
        if dtend:
            end_dt, _ = self._parse_datetime(dtend, file_path)
            return end_dt
        
        duration = component.get('duration')
        if duration and start_dt:
            try:
                from dateutil.relativedelta import relativedelta
                return start_dt + duration.dt
            except Exception:
                pass
        
        if all_day and start_dt:
            return start_dt + timedelta(days=1)
        
        return None

    def _parse_rrule(self, rrule_value: Any, file_path: str, event_title: str) -> Optional[RecurrenceRule]:
        try:
            rule_dict = dict(rrule_value)
            
            freq_map = {
                'DAILY': RecurrenceType.DAILY,
                'WEEKLY': RecurrenceType.WEEKLY,
                'MONTHLY': RecurrenceType.MONTHLY,
                'YEARLY': RecurrenceType.YEARLY,
            }
            
            freq_str = rule_dict.get('FREQ', ['DAILY'])[0] if rule_dict.get('FREQ') else 'DAILY'
            freq = freq_map.get(freq_str.upper(), RecurrenceType.DAILY)
            
            rule = RecurrenceRule(
                freq=freq,
                original_rule=str(rrule_value),
            )
            
            if 'COUNT' in rule_dict and rule_dict['COUNT']:
                rule.count = int(rule_dict['COUNT'][0])
            
            if 'UNTIL' in rule_dict and rule_dict['UNTIL']:
                until_val = rule_dict['UNTIL'][0]
                if hasattr(until_val, 'dt'):
                    rule.until, _ = self._parse_datetime(until_val, file_path)
            
            if 'INTERVAL' in rule_dict and rule_dict['INTERVAL']:
                rule.interval = int(rule_dict['INTERVAL'][0])
            
            if 'BYDAY' in rule_dict and rule_dict['BYDAY']:
                rule.by_day = list(rule_dict['BYDAY'])
            
            if 'BYMONTHDAY' in rule_dict and rule_dict['BYMONTHDAY']:
                rule.by_month_day = [int(x) for x in rule_dict['BYMONTHDAY']]
            
            if 'BYMONTH' in rule_dict and rule_dict['BYMONTH']:
                rule.by_month = [int(x) for x in rule_dict['BYMONTH']]
            
            if 'BYSETPOS' in rule_dict and rule_dict['BYSETPOS']:
                rule.by_set_pos = [int(x) for x in rule_dict['BYSETPOS']]
            
            return rule
            
        except Exception as e:
            self._add_error(file_path, None, event_title, "rrule_parse_error", f"解析重复规则失败: {str(e)}")
            return None

    def _get_str(self, component: Any, key: str) -> Optional[str]:
        val = component.get(key)
        if val is None:
            return None
        return str(val)

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
