"""导入器：把 CSV / JSON 解析成领域对象。"""

from __future__ import annotations

import csv
import io
import json
from typing import List

from .schemas import AdditionRecord, Agreement, Package, PackageItem


# ---------------- CSV 加项 ---------------- #

def parse_additions_csv(raw: str) -> List[AdditionRecord]:
    """解析加项 CSV。

    必填列：addition_id, examinee_id, examinee_name, agreement_id,
    item_code, item_name, unit_price, qty, gross_amount
    可选列：onsite_receivable, applied_coupons
    """
    reader = csv.DictReader(io.StringIO(raw))
    records: List[AdditionRecord] = []
    for row in reader:
        records.append(
            AdditionRecord(
                addition_id=row["addition_id"].strip(),
                examinee_id=row["examinee_id"].strip(),
                examinee_name=row["examinee_name"].strip(),
                agreement_id=row["agreement_id"].strip(),
                item_code=row["item_code"].strip(),
                item_name=row["item_name"].strip(),
                unit_price=float(row["unit_price"] or 0),
                qty=int(row["qty"] or 0),
                gross_amount=float(row["gross_amount"] or 0),
                onsite_receivable=(
                    float(row["onsite_receivable"]) if row.get("onsite_receivable") else None
                ),
                applied_coupons=row.get("applied_coupons") or None,
            )
        )
    return records


# ---------------- JSON 套餐 ---------------- #

def parse_packages_json(raw: str) -> List[Package]:
    data = json.loads(raw)
    packages: List[Package] = []
    for p in data:
        items = [
            PackageItem(
                item_code=i["item_code"],
                item_name=i["item_name"],
                unit_price=float(i["unit_price"]),
                qty=int(i.get("qty", 1)),
                refunded_qty=int(i.get("refunded_qty", 0)),
            )
            for i in p["items"]
        ]
        packages.append(
            Package(
                package_id=p["package_id"],
                examinee_id=p["examinee_id"],
                examinee_name=p["examinee_name"],
                agreement_id=p["agreement_id"],
                items=items,
            )
        )
    return packages


# ---------------- JSON 单位协议 ---------------- #

def parse_agreements_json(raw: str) -> List[Agreement]:
    data = json.loads(raw)
    agreements: List[Agreement] = []
    for a in data:
        agreements.append(
            Agreement(
                agreement_id=a["agreement_id"],
                company_name=a["company_name"],
                per_person_limit=(
                    float(a["per_person_limit"]) if a.get("per_person_limit") is not None else None
                ),
                company_total_limit=(
                    float(a["company_total_limit"])
                    if a.get("company_total_limit") is not None
                    else None
                ),
                coupons=list(a.get("coupons", [])),
            )
        )
    return agreements
