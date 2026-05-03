from dataclasses import dataclass, field
from datetime import date, datetime
from enum import Enum
from typing import Dict, List, Optional, Any
import csv
import json
import os

import yaml

from trademark_deadlines.models.case import Case, CaseStatus
from trademark_deadlines.models.action import Action, ActionType
from trademark_deadlines.models.holiday import HolidayCalendar, HolidayRule, HolidayRuleType
from trademark_deadlines.models.jurisdiction import (
    JurisdictionRule, DeadlineType, CalculationMethod, DeadlineRule
)


class DataIssueType(Enum):
    MISSING_APPLICATION_DATE = "missing_application_date"
    ABANDONED_CASE_WITH_ACTIONS = "abandoned_case_with_actions"
    INVALID_DATE_FORMAT = "invalid_date_format"
    MISSING_REQUIRED_FIELD = "missing_required_field"
    INVALID_ACTION_TYPE = "invalid_action_type"
    INVALID_CASE_STATUS = "invalid_case_status"
    UNKNOWN_JURISDICTION = "unknown_jurisdiction"


@dataclass
class DataIssue:
    issue_type: DataIssueType
    case_id: str
    action_id: Optional[str] = None
    message: str = ""
    severity: str = "warning"
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DataIssues:
    issues: List[DataIssue] = field(default_factory=list)
    
    def add_issue(self, issue: DataIssue):
        self.issues.append(issue)
    
    def get_by_type(self, issue_type: DataIssueType) -> List[DataIssue]:
        return [i for i in self.issues if i.issue_type == issue_type]
    
    def get_warnings(self) -> List[DataIssue]:
        return [i for i in self.issues if i.severity == "warning"]
    
    def get_errors(self) -> List[DataIssue]:
        return [i for i in self.issues if i.severity == "error"]


@dataclass
class LoadedData:
    cases: List[Case] = field(default_factory=list)
    actions: List[Action] = field(default_factory=list)
    jurisdiction_rules: Dict[str, JurisdictionRule] = field(default_factory=dict)
    holiday_calendars: Dict[str, HolidayCalendar] = field(default_factory=dict)
    data_issues: DataIssues = field(default_factory=DataIssues)


