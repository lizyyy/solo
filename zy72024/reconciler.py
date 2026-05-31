from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
from collections import defaultdict

from models import Database


class Reconciler:
    def __init__(self, db: Database):
        self.db = db

    def get_period(self, date_str: str) -> str:
        return date_str[:7] if date_str else "unknown"

    def detect_anomalies(self, record: Dict[str, Any], running_balance: float) -> List[str]:
        anomalies = []

        if record["trans_type"] == "usage" and record["amount"] > running_balance:
            anomalies.append(
                f"透支警告: 本次扣费{record['amount']:.2f}超过当前余额{running_balance:.2f}, "
                f"将导致余额为负"
            )

        if record["amount"] <= 0:
            anomalies.append(f"异常金额: {record['amount']:.2f}")

        if record["amount"] > 100000:
            anomalies.append(f"大额交易提醒: {record['amount']:.2f}，请人工复核")

        if record["trans_type"] == "usage" and record["amount"] == 0:
            anomalies.append("使用记录金额为0")

        if not record.get("handler"):
            anomalies.append("缺少经办人信息")

        return anomalies

    def reconcile(self, period: str = None) -> Dict[str, Any]:
        records = self.db.get_all_records(period)
        if not records:
            return {
                "success": False,
                "error": "没有找到记录",
                "running_balance": []
            }

        sorted_records = sorted(records, key=lambda x: (x["trans_date"], x["id"]))

        running_balance = 0.0
        results = []
        warnings = []
        negative_balance_records = []

        total_prepay = 0.0
        total_usage = 0.0

        for idx, record in enumerate(sorted_records):
            record_period = self.get_period(record["trans_date"])

            if period and record_period != period:
                continue

            if record["trans_type"] == "prepay":
                running_balance += record["amount"]
                total_prepay += record["amount"]
            elif record["trans_type"] == "usage":
                running_balance -= record["amount"]
                total_usage += record["amount"]

            anomalies = self.detect_anomalies(record, running_balance + (record["amount"] if record["trans_type"] == "usage" else 0))
            warnings.extend([f"记录{record['id']}: {a}" for a in anomalies])

            status = "matched"
            conflict_detail = None

            if running_balance < 0:
                status = "warning"
                conflict_detail = f"余额为负: {running_balance:.2f}"
                negative_balance_records.append({
                    "record_id": record["id"],
                    "balance": running_balance,
                    "date": record["trans_date"]
                })

            if anomalies:
                if status == "matched":
                    status = "warning"
                conflict_detail = "; ".join(anomalies)

            if not record.get("handler") or not record.get("bill_no"):
                if status == "matched":
                    status = "warning"
                missing = []
                if not record.get("handler"):
                    missing.append("经办人")
                if not record.get("bill_no"):
                    missing.append("单号")
                conflict_detail = (conflict_detail + "; " if conflict_detail else "") + f"缺少字段: {', '.join(missing)}"

            if record.get("warnings"):
                if status == "matched":
                    status = "warning"
                conflict_detail = (conflict_detail + "; " if conflict_detail else "") + f"清洗警告: {record['warnings']}"

            self.db.insert_reconciliation_result(
                record["id"], record_period, running_balance, status, conflict_detail
            )

            results.append({
                "record_id": record["id"],
                "trans_date": record["trans_date"],
                "trans_type": record["trans_type"],
                "amount": record["amount"],
                "running_balance": round(running_balance, 2),
                "status": status,
                "conflict_detail": conflict_detail,
                "source": f"{record['source_file']}:{record['row_number']}"
            })

        summary = self.db.get_balance_summary(period)

        return {
            "success": True,
            "period": period,
            "total_records": len(results),
            "total_prepay": round(total_prepay, 2),
            "total_usage": round(total_usage, 2),
            "final_balance": round(running_balance, 2),
            "matched": summary["matched"] or 0,
            "conflicts": summary["conflicts"] or 0,
            "warnings": summary["warnings"] or 0,
            "pending": summary["pending"] or 0,
            "negative_balance_count": len(negative_balance_records),
            "negative_balance_records": negative_balance_records,
            "warnings_list": warnings,
            "running_balance": results
        }

    def get_record_trace(self, record_id: int) -> Dict[str, Any]:
        record = self.db.get_record_with_source(record_id)
        if not record:
            return {"error": f"记录不存在: {record_id}"}

        notes = self.db.get_record_notes(record_id)
        changes = self.db.get_record_changes(record_id)

        try:
            import json
            raw_data = json.loads(record["raw_data"]) if record["raw_data"] else {}
        except (json.JSONDecodeError, TypeError):
            raw_data = record["raw_data"]

        return {
            "record_id": record_id,
            "standardized": {
                "trans_date": record["trans_date"],
                "trans_type": record["trans_type"],
                "amount": record["amount"],
                "currency": record["currency"],
                "handler": record["handler"],
                "department": record["department"],
                "bill_no": record["bill_no"],
                "remark": record["remark"],
            },
            "source": {
                "file": record["source_file"],
                "sheet": record["sheet_name"],
                "row_number": record["row_number"],
                "raw_data": raw_data,
            },
            "reconciliation": {
                "period": record["period"],
                "prepaid_balance": record["prepaid_balance"],
                "status": record["reconcile_status"],
                "conflict_detail": record["conflict_detail"],
            },
            "notes": notes,
            "change_history": changes
        }

    def compare_reconciliations(self, before_context: Dict[str, Any], after_context: Dict[str, Any]) -> Dict[str, Any]:
        differences = []

        if before_context.get("final_balance") != after_context.get("final_balance"):
            differences.append(
                f"期末余额变化: {before_context.get('final_balance', 0):.2f} -> {after_context.get('final_balance', 0):.2f} "
                f"(差异: {after_context.get('final_balance', 0) - before_context.get('final_balance', 0):.2f})"
            )

        if before_context.get("total_prepay") != after_context.get("total_prepay"):
            differences.append(
                f"预付总额变化: {before_context.get('total_prepay', 0):.2f} -> {after_context.get('total_prepay', 0):.2f}"
            )

        if before_context.get("total_usage") != after_context.get("total_usage"):
            differences.append(
                f"使用总额变化: {before_context.get('total_usage', 0):.2f} -> {after_context.get('total_usage', 0):.2f}"
            )

        before_ids = {r["record_id"] for r in before_context.get("running_balance", [])}
        after_ids = {r["record_id"] for r in after_context.get("running_balance", [])}

        added = after_ids - before_ids
        removed = before_ids - after_ids

        if added:
            differences.append(f"新增记录: {sorted(added)}")
        if removed:
            differences.append(f"移除记录: {sorted(removed)}")

        before_map = {r["record_id"]: r for r in before_context.get("running_balance", [])}
        after_map = {r["record_id"]: r for r in after_context.get("running_balance", [])}

        for rid in before_ids & after_ids:
            b = before_map[rid]
            a = after_map[rid]
            if b["running_balance"] != a["running_balance"]:
                differences.append(
                    f"记录{rid}余额变化: {b['running_balance']:.2f} -> {a['running_balance']:.2f}"
                )
            if b["status"] != a["status"]:
                differences.append(
                    f"记录{rid}状态变化: {b['status']} -> {a['status']}"
                )

        return {
            "has_differences": len(differences) > 0,
            "differences": differences,
            "before_summary": {
                "final_balance": before_context.get("final_balance"),
                "total_records": before_context.get("total_records"),
            },
            "after_summary": {
                "final_balance": after_context.get("final_balance"),
                "total_records": after_context.get("total_records"),
            }
        }

    def get_monthly_summary(self) -> List[Dict[str, Any]]:
        records = self.db.get_all_records()
        monthly = defaultdict(lambda: {"prepay": 0.0, "usage": 0.0, "count": 0})

        for r in records:
            period = self.get_period(r["trans_date"])
            monthly[period]["count"] += 1
            if r["trans_type"] == "prepay":
                monthly[period]["prepay"] += r["amount"]
            else:
                monthly[period]["usage"] += r["amount"]

        result = []
        running_balance = 0.0
        for period in sorted(monthly.keys()):
            data = monthly[period]
            running_balance += data["prepay"] - data["usage"]
            result.append({
                "period": period,
                "record_count": data["count"],
                "prepay": round(data["prepay"], 2),
                "usage": round(data["usage"], 2),
                "net": round(data["prepay"] - data["usage"], 2),
                "running_balance": round(running_balance, 2)
            })

        return result
