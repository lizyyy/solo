from typing import Dict, Any, List, Optional, Callable
from sqlalchemy.orm import Session
from datetime import datetime

from .models import (
    SessionLocal,
    BoundaryRule,
    FormulaScreenshot,
    RecordStatus,
    AbnormalType,
    BatchImport,
    ChangeType,
)
from .normalizer import record_to_dict, batch_summary


class BoundaryRuleEngine:
    def __init__(self):
        self.rules: List[Dict[str, Any]] = []
        self._load_rules_from_db()

    def _load_rules_from_db(self):
        session = SessionLocal()
        try:
            db_rules = (
                session.query(BoundaryRule)
                .filter_by(is_active=True)
                .order_by(BoundaryRule.priority.desc(), BoundaryRule.id)
                .all()
            )
            for rule in db_rules:
                self.rules.append(
                    {
                        "rule_name": rule.rule_name,
                        "rule_type": rule.rule_type,
                        "condition": rule.condition,
                        "action": rule.action,
                        "priority": rule.priority,
                        "description": rule.description,
                    }
                )
        finally:
            session.close()

    def add_rule(
        self,
        rule_name: str,
        rule_type: str,
        condition: Dict[str, Any],
        action: Dict[str, Any],
        description: str = "",
        priority: int = 0,
    ):
        session = SessionLocal()
        try:
            existing = (
                session.query(BoundaryRule).filter_by(rule_name=rule_name).first()
            )
            if existing:
                existing.rule_type = rule_type
                existing.condition = condition
                existing.action = action
                existing.description = description
                existing.priority = priority
                existing.is_active = True
            else:
                new_rule = BoundaryRule(
                    rule_name=rule_name,
                    rule_type=rule_type,
                    condition=condition,
                    action=action,
                    description=description,
                    priority=priority,
                    is_active=True,
                )
                session.add(new_rule)
            session.commit()
            self._load_rules_from_db()
        finally:
            session.close()

    def evaluate_condition(
        self, condition: Dict[str, Any], record: FormulaScreenshot
    ) -> bool:
        field = condition.get("field")
        operator = condition.get("operator")
        value = condition.get("value")

        record_value = getattr(record, field, None)

        operators = {
            "equals": lambda rv, v: rv == v,
            "not_equals": lambda rv, v: rv != v,
            "is_empty": lambda rv, v: rv is None
            or (isinstance(rv, str) and rv.strip() == "")
            or (isinstance(rv, str) and rv.lower() == "nan"),
            "is_zero": lambda rv, v: rv == 0
            or rv == 0.0
            or (isinstance(rv, float) and abs(rv - 0.0) < 1e-9),
            "is_zero_or_empty_result": lambda rv, v: (
                rv is None
                or (isinstance(rv, str) and rv.strip() == "")
                or (isinstance(rv, str) and rv.lower() == "nan")
                or rv == 0
                or rv == 0.0
            ),
            "greater_than": lambda rv, v: rv > v if rv is not None else False,
            "less_than": lambda rv, v: rv < v if rv is not None else False,
            "contains": lambda rv, v: v in str(rv) if rv is not None else False,
        }

        op_func = operators.get(operator)
        if op_func:
            return op_func(record_value, value)
        return False

    def apply_action(
        self, action: Dict[str, Any], record: FormulaScreenshot
    ) -> Dict[str, Any]:
        action_type = action.get("type")
        params = action.get("params", {})

        result = {"applied": False, "changes": {}}

        if action_type == "set_status":
            old_status = record.status
            new_status = params.get("status", RecordStatus.PENDING.value)
            if old_status != new_status:
                record.status = new_status
                result["changes"] = {"status": {"old": old_status, "new": new_status}}
                result["applied"] = True

        elif action_type == "set_abnormal":
            old_type = record.abnormal_type
            old_note = record.abnormal_note
            new_type = params.get("abnormal_type")
            new_note = params.get("abnormal_note", "")
            changes = {}
            if old_type != new_type:
                changes["abnormal_type"] = {"old": old_type, "new": new_type}
            if old_note != new_note:
                changes["abnormal_note"] = {"old": old_note, "new": new_note}
            record.abnormal_type = new_type
            record.abnormal_note = new_note
            if changes:
                result["changes"] = changes
                result["applied"] = True

        elif action_type == "set_result":
            old_result = record.result_value
            new_result = params.get("result_value")
            if old_result != new_result:
                record.result_value = new_result
                result["changes"] = {
                    "result_value": {"old": old_result, "new": new_result}
                }
                result["applied"] = True

        return result

    def process_record(self, record: FormulaScreenshot) -> List[Dict[str, Any]]:
        applied_rules = []

        for rule in self.rules:
            if self.evaluate_condition(rule["condition"], record):
                action_result = self.apply_action(rule["action"], record)
                if action_result["applied"]:
                    applied_rules.append(
                        {
                            "rule_name": rule["rule_name"],
                            "rule_type": rule["rule_type"],
                            "priority": rule.get("priority", 0),
                            "changes": action_result["changes"],
                        }
                    )

        return applied_rules


