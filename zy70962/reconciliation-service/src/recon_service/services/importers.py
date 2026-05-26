"""导入适配器：CSV 缴存、JSON 销售、备用金流水。"""
from __future__ import annotations

import csv
import io
import json
from datetime import date, datetime
from typing import Iterable

from ..models import DepositRecord, PettyCashRecord, SalesRecord


# ---------------- 缴存 CSV ----------------

_DEPOSIT_CSV_COLUMNS = {
    "store_id": ["store_id", "门店编号", "门店", "store"],
    "deposit_date": ["deposit_date", "缴存日期", "日期", "date"],
    "amount": ["amount", "缴存金额", "金额", "amount_cny"],
    "reference": ["reference", "流水号", "凭证号", "银行流水号", "ref"],
    "note": ["note", "备注", "说明", "remark"],
}


def _resolve_header(row: dict[str, str], candidates: list[str]) -> str | None:
    keys_lower = {k.strip().lower(): k for k in row.keys()}
    for c in candidates:
        if c.lower() in keys_lower:
            return keys_lower[c.lower()]
    return None


def parse_deposit_csv(text: str) -> list[DepositRecord]:
    """解析缴存 CSV。

    支持中英文表头自动匹配，支持列顺序不固定。
    """
    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        return []

    first = rows[0]
    col_map = {}
    for field, candidates in _DEPOSIT_CSV_COLUMNS.items():
        col_map[field] = _resolve_header(first, candidates)

    if col_map["store_id"] is None or col_map["deposit_date"] is None or col_map["amount"] is None:
        raise ValueError(
            f"缴存 CSV 缺少必要列。找到列: {list(first.keys())}；"
            f"需要: 门店编号/日期/金额"
        )

    out: list[DepositRecord] = []
    for i, row in enumerate(rows, start=2):
        store_id = (row.get(col_map["store_id"]) or "").strip()
        date_str = (row.get(col_map["deposit_date"]) or "").strip()
        amount_str = (row.get(col_map["amount"]) or "").strip()
        if not store_id or not date_str or not amount_str:
            continue
        try:
            d = _parse_date(date_str)
            amount = float(amount_str.replace(",", ""))
        except Exception as exc:
            raise ValueError(f"第 {i} 行数据解析失败: {exc}") from exc
        out.append(
            DepositRecord(
                store_id=store_id,
                deposit_date=d,
                amount=amount,
                reference=(row.get(col_map["reference"]) or "").strip() if col_map["reference"] else "",
                note=(row.get(col_map["note"]) or "").strip() if col_map["note"] else "",
            )
        )
    return out


# ---------------- 销售 JSON ----------------

def parse_sales_json(text: str) -> list[SalesRecord]:
    """解析销售 JSON。

    顶层可以是 list，或 {"sales": [...]}，或 {"data": [...]}.
    """
    obj = json.loads(text)
    if isinstance(obj, dict):
        for key in ("sales", "data", "records", "items"):
            if key in obj and isinstance(obj[key], list):
                obj = obj[key]
                break
    if not isinstance(obj, list):
        raise ValueError("销售 JSON 必须是数组或包含数组的对象")

    out: list[SalesRecord] = []
    for i, row in enumerate(obj):
        if not isinstance(row, dict):
            raise ValueError(f"第 {i} 条销售记录不是对象")
        store_id = str(row.get("store_id") or row.get("门店编号") or "").strip()
        sale_date_raw = row.get("sale_date") or row.get("日期") or row.get("date")
        if not store_id or sale_date_raw is None:
            continue
        try:
            d = _parse_date(sale_date_raw)
        except Exception as exc:
            raise ValueError(f"第 {i} 条销售日期解析失败: {exc}") from exc
        out.append(
            SalesRecord(
                store_id=store_id,
                sale_date=d,
                pos_sales_amount=float(row.get("pos_sales_amount") or row.get("pos金额") or 0),
                cash_sales_amount=float(row.get("cash_sales_amount") or row.get("现金销售") or 0),
                note=str(row.get("note") or row.get("备注") or ""),
            )
        )
    return out


# ---------------- 备用金流水 ----------------

def parse_pettycash_csv(text: str) -> list[PettyCashRecord]:
    """解析备用金流水 CSV。"""
    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        return []

    first = rows[0]
    col_map = {
        "store_id": _resolve_header(first, ["store_id", "门店编号", "门店", "store"]),
        "tx_date": _resolve_header(first, ["tx_date", "日期", "date", "发生日期"]),
        "tx_type": _resolve_header(first, ["tx_type", "收支类型", "类型", "方向"]),
        "amount": _resolve_header(first, ["amount", "金额", "发生额"]),
        "purpose": _resolve_header(first, ["purpose", "用途", "说明", "摘要"]),
        "reference": _resolve_header(first, ["reference", "单号", "凭证号", "ref"]),
    }
    if col_map["store_id"] is None or col_map["tx_date"] is None or col_map["amount"] is None:
        raise ValueError(
            f"备用金 CSV 缺少必要列。找到列: {list(first.keys())}"
        )

    out: list[PettyCashRecord] = []
    for i, row in enumerate(rows, start=2):
        store_id = (row.get(col_map["store_id"]) or "").strip()
        date_str = (row.get(col_map["tx_date"]) or "").strip()
        amount_str = (row.get(col_map["amount"]) or "").strip()
        if not store_id or not date_str or not amount_str:
            continue
        try:
            d = _parse_date(date_str)
            amount = float(amount_str.replace(",", ""))
        except Exception as exc:
            raise ValueError(f"第 {i} 行备用金解析失败: {exc}") from exc
        tx_raw = (row.get(col_map["tx_type"]) or "out").strip().lower() if col_map["tx_type"] else "out"
        tx_type: str = "in" if tx_raw in {"in", "收入", "收回", "收"} else "out"
        out.append(
            PettyCashRecord(
                store_id=store_id,
                tx_date=d,
                tx_type=tx_type,  # type: ignore[arg-type]
                amount=amount,
                purpose=(row.get(col_map["purpose"]) or "").strip() if col_map["purpose"] else "",
                reference=(row.get(col_map["reference"]) or "").strip() if col_map["reference"] else "",
            )
        )
    return out


# ---------------- 工具 ----------------

def _parse_date(raw: str | date | datetime) -> date:
    if isinstance(raw, datetime):
        return raw.date()
    if isinstance(raw, date):
        return raw
    raw = str(raw).strip()
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y%m%d", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    from dateutil import parser as _dparser  # 延迟导入
    return _dparser.parse(raw).date()
