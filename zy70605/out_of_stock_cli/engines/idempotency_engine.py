from typing import Dict, List, Tuple, Any

from ..models import (
    CompensationPlan,
    UserConfirmation,
    SettlementRecord,
    BadRow,
)
from ..utils import stable_hash


class IdempotencyEngine:
    def __init__(self):
        self.processed_hashes: Set[str] = set()
        self.duplicates: List[Dict[str, Any]] = []

    def generate_plan_hash(self, plan: CompensationPlan) -> str:
        data = {
            "batch_id": plan.batch_id,
            "order_id": plan.order_id,
            "sku_id": plan.sku_id,
            "user_id": plan.user_id,
            "compensation_type": plan.compensation_type.value,
            "quantity": plan.quantity,
        }
        return stable_hash(data)

    def generate_confirmation_hash(self, conf: UserConfirmation) -> str:
        data = {
            "order_id": conf.order_id,
            "sku_id": conf.sku_id,
            "user_id": conf.user_id,
            "compensation_type": conf.compensation_type.value,
            "confirmed": conf.confirmed,
            "confirmed_at": conf.confirmed_at.isoformat(),
        }
        return stable_hash(data)

    def check_plan_idempotency(
        self, plans: List[CompensationPlan]
    ) -> Tuple[List[CompensationPlan], List[Dict[str, Any]]]:
        unique_plans: List[CompensationPlan] = []
        duplicates: List[Dict[str, Any]] = []

        sorted_plans = sorted(plans, key=lambda p: (p.batch_id, p.plan_id))

        for plan in sorted_plans:
            h = self.generate_plan_hash(plan)
            if h in self.processed_hashes:
                duplicates.append(
                    {
                        "type": "plan",
                        "plan_id": plan.plan_id,
                        "order_id": plan.order_id,
                        "sku_id": plan.sku_id,
                        "source_file": plan.source_file,
                        "source_row": plan.source_row,
                    }
                )
            else:
                self.processed_hashes.add(h)
                unique_plans.append(plan)

        return unique_plans, duplicates

    def check_confirmation_idempotency(
        self, confirmations: List[UserConfirmation]
    ) -> Tuple[List[UserConfirmation], List[Dict[str, Any]]]:
        unique_confs: List[UserConfirmation] = []
        duplicates: List[Dict[str, Any]] = []

        sorted_confs = sorted(
            confirmations, key=lambda c: (c.order_id, c.confirmed_at, c.confirmation_id)
        )

        for conf in sorted_confs:
            h = self.generate_confirmation_hash(conf)
            if h in self.processed_hashes:
                duplicates.append(
                    {
                        "type": "confirmation",
                        "confirmation_id": conf.confirmation_id,
                        "order_id": conf.order_id,
                        "sku_id": conf.sku_id,
                        "source_file": conf.source_file,
                        "source_row": conf.source_row,
                    }
                )
            else:
                self.processed_hashes.add(h)
                unique_confs.append(conf)

        return unique_confs, duplicates

    def reset(self) -> None:
        self.processed_hashes.clear()
        self.duplicates.clear()
