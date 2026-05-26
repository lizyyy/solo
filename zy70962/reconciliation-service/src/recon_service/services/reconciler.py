"""对账引擎：按门店 + 营业日匹配缴存/销售/备用金，生成差异与可读说明。"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from typing import Iterable

from ..config import US_HOLIDAYS_2025_2026
from ..models import (
    Batch,
    BatchStatus,
    DepositRecord,
    Discrepancy,
    DiscrepancyType,
    SalesRecord,
    PettyCashRecord,
)


# ---------------- 核心入口 ----------------

def run_reconciliation(batch: Batch) -> Batch:
    """对批次内三类流水进行比对，重写差异列表。

    规则：
    1. 按门店 + 营业日聚合缴存、销售现金、备用金。
    2. 先标记重复缴存。
    3. 若有销售现金而无缴存：若当日为节假日/周末则标记为 HOLIDAY_DELAY，
       并尝试在接下来 3 个工作日内寻找对应缴存作为匹配；否则 MISSING_DEPOSIT。
    4. 若有缴存而无销售：MISSING_SALES。
    5. 若两边都有：比较金额，差异超过 0.01 时按正负区分 OVER / SHORT。
    6. 备用金：按门店累计收支，若余额异常（例如支出超累计可用额度）标记 PETTY_IMBALANCE。
    """
    discrepancies: list[Discrepancy] = []

    # 聚合
    deposit_by_key: dict[tuple[str, date], list[DepositRecord]] = defaultdict(list)
    for d in batch.deposits:
        deposit_by_key[(d.store_id, d.deposit_date)].append(d)

    sales_by_key: dict[tuple[str, date], SalesRecord] = {}
    for s in batch.sales:
        key = (s.store_id, s.sale_date)
        if key in sales_by_key:
            prev = sales_by_key[key]
            sales_by_key[key] = SalesRecord(
                store_id=prev.store_id,
                sale_date=prev.sale_date,
                pos_sales_amount=prev.pos_sales_amount + s.pos_sales_amount,
                cash_sales_amount=prev.cash_sales_amount + s.cash_sales_amount,
                note=prev.note + " | " + s.note,
            )
        else:
            sales_by_key[key] = s

    all_dates = {d[1] for d in deposit_by_key} | {s[1] for s in sales_by_key}
    all_stores = {d[0] for d in deposit_by_key} | {s[0] for s in sales_by_key}

    # 先标记重复缴存
    for key, lst in deposit_by_key.items():
        if len(lst) > 1:
            for dup in lst:
                discrepancies.append(Discrepancy(
                    type=DiscrepancyType.DUPLICATE,
                    store_id=key[0],
                    biz_date=key[1],
                    deposit_amount=dup.amount,
                    sales_cash_amount=0.0,
                    delta=dup.amount,
                    explanation=(
                        f"门店 {key[0]} 在 {key[1].isoformat()} 存在 {len(lst)} 条缴存记录"
                        f"（流水号 {dup.reference or '未填'}），疑似重复缴存。"
                    ),
                ))

    # 对每个门店+日期进行配对
    used_deposit_keys: set[tuple[str, date]] = set()

    for store in all_stores:
        for d in sorted(all_dates):
            key = (store, d)
            deposits = deposit_by_key.get(key) or []
            sales = sales_by_key.get(key)

            if not deposits and not sales:
                continue

            deposit_amount = sum(d.amount for d in deposits) if deposits else 0.0
            cash_sales = sales.cash_sales_amount if sales else 0.0

            # 有销售现金无缴存 -> 判断是否节假日延迟
            if sales and not deposits:
                expected_biz_date = next_business_date(d, US_HOLIDAYS_2025_2026)
                if _is_holiday_or_weekend(d) and expected_biz_date:
                    # 在后续工作日找对应缴存
                    found, matched = _find_delay_match(
                        store, d, expected_biz_date, deposit_by_key, used_deposit_keys
                    )
                    if found:
                        used_deposit_keys.add(matched)
                        discrepancies.append(Discrepancy(
                            type=DiscrepancyType.HOLIDAY_DELAY,
                            store_id=store,
                            biz_date=d,
                            deposit_amount=sum(dd.amount for dd in deposit_by_key[matched]),
                            sales_cash_amount=cash_sales,
                            delta=sum(dd.amount for dd in deposit_by_key[matched]) - cash_sales,
                            explanation=(
                                f"门店 {store} 在 {d.isoformat()} 有现金销售 ¥{cash_sales:.2f}，"
                                f"当日为{'节假日' if d.isoformat() in US_HOLIDAYS_2025_2026 else '周末'}，"
                                f"缴存推迟至 {matched[1].isoformat()}（下一个工作日），已与当日缴存匹配。"
                            ),
                        ))
                        continue
                discrepancies.append(Discrepancy(
                    type=DiscrepancyType.MISSING_DEPOSIT,
                    store_id=store,
                    biz_date=d,
                    deposit_amount=0.0,
                    sales_cash_amount=cash_sales,
                    delta=-cash_sales,
                    explanation=(
                        f"门店 {store} 在 {d.isoformat()} 有现金销售 ¥{cash_sales:.2f}，"
                        f"但未找到对应缴存记录。请向门店索取银行回单或核实缴存日期。"
                    ),
                ))
                continue

            # 有缴存无销售
            if deposits and not sales:
                if key in used_deposit_keys:
                    continue
                discrepancies.append(Discrepancy(
                    type=DiscrepancyType.MISSING_SALES,
                    store_id=store,
                    biz_date=d,
                    deposit_amount=deposit_amount,
                    sales_cash_amount=0.0,
                    delta=deposit_amount,
                    explanation=(
                        f"门店 {store} 在 {d.isoformat()} 缴存 ¥{deposit_amount:.2f}，"
                        f"但未找到对应 POS 销售数据，请核对销售是否漏报或日期错误。"
                    ),
                ))
                continue

            # 两边都有
            if key in used_deposit_keys:
                # 已经被 HOLIDAY_DELAY 匹配使用过，跳过
                continue
            delta = round(deposit_amount - cash_sales, 2)
            if abs(delta) >= 0.01:
                if delta > 0:
                    d_type = DiscrepancyType.OVER
                    reason = "长款（缴存 > 销售现金）"
                else:
                    d_type = DiscrepancyType.SHORT
                    reason = "短款（缴存 < 销售现金）"
                discrepancies.append(Discrepancy(
                    type=d_type,
                    store_id=store,
                    biz_date=d,
                    deposit_amount=deposit_amount,
                    sales_cash_amount=cash_sales,
                    delta=delta,
                    explanation=(
                        f"门店 {store} 在 {d.isoformat()}：{reason}，"
                        f"缴存 ¥{deposit_amount:.2f} vs 销售现金 ¥{cash_sales:.2f}，"
                        f"差额 ¥{abs(delta):.2f}。需核实是否有零钞差异、漏登销售或多缴存。"
                    ),
                ))

    # 备用金对账
    discrepancies.extend(_reconcile_petty_cash(batch.petty_cash))

    batch.discrepancies = discrepancies
    batch.status = BatchStatus.RECONCILED
    return batch


# ---------------- 备用金 ----------------

def _reconcile_petty_cash(
    records: Iterable[PettyCashRecord],
    expected_opening_balance: float = 0.0,
) -> list[Discrepancy]:
    """按门店累计备用金收支，若出现负余额或流水断档则标记。

    简单策略：
    - 若某门店某天出账后余额 < 0，则记为 PETTY_IMBALANCE。
    - 也支持用户在复核时覆盖期望余额。
    """
    by_store: dict[str, list[PettyCashRecord]] = defaultdict(list)
    for r in records:
        by_store[r.store_id].append(r)

    out: list[Discrepancy] = []
    for store, items in by_store.items():
        items.sort(key=lambda x: x.tx_date)
        bal = expected_opening_balance
        for r in items:
            if r.tx_type == "in":
                bal += r.amount
            else:
                bal -= r.amount
            if bal < -0.001:
                out.append(Discrepancy(
                    type=DiscrepancyType.PETTY_IMBALANCE,
                    store_id=store,
                    biz_date=r.tx_date,
                    delta=bal,  # 负值表示透支
                    explanation=(
                        f"门店 {store} 在 {r.tx_date.isoformat()} 备用金流水出现透支："
                        f"本次{'支出' if r.tx_type == 'out' else '收回'} ¥{abs(r.amount):.2f}，"
                        f"余额 ¥{bal:.2f}（期初 ¥{expected_opening_balance:.2f}）。"
                        f"请核对备用金余额是否在核定范围。"
                    ),
                ))
    return out


# ---------------- 工具 ----------------

def _is_holiday_or_weekend(d: date) -> bool:
    if d.isoformat() in US_HOLIDAYS_2025_2026:
        return True
    return d.weekday() >= 5  # Saturday=5, Sunday=6


def next_business_date(d: date, holidays: set[str]) -> date:
    """返回 d 之后第一个工作日（不包含 d 本身）。"""
    candidate = d + timedelta(days=1)
    for _ in range(10):
        if candidate.isoformat() not in holidays and candidate.weekday() < 5:
            return candidate
        candidate += timedelta(days=1)
    return candidate  # 兜底


def _find_delay_match(
    store: str,
    sale_date: date,
    expected_biz_date: date,
    deposit_by_key: dict[tuple[str, date], list[DepositRecord]],
    used: set[tuple[str, date]],
) -> tuple[bool, tuple[str, date] | None]:
    """在 [expected_biz_date, sale_date+3 工作日] 范围内寻找一笔未使用的缴存。"""
    candidate = expected_biz_date
    end = sale_date + timedelta(days=5)
    while candidate <= end:
        key = (store, candidate)
        if key in deposit_by_key and key not in used:
            return True, key
        candidate += timedelta(days=1)
    return False, None
