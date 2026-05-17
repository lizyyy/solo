from typing import Dict, List, Set, Tuple

from ..models import (
    CompensationPlan,
    CompensationStatus,
    UserConfirmation,
    SettlementRecord,
)
from ..utils import stable_hash


class CompensationStateMachine:
    TRANSITIONS: Dict[CompensationStatus, Set[CompensationStatus]] = {
        CompensationStatus.PENDING: {
            CompensationStatus.CONFIRMED,
            CompensationStatus.CANCELLED,
        },
        CompensationStatus.CONFIRMED: {
            CompensationStatus.PROCESSED,
            CompensationStatus.FAILED,
            CompensationStatus.CANCELLED,
        },
        CompensationStatus.PROCESSED: set(),
        CompensationStatus.FAILED: {
            CompensationStatus.PENDING,
            CompensationStatus.CANCELLED,
        },
        CompensationStatus.CANCELLED: set(),
    }

    def __init__(self, plans: List[CompensationPlan]):
        self.plans = sorted(plans, key=lambda p: (p.batch_id, p.plan_id))
        self.plan_map: Dict[str, CompensationPlan] = {p.plan_id: p for p in plans}

    def can_transition(self, plan_id: str, to_status: CompensationStatus) -> bool:
        plan = self.plan_map.get(plan_id)
        if not plan:
            return False
        return to_status in self.TRANSITIONS.get(plan.status, set())

    def transition(
        self, plan_id: str, to_status: CompensationStatus
    ) -> Tuple[bool, str]:
        if not self.can_transition(plan_id, to_status):
            plan = self.plan_map.get(plan_id)
            current_status = plan.status.value if plan else "NOT_FOUND"
            return False, f"无法从状态 {current_status} 转换到 {to_status.value}"

        plan = self.plan_map[plan_id]
        plan.status = to_status
        return True, "状态转换成功"

    def apply_confirmations(self, confirmations: List[UserConfirmation]) -> List[str]:
        errors: List[str] = []

        for conf in sorted(confirmations, key=lambda c: c.confirmed_at):
            for plan in self.plans:
                if (
                    plan.order_id == conf.order_id
                    and plan.sku_id == conf.sku_id
                    and plan.user_id == conf.user_id
                ):
                    if conf.confirmed:
                        old_type = plan.compensation_type.value
                        plan.compensation_type = conf.compensation_type

                        if conf.compensation_type.value != old_type:
                            if plan.compensation_type.value == "refund":
                                refund_amount = round(plan.quantity * (plan.refund_amount / plan.quantity) if plan.refund_amount else 0, 2)
                                plan.refund_amount = refund_amount
                                plan.points_amount = None
                                plan.exchange_sku_id = None
                                plan.exchange_sku_name = None
                            elif plan.compensation_type.value == "points":
                                points_amount = plan.quantity * 100 * (plan.refund_amount / plan.quantity if plan.refund_amount and plan.quantity > 0 else 0.599)
                                plan.points_amount = int(points_amount)
                                plan.refund_amount = None
                                plan.exchange_sku_id = None
                                plan.exchange_sku_name = None
                            elif plan.compensation_type.value == "exchange":
                                plan.exchange_sku_id = plan.exchange_sku_id or ""
                                plan.exchange_sku_name = plan.exchange_sku_name or ""
                                plan.refund_amount = None
                                plan.points_amount = None

                        success, msg = self.transition(plan.plan_id, CompensationStatus.CONFIRMED)
                        if not success:
                            errors.append(f"方案 {plan.plan_id}: {msg}")
                    else:
                        success, msg = self.transition(plan.plan_id, CompensationStatus.CANCELLED)
                        if not success:
                            errors.append(f"方案 {plan.plan_id}: {msg}")

        return errors

    def get_confirmed_plans(self) -> List[CompensationPlan]:
        return [p for p in self.plans if p.status == CompensationStatus.CONFIRMED]

    def process_all_confirmed(self) -> Tuple[int, List[str]]:
        errors: List[str] = []
        processed_count = 0

        for plan in self.get_confirmed_plans():
            success, msg = self.transition(plan.plan_id, CompensationStatus.PROCESSED)
            if success:
                processed_count += 1
            else:
                errors.append(f"方案 {plan.plan_id}: {msg}")

        return processed_count, errors
