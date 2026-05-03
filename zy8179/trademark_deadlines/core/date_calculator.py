from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from dateutil.relativedelta import relativedelta
from typing import Dict, List, Optional, Tuple
import pytz

from trademark_deadlines.models.case import Case, CaseStatus
from trademark_deadlines.models.action import Action, ActionType
from trademark_deadlines.models.holiday import HolidayCalendar
from trademark_deadlines.models.jurisdiction import (
    JurisdictionRule, DeadlineType, CalculationMethod, DeadlineRule
)


@dataclass
class DeadlineCalculationResult:
    case_id: str
    trademark: str
    jurisdiction: str
    deadline_type: DeadlineType
    base_deadline: date
    adjusted_deadline: date
    was_adjusted: bool = False
    adjustment_reason: str = ""
    days_until_deadline: int = 0
    is_overdue: bool = False
    related_action_id: Optional[str] = None
    notes: str = ""
    
    def calculate_days_until(self, reference_date: date) -> int:
        delta = self.adjusted_deadline - reference_date
        return delta.days


class DateCalculator:
    def __init__(
        self,
        jurisdiction_rules: Dict[str, JurisdictionRule],
        holiday_calendars: Dict[str, HolidayCalendar],
        reference_date: Optional[date] = None
    ):
        self.jurisdiction_rules = jurisdiction_rules
        self.holiday_calendars = holiday_calendars
        self.reference_date = reference_date or date.today()
    
    def calculate_case_deadlines(
        self, 
        case: Case, 
        actions: List[Action]
    ) -> List[DeadlineCalculationResult]:
        results: List[DeadlineCalculationResult] = []
        
        jurisdiction = case.jurisdiction
        j_rule = self.jurisdiction_rules.get(jurisdiction)
        if not j_rule:
            return results
        
        holiday_calendar = self.holiday_calendars.get(
            j_rule.holiday_calendar_key or jurisdiction
        )
        
        action_map: Dict[str, List[Action]] = {}
        for action in actions:
            if action.case_id == case.case_id:
                if action.action_type not in action_map:
                    action_map[action.action_type] = []
                action_map[action.action_type].append(action)
        
        opposition_rule = j_rule.get_deadline_rule(DeadlineType.OPPOSITION)
        if opposition_rule and case.application_date:
            result = self._calculate_from_date(
                case,
                case.application_date,
                DeadlineType.OPPOSITION,
                opposition_rule,
                holiday_calendar
            )
            results.append(result)
        
        renewal_rule = j_rule.get_deadline_rule(DeadlineType.RENEWAL)
        if renewal_rule:
            base_date = case.registration_date or case.application_date
            if base_date:
                result = self._calculate_renewal(
                    case, base_date, renewal_rule, holiday_calendar
                )
                if result:
                    results.append(result)
        
        widening_rule = j_rule.get_deadline_rule(DeadlineType.WIDENING)
        if widening_rule and case.registration_date:
            result = self._calculate_from_date(
                case,
                case.registration_date,
                DeadlineType.WIDENING,
                widening_rule,
                holiday_calendar
            )
            results.append(result)
        
        for action_type in [
            ActionType.OPPOSITION_NOTICE,
            ActionType.EXAMINATION_REPORT,
            ActionType.OFFICE_ACTION
        ]:
            type_actions = action_map.get(action_type, [])
            for action in type_actions:
                if action.requires_response():
                    result = self._calculate_action_response(
                        case, action, j_rule, holiday_calendar
                    )
                    if result:
                        results.append(result)
        
        for result in results:
            result.days_until_deadline = result.calculate_days_until(self.reference_date)
            result.is_overdue = result.days_until_deadline < 0
        
        return results
    
    def _calculate_from_date(
        self,
        case: Case,
        base_date: date,
        deadline_type: DeadlineType,
        rule: DeadlineRule,
        calendar: Optional[HolidayCalendar]
    ) -> DeadlineCalculationResult:
        base_deadline = self._calculate_base_deadline(base_date, rule)
        
        adjusted_deadline, was_adjusted, reason = self._adjust_for_holidays(
            base_deadline, calendar
        )
        
        return DeadlineCalculationResult(
            case_id=case.case_id,
            trademark=case.trademark,
            jurisdiction=case.jurisdiction,
            deadline_type=deadline_type,
            base_deadline=base_deadline,
            adjusted_deadline=adjusted_deadline,
            was_adjusted=was_adjusted,
            adjustment_reason=reason,
            notes=rule.description
        )
    
    def _calculate_renewal(
        self,
        case: Case,
        base_date: date,
        rule: DeadlineRule,
        calendar: Optional[HolidayCalendar]
    ) -> Optional[DeadlineCalculationResult]:
        next_renewal = self._find_next_renewal_date(base_date, rule)
        if not next_renewal:
            return None
        
        adjusted_deadline, was_adjusted, reason = self._adjust_for_holidays(
            next_renewal, calendar
        )
        
        return DeadlineCalculationResult(
            case_id=case.case_id,
            trademark=case.trademark,
            jurisdiction=case.jurisdiction,
            deadline_type=DeadlineType.RENEWAL,
            base_deadline=next_renewal,
            adjusted_deadline=adjusted_deadline,
            was_adjusted=was_adjusted,
            adjustment_reason=reason,
            notes=f"续展期限基于{base_date.strftime('%Y-%m-%d')}计算"
        )
    
    def _find_next_renewal_date(
        self, 
        base_date: date, 
        rule: DeadlineRule
    ) -> Optional[date]:
        if rule.method != CalculationMethod.YEARS:
            return base_date + rule.get_duration_timedelta()
        
        years_interval = rule.duration
        current_date = self.reference_date
        
        next_renewal = date(
            base_date.year,
            base_date.month,
            base_date.day
        )
        
        while next_renewal < current_date:
            next_renewal = date(
                next_renewal.year + years_interval,
                next_renewal.month,
                next_renewal.day
            )
        
        return next_renewal
    
    def _calculate_action_response(
        self,
        case: Case,
        action: Action,
        j_rule: JurisdictionRule,
        calendar: Optional[HolidayCalendar]
    ) -> Optional[DeadlineCalculationResult]:
        deadline_type_map = {
            ActionType.OPPOSITION_NOTICE: DeadlineType.OPPOSITION_RESPONSE,
            ActionType.EXAMINATION_REPORT: DeadlineType.EXAMINATION_AMENDMENT,
            ActionType.OFFICE_ACTION: DeadlineType.OFFICE_ACTION_RESPONSE,
        }
        
        deadline_type = deadline_type_map.get(action.action_type)
        if not deadline_type:
            return None
        
        rule = j_rule.get_deadline_rule(deadline_type)
        
        if rule:
            base_deadline = self._calculate_base_deadline(action.action_date, rule)
        else:
            base_days = action.deadline_days or 30
            base_deadline = action.action_date + timedelta(days=base_days)
        
        adjusted_deadline, was_adjusted, reason = self._adjust_for_holidays(
            base_deadline, calendar
        )
        
        return DeadlineCalculationResult(
            case_id=case.case_id,
            trademark=case.trademark,
            jurisdiction=case.jurisdiction,
            deadline_type=deadline_type,
            base_deadline=base_deadline,
            adjusted_deadline=adjusted_deadline,
            was_adjusted=was_adjusted,
            adjustment_reason=reason,
            related_action_id=action.action_id,
            notes=f"响应动作: {action.description}" if action.description else ""
        )
    
    def _calculate_base_deadline(
        self, 
        base_date: date, 
        rule: DeadlineRule
    ) -> date:
        if rule.method == CalculationMethod.YEARS:
            return base_date + relativedelta(years=rule.duration)
        elif rule.method == CalculationMethod.MONTHS:
            return base_date + relativedelta(months=rule.duration)
        elif rule.method == CalculationMethod.CALENDAR_DAYS:
            return base_date + timedelta(days=rule.duration)
        elif rule.method == CalculationMethod.BUSINESS_DAYS:
            return self._add_business_days(base_date, rule.duration)
        else:
            return base_date + rule.get_duration_timedelta()
    
    def _add_business_days(self, start_date: date, days: int) -> date:
        current = start_date
        added = 0
        while added < days:
            current += timedelta(days=1)
            if current.weekday() < 5:
                added += 1
        return current
    
    def _adjust_for_holidays(
        self, 
        deadline: date, 
        calendar: Optional[HolidayCalendar]
    ) -> Tuple[date, bool, str]:
        if not calendar:
            return deadline, False, ""
        
        current = deadline
        adjusted = False
        reasons = []
        
        while calendar.is_weekend(current) or calendar.is_holiday(current):
            if calendar.is_weekend(current):
                reasons.append(f"周末顺延: {current.strftime('%Y-%m-%d')}")
            elif calendar.is_holiday(current):
                reasons.append(f"节假日顺延: {current.strftime('%Y-%m-%d')}")
            current += timedelta(days=1)
            adjusted = True
        
        reason = "; ".join(reasons) if reasons else ""
        return current, adjusted, reason
