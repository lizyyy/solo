#!/usr/bin/env python3
"""生成样例数据: 正常数据、脏数据、边界冲突、空结果"""

import json
from pathlib import Path
from datetime import date, datetime, timedelta
import uuid

from pet_med_cli.store import DataStore
from pet_med_cli.service import MedicationService


def generate_normal_data():
    """生成正常业务场景数据"""
    print("📦 生成正常数据...")
    store = DataStore("./data/normal")
    store.clear_all()
    service = MedicationService(store)

    pet1 = service.create_pet(
        name="旺财",
        pet_type="dog",
        owner_name="张三",
        owner_phone="13800138000",
        breed="金毛",
        age=3.5,
        weight_kg=25.0
    )
    print(f"  创建宠物: {pet1.pet_id}")

    order1 = service.create_order(
        pet_id=pet1.pet_id,
        checkin_date=date.today() - timedelta(days=3),
        checkout_date=date.today() + timedelta(days=4),
        room_number="A01"
    )
    print(f"  创建订单: {order1.order_id}")

    plan1 = service.create_medication_plan(
        order_id=order1.order_id,
        pet_id=pet1.pet_id,
        start_date=date.today() - timedelta(days=3),
        medication_name="阿莫西林",
        dosage_amount="500",
        dosage_unit="mg",
        frequency="twice_daily",
        route="口服",
        created_by="李护士"
    )
    print(f"  创建计划: {plan1.plan_id}")

    for i in range(3):
        shift_date = date.today() - timedelta(days=3 - i)
        service.record_shift_execution(
            plan_id=plan1.plan_id,
            shift_date=shift_date,
            shift_type="morning",
            status="administered",
            executed_by="早班护士",
            notes=f"第{i+1}天早班喂药"
        )
        service.record_shift_execution(
            plan_id=plan1.plan_id,
            shift_date=shift_date,
            shift_type="evening",
            status="administered",
            executed_by="晚班护士"
        )
    print(f"  创建6条班次记录")

    change, msg = service.update_dosage(
        plan_id=plan1.plan_id,
        dosage_amount="250",
        requested_by="王医生"
    )
    if change:
        print(f"  创建变更: {change.change_id}")
        service.confirm_change(change.change_id, "张店长")
        print(f"  确认变更生效")

    shift_date = date.today() - timedelta(days=0)
    service.record_shift_execution(
        plan_id=plan1.plan_id,
        shift_date=shift_date,
        shift_type="morning",
        status="administered",
        executed_by="早班护士",
        notes="按新剂量执行"
    )

    print("✅ 正常数据生成完成")


def generate_dirty_data():
    """生成脏数据(用于验证数据校验)"""
    print("\n📦 生成脏数据...")
    data_dir = Path("./data/dirty")
    data_dir.mkdir(exist_ok=True)

    dirty_pets = {
        "PET-INVALID-001": {
            "pet_id": "PET-INVALID-001",
            "name": "缺失字段的宠物",
            "type": "invalid_type",
            "owner_name": "测试",
            "owner_phone": "123",
            "created_at": datetime.now().isoformat()
        },
        "PET-INVALID-002": {
            "pet_id": "PET-INVALID-002",
            "name": None,
            "type": "cat",
            "age": "不是数字"
        }
    }
    with open(data_dir / "pets.json", "w") as f:
        json.dump(dirty_pets, f)

    dirty_orders = {
        "ORD-INVALID-001": {
            "order_id": "ORD-INVALID-001",
            "pet_id": "PET-NOT-EXISTS",
            "checkin_date": "2024-13-01",
            "checkout_date": "2024-01-01"
        }
    }
    with open(data_dir / "orders.json", "w") as f:
        json.dump(dirty_orders, f)

    dirty_plans = {
        "PLAN-INVALID-001": {
            "plan_id": "PLAN-INVALID-001",
            "order_id": "ORD-XXX",
            "pet_id": "PET-XXX",
            "start_date": "invalid-date",
            "dosage_versions": "not-a-list",
            "current_version": 999
        }
    }
    with open(data_dir / "plans.json", "w") as f:
        json.dump(dirty_plans, f)

    dirty_executions = {
        "EXEC-INVALID-001": {
            "execution_id": "EXEC-INVALID-001",
            "plan_id": "PLAN-XXX",
            "shift_date": "not-a-date",
            "shift_type": "invalid_shift",
            "status": "unknown_status"
        }
    }
    with open(data_dir / "executions.json", "w") as f:
        json.dump(dirty_executions, f)

    dirty_changes = {
        "CHG-INVALID-001": {
            "change_id": "CHG-INVALID-001",
            "plan_id": "PLAN-XXX",
            "field_changed": None,
            "old_value": "100",
            "new_value": "200",
            "status": "invalid_status"
        }
    }
    with open(data_dir / "changes.json", "w") as f:
        json.dump(dirty_changes, f)

    print("✅ 脏数据生成完成")


