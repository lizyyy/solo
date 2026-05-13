from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.models import SamplingRule
from app.schemas import SamplingRuleCreate, SamplingRuleUpdate


class RuleService:
    def __init__(self, db: Session):
        self.db = db

    def create_rule(self, rule_data: SamplingRuleCreate) -> SamplingRule:
        existing = (
            self.db.query(SamplingRule)
            .filter(SamplingRule.name == rule_data.name)
            .first()
        )
        if existing:
            raise ValueError(f"规则名称 '{rule_data.name}' 已存在")
        
        rule = SamplingRule(
            name=rule_data.name,
            description=rule_data.description,
            task_type=rule_data.task_type,
            tenant_id=rule_data.tenant_id,
            is_vip_tenant=rule_data.is_vip_tenant,
            sample_rate=rule_data.sample_rate,
            dedup_enabled=rule_data.dedup_enabled,
            dedup_window_seconds=rule_data.dedup_window_seconds,
            context_window_before=rule_data.context_window_before,
            context_window_after=rule_data.context_window_after,
            retention_days=rule_data.retention_days,
            priority=rule_data.priority,
            is_active=rule_data.is_active,
            version=1
        )
        
        self.db.add(rule)
        self.db.commit()
        self.db.refresh(rule)
        
        return rule

    def update_rule(self, rule_id: int, update_data: SamplingRuleUpdate) -> Optional[SamplingRule]:
        rule = (
            self.db.query(SamplingRule)
            .filter(SamplingRule.id == rule_id)
            .first()
        )
        if not rule:
            return None
        
        update_dict = update_data.model_dump(exclude_unset=True)
        
        if update_dict:
            for key, value in update_dict.items():
                setattr(rule, key, value)
            rule.version += 1
            rule.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(rule)
        
        return rule

    def delete_rule(self, rule_id: int) -> bool:
        rule = (
            self.db.query(SamplingRule)
            .filter(SamplingRule.id == rule_id)
            .first()
        )
        if not rule:
            return False
        
        self.db.delete(rule)
        self.db.commit()
        return True

    def get_rule(self, rule_id: int) -> Optional[SamplingRule]:
        return (
            self.db.query(SamplingRule)
            .filter(SamplingRule.id == rule_id)
            .first()
        )

    def get_all_rules(self, only_active: bool = False) -> List[SamplingRule]:
        query = self.db.query(SamplingRule)
        if only_active:
            query = query.filter(SamplingRule.is_active == True)
        return query.order_by(SamplingRule.priority.desc()).all()

    def activate_rule(self, rule_id: int) -> Optional[SamplingRule]:
        return self.update_rule(rule_id, SamplingRuleUpdate(is_active=True))

    def deactivate_rule(self, rule_id: int) -> Optional[SamplingRule]:
        return self.update_rule(rule_id, SamplingRuleUpdate(is_active=False))
