from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple


class ReconcileEngine:
    """对账核心引擎 - 处理门店现金缴存、POS 销售和备用金的每日对账"""

    HOLIDAYS_2025_2026 = {
        "2025-01-01", "2025-02-10", "2025-02-11", "2025-02-12",
        "2025-02-13", "2025-02-14", "2025-02-15", "2025-02-16",
        "2025-02-17", "2025-04-04", "2025-04-05", "2025-04-06",
        "2025-05-01", "2025-05-02", "2025-05-03", "2025-05-04",
        "2025-05-05", "2025-06-22", "2025-10-01", "2025-10-02",
        "2025-10-03", "2025-10-04", "2025-10-05", "2025-10-06",
        "2025-10-07", "2025-10-08",
        "2026-01-01", "2026-01-02", "2026-01-03",
        "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19",
        "2026-02-20", "2026-04-04", "2026-04-05", "2026-04-06",
        "2026-05-01", "2026-05-02", "2026-05-03", "2026-06-19",
        "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04",
        "2026-10-05", "2026-10-06", "2026-10-07",
    }

    TOLERANCE = 0.01

    def __init__(self):
        self._rules: List[str] = [
            "short_over_check",
            "duplicate_deposit_check",
            "holiday_delay_check",
            "missing_sales_check",
            "missing_deposit_check",
            "petty_cash_balance_check",
        ]

    def reconcile(
        self,
        deposits: List[Dict[str, Any]],
        sales: List[Dict[str, Any]],
        petty_cash: List[Dict[str, Any]],
        store_id: str,
        batch_date: str,
    ) -> Dict[str, Any]:
        normal_items: List[Dict[str, Any]] = []
        pending_items: List[Dict[str, Any]] = []
        failed_items: List[Dict[str, Any]] = []

        deposit_map = self._index_by_date(deposits, "deposit_date")
        sales_map = self._index_by_date(sales, "sale_date")

        all_dates = set()
        all_dates.update(deposit_map.keys())
        all_dates.update(sales_map.keys())
        all_dates.add(batch_date)

        processed_dates = set()

        for record_date in sorted(all_dates):
            if record_date in processed_dates:
                continue
            processed_dates.add(record_date)

            day_deposits = deposit_map.get(record_date, [])
            day_sales = sales_map.get(record_date, [])

            result = self._reconcile_single_day(
                store_id=store_id,
                record_date=record_date,
                day_deposits=day_deposits,
                day_sales=day_sales,
                all_deposits=deposits,
                all_sales=sales,
                petty_cash=petty_cash,
                batch_date=batch_date,
            )

            status = result.get("status", "failed")
            if status == "normal":
                normal_items.append(result)
            elif status == "pending":
                pending_items.append(result)
            else:
                failed_items.append(result)

        result = {
            "batch_date": batch_date,
            "total_count": len(normal_items) + len(pending_items) + len(failed_items),
            "normal_count": len(normal_items),
            "pending_count": len(pending_items),
            "failed_count": len(failed_items),
            "normal_items": normal_items,
            "pending_items": pending_items,
            "failed_items": failed_items,
            "summary": {
                "store_id": store_id,
                "batch_date": batch_date,
                "total_deposits": len(deposits),
                "total_sales": len(sales),
                "total_petty_cash": len(petty_cash),
                "rules_applied": self._rules,
            },
        }

        return result

    def _reconcile_single_day(
        self,
        store_id: str,
        record_date: str,
        day_deposits: List[Dict[str, Any]],
        day_sales: List[Dict[str, Any]],
        all_deposits: List[Dict[str, Any]],
        all_sales: List[Dict[str, Any]],
        petty_cash: List[Dict[str, Any]],
        batch_date: str,
    ) -> Dict[str, Any]:
        base_item = {
            "item_id": str(uuid.uuid4()),
            "store_id": store_id,
            "record_date": record_date,
            "status": "normal",
            "category": "daily_reconcile",
            "deposit_amount": None,
            "sales_amount": None,
            "petty_cash_change": None,
            "difference": None,
            "raw_record": {},
            "suggestion": None,
            "error_message": None,
            "rule_matched": [],
        }

        total_deposit = sum(d.get("amount", 0) for d in day_deposits)
        total_sales = sum(s.get("total_amount", 0) for s in day_sales)

        cash_sales = sum(s.get("cash_amount", 0) for s in day_sales)
        petty_cash_today = [
            p for p in petty_cash if p.get("txn_date") == record_date
        ]
        petty_cash_change = sum(
            p.get("amount", 0) if p.get("txn_type") in ("income", "replenish", "adjust")
            else -p.get("amount", 0)
            for p in petty_cash_today
        )

        base_item["deposit_amount"] = total_deposit
        base_item["sales_amount"] = total_sales
        base_item["petty_cash_change"] = petty_cash_change
        base_item["raw_record"] = {
            "deposits": day_deposits,
            "sales": day_sales,
            "petty_cash": petty_cash_today,
        }

        rules_triggered: List[str] = []
        suggestions: List[str] = []
        errors: List[str] = []

        if day_deposits:
            dup_result = self._check_duplicate_deposits(day_deposits, all_deposits)
            if dup_result:
                rules_triggered.append("duplicate_deposit_check")
                suggestions.append(dup_result)
                errors.append("检测到重复缴存")

        short_over_result = self._check_short_over(
            total_deposit, cash_sales, total_sales, petty_cash_change
        )
        if short_over_result:
            rules_triggered.append("short_over_check")
            suggestions.append(short_over_result["suggestion"])
            errors.append(short_over_result["error"])
            base_item["difference"] = short_over_result["difference"]

        holiday_result = self._check_holiday_delay(
            record_date, day_deposits, day_sales, batch_date
        )
        if holiday_result:
            rules_triggered.append("holiday_delay_check")
            if holiday_result["status"] == "pending":
                suggestions.append(holiday_result["suggestion"])
                base_item["status"] = "pending"

        missing_deposit_result = self._check_missing_deposit(
            record_date, day_deposits, day_sales, batch_date
        )
        if missing_deposit_result:
            rules_triggered.append("missing_deposit_check")
            suggestions.append(missing_deposit_result)
            errors.append("缴存记录缺失")

        missing_sales_result = self._check_missing_sales(
            record_date, day_deposits, day_sales
        )
        if missing_sales_result:
            rules_triggered.append("missing_sales_check")
            suggestions.append(missing_sales_result)
            errors.append("销售记录缺失")

        petty_result = self._check_petty_cash_balance(
            store_id, record_date, petty_cash_today, petty_cash
        )
        if petty_result:
            rules_triggered.append("petty_cash_balance_check")
            suggestions.append(petty_result["suggestion"])
            errors.append(petty_result["error"])

        base_item["rule_matched"] = rules_triggered
        base_item["suggestion"] = "; ".join(suggestions) if suggestions else None
        base_item["error_message"] = "; ".join(errors) if errors else None

        if errors and "holiday_delay_check" not in rules_triggered:
            base_item["status"] = "failed"
        elif rules_triggered and base_item["status"] != "pending":
            base_item["status"] = "failed"

        return base_item

    def _check_duplicate_deposits(
        self,
        day_deposits: List[Dict[str, Any]],
        all_deposits: List[Dict[str, Any]],
    ) -> Optional[str]:
        for dep in day_deposits:
            ref = dep.get("reference_no")
            if ref:
                same_ref = [
                    d for d in all_deposits
                    if d.get("reference_no") == ref
                    and d.get("deposit_date") == dep.get("deposit_date")
                ]
                if len(same_ref) > 1:
                    return f"参考号 {ref} 存在重复缴存记录，请核实是否为同一笔款项"

        amounts = [d.get("amount", 0) for d in day_deposits]
        for i, amount in enumerate(amounts):
            if amounts.count(amount) > 1:
                return (
                    f"当日存在金额相同的缴存记录（{amount:.2f}元），"
                    f"请确认是否为重复缴存"
                )
        return None

    def _check_short_over(
        self,
        total_deposit: float,
        cash_sales: float,
        total_sales: float,
        petty_cash_change: float,
    ) -> Optional[Dict[str, Any]]:
        expected_cash = cash_sales + petty_cash_change
        difference = total_deposit - expected_cash

        if abs(difference) < self.TOLERANCE:
            return None

        if difference > 0:
            return {
                "difference": round(difference, 2),
                "error": f"长款 {abs(difference):.2f} 元：缴存金额({total_deposit:.2f}) "
                         f"大于应缴现金销售({cash_sales:.2f})+备用金变动({petty_cash_change:.2f})",
                "suggestion": f"请核实是否有其他收入来源或误收款项，"
                              f"长款部分建议计入待确认收入或退还客户",
            }
        else:
            return {
                "difference": round(difference, 2),
                "error": f"短款 {abs(difference):.2f} 元：缴存金额({total_deposit:.2f}) "
                         f"小于应缴现金销售({cash_sales:.2f})+备用金变动({petty_cash_change:.2f})",
                "suggestion": f"请核实是否存在收银差错、找零错误或备用金支出遗漏，"
                              f"短款部分需门店说明原因并按规定处理",
            }

    def _check_holiday_delay(
        self,
        record_date: str,
        day_deposits: List[Dict[str, Any]],
        day_sales: List[Dict[str, Any]],
        batch_date: str,
    ) -> Optional[Dict[str, Any]]:
        if record_date in self.HOLIDAYS_2025_2026:
            if not day_deposits and day_sales:
                batch_dt = datetime.strptime(batch_date, "%Y-%m-%d")
                record_dt = datetime.strptime(record_date, "%Y-%m-%d")
                days_diff = (batch_dt - record_dt).days

                if days_diff <= 3:
                    return {
                        "status": "pending",
                        "suggestion": f"{record_date} 为节假日，缴存可能延迟到下一个工作日，"
                                      f"建议等待至节后第一个工作日再核实缴存情况",
                    }
                else:
                    return {
                        "status": "failed",
                        "suggestion": f"{record_date} 为节假日，已超过常规延迟时间，"
                                      f"请立即核实缴存情况并联系银行确认",
                    }

        if day_deposits:
            for dep in day_deposits:
                dep_date = dep.get("deposit_date", "")
                if dep_date in self.HOLIDAYS_2025_2026:
                    return {
                        "status": "pending",
                        "suggestion": f"缴存日期 {dep_date} 为节假日，银行处理可能延迟，"
                                      f"建议在工作日确认到账情况",
                    }

        return None

    def _check_missing_deposit(
        self,
        record_date: str,
        day_deposits: List[Dict[str, Any]],
        day_sales: List[Dict[str, Any]],
        batch_date: str,
    ) -> Optional[str]:
        if day_sales and not day_deposits:
            cash_total = sum(s.get("cash_amount", 0) for s in day_sales)
            if cash_total > 0:
                batch_dt = datetime.strptime(batch_date, "%Y-%m-%d")
                record_dt = datetime.strptime(record_date, "%Y-%m-%d")
                if (batch_dt - record_dt).days >= 2:
                    return (
                        f"有现金销售({cash_total:.2f}元)但无缴存记录，"
                        f"请确认是否已缴存或存在延迟缴存情况"
                    )
        return None

    def _check_missing_sales(
        self,
        record_date: str,
        day_deposits: List[Dict[str, Any]],
        day_sales: List[Dict[str, Any]],
    ) -> Optional[str]:
        if day_deposits and not day_sales:
            total = sum(d.get("amount", 0) for d in day_deposits)
            return (
                f"有缴存记录({total:.2f}元)但无对应销售记录，"
                f"请确认销售数据是否完整"
            )
        return None

    def _check_petty_cash_balance(
        self,
        store_id: str,
        record_date: str,
        petty_cash_today: List[Dict[str, Any]],
        all_petty_cash: List[Dict[str, Any]],
    ) -> Optional[Dict[str, Any]]:
        if not petty_cash_today:
            return None

        balance = 0.0
        for p in sorted(all_petty_cash, key=lambda x: x.get("txn_date", "")):
            if p.get("txn_date") <= record_date:
                txn_type = p.get("txn_type", "")
                amount = p.get("amount", 0)
                if txn_type in ("income", "replenish", "adjust"):
                    balance += amount
                else:
                    balance -= amount

        for p in petty_cash_today:
            recorded_balance = p.get("balance_after", 0)
            if recorded_balance and abs(recorded_balance - balance) > self.TOLERANCE:
                return {
                    "error": (
                        f"备用金余额不一致：记录余额 {recorded_balance:.2f}，"
                        f"计算余额 {balance:.2f}，差额 {abs(recorded_balance - balance):.2f}"
                    ),
                    "suggestion": "请核实备用金流水记录，检查是否有遗漏或重复记账",
                }

        return None

    def _index_by_date(
        self, records: List[Dict[str, Any]], date_key: str
    ) -> Dict[str, List[Dict[str, Any]]]:
        result: Dict[str, List[Dict[str, Any]]] = {}
        for r in records:
            date_val = r.get(date_key, "")
            if date_val:
                if date_val not in result:
                    result[date_val] = []
                result[date_val].append(r)
        return result
