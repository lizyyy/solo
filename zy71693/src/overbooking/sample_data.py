"""示例数据生成器。

生成符合现实场景的测试数据，包含各种数据质量问题：
- 同名旅客
- 多种日期格式
- 部分延迟数据
- 舱位越界
- 爽约率异常
"""
from __future__ import annotations

import random
import numpy as np
import uuid
from typing import List, Dict, Any, Tuple
from datetime import datetime, date, timedelta

from .models import CabinClass


def generate_flight_date() -> date:
    """生成航班日期（未来7-30天）。"""
    today = date.today()
    days_ahead = random.randint(7, 30)
    return today + timedelta(days=days_ahead)


def generate_sample_flight_info(
    flight_no: str = "CA1234",
    flight_date: date = None
) -> Dict[str, Any]:
    """生成航班基础信息。"""
    if flight_date is None:
        flight_date = generate_flight_date()

    dep_hour = random.randint(6, 22)
    dep_min = random.choice([0, 15, 30, 45])
    scheduled_dep = datetime(
        flight_date.year, flight_date.month, flight_date.day,
        dep_hour, dep_min
    )

    return {
        "flight_no": flight_no,
        "flight_date": flight_date.isoformat(),
        "departure": random.choice(["PEK", "SHA", "CAN", "SZX", "CTU"]),
        "arrival": random.choice(["PEK", "SHA", "CAN", "SZX", "CTU"]),
        "scheduled_departure": scheduled_dep.isoformat(),
        "capacity": {
            "F": random.randint(8, 16),
            "C": random.randint(20, 36),
            "W": random.randint(24, 48),
            "Y": random.randint(150, 220)
        }
    }


def generate_realistic_names(count: int) -> List[str]:
    """生成中文姓名，包含一些同名情况。"""
    surnames = ["王", "李", "张", "刘", "陈", "杨", "赵", "黄", "周", "吴"]
    given_names = ["伟", "芳", "娜", "敏", "静", "强", "磊", "洋", "艳", "勇",
                   "军", "杰", "涛", "明", "超", "秀英", "霞", "平", "刚", "桂英"]

    names = []
    for _ in range(count):
        name = random.choice(surnames) + random.choice(given_names)
        names.append(name)

    duplicate_count = count // 20
    for _ in range(duplicate_count):
        dup_name = random.choice(surnames) + random.choice(given_names)
        names.extend([dup_name, dup_name])

    random.shuffle(names)
    return names[:count]


def generate_sample_orders(
    flight_info: Dict[str, Any],
    count: int = None
) -> List[Dict[str, Any]]:
    """生成航班订单数据，包含现实问题。"""
    total_capacity = sum(flight_info["capacity"].values())
    if count is None:
        count = int(total_capacity * random.uniform(0.85, 0.98))

    names = generate_realistic_names(count)
    date_formats = [
        "%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d",
        "%d/%m/%Y", "%Y年%m月%d日"
    ]

    fares = {
        "F": (3500, 6000),
        "C": (2000, 3500),
        "W": (1200, 2000),
        "Y": (500, 1200)
    }

    orders = []
    passenger_counter = 0

    for i in range(count):
        passenger_counter += 1
        cabin_weights = [
            (CabinClass.FIRST, flight_info["capacity"]["F"] / total_capacity * 1.2),
            (CabinClass.BUSINESS, flight_info["capacity"]["C"] / total_capacity * 1.2),
            (CabinClass.PREMIUM_ECONOMY, flight_info["capacity"]["W"] / total_capacity * 1.1),
            (CabinClass.ECONOMY, flight_info["capacity"]["Y"] / total_capacity * 0.8),
        ]

        cabins, weights = zip(*cabin_weights)
        total_w = sum(weights)
        norm_weights = [w / total_w for w in weights]
        cabin = random.choices(cabins, weights=norm_weights, k=1)[0]

        fare_range = fares[cabin.value]
        fare = round(random.uniform(fare_range[0], fare_range[1]), 2)

        flight_date = flight_info["flight_date"]
        if random.random() < 0.15:
            date_format = random.choice(date_formats)
            try:
                d = date.fromisoformat(flight_date)
                formatted_date = d.strftime(date_format)
            except Exception:
                formatted_date = flight_date
        else:
            formatted_date = flight_date

        booking_date = date.fromisoformat(flight_date) - timedelta(days=random.randint(1, 60))
        if random.random() < 0.1:
            bk_format = random.choice(date_formats)
            booking_date_str = booking_date.strftime(bk_format)
        else:
            booking_date_str = booking_date.isoformat()

        passenger_id = None
        if random.random() < 0.85:
            passenger_id = f"P{passenger_counter:06d}"

        order = {
            "order_id": f"ORD{uuid.uuid4().hex[:8].upper()}",
            "flight_no": flight_info["flight_no"],
            "flight_date": formatted_date,
            "passenger_name": names[i],
            "passenger_id": passenger_id,
            "cabin_class": cabin.value,
            "fare_amount": fare,
            "booking_date": booking_date_str,
            "status": "confirmed"
        }

        if random.random() < 0.03:
            order["cabin_class"] = random.choice(["X", "Z", "U", ""])

        if random.random() < 0.02:
            order["flight_date"] = "invalid-date"

        orders.append(order)

    return orders


