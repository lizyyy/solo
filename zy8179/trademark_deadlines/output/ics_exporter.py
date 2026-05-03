from datetime import date, datetime, timedelta, timezone
from typing import List, Optional
import uuid

from trademark_deadlines.core.date_calculator import DeadlineCalculationResult
from trademark_deadlines.core.risk_detector import RiskItem, RiskSeverity


class ICSExporter:
    def __init__(self):
        pass
    
    def export_calendar(
        self,
        deadlines: List[DeadlineCalculationResult],
        risks: List[RiskItem],
        output_path: str,
        reference_date: Optional[date] = None
    ) -> int:
        calendar_content = self._generate_ical(deadlines, risks, reference_date)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(calendar_content)
        
        return len(deadlines)
    
    def _generate_ical(
        self,
        deadlines: List[DeadlineCalculationResult],
        risks: List[RiskItem],
        reference_date: Optional[date] = None
    ) -> str:
        lines: List[str] = []
        
        lines.append("BEGIN:VCALENDAR")
        lines.append("VERSION:2.0")
        lines.append("PRODID:-//Trademark Deadlines//EN")
        lines.append("CALSCALE:GREGORIAN")
        lines.append("METHOD:PUBLISH")
        lines.append("X-WR-CALNAME:商标案件期限")
        lines.append("X-WR-TIMEZONE:Asia/Shanghai")
        lines.append("")
        
        for deadline in deadlines:
            event_lines = self._create_deadline_event(deadline)
            lines.extend(event_lines)
            lines.append("")
        
        for risk in risks:
            if risk.deadline_date:
                event_lines = self._create_risk_event(risk)
                lines.extend(event_lines)
                lines.append("")
        
        lines.append("END:VCALENDAR")
        
        return "\r\n".join(lines)
    
    def _create_deadline_event(
        self, 
        deadline: DeadlineCalculationResult
    ) -> List[str]:
        lines: List[str] = []
        
        event_uid = f"{deadline.case_id}-{deadline.deadline_type.value}-{uuid.uuid4().hex[:8]}@trademark"
        
        priority = self._get_priority(deadline)
        status = "CONFIRMED"
        summary = self._format_summary(deadline)
        description = self._format_description(deadline)
        
        dt_start = self._date_to_ical(deadline.adjusted_deadline)
        dt_end = self._date_to_ical(deadline.adjusted_deadline + timedelta(days=1))
        dt_stamp = self._datetime_to_ical(datetime.now(timezone.utc))
        
        lines.append("BEGIN:VEVENT")
        lines.append(f"UID:{event_uid}")
        lines.append(f"DTSTAMP:{dt_stamp}")
        lines.append(f"DTSTART;VALUE=DATE:{dt_start}")
        lines.append(f"DTEND;VALUE=DATE:{dt_end}")
        lines.append(f"SUMMARY:{summary}")
        lines.append(f"DESCRIPTION:{self._fold_ical_text(description)}")
        lines.append(f"PRIORITY:{priority}")
        lines.append(f"STATUS:{status}")
        
        if deadline.days_until_deadline >= 0:
            lines.append("BEGIN:VALARM")
            lines.append("ACTION:DISPLAY")
            lines.append(f"DESCRIPTION:{summary}")
            if deadline.days_until_deadline <= 3:
                lines.append("TRIGGER:-P1D")
            else:
                lines.append("TRIGGER:-P3D")
            lines.append("END:VALARM")
        
        lines.append("END:VEVENT")
        
        return lines
    
    def _create_risk_event(self, risk: RiskItem) -> List[str]:
        lines: List[str] = []
        
        event_uid = f"{risk.risk_id}-{uuid.uuid4().hex[:8]}@trademark"
        
        priority_map = {
            RiskSeverity.CRITICAL: 1,
            RiskSeverity.HIGH: 2,
            RiskSeverity.MEDIUM: 5,
            RiskSeverity.LOW: 9,
        }
        priority = priority_map.get(risk.severity, 5)
        
        status = "CONFIRMED"
        summary = f"[风险] {risk.title}"
        description = f"案件ID: {risk.case_id}\n商标: {risk.trademark}\n严重程度: {risk.severity.value}\n\n{risk.description}"
        
        dt_start = self._date_to_ical(risk.deadline_date)
        dt_end = self._date_to_ical(risk.deadline_date + timedelta(days=1))
        dt_stamp = self._datetime_to_ical(datetime.now(timezone.utc))
        
        lines.append("BEGIN:VEVENT")
        lines.append(f"UID:{event_uid}")
        lines.append(f"DTSTAMP:{dt_stamp}")
        lines.append(f"DTSTART;VALUE=DATE:{dt_start}")
        lines.append(f"DTEND;VALUE=DATE:{dt_end}")
        lines.append(f"SUMMARY:{summary}")
        lines.append(f"DESCRIPTION:{self._fold_ical_text(description)}")
        lines.append(f"PRIORITY:{priority}")
        lines.append(f"STATUS:{status}")
        lines.append("END:VEVENT")
        
        return lines
    
    def _get_priority(self, deadline: DeadlineCalculationResult) -> int:
        if deadline.is_overdue:
            return 1
        elif deadline.days_until_deadline <= 3:
            return 2
        elif deadline.days_until_deadline <= 7:
            return 3
        elif deadline.days_until_deadline <= 30:
            return 5
        else:
            return 9
    
    def _format_summary(self, deadline: DeadlineCalculationResult) -> str:
        urgency = ""
        if deadline.is_overdue:
            urgency = "[逾期]"
        elif deadline.days_until_deadline <= 3:
            urgency = "[紧急]"
        elif deadline.days_until_deadline <= 7:
            urgency = "[即将到期]"
        
        return f"{urgency}[{deadline.jurisdiction}]{deadline.trademark} - {deadline.deadline_type.value}"
    
    def _format_description(self, deadline: DeadlineCalculationResult) -> str:
        parts = [
            f"案件ID: {deadline.case_id}",
            f"商标: {deadline.trademark}",
            f"司法管辖区: {deadline.jurisdiction}",
            f"截止类型: {deadline.deadline_type.value}",
            f"基础截止日: {deadline.base_deadline}",
            f"调整后截止日: {deadline.adjusted_deadline}",
        ]
        
        if deadline.was_adjusted:
            parts.append(f"调整原因: {deadline.adjustment_reason}")
        
        parts.append(f"剩余天数: {deadline.days_until_deadline}")
        
        if deadline.related_action_id:
            parts.append(f"关联动作ID: {deadline.related_action_id}")
        
        if deadline.notes:
            parts.append(f"备注: {deadline.notes}")
        
        return "\n".join(parts)
    
    def _date_to_ical(self, d: date) -> str:
        return d.strftime("%Y%m%d")
    
    def _datetime_to_ical(self, dt: datetime) -> str:
        utc_dt = dt.astimezone(timezone.utc)
        return utc_dt.strftime("%Y%m%dT%H%M%SZ")
    
    def _fold_ical_text(self, text: str) -> str:
        text = text.replace('\n', '\\n')
        text = text.replace(',', '\\,')
        text = text.replace(';', '\\;')
        
        if len(text) <= 75:
            return text
        
        lines = []
        current = text[:75]
        remaining = text[75:]
        
        lines.append(current)
        
        while remaining:
            chunk = remaining[:74]
            lines.append(" " + chunk)
            remaining = remaining[74:]
        
        return "\r\n".join(lines)
