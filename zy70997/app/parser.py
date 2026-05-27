import pandas as pd
import json
from typing import List, Dict, Any, Tuple
from io import StringIO, BytesIO
from .schemas import ClaimItem, EmployeeItem, CouponItem


def parse_csv(content: bytes) -> List[Dict[str, Any]]:
    df = pd.read_csv(BytesIO(content), dtype=str)
    df = df.fillna("")
    records = df.to_dict("records")
    return [{k: str(v).strip() if isinstance(v, str) else v for k, v in rec.items()} for rec in records]


def parse_json(content: bytes) -> List[Dict[str, Any]]:
    data = json.loads(content.decode("utf-8"))
    if isinstance(data, dict):
        data = [data]
    return data


def parse_claim_records(records: List[Dict[str, Any]]) -> List[ClaimItem]:
    items = []
    for rec in records:
        item = ClaimItem(
            employee_id=str(rec.get("employee_id", rec.get("工号", "")).strip()),
            employee_name=str(rec.get("employee_name", rec.get("姓名", "")).strip()),
            coupon_code=str(rec.get("coupon_code", rec.get("券码", rec.get("coupon", "")))).strip() or None,
            claim_type=str(rec.get("claim_type", rec.get("福利类型", rec.get("类型", "节日券"))).strip()),
            is_proxy=str(rec.get("is_proxy", rec.get("是否代领", "false"))).lower() in ["true", "1", "是", "yes"],
            proxy_employee_id=str(rec.get("proxy_employee_id", rec.get("代领人工号", ""))).strip() or None,
            proxy_employee_name=str(rec.get("proxy_employee_name", rec.get("代领人姓名", ""))).strip() or None,
            delivery_method=str(rec.get("delivery_method", rec.get("领取方式", "线下领取")).strip()),
            address=str(rec.get("address", rec.get("收货地址", "")).strip()) or None,
            contact_phone=str(rec.get("contact_phone", rec.get("联系电话", "")).strip()) or None,
            remark=str(rec.get("remark", rec.get("备注", "")).strip()) or None
        )
        items.append(item)
    return items


def parse_employees(records: List[Dict[str, Any]]) -> List[EmployeeItem]:
    items = []
    for rec in records:
        item = EmployeeItem(
            employee_id=str(rec.get("employee_id", rec.get("工号", "")).strip()),
            name=str(rec.get("name", rec.get("姓名", "")).strip()),
            department=str(rec.get("department", rec.get("部门", "")).strip()) or None,
            is_active=str(rec.get("is_active", rec.get("在职状态", "true"))).lower() not in ["false", "0", "否", "离职", "no"]
        )
        items.append(item)
    return items


def parse_coupons(records: List[Dict[str, Any]]) -> List[CouponItem]:
    items = []
    for rec in records:
        item = CouponItem(
            coupon_code=str(rec.get("coupon_code", rec.get("券码", "")).strip()),
            coupon_type=str(rec.get("coupon_type", rec.get("类型", rec.get("福利类型", "节日券"))).strip()),
            value=str(rec.get("value", rec.get("面值", "")).strip()) or None
        )
        items.append(item)
    return items


def auto_detect_and_parse(
    content: bytes, filename: str
) -> Tuple[str, List[Dict[str, Any]], List]:
    filename_lower = filename.lower()

    if filename_lower.endswith(".csv"):
        records = parse_csv(content)
    elif filename_lower.endswith(".json"):
        records = parse_json(content)
    else:
        raise ValueError(f"不支持的文件格式: {filename}，请上传 CSV 或 JSON 文件")

    keys = {k.lower() for k in records[0].keys()} if records else set()

    if any(k in keys for k in ["employee_id", "工号"]) and any(k in keys for k in ["name", "姓名"]):
        if "is_active" in keys or "在职状态" in keys or len(keys) <= 5:
            return "employee", records, parse_employees(records)

    if any(k in keys for k in ["coupon_code", "券码"]):
        return "coupon", records, parse_coupons(records)

    return "claim", records, parse_claim_records(records)