class DataLoader:
    def __init__(self):
        self.data_issues = DataIssues()
    
    def load_all(
        self,
        cases_path: str,
        actions_path: str,
        holiday_rules_path: str,
        jurisdiction_rules_path: str
    ) -> LoadedData:
        jurisdiction_rules = self.load_jurisdiction_rules(jurisdiction_rules_path)
        holiday_calendars = self.load_holiday_calendars(holiday_rules_path)
        cases = self.load_cases(cases_path)
        actions = self.load_actions(actions_path)
        
        self._check_data_quality(cases, actions)
        
        return LoadedData(
            cases=cases,
            actions=actions,
            jurisdiction_rules=jurisdiction_rules,
            holiday_calendars=holiday_calendars,
            data_issues=self.data_issues
        )
    
    def load_cases(self, filepath: str) -> List[Case]:
        cases: List[Case] = []
        
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                case = self._parse_case_row(row)
                if case:
                    cases.append(case)
        
        return cases
    
    def _parse_case_row(self, row: Dict[str, str]) -> Optional[Case]:
        case_id = row.get('case_id', '').strip()
        if not case_id:
            return None
        
        try:
            status_str = row.get('status', 'active').lower().strip()
            try:
                status = CaseStatus(status_str)
            except ValueError:
                self.data_issues.add_issue(DataIssue(
                    issue_type=DataIssueType.INVALID_CASE_STATUS,
                    case_id=case_id,
                    message=f"无效的案件状态: {status_str}，使用默认值 'active'",
                    severity="warning"
                ))
                status = CaseStatus.ACTIVE
            
            application_date = self._parse_date(row.get('application_date', ''))
            registration_date = self._parse_date(row.get('registration_date', ''))
            
            classes_str = row.get('classes', '')
            classes = [c.strip() for c in classes_str.split(',')] if classes_str else []
            
            if not application_date:
                self.data_issues.add_issue(DataIssue(
                    issue_type=DataIssueType.MISSING_APPLICATION_DATE,
                    case_id=case_id,
                    message="案件缺少申请日，部分期限计算可能无法进行",
                    severity="warning",
                    metadata={
                        "trademark": row.get('trademark', ''),
                        "jurisdiction": row.get('jurisdiction', '')
                    }
                ))
            
            return Case(
                case_id=case_id,
                trademark=row.get('trademark', '').strip(),
                jurisdiction=row.get('jurisdiction', '').strip(),
                application_number=row.get('application_number') or None,
                registration_number=row.get('registration_number') or None,
                application_date=application_date,
                registration_date=registration_date,
                status=status,
                classes=classes,
                applicant=row.get('applicant', '').strip(),
                filing_timezone=row.get('filing_timezone', 'UTC').strip()
            )
        
        except Exception as e:
            self.data_issues.add_issue(DataIssue(
                issue_type=DataIssueType.MISSING_REQUIRED_FIELD,
                case_id=case_id,
                message=f"解析案件数据时出错: {str(e)}",
                severity="error"
            ))
            return None
    
    def load_actions(self, filepath: str) -> List[Action]:
        actions: List[Action] = []
        
        with open(filepath, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                
                try:
                    data = json.loads(line)
                    action = self._parse_action_data(data, line_num)
                    if action:
                        actions.append(action)
                except json.JSONDecodeError as e:
                    self.data_issues.add_issue(DataIssue(
                        issue_type=DataIssueType.INVALID_DATE_FORMAT,
                        case_id=f"line_{line_num}",
                        message=f"JSON解析错误 (第{line_num}行): {str(e)}",
                        severity="error"
                    ))
        
        return actions
    
    def _parse_action_data(self, data: Dict[str, Any], line_num: int) -> Optional[Action]:
        action_id = data.get('action_id', f'action_{line_num}')
        case_id = data.get('case_id', '')
        
        if not case_id:
            self.data_issues.add_issue(DataIssue(
                issue_type=DataIssueType.MISSING_REQUIRED_FIELD,
                case_id="unknown",
                action_id=action_id,
                message="动作数据缺少case_id",
                severity="error"
            ))
            return None
        
        try:
            action_type_str = data.get('action_type', '').lower().strip()
            try:
                action_type = ActionType(action_type_str)
            except ValueError:
                self.data_issues.add_issue(DataIssue(
                    issue_type=DataIssueType.INVALID_ACTION_TYPE,
                    case_id=case_id,
                    action_id=action_id,
                    message=f"无效的动作类型: {action_type_str}",
                    severity="warning"
                ))
                return None
            
            action_date = self._parse_date(data.get('action_date', ''))
            if not action_date:
                self.data_issues.add_issue(DataIssue(
                    issue_type=DataIssueType.INVALID_DATE_FORMAT,
                    case_id=case_id,
                    action_id=action_id,
                    message=f"无效的动作日期: {data.get('action_date')}",
                    severity="warning"
                ))
                return None
            
            completed_date = self._parse_date(data.get('completed_date', ''))
            
            submission_time = None
            submission_time_str = data.get('submission_time')
            if submission_time_str:
                try:
                    submission_time = datetime.fromisoformat(submission_time_str.replace('Z', '+00:00'))
                except ValueError:
                    pass
            
            return Action(
                action_id=action_id,
                case_id=case_id,
                action_type=action_type,
                action_date=action_date,
                description=data.get('description', '').strip(),
                deadline_days=data.get('deadline_days'),
                is_completed=data.get('is_completed', False),
                completed_date=completed_date,
                timezone=data.get('timezone', 'UTC').strip(),
                submission_time=submission_time
            )
        
        except Exception as e:
            self.data_issues.add_issue(DataIssue(
                issue_type=DataIssueType.MISSING_REQUIRED_FIELD,
                case_id=case_id,
                action_id=action_id,
                message=f"解析动作数据时出错: {str(e)}",
                severity="error"
            ))
            return None
    
    def load_jurisdiction_rules(self, filepath: str) -> Dict[str, JurisdictionRule]:
        rules: Dict[str, JurisdictionRule] = {}
        
        with open(filepath, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        jurisdictions = data.get('jurisdictions', {})
        
        for code, j_data in jurisdictions.items():
            deadline_rules: Dict[DeadlineType, DeadlineRule] = {}
            
            deadlines_data = j_data.get('deadlines', {})
            for deadline_type_str, rule_data in deadlines_data.items():
                try:
                    deadline_type = DeadlineType(deadline_type_str.lower().strip())
                except ValueError:
                    continue
                
                method_str = rule_data.get('method', 'calendar_days').lower()
                try:
                    method = CalculationMethod(method_str)
                except ValueError:
                    method = CalculationMethod.CALENDAR_DAYS
                
                deadline_rule = DeadlineRule(
                    deadline_type=deadline_type,
                    method=method,
                    duration=rule_data.get('duration', 30),
                    description=rule_data.get('description', ''),
                    requires_documents=rule_data.get('requires_documents', []),
                    timezone=rule_data.get('timezone', j_data.get('default_timezone', 'UTC'))
                )
                deadline_rules[deadline_type] = deadline_rule
            
            jurisdiction_rule = JurisdictionRule(
                jurisdiction=code,
                name=j_data.get('name', code),
                default_timezone=j_data.get('default_timezone', 'UTC'),
                deadline_rules=deadline_rules,
                holiday_calendar_key=j_data.get('holiday_calendar_key', code)
            )
            rules[code] = jurisdiction_rule
        
        return rules
    
    def load_holiday_calendars(self, filepath: str) -> Dict[str, HolidayCalendar]:
        calendars: Dict[str, HolidayCalendar] = {}
        
        with open(filepath, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        calendars_data = data.get('calendars', {})
        
        for code, cal_data in calendars_data.items():
            holidays: List[date] = []
            
            custom_holidays = cal_data.get('custom_holidays', [])
            for holiday_str in custom_holidays:
                holiday_date = self._parse_date(holiday_str)
                if holiday_date:
                    holidays.append(holiday_date)
            
            fixed_holidays = cal_data.get('fixed_holidays', [])
            for rule in fixed_holidays:
                month = rule.get('month')
                day = rule.get('day')
                if month and day:
                    for year in range(2020, 2030):
                        try:
                            holidays.append(date(year, month, day))
                        except ValueError:
                            pass
            
            observed_holidays = cal_data.get('observed_holidays', [])
            for rule in observed_holidays:
                if rule.get('name') == 'weekend':
                    for year in range(2020, 2030):
                        for month in range(1, 13):
                            for day in range(1, 32):
                                try:
                                    d = date(year, month, day)
                                    if d.weekday() >= 5:
                                        pass
                                except ValueError:
                                    pass
            
            holidays = sorted(set(holidays))
            
            calendar = HolidayCalendar(
                jurisdiction=code,
                holidays=holidays
            )
            calendars[code] = calendar
        
        return calendars
    
    def _parse_date(self, date_str: str) -> Optional[date]:
        if not date_str:
            return None
        
        date_str = date_str.strip()
        
        formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%d-%m-%Y",
            "%d/%m/%Y",
            "%Y年%m月%d日",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        
        return None
    
    def _check_data_quality(self, cases: List[Case], actions: List[Action]):
        case_map: Dict[str, Case] = {c.case_id: c for c in cases}
        
        abandoned_cases = [c for c in cases if c.is_abandoned()]
        for case in abandoned_cases:
            case_actions = [a for a in actions if a.case_id == case.case_id]
            
            active_actions = [a for a in case_actions if not a.is_completed]
            if active_actions:
                action_ids = [a.action_id for a in active_actions]
                self.data_issues.add_issue(DataIssue(
                    issue_type=DataIssueType.ABANDONED_CASE_WITH_ACTIONS,
                    case_id=case.case_id,
                    message=f"已放弃的案件仍有 {len(active_actions)} 个未完成的动作: {', '.join(action_ids)}",
                    severity="warning",
                    metadata={
                        "trademark": case.trademark,
                        "active_action_count": len(active_actions),
                        "action_ids": action_ids
                    }
                ))
        
        for action in actions:
            if action.case_id not in case_map:
                self.data_issues.add_issue(DataIssue(
                    issue_type=DataIssueType.MISSING_REQUIRED_FIELD,
                    case_id=action.case_id,
                    action_id=action.action_id,
                    message=f"动作引用的案件ID不存在: {action.case_id}",
                    severity="warning"
                ))