def init_boundary_rules():
    engine = BoundaryRuleEngine()

    rules = [
        {
            "rule_name": "分母为0空字符串组合检测",
            "rule_type": "abnormal_detection",
            "condition": {
                "field": "denominator_value",
                "operator": "is_zero",
                "value": 0,
            },
            "action": {
                "type": "set_abnormal",
                "params": {
                    "abnormal_type": AbnormalType.ZERO_DENOMINATOR_EMPTY_RESULT.value,
                    "abnormal_note": "边界规则触发: 分母为0且结果异常，需数据复核人确认",
                },
            },
            "description": "检测分母为0的情况，标记为zero_denominator_empty_result",
            "priority": 100,
        },
        {
            "rule_name": "结果空字符串检测",
            "rule_type": "abnormal_detection",
            "condition": {
                "field": "result_value",
                "operator": "is_empty",
                "value": "",
            },
            "action": {
                "type": "set_abnormal",
                "params": {
                    "abnormal_type": AbnormalType.EMPTY_STRING.value,
                    "abnormal_note": "边界规则触发: 结果为空字符串，需数据复核人确认",
                },
            },
            "description": "检测结果为空字符串的情况",
            "priority": 80,
        },
        {
            "rule_name": "分母为0异常状态设置",
            "rule_type": "abnormal_detection",
            "condition": {
                "field": "denominator_value",
                "operator": "is_zero",
                "value": 0,
            },
            "action": {
                "type": "set_status",
                "params": {"status": RecordStatus.ABNORMAL.value},
            },
            "description": "分母为0时设置状态为异常待复核",
            "priority": 90,
        },
    ]

    for rule in rules:
        engine.add_rule(
            rule["rule_name"],
            rule["rule_type"],
            rule["condition"],
            rule["action"],
            rule["description"],
            rule.get("priority", 0),
        )

    return engine


def rollback_batch(
    batch_id: str, rollback_note: str, rollback_by: str
) -> Dict[str, Any]:
    from .importer import _refresh_batch_counts, create_history_record

    session = SessionLocal()
    try:
        batch = (
            session.query(BatchImport).filter_by(batch_id=batch_id).first()
        )
        if not batch:
            return {"success": False, "message": f"批次不存在: {batch_id}"}

        if batch.is_rollbacked:
            return {
                "success": False,
                "message": f"批次已回滚: {batch_id}",
                "rollback_time": batch.rollback_time,
                "batch_summary": batch_summary(batch),
            }

        screenshots = (
            session.query(FormulaScreenshot).filter_by(batch_id=batch_id).all()
        )

        for screenshot in screenshots:
            before_data = record_to_dict(screenshot)
            screenshot.is_latest = False
            screenshot.status = RecordStatus.ROLLBACKED.value
            after_data = record_to_dict(screenshot)
            screenshot.current_version += 1

            create_history_record(
                session,
                screenshot,
                ChangeType.ROLLBACK,
                before_data,
                after_data,
                changed_by=rollback_by,
                change_reason=rollback_note,
            )

        batch.is_rollbacked = True
        batch.rollback_time = datetime.now()
        batch.rollback_note = rollback_note
        session.flush()

        batch = _refresh_batch_counts(session, batch_id)
        session.commit()

        return {
            "success": True,
            "batch_id": batch_id,
            "records_rollbacked": len(screenshots),
            "rollback_time": batch.rollback_time.isoformat(),
            "batch_summary": batch_summary(batch),
            "message": f"成功回滚批次 {batch_id}，共 {len(screenshots)} 条记录",
        }

    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()


def get_abnormal_records(batch_id: Optional[str] = None) -> List[Dict[str, Any]]:
    from .importer import get_abnormal_records as _impl

    return _impl(batch_id)
