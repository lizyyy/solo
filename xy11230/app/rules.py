from datetime import datetime, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models import Ticket, TicketStatus, RuleAction, Cabinet
from app.schemas import RuleResult


class BaseRule:
    name: str = "base_rule"

    def apply(self, db: Session, ticket: Ticket) -> Optional[RuleResult]:
        raise NotImplementedError


class DuplicateFaultMergeRule(BaseRule):
    name = "duplicate_fault_merge"

    def __init__(self, time_window_hours: int = 24):
        self.time_window_hours = time_window_hours

    def apply(self, db: Session, ticket: Ticket) -> Optional[RuleResult]:
        if not ticket.cabinet_code or not ticket.fault_type:
            return None

        time_threshold = datetime.utcnow() - timedelta(hours=self.time_window_hours)

        existing_ticket = (
            db.query(Ticket)
            .filter(
                Ticket.cabinet_code == ticket.cabinet_code,
                Ticket.fault_type == ticket.fault_type,
                Ticket.status.not_in([TicketStatus.CLOSED, TicketStatus.REJECTED]),
                Ticket.created_at >= time_threshold,
                Ticket.id != ticket.id,
            )
            .order_by(Ticket.created_at.desc())
            .first()
        )

        if existing_ticket:
            return RuleResult(
                action=RuleAction.MERGE,
                rule_name=self.name,
                reason=f"检测到 {ticket.cabinet_code} 同一故障类型 {ticket.fault_type.value} 在24小时内已存在工单 #{existing_ticket.ticket_no}",
                target_ticket_id=existing_ticket.id,
            )

        return RuleResult(
            action=RuleAction.ALLOW,
            rule_name=self.name,
            reason=f"未检测到 {ticket.cabinet_code} 同一故障类型的重复工单",
        )


class OfflineCabinetRule(BaseRule):
    name = "offline_cabinet_exclude"

    def apply(self, db: Session, ticket: Ticket) -> Optional[RuleResult]:
        if not ticket.cabinet_code:
            return RuleResult(
                action=RuleAction.ALLOW,
                rule_name=self.name,
                reason="无柜号信息，跳过离线检查",
            )

        cabinet = (
            db.query(Cabinet)
            .filter(Cabinet.cabinet_code == ticket.cabinet_code)
            .first()
        )

        if not cabinet:
            return RuleResult(
                action=RuleAction.ALLOW,
                rule_name=self.name,
                reason=f"未找到柜号 {ticket.cabinet_code} 的记录，跳过离线检查",
            )

        if not cabinet.is_online:
            return RuleResult(
                action=RuleAction.BLOCK,
                rule_name=self.name,
                reason=f"柜号 {ticket.cabinet_code} 当前处于离线状态，暂不派修",
            )

        return RuleResult(
            action=RuleAction.ALLOW,
            rule_name=self.name,
            reason=f"柜号 {ticket.cabinet_code} 在线，可正常派修",
        )


class RepairStatusConsistencyRule(BaseRule):
    name = "repair_status_consistency"

    def apply(self, db: Session, ticket: Ticket) -> Optional[RuleResult]:
        if ticket.status != TicketStatus.REPAIRED:
            return RuleResult(
                action=RuleAction.ALLOW,
                rule_name=self.name,
                reason="工单未完成维修，跳过状态一致性检查",
            )

        dispatches = ticket.dispatches
        if not dispatches:
            return RuleResult(
                action=RuleAction.ALLOW,
                rule_name=self.name,
                reason="无派修记录，跳过状态一致性检查",
            )

        latest_dispatch = max(dispatches, key=lambda d: d.created_at)

        if latest_dispatch.before_status and latest_dispatch.after_status:
            if latest_dispatch.before_status == latest_dispatch.after_status:
                return RuleResult(
                    action=RuleAction.BLOCK,
                    rule_name=self.name,
                    reason=f"维修前后状态一致 ({latest_dispatch.before_status})，可能存在问题需要复核",
                )

        return RuleResult(
            action=RuleAction.ALLOW,
            rule_name=self.name,
            reason="维修前后状态有变化，符合预期",
        )


class RuleEngine:
    def __init__(self):
        self.rules: List[BaseRule] = []

    def register_rule(self, rule: BaseRule):
        self.rules.append(rule)

    def apply_rules(
        self, db: Session, ticket: Ticket, stage: str = "receive"
    ) -> List[RuleResult]:
        results = []

        for rule in self.rules:
            try:
                result = rule.apply(db, ticket)
                if result:
                    results.append(result)
            except Exception as e:
                results.append(
                    RuleResult(
                        action=RuleAction.ALLOW,
                        rule_name=rule.name,
                        reason=f"规则执行异常: {str(e)}",
                    )
                )

        return results

    def get_final_action(self, results: List[RuleResult]) -> RuleAction:
        if any(r.action == RuleAction.BLOCK for r in results):
            return RuleAction.BLOCK
        if any(r.action == RuleAction.MERGE for r in results):
            return RuleAction.MERGE
        return RuleAction.ALLOW


def create_default_rule_engine() -> RuleEngine:
    engine = RuleEngine()
    engine.register_rule(DuplicateFaultMergeRule())
    engine.register_rule(OfflineCabinetRule())
    engine.register_rule(RepairStatusConsistencyRule())
    return engine
