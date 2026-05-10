from typing import Dict, Any, List, Optional
from datetime import datetime

from sqlalchemy.orm import Session

from ..models import RuleDefinition, RuleEvaluation, RetractionRequest


class RuleEngine:
    def __init__(self, db: Session, ruleset: str = "standard_v1"):
        self.db = db
        self.ruleset = ruleset
        self._rules: List[RuleDefinition] = []
        self._load_rules()
    
    def _load_rules(self):
        self._rules = (
            self.db.query(RuleDefinition)
            .filter(
                RuleDefinition.ruleset == self.ruleset,
                RuleDefinition.is_active == True
            )
            .all()
        )
    
    def evaluate_rules(
        self,
        request: RetractionRequest,
        context: Dict[str, Any]
    ) -> List[RuleEvaluation]:
        evaluations = []
        
        for rule in self._rules:
            result = self._evaluate_single_rule(rule, context)
            evaluation = RuleEvaluation(
                rule_id=rule.id,
                request_id=request.id,
                input_values=context,
                evaluation_result=result["passed"],
                evaluation_notes=result.get("notes")
            )
            evaluations.append(evaluation)
            self.db.add(evaluation)
        
        self.db.commit()
        return evaluations
    
    def _evaluate_single_rule(
        self,
        rule: RuleDefinition,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        try:
            passed = self._execute_condition(rule.condition_expression, context)
            return {"passed": passed}
        except Exception as e:
            return {"passed": False, "notes": f"Rule evaluation error: {str(e)}"}
    
    def _execute_condition(self, expression: str, context: Dict[str, Any]) -> bool:
        safe_globals = {
            "__builtins__": {
                "len": len,
                "str": str,
                "int": int,
                "bool": bool,
                "datetime": datetime,
                "any": any,
                "all": all,
            }
        }
        local_vars = dict(context)
        result = eval(expression, safe_globals, local_vars)
        return bool(result)
    
    def get_all_rules(self) -> List[RuleDefinition]:
        return self._rules
    
    def get_rule_by_name(self, rule_name: str) -> Optional[RuleDefinition]:
        for rule in self._rules:
            if rule.rule_name == rule_name:
                return rule
        return None
    
    def should_approve(self, evaluations: List[RuleEvaluation]) -> bool:
        reject_types = ["approval_gate", "blocking"]
        for eval_item in evaluations:
            rule = (
                self.db.query(RuleDefinition)
                .filter(RuleDefinition.id == eval_item.rule_id)
                .first()
            )
            if rule and rule.rule_type in reject_types:
                if not eval_item.evaluation_result:
                    return False
        return True
    
    def get_blocking_reasons(
        self,
        evaluations: List[RuleEvaluation]
    ) -> List[str]:
        reasons = []
        for eval_item in evaluations:
            if not eval_item.evaluation_result:
                rule = (
                    self.db.query(RuleDefinition)
                    .filter(RuleDefinition.id == eval_item.rule_id)
                    .first()
                )
                if rule and rule.rule_type in ["approval_gate", "blocking"]:
                    reasons.append(
                        f"Rule '{rule.rule_name}' failed: {rule.description or rule.condition_expression}"
                    )
        return reasons


def register_standard_rules(db: Session):
    standard_rules = [
        {
            "id": "rule_001",
            "ruleset": "standard_v1",
            "version": "1.0",
            "rule_name": "reason_is_provided",
            "rule_type": "approval_gate",
            "condition_expression": "retraction_reason is not None and len(str(retraction_reason).strip()) >= 10",
            "action": "approve",
            "description": "撤回申请必须包含原因说明（至少10个字符）"
        },
        {
            "id": "rule_002",
            "ruleset": "standard_v1",
            "version": "1.0",
            "rule_name": "user_data_exists",
            "rule_type": "approval_gate",
            "condition_expression": "user_exists == True",
            "action": "approve",
            "description": "撤回申请关联的用户必须存在"
        },
        {
            "id": "rule_003",
            "ruleset": "standard_v1",
            "version": "1.0",
            "rule_name": "data_not_already_retracted",
            "rule_type": "blocking",
            "condition_expression": "already_retracted == False",
            "action": "reject",
            "description": "数据记录不能已被撤回（防止重复操作）"
        },
        {
            "id": "rule_004",
            "ruleset": "standard_v1",
            "version": "1.0",
            "rule_name": "at_least_one_record_found",
            "rule_type": "approval_gate",
            "condition_expression": "record_count >= 1",
            "action": "approve",
            "description": "至少找到一条要撤回的数据记录"
        },
        {
            "id": "rule_005",
            "ruleset": "standard_v1",
            "version": "1.0",
            "rule_name": "no_pending_request_for_same_user",
            "rule_type": "informational",
            "condition_expression": "has_pending_same_user == False",
            "action": "warn",
            "description": "同一用户是否有待处理的撤回申请（非阻塞，仅警告）"
        },
        {
            "id": "rule_006",
            "ruleset": "standard_v1",
            "version": "1.0",
            "rule_name": "valid_retraction_scope",
            "rule_type": "approval_gate",
            "condition_expression": "scope in ['user_all', 'specific_records', 'by_external_id']",
            "action": "approve",
            "description": "撤回范围必须是有效值"
        },
        {
            "id": "rule_007",
            "ruleset": "standard_v1",
            "version": "1.0",
            "rule_name": "retraction_within_time_window",
            "rule_type": "informational",
            "condition_expression": "within_retention_window == True",
            "action": "warn",
            "description": "数据是否还在可撤回的时间窗口内"
        }
    ]
    
    for rule_data in standard_rules:
        existing = db.query(RuleDefinition).filter(
            RuleDefinition.id == rule_data["id"]
        ).first()
        
        if not existing:
            rule = RuleDefinition(**rule_data)
            db.add(rule)
    
    db.commit()