def generate_no_show_history(
    count: int = 500,
    base_no_show_rate: float = 0.09
) -> List[Dict[str, Any]]:
    """生成爽约历史数据。"""
    names = generate_realistic_names(count)
    flight_nos = ["CA1234", "CA5678", "MU2345", "MU9876", "CZ3456"]
    date_formats = ["%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y"]

    histories = []
    start_date = date.today() - timedelta(days=365)

    for i in range(count):
        days_back = random.randint(0, 364)
        flight_date = start_date + timedelta(days=days_back)

        if random.random() < 0.2:
            date_format = random.choice(date_formats)
            date_str = flight_date.strftime(date_format)
        else:
            date_str = flight_date.isoformat()

        cabin_tiers = ["Y", "Y", "Y", "Y", "W", "W", "C", "F"]
        tier_rates = {"F": 0.03, "C": 0.05, "W": 0.08, "Y": 0.11}
        cabin = random.choice(cabin_tiers)
        no_show_prob = tier_rates.get(cabin, base_no_show_rate)

        passenger_id = None
        if random.random() < 0.7:
            passenger_id = f"H{i:06d}"

        was_no_show = random.random() < no_show_prob

        reasons = [None, None, None, "行程变更", "突发疾病", "天气原因", "误机"]
        reason = random.choice(reasons) if was_no_show else None

        history = {
            "history_id": f"HIST{i:06d}",
            "passenger_name": names[i],
            "passenger_id": passenger_id,
            "flight_date": date_str,
            "flight_no": random.choice(flight_nos),
            "was_no_show": was_no_show,
            "reason": reason
        }

        if random.random() < 0.05:
            history["passenger_id"] = None

        histories.append(history)

    abnormal_count = int(count * 0.02)
    for i in range(abnormal_count):
        idx = random.randint(0, count - 1)
        histories[idx]["was_no_show"] = random.random() < 0.4

    return histories


def generate_compensation_rules() -> List[Dict[str, Any]]:
    """生成补偿规则。"""
    rules = []

    thresholds = [0, 2, 6, 24, 72]
    compensations = {
        "F": [5000, 4000, 3500, 3000, 2500],
        "C": [3500, 2800, 2400, 2000, 1800],
        "W": [1800, 1500, 1300, 1000, 800],
        "Y": [800, 700, 600, 500, 400]
    }
    vouchers = {
        "F": [2000, 1500, 1000, 800, 500],
        "C": [1500, 1000, 800, 600, 400],
        "W": [800, 600, 500, 400, 300],
        "Y": [400, 300, 250, 200, 150]
    }

    rule_id = 0
    for cabin in ["F", "C", "W", "Y"]:
        for i, threshold in enumerate(thresholds):
            rule = {
                "rule_id": f"RULE_{rule_id:03d}",
                "cabin_class": cabin,
                "threshold_hours": threshold,
                "compensation_amount": compensations[cabin][i],
                "voucher_amount": vouchers[cabin][i],
                "priority_booking": threshold <= 6
            }
            rules.append(rule)
            rule_id += 1

    if random.random() < 0.5:
        rules = [r for r in rules if not (r["cabin_class"] == "W" and r["threshold_hours"] == 0)]

    return rules


