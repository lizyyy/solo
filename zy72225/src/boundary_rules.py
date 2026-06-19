from typing import Optional, Tuple, List, Callable, Dict
from .models import ReleaseRecord, BoundaryType, ProcessStatus, ChangeLog, ChangeType


class BoundaryRule:
    def __init__(
        self,
        name: str,
        rule_type: BoundaryType,
        check_func: Callable[[ReleaseRecord], bool],
        action_func: Callable[[ReleaseRecord, str], None],
        description: str,
        rollback_func: Optional[Callable[[ReleaseRecord, str], None]] = None,
    ):
        self.name = name
        self.rule_type = rule_type
        self.check_func = check_func
        self.action_func = action_func
        self.description = description
        self.rollback_func = rollback_func

    def check(self, record: ReleaseRecord) -> bool:
        return self.check_func(record)

    def apply(self, record: ReleaseRecord, operator: str) -> None:
        self.action_func(record, operator)

    def rollback(self, record: ReleaseRecord, operator: str) -> None:
        if self.rollback_func:
            self.rollback_func(record, operator)


def _check_zero_amount_with_reversal_note(record: ReleaseRecord) -> bool:
    has_zero_amount = abs(record.amount - 0.0) < 0.0001
    has_reversal_keywords = any(
        keyword in record.remark
        for keyword in ["冲正", "已冲正", "reverse", "reversed", "冲销"]
    )
    return has_zero_amount and has_reversal_keywords


def _action_zero_amount_with_reversal_note(record: ReleaseRecord, operator: str) -> None:
    old_status = record.status
    old_boundary = record.boundary_type

    record.status = ProcessStatus.RISK_REVIEW_REQUIRED
    record.boundary_type = BoundaryType.ZERO_AMOUNT_WITH_REVERSAL_NOTE
    record.boundary_note = "金额为0但备注含'冲正'字样，需风控复核确认，不得自动归为正常"

    change_log = ChangeLog(
        change_type=ChangeType.BOUNDARY_RULE_APPLIED,
        operator=operator,
        field_name="status_and_boundary",
        old_value={"status": old_status.value, "boundary_type": old_boundary.value if old_boundary else None},
        new_value={"status": record.status.value, "boundary_type": record.boundary_type.value},
        reason="触发边界规则：金额为0但备注写着已冲正",
    )
    record.add_change_log(change_log)


def _rollback_zero_amount_with_reversal_note(record: ReleaseRecord, operator: str) -> None:
    old_status = record.status
    old_boundary = record.boundary_type
    old_note = record.boundary_note

    record.status = ProcessStatus.PENDING
    record.boundary_type = None
    record.boundary_note = None

    change_log = ChangeLog(
        change_type=ChangeType.ROLLBACK,
        operator=operator,
        field_name="status_and_boundary",
        old_value={"status": old_status.value, "boundary_type": old_boundary.value if old_boundary else None, "note": old_note},
        new_value={"status": record.status.value, "boundary_type": None, "note": None},
        reason="回滚边界规则：金额为0但备注写着已冲正",
    )
    record.add_change_log(change_log)


def _check_negative_amount(record: ReleaseRecord) -> bool:
    return record.amount < 0


def _action_negative_amount(record: ReleaseRecord, operator: str) -> None:
    old_status = record.status
    old_boundary = record.boundary_type

    record.status = ProcessStatus.RISK_REVIEW_REQUIRED
    record.boundary_type = BoundaryType.NEGATIVE_AMOUNT
    record.boundary_note = "金额为负数，需风控复核"

    change_log = ChangeLog(
        change_type=ChangeType.BOUNDARY_RULE_APPLIED,
        operator=operator,
        field_name="status_and_boundary",
        old_value={"status": old_status.value, "boundary_type": old_boundary.value if old_boundary else None},
        new_value={"status": record.status.value, "boundary_type": record.boundary_type.value},
        reason="触发边界规则：金额为负数",
    )
    record.add_change_log(change_log)


def _rollback_negative_amount(record: ReleaseRecord, operator: str) -> None:
    old_status = record.status
    old_boundary = record.boundary_type
    old_note = record.boundary_note

    record.status = ProcessStatus.PENDING
    record.boundary_type = None
    record.boundary_note = None

    change_log = ChangeLog(
        change_type=ChangeType.ROLLBACK,
        operator=operator,
        field_name="status_and_boundary",
        old_value={"status": old_status.value, "boundary_type": old_boundary.value if old_boundary else None, "note": old_note},
        new_value={"status": record.status.value, "boundary_type": None, "note": None},
        reason="回滚边界规则：金额为负数",
    )
    record.add_change_log(change_log)


class BoundaryRuleEngine:
    def __init__(self):
        self.rules: List[BoundaryRule] = []
        self._register_default_rules()

    def _register_default_rules(self) -> None:
        self.add_rule(BoundaryRule(
            name="zero_amount_with_reversal_note",
            rule_type=BoundaryType.ZERO_AMOUNT_WITH_REVERSAL_NOTE,
            check_func=_check_zero_amount_with_reversal_note,
            action_func=_action_zero_amount_with_reversal_note,
            description="金额为0但备注包含'冲正'、'已冲正'、'冲销'等字样时，标记为需风控复核，不得自动跳过或归为正常",
            rollback_func=_rollback_zero_amount_with_reversal_note,
        ))

        self.add_rule(BoundaryRule(
            name="negative_amount",
            rule_type=BoundaryType.NEGATIVE_AMOUNT,
            check_func=_check_negative_amount,
            action_func=_action_negative_amount,
            description="金额为负数时，标记为需风控复核",
            rollback_func=_rollback_negative_amount,
        ))

    def add_rule(self, rule: BoundaryRule) -> None:
        self.rules.append(rule)

    def check_and_apply(self, record: ReleaseRecord, operator: str) -> Tuple[bool, List[BoundaryType]]:
        applied_rules: List[BoundaryType] = []
        for rule in self.rules:
            if rule.check(record):
                rule.apply(record, operator)
                applied_rules.append(rule.rule_type)
        return len(applied_rules) > 0, applied_rules

    def get_rule_by_type(self, rule_type: BoundaryType) -> Optional[BoundaryRule]:
        for rule in self.rules:
            if rule.rule_type == rule_type:
                return rule
        return None

    def rollback_rule(self, record: ReleaseRecord, rule_type: BoundaryType, operator: str) -> bool:
        rule = self.get_rule_by_type(rule_type)
        if rule and record.boundary_type == rule_type:
            rule.rollback(record, operator)
            return True
        return False

    def get_rule_documentation(self) -> List[Dict[str, str]]:
        return [
            {
                "name": rule.name,
                "type": rule.rule_type.value,
                "description": rule.description,
                "has_rollback": rule.rollback_func is not None,
            }
            for rule in self.rules
        ]
