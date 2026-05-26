"""对账引擎：把加项与套餐/协议关联，计算应收、解释差异。"""

from __future__ import annotations

from typing import Dict, Iterable, List, Optional

from .schemas import (
    AdditionRecord,
    Agreement,
    DiffExplanation,
    Package,
    PackageItem,
    ReasonCode,
    ReconciliationItem,
)


# ---------------- 工具 ---------------- #

def _round2(x: float) -> float:
    return round(float(x), 2)


def _coupon_value(coupon: Dict, gross: float) -> float:
    ctype = coupon.get("type", "fixed")
    val = float(coupon.get("value", 0))
    if ctype == "percent":
        return gross * val / 100.0
    return val


def _agreement_map(agreements: Iterable[Agreement]) -> Dict[str, Agreement]:
    return {a.agreement_id: a for a in agreements}


def _package_by_examinee(packages: Iterable[Package]) -> Dict[str, List[Package]]:
    m: Dict[str, List[Package]] = {}
    for p in packages:
        if p.examinee_id not in m:
            m[p.examinee_id] = []
        m[p.examinee_id].append(p)
    return m


def _item_by_code(items: Iterable[PackageItem]) -> Dict[str, PackageItem]:
    return {i.item_code: i for i in items}


# ---------------- 单条加项对账 ---------------- #

def reconcile_one(
    addition: AdditionRecord,
    agreement: Optional[Agreement],
    package: Optional[Package],
) -> ReconciliationItem:
    reasons: List[ReasonCode] = []
    break_down: Dict[str, float] = {}

    gross = _round2(addition.unit_price * addition.qty)
    break_down["gross"] = gross

    # --- 套餐核对：价格 / 数量 / 退项冲正 ---
    pkg_item = None
    if package is not None:
        pkg_item = _item_by_code(package.items).get(addition.item_code)

    refunded_qty = 0
    price_mismatch = False
    qty_mismatch = False
    if pkg_item is not None:
        refunded_qty = pkg_item.refunded_qty
        effective_qty = pkg_item.qty - refunded_qty
        if abs(pkg_item.unit_price - addition.unit_price) > 1e-6:
            price_mismatch = True
            reasons.append(ReasonCode.PRICE_MISMATCH)
        if effective_qty != addition.qty:
            qty_mismatch = True
            reasons.append(ReasonCode.QTY_MISMATCH)
        if refunded_qty > 0:
            reasons.append(ReasonCode.REFUND_REVERSAL)
            break_down["refunded_qty"] = refunded_qty
            break_down["refund_reversal_amount"] = _round2(
                pkg_item.unit_price * refunded_qty
            )

    # 用套餐中更权威的价格作为基准
    base_unit_price = pkg_item.unit_price if pkg_item is not None else addition.unit_price
    base_qty = addition.qty
    effective_gross = _round2(base_unit_price * base_qty)

    # --- 券叠加 --- #
    coupon_discount = 0.0
    coupon_ids = (addition.applied_coupons or "").strip()
    used_coupons: List[Dict] = []
    if coupon_ids and agreement is not None:
        want = {c.strip() for c in coupon_ids.split(",") if c.strip()}
        all_coupons = {c["coupon_id"]: c for c in agreement.coupons}
        stackables = []
        non_stackables = []
        for cid in sorted(want):
            c = all_coupons.get(cid)
            if c is None:
                continue
            if c.get("stackable", True):
                stackables.append(c)
            else:
                non_stackables.append(c)
        # 可叠加的全部按顺序叠加；不可叠加的只取最大折扣
        for c in stackables:
            coupon_discount += _coupon_value(c, effective_gross)
            used_coupons.append(c)
        if non_stackables:
            best = max(non_stackables, key=lambda c: _coupon_value(c, effective_gross))
            coupon_discount += _coupon_value(best, effective_gross)
            used_coupons.append(best)
    coupon_discount = _round2(coupon_discount)
    if coupon_discount > 0:
        reasons.append(ReasonCode.COUPON_STACK)
        break_down["coupon_discount"] = coupon_discount
        break_down["coupons_applied"] = [c["coupon_id"] for c in used_coupons]

    # --- 单位限额 --- #
    limit_clip = 0.0
    if agreement is not None and agreement.per_person_limit is not None:
        after_coupon = effective_gross - coupon_discount
        if after_coupon > agreement.per_person_limit:
            limit_clip = _round2(after_coupon - agreement.per_person_limit)
            reasons.append(ReasonCode.AGREEMENT_LIMIT)
            break_down["per_person_limit"] = agreement.per_person_limit
            break_down["limit_clip"] = limit_clip

    expected = _round2(effective_gross - coupon_discount - limit_clip)

    onsite = addition.onsite_receivable
    if onsite is None:
        onsite = addition.gross_amount
    onsite = _round2(onsite)
    diff = _round2(onsite - expected)

    # 如果 gross / qty / price 都一致，且没有券 / 限额 / 退项，视为无差异
    if not reasons and abs(diff) < 0.01:
        reasons = []

    human = _human_readable(reasons, break_down, expected, onsite, diff)

    return ReconciliationItem(
        addition=addition,
        package=package,
        agreement=agreement,
        expected_amount=expected,
        onsite_amount=onsite,
        diff_amount=diff,
        explanation=DiffExplanation(
            reason_codes=reasons,
            human_readable=human,
            break_down=break_down,
        ),
    )


def _human_readable(
    reasons: List[ReasonCode],
    break_down: Dict[str, float],
    expected: float,
    onsite: float,
    diff: float,
) -> str:
    if not reasons and abs(diff) < 0.01:
        return f"一致：现场应收 {onsite}，系统应收 {expected}。"

    parts: List[str] = []
    if ReasonCode.REFUND_REVERSAL in reasons:
        parts.append(f"退项冲正 {break_down.get('refund_reversal_amount', 0)}")
    if ReasonCode.COUPON_STACK in reasons:
        coupons = break_down.get("coupons_applied", [])
        parts.append(f"券叠加(共 {len(coupons)} 张) 共抵扣 {break_down.get('coupon_discount', 0)}")
    if ReasonCode.AGREEMENT_LIMIT in reasons:
        parts.append(
            f"单位限额 {break_down.get('per_person_limit')}，超出部分 {break_down.get('limit_clip')} 不计收"
        )
    if ReasonCode.PRICE_MISMATCH in reasons:
        parts.append("价格与套餐不符")
    if ReasonCode.QTY_MISMATCH in reasons:
        parts.append("数量与套餐不符")

    summary = f"系统应收 {expected}，现场应收 {onsite}，差额 {diff}。"
    if parts:
        return "；".join(parts) + "。" + summary
    return summary


# ---------------- 批量对账 ---------------- #

def reconcile_all(
    additions: List[AdditionRecord],
    packages: List[Package],
    agreements: List[Agreement],
) -> List[ReconciliationItem]:
    agreemap = _agreement_map(agreements)
    pkgmap = _package_by_examinee(packages)
    items: List[ReconciliationItem] = []
    for a in additions:
        agreement = agreemap.get(a.agreement_id)
        pkgs = pkgmap.get(a.examinee_id, [])
        package = pkgs[0] if pkgs else None
        items.append(reconcile_one(a, agreement, package))
    return items
