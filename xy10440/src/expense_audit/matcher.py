from decimal import Decimal
from typing import Dict, List, Optional
from expense_audit.models import (
    ExpenseType,
    Itinerary,
    Invoice,
    ExpenseRule,
)


CITY_LEVEL_MAP = {
    "北京": "tier1",
    "上海": "tier1",
    "广州": "tier1",
    "深圳": "tier1",
    "杭州": "tier2",
    "南京": "tier2",
    "成都": "tier2",
    "武汉": "tier2",
    "西安": "tier2",
}


def get_city_level(city: str) -> str:
    return CITY_LEVEL_MAP.get(city, "tier3")


def match_expense_type(invoice: Invoice, itinerary: Itinerary) -> ExpenseType:
    if invoice.expense_type:
        return invoice.expense_type

    desc = (invoice.description or "").lower()
    merchant = (invoice.merchant or "").lower()

    if any(k in desc or k in merchant for k in ["机票", "航空", "火车", "高铁", "打车", "交通", "出租车"]):
        return ExpenseType.TRANSPORTATION
    elif any(k in desc or k in merchant for k in ["酒店", "住宿", "宾馆"]):
        return ExpenseType.ACCOMMODATION
    elif any(k in desc or k in merchant for k in ["餐饮", "餐厅", "饭店"]):
        return ExpenseType.MEAL

    return ExpenseType.OTHER


def find_rule(
    expense_type: ExpenseType,
    arrival_city: str,
    rules: List[ExpenseRule],
) -> Optional[ExpenseRule]:
    city_level = get_city_level(arrival_city)

    for rule in rules:
        if rule.expense_type == expense_type and rule.city_level == city_level:
            return rule

    for rule in rules:
        if rule.expense_type == expense_type and rule.city_level == "default":
            return rule

    return None


def calculate_allowable_amount(
    invoice: Invoice,
    rule: Optional[ExpenseRule],
    days: int = 1,
) -> Decimal:
    if not rule:
        return invoice.amount

    if rule.max_daily_amount:
        return min(invoice.amount, rule.max_daily_amount * days)

    return min(invoice.amount, rule.max_amount)
