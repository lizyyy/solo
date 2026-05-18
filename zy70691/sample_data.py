#!/usr/bin/env python3
import json
from datetime import date, datetime, timedelta
from dataclasses import asdict

from models import (
    Flower, Subscription, DeliverySchedule, ChangeRequest,
    SubscriptionStatus, ChangeType, AdjustmentStatus, PriceDifference, InventoryLog
)


def create_normal_sample():
    print("生成正常样例数据...")
    flowers = [
        Flower("F001", "红玫瑰", 29.9, 100, 10, "供应商A", datetime.now()),
        Flower("F002", "白百合", 35.0, 50, 5, "供应商B", datetime.now()),
        Flower("F003", "向日葵", 18.5, 80, 8, "供应商A", datetime.now()),
        Flower("F004", "康乃馨", 15.0, 120, 15, "供应商C", datetime.now()),
        Flower("F005", "郁金香", 42.0, 30, 3, "供应商B", datetime.now()),
    ]
    subscriptions = [
        Subscription(
            "SUB001", "CUST001", "PLAN_WEEKLY",
            date(2024, 1, 1), date(2024, 12, 31),
            SubscriptionStatus.ACTIVE,
            ["F001", "F002"], 64.9, [], datetime.now()
        ),
        Subscription(
            "SUB002", "CUST002", "PLAN_BIWEEKLY",
            date(2024, 3, 1), date(2024, 6, 30),
            SubscriptionStatus.ACTIVE,
            ["F003"], 18.5, [], datetime.now()
        ),
    ]
    schedules = []
    base_date = date(2024, 5, 1)
    for i in range(10):
        schedules.append(DeliverySchedule(
            f"SCHED{i:03d}", "SUB001", base_date + timedelta(days=i * 7),
            ["F001", "F002"], "delivered" if i < 5 else "scheduled",
            base_date + timedelta(days=i * 7) if i < 5 else None,
            "上海市静安区xxx路xxx号", f"DRIVER{100+i}"
        ))
    for i in range(5):
        schedules.append(DeliverySchedule(
            f"SCHED1{i:02d}", "SUB002", base_date + timedelta(days=i * 14),
            ["F003"], "delivered" if i < 2 else "scheduled",
            base_date + timedelta(days=i * 14) if i < 2 else None,
            "北京市朝阳区xxx路xxx号", f"DRIVER{200+i}"
        ))
    change_requests = []
    price_differences = []
    inventory_logs = []
    executed_requests = {}
    data = {
        "flowers": [asdict(f) for f in flowers],
        "subscriptions": [asdict(s) for s in subscriptions],
        "schedules": [asdict(s) for s in schedules],
        "change_requests": change_requests,
        "price_differences": price_differences,
        "inventory_logs": inventory_logs,
        "executed_requests": executed_requests
    }
    with open("data_normal.json", "w", encoding="utf-8") as f:
        json.dump(data, f, cls=DateTimeEncoder, indent=2, ensure_ascii=False)
    print("正常样例已保存到 data_normal.json")


def create_dirty_data_sample():
    print("生成脏数据样例...")
    flowers = [
        Flower("F001", "红玫瑰", 29.9, 100, 10, "供应商A", datetime.now()),
        Flower("F002", "白百合", 35.0, 0, 5, "供应商B", datetime.now()),
        Flower("F999", "不存在的花", 999, -5, 0, "未知", datetime.now()),
    ]
    subscriptions = [
        Subscription(
            "SUB001", "CUST001", "PLAN_WEEKLY",
            date(2024, 1, 1), date(2024, 12, 31),
            SubscriptionStatus.ACTIVE,
            ["F001", "INVALID_FLOWER"], 64.9, [], datetime.now()
        ),
        Subscription(
            "SUB002", "CUST002", "PLAN_BIWEEKLY",
            date(2025, 1, 1), date(2024, 1, 1),
            SubscriptionStatus.CANCELLED,
            ["F002"], 18.5, [], datetime.now()
        ),
    ]
    schedules = [
        DeliverySchedule(
            "SCHED001", "SUB001", date(2024, 5, 1),
            ["F001", "INVALID_FLOWER"], "unknown_status", None,
            "", ""
        ),
    ]
    data = {
        "flowers": [asdict(f) for f in flowers],
        "subscriptions": [asdict(s) for s in subscriptions],
        "schedules": [asdict(s) for s in schedules],
        "change_requests": [],
        "price_differences": [],
        "inventory_logs": [],
        "executed_requests": {}
    }
    with open("data_dirty.json", "w", encoding="utf-8") as f:
        json.dump(data, f, cls=DateTimeEncoder, indent=2, ensure_ascii=False)
    print("脏数据样例已保存到 data_dirty.json")


def create_conflict_sample():
    print("生成边界冲突样例...")
    flowers = [
        Flower("F001", "红玫瑰", 29.9, 1, 10, "供应商A", datetime.now()),
        Flower("F002", "白百合", 35.0, 1, 5, "供应商B", datetime.now()),
        Flower("F003", "向日葵", 18.5, 0, 8, "供应商A", datetime.now()),
    ]
    pause_history = [
        {"start_date": date(2024, 5, 10), "end_date": date(2024, 5, 20), "request_id": "REQ_OLD"}
    ]
    subscriptions = [
        Subscription(
            "SUB001", "CUST001", "PLAN_WEEKLY",
            date(2024, 1, 1), date(2024, 6, 30),
            SubscriptionStatus.PAUSED,
            ["F001", "F002"], 64.9, pause_history, datetime.now()
        ),
    ]
    schedules = []
    base_date = date(2024, 5, 1)
    for i in range(8):
        schedules.append(DeliverySchedule(
            f"SCHED{i:03d}", "SUB001", base_date + timedelta(days=i * 7),
            ["F001", "F002"], "scheduled", None,
            "上海市静安区xxx路xxx号", f"DRIVER{100+i}"
        ))
    data = {
        "flowers": [asdict(f) for f in flowers],
        "subscriptions": [asdict(s) for s in subscriptions],
        "schedules": [asdict(s) for s in schedules],
        "change_requests": [],
        "price_differences": [],
        "inventory_logs": [],
        "executed_requests": {}
    }
    with open("data_conflict.json", "w", encoding="utf-8") as f:
        json.dump(data, f, cls=DateTimeEncoder, indent=2, ensure_ascii=False)
    print("边界冲突样例已保存到 data_conflict.json")


def create_empty_sample():
    print("生成空结果样例...")
    data = {
        "flowers": [],
        "subscriptions": [],
        "schedules": [],
        "change_requests": [],
        "price_differences": [],
        "inventory_logs": [],
        "executed_requests": {}
    }
    with open("data_empty.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print("空结果样例已保存到 data_empty.json")


class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        if isinstance(obj, (SubscriptionStatus, ChangeType, AdjustmentStatus)):
            return obj.value
        return super().default(obj)


if __name__ == "__main__":
    create_normal_sample()
    create_dirty_data_sample()
    create_conflict_sample()
    create_empty_sample()
    print("\n所有样例数据生成完成!")
    print("  - data_normal.json: 正常业务数据")
    print("  - data_dirty.json: 包含脏数据(库存为负、无效花材、日期颠倒)")
    print("  - data_conflict.json: 边界冲突(库存不足、暂停重叠、已取消订阅)")
    print("  - data_empty.json: 空数据集")