def generate_boundary_data():
    """生成边界冲突数据"""
    print("\n📦 生成边界冲突数据...")
    store = DataStore("./data/boundary")
    store.clear_all()

    pet = store.save_pet({
        "pet_id": "PET-BOUNDARY-001",
        "name": "边界测试",
        "type": "cat",
        "owner_name": "测试主人",
        "owner_phone": "1234567890",
        "created_at": datetime.now().isoformat()
    })

    order = store.save_order({
        "order_id": "ORD-BOUNDARY-001",
        "pet_id": "PET-BOUNDARY-001",
        "checkin_date": str(date.today()),
        "checkout_date": str(date.today() + timedelta(days=7)),
        "created_at": datetime.now().isoformat()
    })

    plan = {
        "plan_id": "PLAN-BOUNDARY-001",
        "order_id": "ORD-BOUNDARY-001",
        "pet_id": "PET-BOUNDARY-001",
        "start_date": str(date.today()),
        "dosage_versions": [{
            "version": 1,
            "medication_name": "测试药",
            "dosage_amount": "100",
            "dosage_unit": "mg",
            "frequency": "daily",
            "route": "口服",
            "created_by": "测试人",
            "created_at": datetime.now().isoformat()
        }],
        "current_version": 1,
        "is_active": True,
        "created_at": datetime.now().isoformat()
    }
    store.save_medication_plan(plan)

    same_change = {
        "change_id": "CHG-BOUNDARY-001",
        "plan_id": "PLAN-BOUNDARY-001",
        "field_changed": "dosage_amount",
        "old_value": "100",
        "new_value": "200",
        "requested_by": "测试人",
        "requested_at": datetime.now().isoformat(),
        "status": "pending",
        "change_hash": ""
    }

    saved_id = store.save_change_record(same_change)
    print(f"  创建变更1: {saved_id}")

    same_change["change_id"] = "CHG-BOUNDARY-002"
    saved_id2 = store.save_change_record(same_change)
    print(f"  重复变更(幂等测试): {saved_id2} (应为None)")

    for i in range(5):
        exec_data = {
            "execution_id": f"EXEC-BOUNDARY-{i:03d}",
            "plan_id": "PLAN-BOUNDARY-001",
            "shift_date": str(date.today()),
            "shift_type": "morning",
            "status": "administered",
            "dosage_version_at_execution": 1,
            "created_at": datetime.now().isoformat()
        }
        store.save_shift_execution(exec_data)
    print(f"  创建5条同一班次重复记录")

    print("✅ 边界冲突数据生成完成")


def generate_empty_data():
    """生成空结果场景"""
    print("\n📦 生成空数据...")
    store = DataStore("./data/empty")
    store.clear_all()
    print("✅ 空数据生成完成(所有表为空)")


def show_usage_guide():
    """显示使用说明"""
    print("\n" + "=" * 60)
    print("📖 使用说明")
    print("=" * 60)
    print("""
正常业务流程示例:

1. 验证CLI基本操作
   python -m pet_med_cli pet create --name 旺财 --type dog --owner 张三 --phone 13800138000
   python -m pet_med_cli pet list

2. 数据验证测试(脏数据)
   python -m pet_med_cli validate --data-dir ./data/dirty

3. 检查漏喂告警
   python -m pet_med_cli shift check-missed

4. 变更确认流程
   python -m pet_med_cli plan update --plan-id PLAN-XXX --amount 250 --by 医生
   python -m pet_med_cli change pending
   python -m pet_med_cli change confirm --change-id CHG-XXX --by 店长

5. 生成护理报告
   python -m pet_med_cli report generate --order-id ORD-XXX --start 2024-01-01 --end 2024-01-07 --export

6. 各数据目录说明
   ./data/normal/   - 正常业务数据
   ./data/dirty/    - 脏数据(验证用)
   ./data/boundary/ - 边界冲突数据
   ./data/empty/    - 空数据
""")


if __name__ == "__main__":
    print("🎯 宠物店喂药系统样例数据生成工具")
    print("=" * 50)

    generate_normal_data()
    generate_dirty_data()
    generate_boundary_data()
    generate_empty_data()

    show_usage_guide()
