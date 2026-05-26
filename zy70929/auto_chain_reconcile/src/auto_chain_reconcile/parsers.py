from __future__ import annotations

import csv
import io
import json
from typing import Any


def parse_packages_csv(raw: str) -> list[dict[str, Any]]:
    """套餐 CSV：package_id,customer_id,customer_name,item_code,item_name,allowed_store,total_qty"""
    reader = csv.DictReader(io.StringIO(raw.strip()))
    out: list[dict[str, Any]] = []
    for row in reader:
        row = {k.strip(): (v.strip() if isinstance(v, str) else v) for k, v in row.items()}
        try:
            row["total_qty"] = int(row.get("total_qty") or 1)
        except ValueError:
            row["total_qty"] = 1
        row["used_qty"] = int(row.get("used_qty") or 0)
        out.append(row)
    return out


def parse_work_orders_json(raw: str) -> list[dict[str, Any]]:
    data = json.loads(raw)
    if isinstance(data, dict):
        if "work_orders" in data:
            return list(data["work_orders"])
        if "orders" in data:
            return list(data["orders"])
        return [data]
    return list(data)


def parse_inventory_csv(raw: str) -> list[dict[str, Any]]:
    """库存 CSV：part_code,part_name,batch_no,supplier,inbound_date,store_id,initial_qty"""
    reader = csv.DictReader(io.StringIO(raw.strip()))
    out: list[dict[str, Any]] = []
    for row in reader:
        row = {k.strip(): (v.strip() if isinstance(v, str) else v) for k, v in row.items()}
        try:
            row["initial_qty"] = int(row.get("initial_qty") or 0)
        except ValueError:
            row["initial_qty"] = 0
        row["remaining_qty"] = row["initial_qty"]
        out.append(row)
    return out
