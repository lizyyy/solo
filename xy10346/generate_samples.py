#!/usr/bin/env python3
from datetime import date, timedelta
import json
import os

today = date.today()

SAMPLES_DIR = os.path.join(os.path.dirname(__file__), "sample_data")
os.makedirs(SAMPLES_DIR, exist_ok=True)

inventory = [
    {
        "batch_id": "BATCH-001",
        "supply_id": "MAT-001",
        "supply_name": "一次性注射器 10ml",
        "quantity": 80,
        "unit": "支",
        "expiry_date": (today + timedelta(days=15)).isoformat()
    },
    {
        "batch_id": "BATCH-002",
        "supply_id": "MAT-001",
        "supply_name": "一次性注射器 10ml",
        "quantity": 120,
        "unit": "支",
        "expiry_date": (today + timedelta(days=180)).isoformat()
    },
    {
        "batch_id": "BATCH-003",
        "supply_id": "MAT-002",
        "supply_name": "一次性手套 L号",
        "quantity": 200,
        "unit": "双",
        "expiry_date": (today - timedelta(days=5)).isoformat()
    },
    {
        "batch_id": "BATCH-004",
        "supply_id": "MAT-002",
        "supply_name": "一次性手套 L号",
        "quantity": 300,
        "unit": "双",
        "expiry_date": (today + timedelta(days=90)).isoformat()
    },
    {
        "batch_id": "BATCH-005",
        "supply_id": "MAT-003",
        "supply_name": "无菌纱布 5x5cm",
        "quantity": 500,
        "unit": "包",
        "expiry_date": (today + timedelta(days=365)).isoformat()
    },
    {
        "batch_id": "BATCH-006",
        "supply_id": "MAT-004",
        "supply_name": "碘伏消毒液",
        "quantity": 50,
        "unit": "瓶",
        "expiry_date": (today + timedelta(days=7)).isoformat()
    }
]

emergency_borrows = [
    {
        "borrow_id": "EMG-001",
        "department_id": "DEPT-002",
        "department_name": "急诊科",
        "supply_id": "MAT-003",
        "supply_name": "无菌纱布 5x5cm",
        "quantity": 50,
        "unit": "包",
        "borrow_date": (today - timedelta(days=3)).isoformat(),
        "expected_return_date": (today + timedelta(days=4)).isoformat(),
        "status": "borrowed",
        "is_replenished": False
    }
]

dept_limits = [
    {
        "department_id": "DEPT-001",
        "department_name": "普通内科",
        "supply_id": "MAT-001",
        "supply_name": "一次性注射器 10ml",
        "monthly_limit": 100,
        "used_amount": 0
    },
    {
        "department_id": "DEPT-001",
        "department_name": "普通内科",
        "supply_id": "MAT-002",
        "supply_name": "一次性手套 L号",
        "monthly_limit": 500,
        "used_amount": 450
    },
    {
        "department_id": "DEPT-002",
        "department_name": "急诊科",
        "supply_id": "MAT-001",
        "supply_name": "一次性注射器 10ml",
        "monthly_limit": 200,
        "used_amount": 0
    },
    {
        "department_id": "DEPT-002",
        "department_name": "急诊科",
        "supply_id": "MAT-003",
        "supply_name": "无菌纱布 5x5cm",
        "monthly_limit": 1000,
        "used_amount": 0
    }
]

with open(os.path.join(SAMPLES_DIR, "sample_inventory.json"), "w", encoding="utf-8") as f:
    json.dump(inventory, f, ensure_ascii=False, indent=2)
with open(os.path.join(SAMPLES_DIR, "sample_emergency_borrows.json"), "w", encoding="utf-8") as f:
    json.dump(emergency_borrows, f, ensure_ascii=False, indent=2)
with open(os.path.join(SAMPLES_DIR, "sample_dept_limits.json"), "w", encoding="utf-8") as f:
    json.dump(dept_limits, f, ensure_ascii=False, indent=2)

print("样例数据已生成:")
print(f"  - {os.path.join(SAMPLES_DIR, 'sample_dept_limits.json')}")
print(f"  - {os.path.join(SAMPLES_DIR, 'sample_inventory.json')}")
print(f"  - {os.path.join(SAMPLES_DIR, 'sample_emergency_borrows.json')}")
print(f"\n日期说明 (基于今天 {today}):")
print(f"  - BATCH-001 (MAT-001): 15天后过期 (效期预警)")
print(f"  - BATCH-003 (MAT-002): 已过期5天 (禁止使用)")
print(f"  - BATCH-006 (MAT-004): 7天后过期 (效期预警)")
print(f"  - EMG-001: 急诊科3天前借用，尚未补单")
print(f"\n业务场景:")
print("  1. 普通内科申领手套(已用450/限额500)，申领100将超限额")
print("  2. 急诊科申领纱布，存在未补单借用记录")
print("  3. BATCH-001即将过期，发放时优先使用")
