import csv
import io
import json
from datetime import datetime
from typing import List

from app.schemas import RefundItem, SubsidyItem, SwipeItem


def _parse_datetime(value: str) -> datetime:
    value = value.strip()
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d %H:%M",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(value)
    except Exception:
        raise ValueError(f"无法解析时间字段: {value!r}")


def _float(value) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def parse_swipe_csv(content: str) -> List[SwipeItem]:
    content = content.lstrip("\ufeff")
    reader = csv.DictReader(io.StringIO(content))
    items: List[SwipeItem] = []
    for row in reader:
        items.append(SwipeItem(
            student_id=(row.get("student_id") or row.get("学号") or row.get("studentId") or "").strip(),
            student_name=(row.get("student_name") or row.get("姓名") or row.get("studentName") or "").strip(),
            swipe_time=_parse_datetime(row.get("swipe_time") or row.get("刷卡时间") or row.get("time") or ""),
            meal_type=(row.get("meal_type") or row.get("餐次") or row.get("meal") or "未知").strip(),
            amount=_float(row.get("amount") or row.get("金额") or row.get("price")),
            device=(row.get("device") or row.get("设备") or row.get("terminal") or "").strip(),
        ))
    return items


def parse_subsidy_json(content: str) -> List[SubsidyItem]:
    data = json.loads(content)
    if isinstance(data, dict) and "items" in data:
        data = data["items"]
    if not isinstance(data, list):
        raise ValueError("补贴名单必须是数组或包含 items 的对象")
    items: List[SubsidyItem] = []
    for row in data:
        items.append(SubsidyItem(
            student_id=str(row.get("student_id") or row.get("学号") or "").strip(),
            student_name=str(row.get("student_name") or row.get("姓名") or "").strip(),
            monthly_limit=float(row.get("monthly_limit") or row.get("月补贴上限") or 0),
            subsidy_type=str(row.get("subsidy_type") or row.get("补贴类型") or "").strip(),
            effective_month=str(row.get("effective_month") or row.get("生效月份") or "").strip(),
            note=str(row.get("note") or row.get("备注") or "").strip(),
        ))
    return items


def parse_refund_table(content: str, fmt: str = "csv") -> List[RefundItem]:
    content = content.lstrip("\ufeff")
    items: List[RefundItem] = []
    if fmt == "json":
        data = json.loads(content)
        if isinstance(data, dict) and "items" in data:
            data = data["items"]
        for row in data:
            items.append(RefundItem(
                student_id=str(row.get("student_id") or row.get("学号") or "").strip(),
                refund_time=_parse_datetime(row.get("refund_time") or row.get("退款时间") or ""),
                refund_amount=float(row.get("refund_amount") or row.get("退款金额") or 0),
                related_meal_type=str(row.get("related_meal_type") or row.get("关联餐次") or "").strip(),
                reason=str(row.get("reason") or row.get("原因") or "").strip(),
            ))
        return items
    delim = "\t" if fmt == "tsv" else ","
    reader = csv.DictReader(io.StringIO(content), delimiter=delim)
    for row in reader:
        items.append(RefundItem(
            student_id=(row.get("student_id") or row.get("学号") or "").strip(),
            refund_time=_parse_datetime(row.get("refund_time") or row.get("退款时间") or row.get("time") or ""),
            refund_amount=_float(row.get("refund_amount") or row.get("退款金额") or row.get("amount")),
            related_meal_type=(row.get("related_meal_type") or row.get("关联餐次") or row.get("meal") or "").strip(),
            reason=(row.get("reason") or row.get("原因") or "").strip(),
        ))
    return items
