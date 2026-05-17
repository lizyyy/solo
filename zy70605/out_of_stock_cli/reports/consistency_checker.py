from typing import List, Dict, Any, Tuple

from ..models import (
    Batch,
    OrderItem,
    OutOfStockItem,
    CompensationPlan,
    UserConfirmation,
    SettlementRecord,
    CompensationStatus,
)


class ConsistencyChecker:
    def __init__(
        self,
        batches: List[Batch],
        orders: List[OrderItem],
        out_of_stocks: List[OutOfStockItem],
        plans: List[CompensationPlan],
        confirmations: List[UserConfirmation],
        settlements: List[SettlementRecord],
    ):
        self.batches = batches
        self.orders = orders
        self.out_of_stocks = out_of_stocks
        self.plans = plans
        self.confirmations = confirmations
        self.settlements = settlements

        self.batch_ids = {b.batch_id for b in batches}
        self.order_ids = {o.order_id for o in orders}
        self.plan_ids = {p.plan_id for p in plans}

    def check_all(self) -> Tuple[bool, List[Dict[str, Any]]]:
        issues: List[Dict[str, Any]] = []

        issues.extend(self._check_batch_references())
        issues.extend(self._check_order_references())
        issues.extend(self._check_shortage_consistency())
        issues.extend(self._check_plan_status_consistency())
        issues.extend(self._check_settlement_consistency())

        return len(issues) == 0, issues

    def _check_batch_references(self) -> List[Dict[str, Any]]:
        issues = []

        for oos in self.out_of_stocks:
            if oos.batch_id not in self.batch_ids:
                issues.append(
                    {
                        "level": "ERROR",
                        "type": "批次引用错误",
                        "message": f"缺货记录引用不存在的批次",
                        "batch_id": oos.batch_id,
                        "sku_id": oos.sku_id,
                        "source": f"{oos.source_file}:{oos.source_row}",
                    }
                )

        for plan in self.plans:
            if plan.batch_id not in self.batch_ids:
                issues.append(
                    {
                        "level": "ERROR",
                        "type": "批次引用错误",
                        "message": f"补偿方案引用不存在的批次",
                        "batch_id": plan.batch_id,
                        "plan_id": plan.plan_id,
                        "source": f"{plan.source_file}:{plan.source_row}",
                    }
                )

        return issues

    def _check_order_references(self) -> List[Dict[str, Any]]:
        issues = []

        for plan in self.plans:
            if plan.order_id not in self.order_ids:
                issues.append(
                    {
                        "level": "ERROR",
                        "type": "订单引用错误",
                        "message": f"补偿方案引用不存在的订单",
                        "plan_id": plan.plan_id,
                        "order_id": plan.order_id,
                        "source": f"{plan.source_file}:{plan.source_row}",
                    }
                )

        for conf in self.confirmations:
            if conf.order_id not in self.order_ids:
                issues.append(
                    {
                        "level": "WARNING",
                        "type": "订单引用警告",
                        "message": f"用户确认引用不存在的订单",
                        "confirmation_id": conf.confirmation_id,
                        "order_id": conf.order_id,
                        "source": f"{conf.source_file}:{conf.source_row}",
                    }
                )

        return issues

    def _check_shortage_consistency(self) -> List[Dict[str, Any]]:
        issues = []

        oos_map = {(oos.batch_id, oos.sku_id): oos for oos in self.out_of_stocks}

        for (batch_id, sku_id), oos in oos_map.items():
            total_plan_quantity = sum(
                p.quantity
                for p in self.plans
                if p.batch_id == batch_id and p.sku_id == sku_id
            )

            if total_plan_quantity > oos.shortage_quantity:
                issues.append(
                    {
                        "level": "ERROR",
                        "type": "缺货数量不一致",
                        "message": f"补偿方案总数量超过缺货数量",
                        "batch_id": batch_id,
                        "sku_id": sku_id,
                        "shortage_quantity": oos.shortage_quantity,
                        "plan_quantity": total_plan_quantity,
                    }
                )

        return issues

    def _check_plan_status_consistency(self) -> List[Dict[str, Any]]:
        issues = []

        for plan in self.plans:
            if plan.status == CompensationStatus.PROCESSED:
                has_settlement = any(
                    s.order_id == plan.order_id and s.sku_id == plan.sku_id
                    for s in self.settlements
                )
                if not has_settlement:
                    issues.append(
                        {
                            "level": "WARNING",
                            "type": "状态一致性警告",
                            "message": f"已处理的补偿方案缺少结算记录",
                            "plan_id": plan.plan_id,
                            "status": plan.status.value,
                        }
                    )

        return issues

    def _check_settlement_consistency(self) -> List[Dict[str, Any]]:
        issues = []

        for settlement in self.settlements:
            has_plan = any(
                p.plan_id in self.plan_ids
                and p.order_id == settlement.order_id
                and p.sku_id == settlement.sku_id
                for p in self.plans
            )
            if not has_plan:
                issues.append(
                    {
                        "level": "ERROR",
                        "type": "结算一致性错误",
                        "message": f"结算记录缺少对应补偿方案",
                        "settlement_id": settlement.settlement_id,
                        "order_id": settlement.order_id,
                        "sku_id": settlement.sku_id,
                    }
                )

        return issues
