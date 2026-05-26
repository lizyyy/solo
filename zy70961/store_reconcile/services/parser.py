from __future__ import annotations

import csv
import io
import json
from datetime import datetime
from typing import Any, Dict, List, Tuple


class DataParser:
    """数据解析层 - 处理 CSV/JSON 文件的读取与校验"""

    @staticmethod
    def parse_deposit_csv(csv_content: str, store_id: str) -> List[Dict[str, Any]]:
        deposits: List[Dict[str, Any]] = []

        if not csv_content or not csv_content.strip():
            return deposits

        reader = csv.DictReader(io.StringIO(csv_content))
        for row_num, row in enumerate(reader, start=2):
            try:
                deposit_date = row.get("deposit_date", "").strip() or row.get("日期", "").strip()
                amount_str = row.get("amount", "").strip() or row.get("金额", "").strip()
                deposit_method = row.get("deposit_method", "cash").strip() or row.get("方式", "cash").strip()
                reference_no = row.get("reference_no", "").strip() or row.get("参考号", "").strip()

                if not deposit_date or not amount_str:
                    continue

                amount = float(amount_str.replace(",", ""))

                deposit = {
                    "store_id": store_id,
                    "deposit_date": deposit_date,
                    "amount": amount,
                    "deposit_method": deposit_method,
                    "reference_no": reference_no or None,
                    "raw_data": dict(row),
                }
                deposits.append(deposit)
            except (ValueError, KeyError) as e:
                raise ValueError(f"CSV 第 {row_num} 行解析失败: {str(e)}")

        return deposits

    @staticmethod
    def parse_sales_json(json_content: str, store_id: str) -> List[Dict[str, Any]]:
        sales: List[Dict[str, Any]] = []

        if not json_content or not json_content.strip():
            return sales

        try:
            data = json.loads(json_content)
        except json.JSONDecodeError as e:
            raise ValueError(f"销售 JSON 解析失败: {str(e)}")

        records = data if isinstance(data, list) else data.get("records", data.get("sales", []))

        for idx, record in enumerate(records):
            try:
                sale_date = record.get("sale_date", "").strip() or record.get("日期", "").strip()
                total_amount = float(
                    record.get("total_amount", record.get("总金额", 0))
                )
                cash_amount = float(
                    record.get("cash_amount", record.get("现金金额", 0))
                )
                pos_amount = float(
                    record.get("pos_amount", record.get("POS金额", 0))
                )
                other_amount = float(
                    record.get("other_amount", record.get("其他金额", 0))
                )
                transaction_count = int(
                    record.get("transaction_count", record.get("交易笔数", 0))
                )

                if not sale_date:
                    continue

                sale = {
                    "store_id": store_id,
                    "sale_date": sale_date,
                    "total_amount": total_amount,
                    "cash_amount": cash_amount,
                    "pos_amount": pos_amount,
                    "other_amount": other_amount,
                    "transaction_count": transaction_count,
                    "raw_data": record,
                }
                sales.append(sale)
            except (ValueError, KeyError) as e:
                raise ValueError(f"销售记录第 {idx + 1} 条解析失败: {str(e)}")

        return sales

    @staticmethod
    def parse_petty_cash_json(json_content: str, store_id: str) -> List[Dict[str, Any]]:
        records: List[Dict[str, Any]] = []

        if not json_content or not json_content.strip():
            return records

        try:
            data = json.loads(json_content)
        except json.JSONDecodeError as e:
            raise ValueError(f"备用金 JSON 解析失败: {str(e)}")

        entries = data if isinstance(data, list) else data.get("records", data.get("transactions", []))

        for idx, entry in enumerate(entries):
            try:
                txn_date = entry.get("txn_date", "").strip() or entry.get("日期", "").strip()
                txn_type = entry.get("txn_type", "").strip().lower() or entry.get("类型", "").strip().lower()
                amount = float(entry.get("amount", entry.get("金额", 0)))
                balance_after = float(entry.get("balance_after", entry.get("余额", 0)))
                reference = entry.get("reference", entry.get("参考号", ""))
                description = entry.get("description", entry.get("备注", ""))

                if not txn_date or not txn_type:
                    continue

                valid_types = {"income", "expense", "replenish", "adjust"}
                if txn_type not in valid_types:
                    raise ValueError(f"备用金类型无效: {txn_type}，必须为 {valid_types}")

                record = {
                    "store_id": store_id,
                    "txn_date": txn_date,
                    "txn_type": txn_type,
                    "amount": amount,
                    "balance_after": balance_after,
                    "reference": reference or None,
                    "description": description or None,
                    "raw_data": entry,
                }
                records.append(record)
            except (ValueError, KeyError) as e:
                raise ValueError(f"备用金记录第 {idx + 1} 条解析失败: {str(e)}")

        return records

    @staticmethod
    def validate_date(date_str: str) -> bool:
        try:
            datetime.strptime(date_str, "%Y-%m-%d")
            return True
        except ValueError:
            return False

    @staticmethod
    def validate_batch_data(
        deposits: List[Dict[str, Any]],
        sales: List[Dict[str, Any]],
        petty_cash: List[Dict[str, Any]],
    ) -> Tuple[bool, str]:
        if not deposits and not sales and not petty_cash:
            return False, "至少需要提供一种数据（缴存/销售/备用金）"

        for d in deposits:
            if not DataParser.validate_date(d.get("deposit_date", "")):
                return False, f"缴存日期格式错误: {d.get('deposit_date')}"
            if d.get("amount", 0) < 0:
                return False, f"缴存金额不能为负: {d.get('amount')}"

        for s in sales:
            if not DataParser.validate_date(s.get("sale_date", "")):
                return False, f"销售日期格式错误: {s.get('sale_date')}"
            if s.get("total_amount", 0) < 0:
                return False, f"销售金额不能为负: {s.get('total_amount')}"

        for p in petty_cash:
            if not DataParser.validate_date(p.get("txn_date", "")):
                return False, f"备用金日期格式错误: {p.get('txn_date')}"

        return True, "数据校验通过"
