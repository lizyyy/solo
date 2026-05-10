from datetime import date, datetime
from typing import Dict, List, Optional

from models import PaymentPlan, PaymentPlanStatus, PaymentPriority


class PaymentPlanRepository:
    def __init__(self):
        self._plans: Dict[str, PaymentPlan] = {}

    def save(self, plan: PaymentPlan) -> None:
        self._plans[plan.id] = plan

    def get_by_id(self, plan_id: str) -> Optional[PaymentPlan]:
        return self._plans.get(plan_id)

    def get_by_purchase_order(self, po_id: str) -> List[PaymentPlan]:
        return [p for p in self._plans.values() if p.purchase_order_id == po_id]

    def get_by_vendor(self, vendor_id: str) -> List[PaymentPlan]:
        return [p for p in self._plans.values() if p.vendor_id == vendor_id]

    def get_by_status(self, status: PaymentPlanStatus) -> List[PaymentPlan]:
        return [p for p in self._plans.values() if p.status == status]

    def get_pending_scheduling(self) -> List[PaymentPlan]:
        pending = [p for p in self._plans.values() 
                   if p.status == PaymentPlanStatus.PENDING_SCHEDULE]
        
        def sort_key(p: PaymentPlan):
            priority_order = {
                PaymentPriority.URGENT: 0,
                PaymentPriority.HIGH: 1,
                PaymentPriority.NORMAL: 2
            }
            return (priority_order[p.priority], p.created_at)
        
        return sorted(pending, key=sort_key)

    def get_scheduled_for_date(self, target_date: date) -> List[PaymentPlan]:
        return [p for p in self._plans.values() 
                if p.current_payment_date == target_date 
                and p.status in [PaymentPlanStatus.SCHEDULED, PaymentPlanStatus.PARTIALLY_PAID]]

    def get_delayed_plans(self) -> List[PaymentPlan]:
        return [p for p in self._plans.values() if p.status == PaymentPlanStatus.DELAYED]

    def get_manual_review_plans(self) -> List[PaymentPlan]:
        return [p for p in self._plans.values() if p.status == PaymentPlanStatus.MANUAL_REVIEW]

    def get_all(self) -> List[PaymentPlan]:
        return list(self._plans.values())

    def delete(self, plan_id: str) -> bool:
        if plan_id in self._plans:
            del self._plans[plan_id]
            return True
        return False
