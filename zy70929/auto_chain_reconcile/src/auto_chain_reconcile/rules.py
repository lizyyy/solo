from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from auto_chain_reconcile.models import (
    InventoryBatch,
    Package,
    ReconcileResult,
    WorkOrder,
)


ITEM_SUBSTITUTES: dict[str, set[str]] = {
    "OIL_0W20": {"OIL_0W20", "OIL_5W30"},
    "OIL_5W30": {"OIL_0W20", "OIL_5W30"},
    "FILTER_OIL": {"FILTER_OIL"},
    "FILTER_AIR": {"FILTER_AIR"},
    "BRAKE_PAD_FR": {"BRAKE_PAD_FR", "BRAKE_PAD_FR_CERAMIC"},
    "BRAKE_PAD_FR_CERAMIC": {"BRAKE_PAD_FR", "BRAKE_PAD_FR_CERAMIC"},
}


@dataclass
class OrderDecision:
    order: dict[str, Any]
    status: str = "normal"
    reason: str = ""
    suggestion: str = ""
    rules: list[str] = field(default_factory=list)
    matched_package_id: str | None = None
    consumed_batches: list[dict[str, Any]] = field(default_factory=list)
    package_used_qty_delta: int = 0
    package_to_consume: Package | None = None
    inventory_delta: dict[int, int] = field(default_factory=dict)  # inventory_batch.id -> delta

    def to_result_row(self, batch_id: int) -> ReconcileResult:
        return ReconcileResult(
            batch_id=batch_id,
            order_id=self.order.get("order_id", ""),
            package_id=self.matched_package_id or "",
            status=self.status,
            reason=self.reason,
            suggestion=self.suggestion,
            raw=json.dumps(self.order, ensure_ascii=False),
            rules=json.dumps(self.rules, ensure_ascii=False),
        )


def _fallback_substitutes(item_code: str) -> set[str]:
    if item_code in ITEM_SUBSTITUTES:
        return ITEM_SUBSTITUTES[item_code]
    return {item_code}


def evaluate_order(
    order: dict[str, Any],
    store_id: str,
    packages: list[Package],
    inventory: list[InventoryBatch],
) -> OrderDecision:
    """
    规则：
    1. 跨店核销：allowed_store 非 '*' 且不等于当前 store_id -> failed
    2. 项目替换：套餐 item_code 与工单 item_code 不在同一替代组 -> pending
    3. 库存扣减：按 part_code 从批次中按入库日期先进先出扣减，不足 -> failed
    4. 套餐剩余次数不足 -> failed
    """
    decision = OrderDecision(order=order)
    order_id = order.get("order_id", "")
    customer_id = order.get("customer_id", "")
    order_item = (order.get("item_code") or "").strip()
    qty = int(order.get("qty") or 1)
    parts = order.get("parts") or []
    if isinstance(parts, str):
        try:
            parts = json.loads(parts)
        except json.JSONDecodeError:
            parts = []
    parts = list(parts)

    candidates = [
        p
        for p in packages
        if p.customer_id == customer_id and (p.total_qty - p.used_qty) > 0
    ]
    if not candidates:
        decision.status = "failed"
        decision.reason = "该客户无可用套餐或次数已用完"
        decision.suggestion = "请为客户补购套餐或单独按工单计费"
        decision.rules.append("PACKAGE_MISSING")
        return decision

    # 同客户下，优先同 item_code；否则找同替代组
    substitutes = _fallback_substitutes(order_item)
    exact = [p for p in candidates if p.item_code == order_item]
    replaceable = [p for p in candidates if p.item_code in substitutes]

    chosen: Package | None = None
    if exact:
        chosen = exact[0]
    elif replaceable:
        chosen = replaceable[0]
        decision.status = "pending"
        decision.reason = f"套餐项目 {chosen.item_code} 与工单项目 {order_item} 需确认替换"
        decision.suggestion = "请店长确认项目替换并在备注中留存客户签字"
        decision.rules.append("ITEM_SUBSTITUTE")
    else:
        decision.status = "pending"
        decision.reason = f"未找到与工单项目 {order_item} 兼容的套餐项目"
        decision.suggestion = "请核对套餐配置或联系总部更新替代关系表"
        decision.rules.append("ITEM_NO_MATCH")
        return decision

    # 跨店校验
    allowed = (chosen.allowed_store or "*").strip()
    if allowed != "*" and allowed != store_id:
        decision.status = "failed"
        decision.reason = (
            f"套餐仅限门店 {allowed} 使用，当前门店 {store_id}（跨店核销）"
        )
        decision.suggestion = (
            "引导客户返回原店核销，或发起跨店审批后在后台手工调整"
        )
        decision.rules.append("CROSS_STORE")
        return decision

    # 套餐剩余次数
    remaining = chosen.total_qty - chosen.used_qty
    if remaining < qty:
        decision.status = "failed"
        decision.reason = f"套餐剩余 {remaining} 次，不足本次核销 {qty} 次"
        decision.suggestion = "拆单核销或引导客户补购"
        decision.rules.append("PACKAGE_QTY_SHORT")
        return decision

    # 库存扣减（先进先出）
    inventory_delta: dict[int, int] = {}
    consumed_batches: list[dict[str, Any]] = []
    for part in parts:
        part_code = (part.get("part_code") or "").strip()
        need = int(part.get("qty") or 1)
        if not part_code:
            continue
        batches = sorted(
            [b for b in inventory if b.part_code == part_code and b.remaining_qty > 0],
            key=lambda b: (b.inbound_date or "", b.id),
        )
        remaining_need = need
        for b in batches:
            take = min(b.remaining_qty, remaining_need)
            if take <= 0:
                continue
            inventory_delta[b.id] = inventory_delta.get(b.id, 0) - take
            b.remaining_qty -= take
            remaining_need -= take
            consumed_batches.append(
                {
                    "part_code": part_code,
                    "batch_no": b.batch_no,
                    "supplier": b.supplier,
                    "inbound_date": b.inbound_date,
                    "qty": take,
                    "store_id": b.store_id,
                }
            )
            if remaining_need == 0:
                break
        if remaining_need > 0:
            decision.status = "failed"
            decision.reason = f"配件 {part_code} 库存不足，缺口 {remaining_need}"
            decision.suggestion = "紧急调拨或先欠料登记，到货后补扣"
            decision.rules.append("INVENTORY_SHORT")
            # 回滚库存扣减
            for b_id, delta in list(inventory_delta.items()):
                invb = next((x for x in inventory if x.id == b_id), None)
                if invb is not None:
                    invb.remaining_qty -= delta
                    inventory_delta[b_id] = 0
            return decision

    # 正常
    decision.matched_package_id = chosen.package_id
    decision.package_to_consume = chosen
    decision.package_used_qty_delta = qty
    decision.inventory_delta = inventory_delta
    decision.consumed_batches = consumed_batches
    if decision.status != "pending":
        decision.status = "normal"
        decision.reason = "套餐/库存/门店全部校验通过"
        decision.suggestion = "按正常流程核销"
        decision.rules.append("OK")
    return decision