def generate_passengers(
    names: List[str] = None,
    count: int = 200
) -> List[Dict[str, Any]]:
    """生成旅客名单。"""
    if names is None:
        names = generate_realistic_names(count)

    tiers = ["basic", "basic", "basic", "basic", "silver", "silver", "gold", "platinum"]

    passengers = []
    for i in range(count):
        tier = random.choice(tiers)
        flight_count = random.randint(0, 100)
        no_show_count = int(np.random.binomial(flight_count, 0.09)) if flight_count > 0 else 0

        passenger = {
            "passenger_id": f"P{i+1:06d}",
            "name": names[i] if i < len(names) else generate_realistic_names(1)[0],
            "phone": f"1{random.choice(['3','5','7','8','9'])}{random.randint(100000000, 999999999)}",
            "email": f"user{i+1}@example.com" if random.random() < 0.7 else None,
            "tier": tier,
            "historical_no_show_count": no_show_count,
            "historical_flight_count": flight_count
        }

        if random.random() < 0.05:
            passenger["phone"] = None

        passengers.append(passenger)

    return passengers


def generate_all_sample_data(
    flight_no: str = "CA1234",
    include_late_data: bool = True
) -> Dict[str, Any]:
    """生成完整的示例数据包。

    Args:
        flight_no: 航班号
        include_late_data: 是否模拟延迟到达的数据

    Returns:
        包含所有数据的字典
    """
    flight_date = generate_flight_date()
    flight_info = generate_sample_flight_info(flight_no, flight_date)
    orders = generate_sample_orders(flight_info)

    passenger_names = [o["passenger_name"] for o in orders]
    passengers = generate_passengers(passenger_names, count=len(orders))

    no_show_history = generate_no_show_history(count=600)
    compensation_rules = generate_compensation_rules()

    main_passengers = passengers[:int(len(passengers) * 0.85)] if include_late_data else passengers
    late_passengers = passengers[int(len(passengers) * 0.85):] if include_late_data else []

    return {
        "flight_info": flight_info,
        "flight_orders": orders,
        "passengers": main_passengers,
        "late_arriving_passengers": late_passengers,
        "no_show_history": no_show_history,
        "compensation_rules": compensation_rules,
        "flight_date": flight_date,
        "flight_no": flight_no
    }


def generate_edge_case_data() -> Dict[str, Any]:
    """生成边缘测试场景数据。"""
    flight_info = generate_sample_flight_info("MU9999")
    flight_info["capacity"] = {"Y": 100, "C": 10, "F": 5, "W": 0}
    flight_info["capacity"]["Y"] = 50

    orders = generate_sample_orders(flight_info, count=48)

    for i in range(10):
        orders[i]["passenger_name"] = "张伟"
        orders[i]["passenger_id"] = None

    orders[0]["cabin_class"] = "Y"
    orders[0]["fare_amount"] = 5000.0

    no_show_history = generate_no_show_history(count=50)
    for h in no_show_history[:25]:
        h["was_no_show"] = True

    compensation_rules = generate_compensation_rules()
    compensation_rules = [r for r in compensation_rules if r["cabin_class"] != "F"]

    return {
        "flight_info": flight_info,
        "flight_orders": orders,
        "passengers": generate_passengers(count=40),
        "no_show_history": no_show_history,
        "compensation_rules": compensation_rules
    }
