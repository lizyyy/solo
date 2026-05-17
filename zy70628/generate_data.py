#!/usr/bin/env python3
"""
造数脚本 - 生成测试数据
"""
import sys
import requests
import random
from datetime import datetime, timedelta

BASE_URL = "http://127.0.0.1:8000"

# 测试数据
names = ["张三", "李四", "王五", "赵六", "钱七", "孙八", "周九", "吴十", "郑十一", "王十二"]
phones = [f"138{str(i).zfill(8)}" for i in range(100)]
couriers = ["顺丰", "圆通", "中通", "申通", "韵达", "极兔", "京东物流", "邮政EMS"]
shelves = ["A-01", "A-02", "A-03", "B-01", "B-02", "B-03", "C-01", "C-02"]
reasons = ["商品破损", "发错货", "不想要了", "质量问题", "尺码不对", "其他"]
operators = ["admin", "staff01", "staff02", "manager"]


def generate_tracking_number():
    """生成快递单号"""
    prefix = "SF" if random.random() > 0.5 else "YT"
    return f"{prefix}{random.randint(10000000000, 99999999999)}"


def generate_parcels(count=20):
    """生成包裹数据"""
    print(f"开始生成 {count} 个包裹...")
    parcel_ids = []

    for i in range(count):
        name = random.choice(names)
        phone = random.choice(phones)
        days_ago = random.randint(0, 15)
        inbound_time = (datetime.now() - timedelta(days=days_ago)).isoformat()

        data = {
            "tracking_number": generate_tracking_number(),
            "courier_company": random.choice(couriers),
            "recipient": {
                "name": name,
                "phone": phone,
                "address": f"测试小区{random.randint(1, 20)}号楼{random.randint(1, 30)}0室"
            },
            "inbound_time": inbound_time,
            "shelf_location": random.choice(shelves),
            "weight": f"{random.uniform(0.1, 5.0):.1f}kg",
            "remarks": f"测试包裹{i + 1}",
            "created_by": random.choice(operators)
        }

        try:
            response = requests.post(f"{BASE_URL}/api/parcels", json=data)
            if response.status_code == 200:
                parcel = response.json()
                parcel_ids.append(parcel['id'])
                print(f"✓ 创建包裹: {parcel['tracking_number']} - {parcel['recipient_name']}")
            else:
                print(f"✗ 创建失败: {response.text}")
        except Exception as e:
            print(f"✗ 请求失败: {e}")

    return parcel_ids


