from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple, Optional
from dataclasses import dataclass
from enum import Enum


class ResultType(Enum):
    SUCCESS = "success"
    CONFIRM = "confirm"
    FAIL = "fail"


@dataclass
class RuleResult:
    result_type: ResultType
    rule_code: str
    rule_name: str
    message: str
    suggestion: Optional[str] = None


class RuleEngine:
    MAX_RENEW_COUNT = 2
    BORROW_DAYS = 30
    OVERDUE_WARNING_DAYS = 3

    def __init__(self, cases: Dict[str, Dict] = None, persons: Dict[str, Dict] = None):
        self.cases = cases or {}
        self.persons = persons or {}

    def validate_required_fields(self, record: Dict[str, Any]) -> Optional[RuleResult]:
        missing_fields = []
        if not record.get("case_no"):
            missing_fields.append("案号(case_no)")
        if not record.get("person_id"):
            missing_fields.append("人员编号(person_id)")
        if not record.get("borrow_date"):
            missing_fields.append("借阅日期(borrow_date)")

        if missing_fields:
            return RuleResult(
                result_type=ResultType.FAIL,
                rule_code="MISSING_FIELDS",
                rule_name="必填字段校验",
                message=f"缺少必填字段: {', '.join(missing_fields)}",
                suggestion="请补充完整必填字段后重新导入"
            )
        return None

    def validate_case_exists(self, record: Dict[str, Any]) -> Optional[RuleResult]:
        case_no = record.get("case_no")
        if case_no and case_no not in self.cases:
            return RuleResult(
                result_type=ResultType.CONFIRM,
                rule_code="CASE_NOT_FOUND",
                rule_name="案件存在性校验",
                message=f"案件[{case_no}]在系统中不存在",
                suggestion="请确认案号是否正确，或先导入该案件信息"
            )
        return None

    def validate_person_exists(self, record: Dict[str, Any]) -> Optional[RuleResult]:
        person_id = record.get("person_id")
        if person_id and person_id not in self.persons:
            return RuleResult(
                result_type=ResultType.CONFIRM,
                rule_code="PERSON_NOT_FOUND",
                rule_name="人员存在性校验",
                message=f"人员[{person_id}]在权限表中不存在",
                suggestion="请确认人员编号是否正确，或先导入该人员权限信息"
            )
        return None

    def validate_secret_case_access(self, record: Dict[str, Any]) -> Optional[RuleResult]:
        case_no = record.get("case_no")
        person_id = record.get("person_id")

        if case_no in self.cases and person_id in self.persons:
            case = self.cases[case_no]
            person = self.persons[person_id]

            if case.get("is_secret") and not person.get("can_access_secret"):
                return RuleResult(
                    result_type=ResultType.FAIL,
                    rule_code="SECRET_ACCESS_DENIED",
                    rule_name="涉密案件权限校验",
                    message=f"人员[{person.get('name')}]无权限借阅涉密案件[{case_no}]",
                    suggestion="涉密案件借阅需要专门审批，请走涉密卷宗借阅审批流程"
                )
        return None

    def validate_renew_limit(self, record: Dict[str, Any]) -> Optional[RuleResult]:
        renew_count = record.get("renew_count", 0)
        if renew_count > self.MAX_RENEW_COUNT:
            return RuleResult(
                result_type=ResultType.FAIL,
                rule_code="RENEW_EXCEED_LIMIT",
                rule_name="续借次数上限校验",
                message=f"续借次数[{renew_count}]超过上限[{self.MAX_RENEW_COUNT}次]",
                suggestion=f"卷宗最多可续借{self.MAX_RENEW_COUNT}次，超过后必须归还后再借阅"
            )
        return None

    def calculate_overdue_status(self, record: Dict[str, Any]) -> Optional[RuleResult]:
        borrow_date = record.get("borrow_date")
        due_date = record.get("due_date")
        return_date = record.get("return_date")

        if return_date:
            return None

        if not due_date and borrow_date:
            due_date = borrow_date + timedelta(days=self.BORROW_DAYS)

        if due_date:
            today = datetime.now()
            if today > due_date:
                overdue_days = (today - due_date).days
                return RuleResult(
                    result_type=ResultType.CONFIRM,
                    rule_code="OVERDUE_NEED_REMIND",
                    rule_name="超期催还提醒",
                    message=f"该卷宗已超期{overdue_days}天未归还",
                    suggestion=f"请立即通知借阅人[{record.get('person_name', record.get('person_id'))}]归还卷宗"
                )
            elif (due_date - today).days <= self.OVERDUE_WARNING_DAYS:
                days_left = (due_date - today).days
                return RuleResult(
                    result_type=ResultType.CONFIRM,
                    rule_code="DUE_SOON_WARNING",
                    rule_name="即将到期提醒",
                    message=f"该卷宗将在{days_left}天后到期",
                    suggestion=f"请提醒借阅人[{record.get('person_name', record.get('person_id'))}]及时归还或办理续借"
                )
        return None

    def validate_date_logic(self, record: Dict[str, Any]) -> Optional[RuleResult]:
        borrow_date = record.get("borrow_date")
        return_date = record.get("return_date")
        due_date = record.get("due_date")

        if borrow_date and return_date and return_date < borrow_date:
            return RuleResult(
                result_type=ResultType.FAIL,
                rule_code="RETURN_BEFORE_BORROW",
                rule_name="日期逻辑校验",
                message="归还日期不能早于借阅日期",
                suggestion="请检查并修正日期后重新导入"
            )

        if borrow_date and due_date and due_date < borrow_date:
            return RuleResult(
                result_type=ResultType.CONFIRM,
                rule_code="DUE_BEFORE_BORROW",
                rule_name="日期逻辑校验",
                message="应还日期早于借阅日期",
                suggestion="请确认应还日期是否正确，系统将按借阅日期后30天自动计算到期日"
            )
        return None

    def validate_action_type(self, record: Dict[str, Any]) -> Optional[RuleResult]:
        action_type = record.get("action_type", "borrow")
        valid_actions = ["borrow", "renew", "return", "extend"]

        if action_type not in valid_actions:
            return RuleResult(
                result_type=ResultType.CONFIRM,
                rule_code="UNKNOWN_ACTION_TYPE",
                rule_name="操作类型校验",
                message=f"未知的操作类型: {action_type}",
                suggestion=f"请确认操作类型，有效类型为: {', '.join(valid_actions)}"
            )
        return None

    def check_all_rules(self, record: Dict[str, Any]) -> Tuple[ResultType, List[RuleResult]]:
        results = []

        fail_rules = [
            self.validate_required_fields,
            self.validate_secret_case_access,
            self.validate_renew_limit,
            self.validate_date_logic,
        ]

        confirm_rules = [
            self.validate_case_exists,
            self.validate_person_exists,
            self.calculate_overdue_status,
            self.validate_action_type,
        ]

        for rule in fail_rules:
            result = rule(record)
            if result:
                results.append(result)

        for rule in confirm_rules:
            result = rule(record)
            if result:
                results.append(result)

        has_fail = any(r.result_type == ResultType.FAIL for r in results)
        has_confirm = any(r.result_type == ResultType.CONFIRM for r in results)

        if has_fail:
            return ResultType.FAIL, results
        elif has_confirm:
            return ResultType.CONFIRM, results
        else:
            return ResultType.SUCCESS, []