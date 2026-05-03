from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from enum import Enum
from typing import Dict, List, Optional, Any, Set
from collections import defaultdict
import pytz

from trademark_deadlines.models.case import Case, CaseStatus
from trademark_deadlines.models.action import Action, ActionType
from trademark_deadlines.models.jurisdiction import DeadlineType, JurisdictionRule
from trademark_deadlines.core.date_calculator import DeadlineCalculationResult


class RiskCategory(Enum):
    MISSING_DOCUMENT = "missing_document"
    TIMEZONE_CONFLICT = "timezone_conflict"
    MULTI_CASE_CONFLICT = "multi_case_conflict"
    OVERDUE = "overdue"
    IMMINENT_DEADLINE = "imminent_deadline"
    DATA_QUALITY = "data_quality"


class RiskSeverity(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class RiskItem:
    risk_id: str
    case_id: str
    trademark: str
    jurisdiction: str
    category: RiskCategory
    severity: RiskSeverity
    title: str
    description: str
    related_action_id: Optional[str] = None
    deadline_date: Optional[date] = None
    days_remaining: Optional[int] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MissingDocumentRisk(RiskItem):
    required_documents: List[str] = field(default_factory=list)
    submitted_documents: List[str] = field(default_factory=list)
    missing_documents: List[str] = field(default_factory=list)


@dataclass
class TimezoneConflictRisk(RiskItem):
    source_timezone: str = ""
    target_timezone: str = ""
    submission_time: Optional[datetime] = None
    deadline_local_time: Optional[datetime] = None
    is_after_deadline: bool = False


@dataclass
class MultiCaseConflictRisk(RiskItem):
    conflict_type: str = ""
    conflicting_case_ids: List[str] = field(default_factory=list)
    conflict_description: str = ""


class RiskDetector:
    def __init__(
        self,
        jurisdiction_rules: Dict[str, JurisdictionRule],
        imminent_threshold_days: int = 7,
        reference_date: Optional[date] = None
    ):
        self.jurisdiction_rules = jurisdiction_rules
        self.imminent_threshold_days = imminent_threshold_days
        self.reference_date = reference_date or date.today()
        self._risk_counter = 0
    
    def detect_all_risks(
        self,
        cases: List[Case],
        actions: List[Action],
        deadlines: List[DeadlineCalculationResult]
    ) -> List[RiskItem]:
        all_risks: List[RiskItem] = []
        
        all_risks.extend(self.detect_overdue_deadlines(deadlines))
        all_risks.extend(self.detect_imminent_deadlines(deadlines))
        all_risks.extend(self.detect_missing_documents(cases, actions))
        all_risks.extend(self.detect_timezone_conflicts(actions))
        all_risks.extend(self.detect_multi_case_conflicts(cases, actions))
        
        return all_risks
    
    def detect_overdue_deadlines(
        self, 
        deadlines: List[DeadlineCalculationResult]
    ) -> List[RiskItem]:
        risks: List[RiskItem] = []
        
        for deadline in deadlines:
            if deadline.is_overdue:
                risk = RiskItem(
                    risk_id=self._next_risk_id(),
                    case_id=deadline.case_id,
                    trademark=deadline.trademark,
                    jurisdiction=deadline.jurisdiction,
                    category=RiskCategory.OVERDUE,
                    severity=RiskSeverity.CRITICAL,
                    title=f"{deadline.deadline_type.value} 已逾期",
                    description=f"{deadline.deadline_type.value} 截止日为 {deadline.adjusted_deadline}，"
                               f"已逾期 {abs(deadline.days_until_deadline)} 天。"
                               f"{deadline.adjustment_reason}",
                    deadline_date=deadline.adjusted_deadline,
                    days_remaining=deadline.days_until_deadline,
                    related_action_id=deadline.related_action_id
                )
                risks.append(risk)
        
        return risks
    
    def detect_imminent_deadlines(
        self, 
        deadlines: List[DeadlineCalculationResult]
    ) -> List[RiskItem]:
        risks: List[RiskItem] = []
        
        for deadline in deadlines:
            if 0 <= deadline.days_until_deadline <= self.imminent_threshold_days:
                if deadline.days_until_deadline <= 2:
                    severity = RiskSeverity.HIGH
                else:
                    severity = RiskSeverity.MEDIUM
                
                risk = RiskItem(
                    risk_id=self._next_risk_id(),
                    case_id=deadline.case_id,
                    trademark=deadline.trademark,
                    jurisdiction=deadline.jurisdiction,
                    category=RiskCategory.IMMINENT_DEADLINE,
                    severity=severity,
                    title=f"{deadline.deadline_type.value} 即将到期",
                    description=f"{deadline.deadline_type.value} 截止日为 {deadline.adjusted_deadline}，"
                               f"剩余 {deadline.days_until_deadline} 天。"
                               f"{deadline.adjustment_reason}",
                    deadline_date=deadline.adjusted_deadline,
                    days_remaining=deadline.days_until_deadline,
                    related_action_id=deadline.related_action_id
                )
                risks.append(risk)
        
        return risks
    
    def detect_missing_documents(
        self,
        cases: List[Case],
        actions: List[Action]
    ) -> List[RiskItem]:
        risks: List[RiskItem] = []
        case_map: Dict[str, Case] = {c.case_id: c for c in cases}
        
        action_requirements: Dict[ActionType, List[str]] = {
            ActionType.OPPOSITION_RESPONSE: [
                "答辩书", "证据材料", "委托书", "主体资格证明"
            ],
            ActionType.EXAMINATION_REPORT: [
                "补正意见陈述书", "修改后的商标图样", "证据材料"
            ],
            ActionType.RENEWAL: [
                "续展申请书", "主体资格证明", "委托书"
            ],
            ActionType.USE_EVIDENCE: [
                "使用证据声明书", "使用证据材料", "委托书"
            ],
        }
        
        for action in actions:
            if action.is_completed:
                continue
            
            required_docs = action_requirements.get(action.action_type, [])
            if not required_docs:
                continue
            
            case = case_map.get(action.case_id)
            if not case:
                continue
            
            submitted_docs = self._extract_submitted_docs(action.description)
            missing_docs = [d for d in required_docs if d not in submitted_docs]
            
            if missing_docs:
                risk = MissingDocumentRisk(
                    risk_id=self._next_risk_id(),
                    case_id=case.case_id,
                    trademark=case.trademark,
                    jurisdiction=case.jurisdiction,
                    category=RiskCategory.MISSING_DOCUMENT,
                    severity=RiskSeverity.HIGH,
                    title=f"{action.action_type.value} 材料缺失",
                    description=f"动作 {action.action_id} 需要提交以下材料：{', '.join(required_docs)}。"
                               f"目前缺失：{', '.join(missing_docs)}。",
                    related_action_id=action.action_id,
                    required_documents=required_docs,
                    submitted_documents=submitted_docs,
                    missing_documents=missing_docs
                )
                risks.append(risk)
        
        return risks
    
    def _extract_submitted_docs(self, description: str) -> List[str]:
        doc_keywords = {
            "答辩书": ["答辩书", "response", "answer"],
            "证据材料": ["证据", "evidence", "exhibit"],
            "委托书": ["委托书", "power of attorney", "poa"],
            "主体资格证明": ["主体资格", "身份证明", "incorporation", "id"],
            "补正意见陈述书": ["补正", "amendment", "response"],
            "修改后的商标图样": ["商标图样", "logo", "drawing"],
            "续展申请书": ["续展申请", "renewal application"],
            "使用证据声明书": ["使用声明", "declaration of use"],
        }
        
        submitted = []
        description_lower = description.lower()
        
        for doc_name, keywords in doc_keywords.items():
            for keyword in keywords:
                if keyword.lower() in description_lower:
                    submitted.append(doc_name)
                    break
        
        return submitted
    
    def detect_timezone_conflicts(
        self,
        actions: List[Action]
    ) -> List[RiskItem]:
        risks: List[RiskItem] = []
        
        for action in actions:
            if not action.submission_time or not action.timezone:
                continue
            
            submission_tz = pytz.timezone(action.timezone)
            utc_time = action.submission_time.astimezone(pytz.UTC)
            
            jurisdiction_tz_name = self._get_jurisdiction_timezone(action.case_id)
            if jurisdiction_tz_name:
                jurisdiction_tz = pytz.timezone(jurisdiction_tz_name)
                submission_local = utc_time.astimezone(jurisdiction_tz)
                
                deadline_date = action.action_date
                if deadline_date:
                    deadline_local = jurisdiction_tz.localize(
                        datetime(deadline_date.year, deadline_date.month, deadline_date.day, 23, 59, 59)
                    )
                    
                    is_after_deadline = submission_local > deadline_local
                    
                    if submission_local.hour >= 17 or is_after_deadline:
                        risk = TimezoneConflictRisk(
                            risk_id=self._next_risk_id(),
                            case_id=action.case_id,
                            trademark="",
                            jurisdiction="",
                            category=RiskCategory.TIMEZONE_CONFLICT,
                            severity=RiskSeverity.HIGH if is_after_deadline else RiskSeverity.MEDIUM,
                            title="跨时区提交风险",
                            description=f"提交时间为 {submission_local.strftime('%Y-%m-%d %H:%M:%S %Z')}，"
                                       f"可能存在跨时区问题。{'已超过截止日当地时间！' if is_after_deadline else ''}",
                            related_action_id=action.action_id,
                            source_timezone=action.timezone,
                            target_timezone=jurisdiction_tz_name,
                            submission_time=submission_local,
                            deadline_local_time=deadline_local,
                            is_after_deadline=is_after_deadline
                        )
                        risks.append(risk)
        
        return risks
    
    def _get_jurisdiction_timezone(self, case_id: str) -> Optional[str]:
        return "Asia/Shanghai"
    
    def detect_multi_case_conflicts(
        self,
        cases: List[Case],
        actions: List[Action]
    ) -> List[RiskItem]:
        risks: List[RiskItem] = []
        
        trademark_to_cases: Dict[str, List[Case]] = defaultdict(list)
        for case in cases:
            trademark_to_cases[case.trademark].append(case)
        
        for trademark, case_list in trademark_to_cases.items():
            if len(case_list) <= 1:
                continue
            
            jurisdictions = {c.jurisdiction for c in case_list}
            classes = set()
            for case in case_list:
                classes.update(case.classes)
            
            if len(jurisdictions) > 1:
                case_ids = [c.case_id for c in case_list]
                first_case = case_list[0]
                
                risk = MultiCaseConflictRisk(
                    risk_id=self._next_risk_id(),
                    case_id=first_case.case_id,
                    trademark=trademark,
                    jurisdiction=first_case.jurisdiction,
                    category=RiskCategory.MULTI_CASE_CONFLICT,
                    severity=RiskSeverity.HIGH,
                    title=f"商标 '{trademark}' 多司法管辖区案件冲突",
                    description=f"同一商标 '{trademark}' 在多个司法管辖区有案件："
                               f"{', '.join(jurisdictions)}。案件ID：{', '.join(case_ids)}。"
                               f"请协调各司法管辖区的期限和策略。",
                    conflict_type="multiple_jurisdictions",
                    conflicting_case_ids=case_ids,
                    conflict_description=f"涉及司法管辖区：{', '.join(jurisdictions)}"
                )
                risks.append(risk)
            
            class_to_cases: Dict[str, List[Case]] = defaultdict(list)
            for case in case_list:
                for cls in case.classes:
                    class_to_cases[cls].append(case)
            
            for cls, class_case_list in class_to_cases.items():
                if len(class_case_list) > 1:
                    case_ids = [c.case_id for c in class_case_list]
                    first_case = class_case_list[0]
                    
                    risk = MultiCaseConflictRisk(
                        risk_id=self._next_risk_id(),
                        case_id=first_case.case_id,
                        trademark=trademark,
                        jurisdiction=first_case.jurisdiction,
                        category=RiskCategory.MULTI_CASE_CONFLICT,
                        severity=RiskSeverity.MEDIUM,
                        title=f"商标 '{trademark}' 第{cls}类多案件冲突",
                        description=f"同一商标 '{trademark}' 在第{cls}类有多个案件："
                                   f"{', '.join(case_ids)}。请检查是否存在重复申请或需要合并处理。",
                        conflict_type="same_class_multiple_cases",
                        conflicting_case_ids=case_ids,
                        conflict_description=f"第{cls}类涉及案件：{', '.join(case_ids)}"
                    )
                    risks.append(risk)
        
        return risks
    
    def _next_risk_id(self) -> str:
        self._risk_counter += 1
        return f"RISK-{self._risk_counter:04d}"
