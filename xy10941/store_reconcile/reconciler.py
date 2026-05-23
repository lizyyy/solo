import pandas as pd
from datetime import timedelta
import hashlib


class Reconciler:
    def __init__(self, time_window=timedelta(minutes=5), amount_tolerance=0.01, verbose=False):
        self.time_window = time_window
        self.amount_tolerance = amount_tolerance
        self.verbose = verbose

    def _deduplicate(self, df, source_type):
        df = df.copy()
        df["match_key"] = df.apply(
            lambda x: hashlib.md5(
                f"{x['trade_no']}_{x['amount']}_{x['time'].isoformat()}_{x['is_refund']}".encode()
            ).hexdigest()[:16],
            axis=1
        )
        
        duplicates = df[df.duplicated("match_key", keep=False)]
        deduped = df.drop_duplicates("match_key", keep="first").reset_index(drop=True)
        
        duplicate_info = []
        if not duplicates.empty:
            for key in duplicates["match_key"].unique():
                dup_rows = duplicates[duplicates["match_key"] == key]
                duplicate_info.append({
                    "source": source_type,
                    "match_key": key,
                    "trade_no": dup_rows.iloc[0]["trade_no"],
                    "amount": dup_rows.iloc[0]["amount"],
                    "time": dup_rows.iloc[0]["time"],
                    "count": len(dup_rows),
                    "rows": [f"{r['file']}:{r['row']}" for _, r in dup_rows.iterrows()]
                })
        
        return deduped, duplicate_info

    def _match_records(self, cash_df, payment_df):
        matched = []
        cash_used = set()
        payment_used = set()
        
        for cash_idx, cash_row in cash_df.iterrows():
            best_match = None
            best_time_diff = None
            
            for pay_idx, pay_row in payment_df.iterrows():
                if pay_idx in payment_used:
                    continue
                
                if cash_row["is_refund"] != pay_row["is_refund"]:
                    continue
                
                if abs(cash_row["amount"] - pay_row["amount"]) > self.amount_tolerance:
                    continue
                
                time_diff = abs((cash_row["time"] - pay_row["time"]).total_seconds())
                if time_diff > self.time_window.total_seconds():
                    continue
                
                if best_time_diff is None or time_diff < best_time_diff:
                    best_time_diff = time_diff
                    best_match = pay_idx
            
            if best_match is not None:
                cash_used.add(cash_idx)
                payment_used.add(best_match)
                
                pay_row = payment_df.iloc[best_match]
                matched.append({
                    "cash_trade_no": cash_row["trade_no"],
                    "payment_trade_no": pay_row["trade_no"],
                    "amount": cash_row["amount"],
                    "cash_time": cash_row["time"],
                    "payment_time": pay_row["time"],
                    "time_diff_seconds": best_time_diff,
                    "is_refund": cash_row["is_refund"],
                    "cash_source": f"{cash_row['file']}:{cash_row['row']}",
                    "payment_source": f"{pay_row['file']}:{pay_row['row']}",
                    "platform": pay_row["platform"]
                })
        
        return matched, cash_used, payment_used

    def _identify_difference_reason(self, row, other_df, source_type):
        amount = row["amount"]
        time = row["time"]
        is_refund = row["is_refund"]
        
        amount_matches = other_df[
            (other_df["is_refund"] == is_refund) &
            (abs(other_df["amount"] - amount) <= self.amount_tolerance)
        ]
        
        if amount_matches.empty:
            if is_refund:
                return "退款记录在对方系统不存在"
            return "金额不匹配"
        
        time_matches = amount_matches[
            abs((amount_matches["time"] - time).dt.total_seconds()) <= self.time_window.total_seconds()
        ]
        
        if time_matches.empty:
            if is_refund:
                return "退款时间差异超出窗口"
            return "时间差异超出窗口"
        
        return "订单号不匹配"

    def reconcile(self, cash_df, payment_df, store_id):
        if self.verbose:
            print("  执行去重处理...")
        
        cash_deduped, cash_duplicates = self._deduplicate(cash_df, "cashier")
        payment_deduped, payment_duplicates = self._deduplicate(payment_df, "payment")
        
        all_duplicates = cash_duplicates + payment_duplicates
        
        if self.verbose:
            print(f"  收银去重后: {len(cash_deduped)} 条")
            print(f"  支付去重后: {len(payment_deduped)} 条")
            print("  执行记录匹配...")
        
        matched, cash_used, payment_used = self._match_records(cash_deduped, payment_deduped)
        
        unmatched_cash = []
        for idx, row in cash_deduped.iterrows():
            if idx not in cash_used:
                reason = self._identify_difference_reason(row, payment_deduped, "cash")
                unmatched_cash.append({
                    "trade_no": row["trade_no"],
                    "amount": row["amount"],
                    "time": row["time"],
                    "is_refund": row["is_refund"],
                    "store_id": row["store_id"],
                    "source": f"{row['file']}:{row['row']}",
                    "reason": reason
                })
        
        unmatched_payment = []
        for idx, row in payment_deduped.iterrows():
            if idx not in payment_used:
                reason = self._identify_difference_reason(row, cash_deduped, "payment")
                unmatched_payment.append({
                    "trade_no": row["trade_no"],
                    "amount": row["amount"],
                    "time": row["time"],
                    "is_refund": row["is_refund"],
                    "platform": row["platform"],
                    "source": f"{row['file']}:{row['row']}",
                    "reason": reason
                })
        
        summary = self._generate_summary(
            cash_df, payment_df, cash_deduped, payment_deduped,
            matched, unmatched_cash, unmatched_payment, all_duplicates, store_id
        )
        
        return {
            "store_id": store_id,
            "summary": summary,
            "matched": matched,
            "unmatched_cash": unmatched_cash,
            "unmatched_payment": unmatched_payment,
            "duplicates": all_duplicates,
            "cash_raw_count": len(cash_df),
            "payment_raw_count": len(payment_df),
            "cash_deduped_count": len(cash_deduped),
            "payment_deduped_count": len(payment_deduped)
        }

    def _generate_summary(self, cash_df, payment_df, cash_deduped, payment_deduped,
                         matched, unmatched_cash, unmatched_payment, duplicates, store_id):
        matched_payments = sum(1 for m in matched if not m["is_refund"])
        matched_refunds = sum(1 for m in matched if m["is_refund"])
        
        cash_amount = cash_deduped[~cash_deduped["is_refund"]]["amount"].sum()
        cash_refund_amount = cash_deduped[cash_deduped["is_refund"]]["amount"].sum()
        
        pay_amount = payment_deduped[~payment_deduped["is_refund"]]["amount"].sum()
        pay_refund_amount = payment_deduped[payment_deduped["is_refund"]]["amount"].sum()
        
        matched_amount = sum(m["amount"] for m in matched if not m["is_refund"])
        matched_refund_amount = sum(m["amount"] for m in matched if m["is_refund"])
        
        unmatched_cash_amount = sum(r["amount"] for r in unmatched_cash if not r["is_refund"])
        unmatched_cash_refund_amount = sum(r["amount"] for r in unmatched_cash if r["is_refund"])
        
        unmatched_pay_amount = sum(r["amount"] for r in unmatched_payment if not r["is_refund"])
        unmatched_pay_refund_amount = sum(r["amount"] for r in unmatched_payment if r["is_refund"])
        
        return {
            "store_id": store_id,
            "raw_records": {
                "cashier": len(cash_df),
                "payment": len(payment_df)
            },
            "after_dedup": {
                "cashier": len(cash_deduped),
                "payment": len(payment_deduped)
            },
            "duplicates": {
                "total": len(duplicates),
                "cashier": len([d for d in duplicates if d["source"] == "cashier"]),
                "payment": len([d for d in duplicates if d["source"] == "payment"])
            },
            "matched": {
                "total": len(matched),
                "payments": matched_payments,
                "refunds": matched_refunds,
                "amount": matched_amount,
                "refund_amount": matched_refund_amount
            },
            "unmatched": {
                "cashier": {
                    "total": len(unmatched_cash),
                    "payments": len([r for r in unmatched_cash if not r["is_refund"]]),
                    "refunds": len([r for r in unmatched_cash if r["is_refund"]]),
                    "amount": unmatched_cash_amount,
                    "refund_amount": unmatched_cash_refund_amount
                },
                "payment": {
                    "total": len(unmatched_payment),
                    "payments": len([r for r in unmatched_payment if not r["is_refund"]]),
                    "refunds": len([r for r in unmatched_payment if r["is_refund"]]),
                    "amount": unmatched_pay_amount,
                    "refund_amount": unmatched_pay_refund_amount
                }
            },
            "amount_summary": {
                "cashier_total": cash_amount,
                "cashier_refund_total": cash_refund_amount,
                "cashier_net": cash_amount - cash_refund_amount,
                "payment_total": pay_amount,
                "payment_refund_total": pay_refund_amount,
                "payment_net": pay_amount - pay_refund_amount,
                "difference": (cash_amount - cash_refund_amount) - (pay_amount - pay_refund_amount)
            },
            "reason_stats": {
                "cashier": self._count_reasons(unmatched_cash),
                "payment": self._count_reasons(unmatched_payment)
            }
        }

    def _count_reasons(self, records):
        stats = {}
        for r in records:
            reason = r["reason"]
            stats[reason] = stats.get(reason, 0) + 1
        return stats
