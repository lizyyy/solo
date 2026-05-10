from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from datetime import datetime
from ..models.rule import RuleDefinition, RuleStatus, RuleType, RuleExecutionLog
from ..models.lesion import LesionRecord


class RuleEngine:
    def __init__(self):
        pass
    
    def _generate_log_code(self) -> str:
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        import random
        suffix = random.randint(1000, 9999)
        return f"RL{timestamp}{suffix}"
    
    def _evaluate_condition(
        self,
        condition: Dict[str, Any],
        target_data: Dict[str, Any]
    ) -> bool:
        if not condition:
            return True
        
        field = condition.get("field")
        operator = condition.get("operator")
        value = condition.get("value")
        
        if not field or not operator:
            return False
        
        actual_value = target_data.get(field)
        
        if operator == "equals":
            return actual_value == value
        elif operator == "not_equals":
            return actual_value != value
        elif operator == "greater_than":
            return actual_value is not None and actual_value > value
        elif operator == "less_than":
            return actual_value is not None and actual_value < value
        elif operator == "greater_than_or_equal":
            return actual_value is not None and actual_value >= value
        elif operator == "less_than_or_equal":
            return actual_value is not None and actual_value <= value
        elif operator == "contains":
            return actual_value is not None and value in str(actual_value)
        elif operator == "in":
            return actual_value in value if isinstance(value, list) else False
        elif operator == "and":
            sub_conditions = condition.get("conditions", [])
            return all(self._evaluate_condition(sc, target_data) for sc in sub_conditions)
        elif operator == "or":
            sub_conditions = condition.get("conditions", [])
            return any(self._evaluate_condition(sc, target_data) for sc in sub_conditions)
        
        return False
    
    def _generate_match_reason(
        self,
        rule: RuleDefinition,
        target_data: Dict[str, Any]
    ) -> str:
        return f"规则【{rule.rule_name}】匹配：规则描述：{rule.rule_description}，目标数据包含匹配条件"
    
    def apply_rules(
        self,
        db: Session,
        rule_type: RuleType,
        target_type: str,
        target_data: Dict[str, Any],
        target_id: Optional[int] = None,
        target_code: Optional[str] = None,
        executed_by: str = "system",
        auto_save: bool = True
    ) -> Dict[str, Any]:
        rules = db.query(RuleDefinition).filter(
            RuleDefinition.rule_type == rule_type,
            RuleDefinition.status == RuleStatus.ACTIVE
        ).order_by(
            RuleDefinition.priority.desc()
        ).all()
        
        if not rules:
            return {
                "matched": False,
                "matched_rules": [],
                "message": f"没有找到类型为【{rule_type.value}】的启用规则"
            }
        
        matched_rules = []
        execution_logs = []
        
        for rule in rules:
            try:
                is_matched = self._evaluate_condition(rule.rule_condition, target_data)
                
                log = RuleExecutionLog(
                    log_code=self._generate_log_code(),
                    rule_id=rule.id,
                    rule_code=rule.rule_code,
                    rule_name=rule.rule_name,
                    target_type=target_type,
                    target_id=target_id,
                    target_code=target_code,
                    input_data=target_data,
                    execution_result={"matched": is_matched},
                    match_reason=self._generate_match_reason(rule, target_data) if is_matched else None,
                    is_matched=is_matched,
                    executed_by=executed_by
                )
                
                if auto_save:
                    db.add(log)
                
                execution_logs.append({
                    "log_code": log.log_code,
                    "rule_code": rule.rule_code,
                    "rule_name": rule.rule_name,
                    "is_matched": is_matched,
                    "match_reason": log.match_reason
                })
                
                if is_matched:
                    matched_rules.append({
                        "rule_id": rule.id,
                        "rule_code": rule.rule_code,
                        "rule_name": rule.rule_name,
                        "rule_description": rule.rule_description,
                        "priority": rule.priority,
                        "rule_action": rule.rule_action
                    })
            except Exception as e:
                execution_logs.append({
                    "rule_code": rule.rule_code,
                    "rule_name": rule.rule_name,
                    "error": str(e)
                })
        
        if auto_save:
            db.commit()
        
        return {
            "matched": len(matched_rules) > 0,
            "matched_rules": matched_rules,
            "execution_logs": execution_logs,
            "message": f"共检查{len(rules)}条规则，匹配{len(matched_rules)}条" if matched_rules else f"共检查{len(rules)}条规则，未匹配任何规则"
        }
    
    def create_rule(
        self,
        db: Session,
        rule_code: str,
        rule_name: str,
        rule_type: RuleType,
        rule_description: str,
        rule_condition: Dict[str, Any],
        rule_action: Optional[Dict[str, Any]] = None,
        priority: int = 0,
        is_auto_apply: bool = True,
        created_by: str = "system"
    ) -> RuleDefinition:
        existing = db.query(RuleDefinition).filter(
            RuleDefinition.rule_code == rule_code
        ).first()
        
        if existing:
            raise ValueError(f"规则编号【{rule_code}】已存在")
        
        rule = RuleDefinition(
            rule_code=rule_code,
            rule_name=rule_name,
            rule_type=rule_type,
            rule_description=rule_description,
            rule_condition=rule_condition,
            rule_action=rule_action,
            priority=priority,
            is_auto_apply=is_auto_apply,
            status=RuleStatus.DRAFT,
            created_by=created_by
        )
        
        db.add(rule)
        db.commit()
        db.refresh(rule)
        
        return rule
    
    def activate_rule(
        self,
        db: Session,
        rule_code: str,
        updated_by: str
    ) -> Optional[RuleDefinition]:
        rule = db.query(RuleDefinition).filter(
            RuleDefinition.rule_code == rule_code
        ).first()
        
        if not rule:
            return None
        
        rule.status = RuleStatus.ACTIVE
        rule.updated_by = updated_by
        
        db.commit()
        db.refresh(rule)
        
        return rule
    
    def deactivate_rule(
        self,
        db: Session,
        rule_code: str,
        updated_by: str
    ) -> Optional[RuleDefinition]:
        rule = db.query(RuleDefinition).filter(
            RuleDefinition.rule_code == rule_code
        ).first()
        
        if not rule:
            return None
        
        rule.status = RuleStatus.DISABLED
        rule.updated_by = updated_by
        
        db.commit()
        db.refresh(rule)
        
        return rule
    
    def get_rule_execution_history(
        self,
        db: Session,
        rule_code: Optional[str] = None,
        target_code: Optional[str] = None,
        page: int = 1,
        page_size: int = 20
    ) -> Dict[str, Any]:
        query = db.query(RuleExecutionLog)
        
        if rule_code:
            query = query.filter(RuleExecutionLog.rule_code == rule_code)
        
        if target_code:
            query = query.filter(RuleExecutionLog.target_code == target_code)
        
        total = query.count()
        total_pages = (total + page_size - 1) // page_size
        
        items = query.order_by(RuleExecutionLog.executed_at.desc()).offset(
            (page - 1) * page_size
        ).limit(page_size).all()
        
        logs = []
        for log in items:
            logs.append({
                "log_code": log.log_code,
                "rule_code": log.rule_code,
                "rule_name": log.rule_name,
                "target_type": log.target_type,
                "target_code": log.target_code,
                "is_matched": log.is_matched,
                "match_reason": log.match_reason,
                "executed_by": log.executed_by,
                "executed_at": log.executed_at
            })
        
        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "items": logs,
            "business_message": f"共查询到{total}条规则执行记录"
        }


rule_engine = RuleEngine()
