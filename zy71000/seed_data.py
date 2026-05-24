import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"


def generate_time_offset(hours):
    return (datetime.now() + timedelta(hours=hours)).isoformat()


test_data = [
    {
        "batch_number": "BATCH-2024-001",
        "sterilization_cycle": "CYCLE-A001",
        "operating_room": "手术室1",
        "receiving_nurse": "张护士",
        "isolation_reason": "临时换包，纸单补录",
        "submission_time": generate_time_offset(-1),
        "surgery_time": generate_time_offset(-2),
        "supplementary_info": "术中发现包装有污渍"
    },
    {
        "batch_number": "BATCH-2024-002",
        "sterilization_cycle": "CYCLE-A001",
        "operating_room": "手术室2",
        "receiving_nurse": "李护士",
        "isolation_reason": "批号核对异常",
        "submission_time": generate_time_offset(-3),
        "surgery_time": generate_time_offset(-5),
        "supplementary_info": "外标签批号与内卡不符"
    },
    {
        "batch_number": "BATCH-2024-003",
        "sterilization_cycle": "CYCLE-B002",
        "operating_room": "手术室3",
        "receiving_nurse": "王护士",
        "isolation_reason": "正常使用登记",
        "submission_time": generate_time_offset(-6),
        "surgery_time": generate_time_offset(-4),
        "supplementary_info": None
    },
    {
        "batch_number": "BATCH-2024-001",
        "sterilization_cycle": "CYCLE-A001",
        "operating_room": "手术室3",
        "receiving_nurse": "赵护士",
        "isolation_reason": "跨房间使用追踪",
        "submission_time": generate_time_offset(-7),
        "surgery_time": generate_time_offset(-8),
        "supplementary_info": "紧急手术调用备用包"
    }
]


def seed_data():
    print("🚀 开始造测试数据...\n")
    
    try:
        health = requests.get(f"{BASE_URL}/api/health")
        print(f"✅ 服务状态: {health.json()['status']}")
    except:
        print("❌ 服务未启动，请先运行: uvicorn main:app --reload")
        return

    print("\n📦 提交测试数据...")
    for i, data in enumerate(test_data, 1):
        print(f"\n[{i}/{len(test_data)}] 提交: {data['batch_number']} - {data['isolation_reason'][:20]}...")
        try:
            response = requests.post(
                f"{BASE_URL}/api/raw-materials/",
                json=data
            )
            result = response.json()
            if result.get("status") == "created":
                print(f"   ✅ 成功 - 隔离单号: {result['order_no']}")
                print(f"   风险等级: {result['validation']['risk_level']}")
                if result['validation']['issues']:
                    print(f"   ⚠️  问题: {', '.join(result['validation']['issues'])}")
            elif result.get("status") == "duplicate":
                print(f"   ℹ️  重复 - {result['message']}")
        except Exception as e:
            print(f"   ❌ 失败: {e}")

    print("\n📋 获取隔离单列表...")
    response = requests.get(f"{BASE_URL}/api/isolation-orders/")
    orders = response.json()
    print(f"✅ 共 {len(orders)} 条隔离单记录")

    if orders:
        first_order = orders[0]
        print(f"\n🔍 对第一条隔离单进行放行操作...")
        try:
            decision_response = requests.post(
                f"{BASE_URL}/api/decisions/",
                json={
                    "isolation_order_id": first_order['id'],
                    "decision_type": "approve",
                    "conclusion": "测试数据-同意放行",
                    "reason": "材料齐全，符合要求",
                    "operator": "系统管理员",
                    "supplementary_evidence": "测试数据"
                }
            )
            if decision_response.status_code == 200:
                print(f"✅ 放行成功")
            else:
                print(f"❌ 放行失败: {decision_response.text}")
        except Exception as e:
            print(f"❌ 操作失败: {e}")

    print("\n🎉 测试数据造完完成！")
    print(f"\n📖 访问 API 文档: {BASE_URL}/docs")


if __name__ == "__main__":
    seed_data()