def generate_reminders(parcel_ids):
    """生成催取记录"""
    if not parcel_ids:
        return

    # 取部分包裹进行催取
    remind_count = min(len(parcel_ids) // 2, 10)
    remind_parcels = random.sample(parcel_ids, remind_count)

    print(f"\n开始催取 {len(remind_parcels)} 个包裹...")
    data = {
        "parcel_ids": remind_parcels,
        "reminder_type": random.choice(["normal", "urgent", "final"]),
        "reminder_channel": "sms",
        "sent_by": random.choice(operators)
    }

    try:
        response = requests.post(f"{BASE_URL}/api/reminders", json=data)
        if response.status_code == 200:
            result = response.json()
            print(f"✓ 批量催取完成，成功 {result['total_success']} 个")
        else:
            print(f"✗ 催取失败: {response.text}")
    except Exception as e:
        print(f"✗ 请求失败: {e}")


def generate_rejections(parcel_ids):
    """生成拒收记录"""
    if not parcel_ids:
        return

    reject_parcels = random.sample(parcel_ids, min(3, len(parcel_ids)))
    rejection_ids = []

    print(f"\n开始创建 {len(reject_parcels)} 个拒收记录...")
    for parcel_id in reject_parcels:
        data = {
            "parcel_id": parcel_id,
            "reason": random.choice(reasons),
            "rejected_by": random.choice(operators),
            "contact_result": "已联系发件人",
            "follow_up_action": "等待退回",
            "remarks": "测试拒收"
        }

        try:
            response = requests.post(f"{BASE_URL}/api/rejections", json=data)
            if response.status_code == 200:
                rejection = response.json()
                rejection_ids.append(rejection['id'])
                print(f"✓ 创建拒收记录: 包裹ID {parcel_id}")
            else:
                print(f"✗ 创建拒收失败: {response.text}")
        except Exception as e:
            print(f"✗ 请求失败: {e}")

    return rejection_ids


def confirm_rejections(rejection_ids):
    """确认部分拒收"""
    if not rejection_ids:
        return

    confirm_ids = random.sample(rejection_ids, min(2, len(rejection_ids)))
    print(f"\n开始确认 {len(confirm_ids)} 个拒收记录...")

    for rid in confirm_ids:
        data = {
            "rejection_id": rid,
            "confirmed_by": random.choice(operators)
        }

        try:
            response = requests.post(f"{BASE_URL}/api/rejections/confirm", json=data)
            if response.status_code == 200:
                print(f"✓ 确认拒收: 记录ID {rid}")
            else:
                print(f"✗ 确认失败: {response.text}")
        except Exception as e:
            print(f"✗ 请求失败: {e}")


def generate_returns(parcel_ids, rejection_ids):
    """生成退回记录"""
    return_ids = []

    # 从没有被拒收的包裹中选择一些
    if len(parcel_ids) > 5:
        return_parcels = random.sample(parcel_ids[5:], min(2, len(parcel_ids) - 5))
    else:
        return_parcels = []

    print(f"\n开始创建 {len(return_parcels)} 个退回报告...")
    for parcel_id in return_parcels:
        data = {
            "parcel_id": parcel_id,
            "return_tracking_number": generate_tracking_number(),
            "return_courier_company": random.choice(couriers),
            "return_reason": random.choice(reasons),
            "return_address": "上海市浦东新区退货仓库",
            "return_contact": "退货处理员",
            "return_phone": "4001234567",
            "reported_by": random.choice(operators),
            "remarks": "测试退回"
        }

        try:
            response = requests.post(f"{BASE_URL}/api/returns", json=data)
            if response.status_code == 200:
                return_report = response.json()
                return_ids.append(return_report['id'])
                print(f"✓ 创建退回报告: 包裹ID {parcel_id}")
            else:
                print(f"✗ 创建退回失败: {response.text}")
        except Exception as e:
            print(f"✗ 请求失败: {e}")

    return return_ids


def confirm_returns(return_ids):
    """确认部分退回"""
    if not return_ids:
        return

    confirm_ids = random.sample(return_ids, min(1, len(return_ids)))
    print(f"\n开始确认 {len(confirm_ids)} 个退回记录...")

    for rid in confirm_ids:
        data = {
            "return_id": rid,
            "confirmed_by": random.choice(operators),
            "actual_shipped_at": datetime.now().isoformat()
        }

        try:
            response = requests.post(f"{BASE_URL}/api/returns/confirm", json=data)
            if response.status_code == 200:
                print(f"✓ 确认退回: 记录ID {rid}")
            else:
                print(f"✗ 确认失败: {response.text}")
        except Exception as e:
            print(f"✗ 请求失败: {e}")


def update_some_status(parcel_ids):
    """更新部分包裹状态"""
    if not parcel_ids:
        return

    update_parcels = random.sample(parcel_ids, min(5, len(parcel_ids)))
    print(f"\n开始更新 {len(update_parcels)} 个包裹状态...")

    statuses = ["picked_up", "reminded", "pending"]
    for parcel_id in update_parcels:
        data = {
            "parcel_id": parcel_id,
            "new_status": random.choice(statuses),
            "operator": random.choice(operators),
            "remarks": "状态更新测试"
        }

        try:
            response = requests.put(f"{BASE_URL}/api/parcels/status", json=data)
            if response.status_code == 200:
                result = response.json()
                print(f"✓ 更新状态: 包裹 {parcel_id} - {result['old_status']} → {result['new_status']}")
            else:
                print(f"✗ 更新失败: {response.text}")
        except Exception as e:
            print(f"✗ 请求失败: {e}")


def main():
    """主函数"""
    print("=" * 50)
    print("驿站包裹管理系统 - 测试数据生成脚本")
    print("=" * 50)

    # 检查服务是否启动
    try:
        response = requests.get(f"{BASE_URL}/api/statistics")
        if response.status_code == 200:
            stats = response.json()
            print(f"\n当前系统已有包裹数: {stats['total_parcels']}")
    except Exception:
        print("\n错误: 无法连接到API服务，请先启动服务:")
        print("  python main.py 或 uvicorn main:app --reload")
        sys.exit(1)

    # 生成数据
    parcel_ids = generate_parcels(count=25)
    if parcel_ids:
        generate_reminders(parcel_ids)
        rejection_ids = generate_rejections(parcel_ids)
        confirm_rejections(rejection_ids)
        return_ids = generate_returns(parcel_ids, rejection_ids)
        confirm_returns(return_ids)
        update_some_status(parcel_ids)

    print("\n" + "=" * 50)
    print("数据生成完成!")
    print("=" * 50)
    print(f"\n生成包裹数: {len(parcel_ids)}")
    print(f"API文档地址: {BASE_URL}/docs")


if __name__ == "__main__":
    main()
