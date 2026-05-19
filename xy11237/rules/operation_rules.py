from typing import Dict
from .base import BaseRule, RuleResult
from .context import OutboundContext, ReturnContext, InventoryContext
from models import ExceptionType


class OutboundStockValidationRule(BaseRule[OutboundContext]):
    def __init__(self):
        super().__init__("出库库存校验", "检查出库数量是否超过可用库存")

    def apply(self, context: OutboundContext) -> RuleResult:
        inventory_map: Dict[str, float] = {}
        for inv in context.items:
            key = f"{inv.reagent_id}_{inv.batch_no}"
            if key not in inventory_map:
                inventory_map[key] = 0
            inventory_map[key] += inv.available_quantity

        for item in context.outbound.items:
            key = f"{item.reagent_id}_{item.batch_no}"
            available = inventory_map.get(key, 0)
            if item.quantity > available:
                return RuleResult.fail(
                    ExceptionType.INSUFFICIENT_STOCK,
                    f"试剂 {item.reagent_name} 批次 {item.batch_no} 库存不足，出库数量: {item.quantity}, 可用数量: {available}",
                    blocking=True
                )
        return RuleResult.success()


class OutboundQuantityValidationRule(BaseRule[OutboundContext]):
    def __init__(self):
        super().__init__("出库数量校验", "检查出库数量是否合法")

    def apply(self, context: OutboundContext) -> RuleResult:
        for item in context.outbound.items:
            if item.quantity <= 0:
                return RuleResult.fail(
                    ExceptionType.INVALID_QUANTITY,
                    f"试剂 {item.reagent_name} 出库数量必须大于0，当前数量: {item.quantity}",
                    blocking=True
                )
        return RuleResult.success()


class OutboundNotEmptyRule(BaseRule[OutboundContext]):
    def __init__(self):
        super().__init__("出库非空校验", "检查出库单是否包含试剂")

    def apply(self, context: OutboundContext) -> RuleResult:
        if not context.outbound.items:
            return RuleResult.fail(
                ExceptionType.INVALID_QUANTITY,
                "出库单必须包含至少一种试剂",
                blocking=True
            )
        return RuleResult.success()


class ReturnQuantityValidationRule(BaseRule[ReturnContext]):
    def __init__(self):
        super().__init__("归还数量校验", "检查归还数量是否合法")

    def apply(self, context: ReturnContext) -> RuleResult:
        for item in context.return_record.items:
            if item.quantity <= 0:
                return RuleResult.fail(
                    ExceptionType.INVALID_QUANTITY,
                    f"试剂 {item.reagent_name} 归还数量必须大于0，当前数量: {item.quantity}",
                    blocking=True
                )
            if item.remaining_quantity < 0:
                return RuleResult.fail(
                    ExceptionType.INVALID_QUANTITY,
                    f"试剂 {item.reagent_name} 剩余数量不能为负数",
                    blocking=True
                )
        return RuleResult.success()


class ReturnNotEmptyRule(BaseRule[ReturnContext]):
    def __init__(self):
        super().__init__("归还非空校验", "检查归还单是否包含试剂")

    def apply(self, context: ReturnContext) -> RuleResult:
        if not context.return_record.items:
            return RuleResult.fail(
                ExceptionType.INVALID_QUANTITY,
                "归还单必须包含至少一种试剂",
                blocking=True
            )
        return RuleResult.success()


class InventoryDifferenceValidationRule(BaseRule[InventoryContext]):
    def __init__(self):
        super().__init__("盘点差异校验", "检查盘点差异是否合理")

    def apply(self, context: InventoryContext) -> RuleResult:
        for item in context.inventory_record.items:
            if item.system_quantity < 0 or item.actual_quantity < 0:
                return RuleResult.fail(
                    ExceptionType.NEGATIVE_STOCK,
                    f"试剂 {item.reagent_name} 库存数量不能为负数",
                    blocking=True
                )
        return RuleResult.success()


class InventoryNotEmptyRule(BaseRule[InventoryContext]):
    def __init__(self):
        super().__init__("盘点非空校验", "检查盘点单是否包含试剂")

    def apply(self, context: InventoryContext) -> RuleResult:
        if not context.inventory_record.items:
            return RuleResult.fail(
                ExceptionType.INVALID_QUANTITY,
                "盘点单必须包含至少一种试剂",
                blocking=True
            )
        return RuleResult.success()


def create_outbound_rules() -> list:
    return [
        OutboundNotEmptyRule(),
        OutboundQuantityValidationRule(),
        OutboundStockValidationRule(),
    ]


def create_return_rules() -> list:
    return [
        ReturnNotEmptyRule(),
        ReturnQuantityValidationRule(),
    ]


def create_inventory_rules() -> list:
    return [
        InventoryNotEmptyRule(),
        InventoryDifferenceValidationRule(),
    ]
