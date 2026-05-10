from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from ..models.models import (
    TermRule,
    RuleStatus,
    TermLibrary,
    TermLibraryVersion
)
from ..schemas.schemas import (
    TermRuleCreate,
    TermRuleUpdate
)
from .state_machine import StateMachineService, StateTransitionError
from .audit_service import AuditService


class RuleService:
    def __init__(self, state_machine: StateMachineService):
        self.state_machine = state_machine

    def create_rule(self, db: Session, rule_data: TermRuleCreate) -> TermRule:
        library = db.query(TermLibrary).filter(TermLibrary.id == rule_data.library_id).first()
        if not library:
            raise ValueError(f"词库不存在: id={rule_data.library_id}")
        if not library.is_active:
            raise ValueError(f"词库已停用: {library.name}")

        existing = (
            db.query(TermRule)
            .filter(
                TermRule.library_id == rule_data.library_id,
                TermRule.term == rule_data.term,
                TermRule.rule_type == rule_data.rule_type,
                TermRule.status != RuleStatus.DEPRECATED
            )
            .first()
        )
        if existing:
            raise ValueError(
                f"该词库中已存在相同的「{rule_data.rule_type.value}」规则: {rule_data.term}"
            )

        rule = TermRule(
            library_id=rule_data.library_id,
            rule_type=rule_data.rule_type,
            term=rule_data.term,
            match_type=rule_data.match_type,
            priority=rule_data.priority,
            action=rule_data.action,
            reason=rule_data.reason,
            status=RuleStatus.DRAFT,
            created_by=rule_data.created_by
        )
        
        db.add(rule)
        db.flush()
        
        AuditService.log_action(
            db=db,
            rule_id=rule.id,
            action="CREATE",
            actor=rule_data.created_by,
            reason="创建新规则",
            details={
                "rule_type": rule_data.rule_type.value,
                "term": rule_data.term,
                "library_id": rule_data.library_id
            }
        )
        
        return rule

    def update_rule(self, db: Session, rule_id: int, update_data: TermRuleUpdate, actor: str) -> TermRule:
        rule = db.query(TermRule).filter(TermRule.id == rule_id).first()
        if not rule:
            raise ValueError(f"规则不存在: id={rule_id}")
        
        if rule.status in [RuleStatus.PENDING_REVIEW, RuleStatus.IN_GRAY, RuleStatus.PRODUCTION]:
            raise ValueError(
                f"规则当前处于「{self._get_status_display(rule.status)}」状态，不允许直接修改。"
                f"如需修改，请先将规则回滚或废弃后再操作。"
            )

        update_dict = update_data.dict(exclude_unset=True)
        if not update_dict:
            return rule

        for field, value in update_dict.items():
            setattr(rule, field, value)
        
        AuditService.log_action(
            db=db,
            rule_id=rule.id,
            action="UPDATE",
            actor=actor,
            reason="更新规则信息",
            details=update_dict
        )
        
        return rule

    def transition_status(
        self,
        db: Session,
        rule_id: int,
        target_status: RuleStatus,
        actor: str,
        reason: Optional[str] = None,
        details: Optional[dict] = None
    ) -> TermRule:
        rule = db.query(TermRule).filter(TermRule.id == rule_id).first()
        if not rule:
            raise ValueError(f"规则不存在: id={rule_id}")
        
        old_status = rule.status
        
        try:
            self.state_machine.validate_transition(old_status, target_status)
        except StateTransitionError as e:
            raise e

        action = self._get_action_for_transition(old_status, target_status)
        transition_desc = self.state_machine.get_transition_description(old_status, target_status)

        rule.status = target_status
        
        AuditService.log_transition(
            db=db,
            rule_id=rule.id,
            action=action,
            from_status=old_status,
            to_status=target_status,
            actor=actor,
            reason=reason or transition_desc,
            details=details or {"transition_description": transition_desc}
        )
        
        return rule

    def get_rule(self, db: Session, rule_id: int) -> Optional[TermRule]:
        return db.query(TermRule).filter(TermRule.id == rule_id).first()

    def list_rules(
        self,
        db: Session,
        library_id: Optional[int] = None,
        status: Optional[RuleStatus] = None,
        rule_type: Optional[str] = None,
        term: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[TermRule]:
        query = db.query(TermRule)
        
        if library_id:
            query = query.filter(TermRule.library_id == library_id)
        if status:
            query = query.filter(TermRule.status == status)
        if rule_type:
            query = query.filter(TermRule.rule_type == rule_type)
        if term:
            query = query.filter(TermRule.term.ilike(f"%{term}%"))
        
        return query.order_by(TermRule.updated_at.desc()).offset(offset).limit(limit).all()

    def _get_status_display(self, status: RuleStatus) -> str:
        displays = {
            RuleStatus.DRAFT: "草稿",
            RuleStatus.PENDING_REVIEW: "待审核",
            RuleStatus.REVIEW_REJECTED: "审核驳回",
            RuleStatus.PENDING_GRAY: "待灰度",
            RuleStatus.IN_GRAY: "灰度中",
            RuleStatus.GRAY_REJECTED: "灰度不通过",
            RuleStatus.PRODUCTION: "生产生效",
            RuleStatus.ROLLED_BACK: "已回滚",
            RuleStatus.DEPRECATED: "已废弃"
        }
        return displays.get(status, status.value)

    def _get_action_for_transition(self, from_status: RuleStatus, to_status: RuleStatus) -> str:
        action_map = {
            (RuleStatus.DRAFT, RuleStatus.PENDING_REVIEW): "SUBMIT_REVIEW",
            (RuleStatus.PENDING_REVIEW, RuleStatus.PENDING_GRAY): "APPROVE_REVIEW",
            (RuleStatus.PENDING_REVIEW, RuleStatus.REVIEW_REJECTED): "REJECT_REVIEW",
            (RuleStatus.PENDING_GRAY, RuleStatus.IN_GRAY): "START_GRAY",
            (RuleStatus.IN_GRAY, RuleStatus.PRODUCTION): "APPROVE_GRAY",
            (RuleStatus.IN_GRAY, RuleStatus.GRAY_REJECTED): "REJECT_GRAY",
            (RuleStatus.IN_GRAY, RuleStatus.ROLLED_BACK): "ROLLBACK",
            (RuleStatus.PRODUCTION, RuleStatus.ROLLED_BACK): "ROLLBACK",
            (RuleStatus.ROLLED_BACK, RuleStatus.PENDING_REVIEW): "SUBMIT_REVIEW",
            (RuleStatus.DRAFT, RuleStatus.DEPRECATED): "DEPRECATE",
            (RuleStatus.REVIEW_REJECTED, RuleStatus.DEPRECATED): "DEPRECATE",
            (RuleStatus.PENDING_GRAY, RuleStatus.DEPRECATED): "DEPRECATE",
            (RuleStatus.GRAY_REJECTED, RuleStatus.DEPRECATED): "DEPRECATE",
            (RuleStatus.PRODUCTION, RuleStatus.DEPRECATED): "DEPRECATE",
            (RuleStatus.ROLLED_BACK, RuleStatus.DEPRECATED): "DEPRECATE"
        }
        return action_map.get((from_status, to_status), "STATUS_CHANGE")
