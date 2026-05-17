from typing import List, Dict, Set, Tuple

from ..models import (
    Batch,
    OrderItem,
    OutOfStockItem,
    CompensationPlan,
    UserConfirmation,
    BadRow,
)


class DataValidator:
    def validate_all(
        self,
        batches: List[Batch],
        orders: List[OrderItem],
        out_of_stocks: List[OutOfStockItem],
        plans: List[CompensationPlan],
        confirmations: List[UserConfirmation],
    ) -> Tuple[bool, List[str]]:
        errors = []

        batch_ids = {b.batch_id for b in batches}
        order_ids = {o.order_id for o in orders}
        sku_ids = {o.sku_id for o in orders}

        for oos in out_of_stocks:
            if oos.batch_id not in batch_ids:
                errors.append(f"缺货记录批次ID不存在: {oos.batch_id}, SKU: {oos.sku_id}, 行: {oos.source_row}")

        for plan in plans:
            if plan.batch_id not in batch_ids:
                errors.append(f"补偿方案批次ID不存在: {plan.plan_id}, 批次: {plan.batch_id}, 行: {plan.source_row}")
            if plan.order_id not in order_ids:
                errors.append(f"补偿方案订单ID不存在: {plan.plan_id}, 订单: {plan.order_id}, 行: {plan.source_row}")

        for conf in confirmations:
            if conf.order_id not in order_ids:
                errors.append(f"用户确认订单ID不存在: {conf.confirmation_id}, 订单: {conf.order_id}, 行: {conf.source_row}")

        return len(errors) == 0, errors

    def validate_unique_ids(
        self,
        batches: List[Batch],
        orders: List[OrderItem],
        plans: List[CompensationPlan],
        confirmations: List[UserConfirmation],
    ) -> Tuple[bool, List[str]]:
        errors = []

        batch_ids = [b.batch_id for b in batches]
        if len(batch_ids) != len(set(batch_ids)):
            duplicates = self._find_duplicates(batch_ids)
            errors.append(f"批次ID重复: {duplicates}")

        plan_ids = [p.plan_id for p in plans]
        if len(plan_ids) != len(set(plan_ids)):
            duplicates = self._find_duplicates(plan_ids)
            errors.append(f"补偿方案ID重复: {duplicates}")

        conf_ids = [c.confirmation_id for c in confirmations]
        if len(conf_ids) != len(set(conf_ids)):
            duplicates = self._find_duplicates(conf_ids)
            errors.append(f"确认ID重复: {duplicates}")

        return len(errors) == 0, errors

    def _find_duplicates(self, items: List[str]) -> List[str]:
        seen: Set[str] = set()
        duplicates: Set[str] = set()
        for item in items:
            if item in seen:
                duplicates.add(item)
            seen.add(item)
        return sorted(list(duplicates))
