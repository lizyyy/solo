from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from store_reconcile.db.database import DatabaseManager


class PettyCashTracer:
    """备用金追溯服务 - 从历史记录中追踪备用金来源和流向"""

    def __init__(self, db_manager: Optional[DatabaseManager] = None):
        self.db = db_manager or DatabaseManager.get_instance()

    def trace_petty_cash(
        self, store_id: str, target_date: str
    ) -> Dict[str, Any]:
        ledger = self.db.get_petty_cash_ledger(
            store_id=store_id,
            end_date=target_date,
        )

        if not ledger:
            return {
                "store_id": store_id,
                "target_date": target_date,
                "current_balance": 0.0,
                "opening_balance": 0.0,
                "total_income": 0.0,
                "total_expense": 0.0,
                "total_replenish": 0.0,
                "total_adjust": 0.0,
                "trace_path": [],
                "earliest_date": None,
            }

        opening_balance = 0.0
        total_income = 0.0
        total_expense = 0.0
        total_replenish = 0.0
        total_adjust = 0.0

        trace_path: List[Dict[str, Any]] = []

        for entry in ledger:
            entry_data = dict(entry)
            txn_type = entry_data.get("txn_type", "")
            amount = entry_data.get("amount", 0)
            txn_date = entry_data.get("txn_date", "")
            balance_after = entry_data.get("balance_after", 0)

            raw_data = {}
            if entry_data.get("raw_data"):
                try:
                    raw_data = json.loads(entry_data["raw_data"])
                except (json.JSONDecodeError, TypeError):
                    raw_data = {}

            node = {
                "txn_date": txn_date,
                "txn_type": txn_type,
                "amount": amount,
                "balance_after": balance_after,
                "reference": entry_data.get("reference"),
                "description": entry_data.get("description"),
                "source_batch_id": entry_data.get("batch_id"),
                "raw_data": raw_data,
            }
            trace_path.append(node)

            if txn_type == "income":
                total_income += amount
            elif txn_type == "expense":
                total_expense += amount
            elif txn_type == "replenish":
                total_replenish += amount
            elif txn_type == "adjust":
                total_adjust += amount

        current_balance = total_income + total_replenish + total_adjust - total_expense

        if trace_path:
            earliest_date = trace_path[0]["txn_date"]
        else:
            earliest_date = None

        return {
            "store_id": store_id,
            "target_date": target_date,
            "current_balance": round(current_balance, 2),
            "opening_balance": round(opening_balance, 2),
            "total_income": round(total_income, 2),
            "total_expense": round(total_expense, 2),
            "total_replenish": round(total_replenish, 2),
            "total_adjust": round(total_adjust, 2),
            "trace_path": trace_path,
            "earliest_date": earliest_date,
        }

    def trace_specific_txn(
        self, store_id: str, txn_id: str
    ) -> Optional[Dict[str, Any]]:
        ledger = self.db.get_petty_cash_ledger(store_id=store_id)

        for entry in ledger:
            entry_data = dict(entry)
            if entry_data.get("txn_id") == txn_id:
                raw_data = {}
                if entry_data.get("raw_data"):
                    try:
                        raw_data = json.loads(entry_data["raw_data"])
                    except (json.JSONDecodeError, TypeError):
                        raw_data = {}

                return {
                    "txn_id": entry_data.get("txn_id"),
                    "store_id": entry_data.get("store_id"),
                    "txn_date": entry_data.get("txn_date"),
                    "txn_type": entry_data.get("txn_type"),
                    "amount": entry_data.get("amount"),
                    "balance_after": entry_data.get("balance_after"),
                    "reference": entry_data.get("reference"),
                    "description": entry_data.get("description"),
                    "source_batch_id": entry_data.get("batch_id"),
                    "raw_data": raw_data,
                }

        return None

    def get_balance_summary(
        self, store_id: str, start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        ledger = self.db.get_petty_cash_ledger(
            store_id=store_id,
            start_date=start_date,
            end_date=end_date,
        )

        if not ledger:
            return {
                "store_id": store_id,
                "start_date": start_date,
                "end_date": end_date,
                "transaction_count": 0,
                "total_income": 0.0,
                "total_expense": 0.0,
                "total_replenish": 0.0,
                "total_adjust": 0.0,
                "net_change": 0.0,
                "opening_balance": 0.0,
                "closing_balance": 0.0,
            }

        total_income = 0.0
        total_expense = 0.0
        total_replenish = 0.0
        total_adjust = 0.0

        for entry in ledger:
            txn_type = entry["txn_type"]
            amount = entry["amount"]

            if txn_type == "income":
                total_income += amount
            elif txn_type == "expense":
                total_expense += amount
            elif txn_type == "replenish":
                total_replenish += amount
            elif txn_type == "adjust":
                total_adjust += amount

        net_change = total_income + total_replenish + total_adjust - total_expense

        sorted_ledger = sorted(ledger, key=lambda x: x["txn_date"])
        opening_balance = sorted_ledger[0].get("balance_after", 0) if sorted_ledger else 0
        closing_balance = sorted_ledger[-1].get("balance_after", 0) if sorted_ledger else 0

        return {
            "store_id": store_id,
            "start_date": start_date,
            "end_date": end_date,
            "transaction_count": len(ledger),
            "total_income": round(total_income, 2),
            "total_expense": round(total_expense, 2),
            "total_replenish": round(total_replenish, 2),
            "total_adjust": round(total_adjust, 2),
            "net_change": round(net_change, 2),
            "opening_balance": round(opening_balance, 2),
            "closing_balance": round(closing_balance, 2),
        }

    def trace_batch_impact(
        self, batch_id: str, store_id: str
    ) -> Dict[str, Any]:
        ledger = self.db.get_petty_cash_ledger(store_id=store_id)

        batch_ledger = [
            entry for entry in ledger
            if entry.get("batch_id") == batch_id
        ]

        if not batch_ledger:
            return {
                "batch_id": batch_id,
                "store_id": store_id,
                "transaction_count": 0,
                "impact": 0.0,
                "details": [],
            }

        impact = 0.0
        details = []

        for entry in batch_ledger:
            entry_data = dict(entry)
            txn_type = entry_data.get("txn_type", "")
            amount = entry_data.get("amount", 0)

            if txn_type in ("income", "replenish", "adjust"):
                impact += amount
            else:
                impact -= amount

            raw_data = {}
            if entry_data.get("raw_data"):
                try:
                    raw_data = json.loads(entry_data["raw_data"])
                except (json.JSONDecodeError, TypeError):
                    raw_data = {}

            details.append({
                "txn_date": entry_data.get("txn_date"),
                "txn_type": txn_type,
                "amount": amount,
                "balance_after": entry_data.get("balance_after"),
                "reference": entry_data.get("reference"),
                "description": entry_data.get("description"),
                "raw_data": raw_data,
            })

        return {
            "batch_id": batch_id,
            "store_id": store_id,
            "transaction_count": len(batch_ledger),
            "impact": round(impact, 2),
            "details": details,
        }
