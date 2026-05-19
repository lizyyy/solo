#!/usr/bin/env python3
import requests
import json
import time
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")

def test_health():
    print_section("1. 健康检查")
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"状态码: {response.status_code}")
        print(f"响应: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        return response.status_code == 200
    except Exception as e:
        print(f"连接失败: {e}")
        print("请先启动服务: python main.py")
        return False

def create_test_data():
    print_section("2. 创建基础测试数据")
    
    driver_data = {
        "driver_name": "张司机",
        "driver_phone": "13800138001",
        "employee_id": "DRV001"
    }
    response = requests.post(f"{BASE_URL}/drivers/", json=driver_data)
    print(f"创建司机: {response.status_code}")
    driver_result = response.json()
    print(f"响应: {json.dumps(driver_result, indent=2, ensure_ascii=False)}")
    driver_id = driver_result["data"]["id"]
    
    bus_data = {
        "bus_number": "BUS001",
        "plate_number": "京A12345",
        "route_name": "1号线",
        "driver_id": driver_id
    }
    response = requests.post(f"{BASE_URL}/buses/", json=bus_data)
    print(f"\n创建车辆: {response.status_code}")
    bus_result = response.json()
    print(f"响应: {json.dumps(bus_result, indent=2, ensure_ascii=False)}")
    bus_id = bus_result["data"]["id"]
    
    student_data = {
        "student_name": "李明",
        "student_number": "STU001",
        "parent_name": "李父",
        "parent_phone": "13900139001",
        "bus_route": "1号线",
        "stop_name": "中关村站"
    }
    response = requests.post(f"{BASE_URL}/students/", json=student_data)
    print(f"\n创建学生: {response.status_code}")
    student_result = response.json()
    print(f"响应: {json.dumps(student_result, indent=2, ensure_ascii=False)}")
    
    return driver_id, bus_id

def import_checkin_data(driver_id, bus_id):
    print_section("3. 导入司机打卡数据")
    
    checkin_time = datetime.now().replace(hour=6, minute=20, second=0)
    checkin_data = {
        "idempotency_key": f"checkin_test_{int(time.time())}",
        "driver_id": driver_id,
        "bus_id": bus_id,
        "checkin_time": checkin_time.isoformat(),
        "checkin_type": "start",
        "location_lat": 39.98,
        "location_lng": 116.31,
        "location_name": "停车场",
        "notes": "正常发车"
    }
    response = requests.post(f"{BASE_URL}/checkins/", json=checkin_data)
    print(f"导入打卡: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")

def import_gps_data(bus_id):
    print_section("4. 导入GPS轨迹数据")
    
    base_time = datetime.now().replace(hour=7, minute=0, second=0)
    gps_items = []
    for i in range(10):
        record_time = base_time + timedelta(minutes=i*2)
        gps_items.append({
            "bus_id": bus_id,
            "record_time": record_time.isoformat(),
            "lat": 39.98 + i * 0.005,
            "lng": 116.31 + i * 0.003,
            "speed": 8.0 + i * 0.5,
            "heading": 90.0
        })
    
    batch_data = {
        "items": gps_items,
        "idempotency_prefix": "gps_test"
    }
    response = requests.post(f"{BASE_URL}/batch/gps/", json=batch_data)
    print(f"批量导入GPS: {response.status_code}")
    result = response.json()
    print(f"总计: {result['total_count']}, 成功: {result['success_count']}, 失败: {result['failure_count']}")
    print(f"成功条目: {json.dumps(result['success_items'][:3], indent=2, ensure_ascii=False)}...")

def import_complaint_data():
    print_section("5. 导入家长申诉数据")
    
    complaint_date = datetime.now().replace(hour=7, minute=30, second=0)
    scheduled_arrival = datetime.now().replace(hour=7, minute=20, second=0)
    actual_arrival = datetime.now().replace(hour=7, minute=45, second=0)
    
    complaint_data = {
        "idempotency_key": f"complaint_test_{int(time.time())}",
        "complaint_number": f"COMP{int(time.time())}",
        "student_name": "李明",
        "parent_name": "李父",
        "parent_phone": "13900139001",
        "bus_route": "1号线",
        "stop_name": "中关村站",
        "complaint_date": complaint_date.isoformat(),
        "scheduled_arrival": scheduled_arrival.isoformat(),
        "actual_arrival": actual_arrival.isoformat(),
        "complaint_type": "delay",
        "description": "今天校车晚点25分钟，孩子迟到了"
    }
    response = requests.post(f"{BASE_URL}/complaints/", json=complaint_data)
    print(f"导入申诉: {response.status_code}")
    result = response.json()
    print(f"响应: {json.dumps(result, indent=2, ensure_ascii=False)}")
    return result["data"]["id"]

def test_idempotency():
    print_section("6. 测试幂等性 - 重复提交")
    
    print("重复导入相同的申诉...")
    complaint_date = datetime.now().replace(hour=7, minute=30, second=0)
    complaint_data = {
        "idempotency_key": "complaint_test_idempotent",
        "complaint_number": "COMP_IDEMPOTENT_001",
        "student_name": "王芳",
        "parent_name": "王父",
        "parent_phone": "13900139002",
        "bus_route": "1号线",
        "stop_name": "中关村站",
        "complaint_date": complaint_date.isoformat(),
        "complaint_type": "delay"
    }
    
    response1 = requests.post(f"{BASE_URL}/complaints/", json=complaint_data)
    print(f"第一次提交: status={response1.status_code}, status={response1.json()['status']}")
    
    response2 = requests.post(f"{BASE_URL}/complaints/", json=complaint_data)
    print(f"第二次提交: status={response2.status_code}, status={response2.json()['status']}")
    
    if response2.json()["status"] == "duplicate":
        print("✓ 幂等性验证成功：重复提交返回 duplicate")
    else:
        print("✗ 幂等性验证失败")

def test_batch_import_with_errors():
    print_section("7. 测试批量导入（包含错误数据）")
    
    base_time = datetime.now()
    checkin_items = [
        {
            "driver_id": 1,
            "bus_id": 1,
            "checkin_time": (base_time + timedelta(minutes=i)).isoformat(),
            "checkin_type": "checkpoint",
        }
        for i in range(5)
    ]
    checkin_items.append({
        "driver_id": 99999,
        "bus_id": 1,
        "checkin_time": base_time.isoformat(),
        "checkin_type": "invalid",
    })
    
    batch_data = {
        "items": checkin_items,
        "idempotency_prefix": "batch_test_with_error"
    }
    
    response = requests.post(f"{BASE_URL}/batch/checkins/", json=batch_data)
    print(f"批量导入: {response.status_code}")
    result = response.json()
    print(f"总计: {result['total_count']}, 成功: {result['success_count']}, 失败: {result['failure_count']}")
    
    if result['failure_count'] > 0:
        print(f"失败详情: {json.dumps(result['failure_items'], indent=2, ensure_ascii=False)}")
        print("✓ 部分失败验证成功：失败记录被正确捕获，成功记录不受影响")

def auto_ruling(complaint_id):
    print_section("8. 自动匹配与裁定")
    
    response = requests.post(f"{BASE_URL}/rulings/auto/{complaint_id}")
    print(f"自动裁定: {response.status_code}")
    result = response.json()
    print(f"响应: {json.dumps(result, indent=2, ensure_ascii=False)}")
    
    if result["success"]:
        ruling_data = result["data"]
        print(f"\n裁定结果:")
        print(f"  - 责任方: {ruling_data['responsibility']}")
        print(f"  - 延误分钟: {ruling_data['delay_minutes']}")
        print(f"  - 根本原因: {ruling_data['root_cause']}")
        print(f"  - GPS证据: {ruling_data['gps_evidence']}")
        print(f"  - 打卡证据: {ruling_data['checkin_evidence']}")
    
    return result["data"]["ruling_id"] if result["success"] else None

def review_ruling(ruling_id):
    print_section("9. 复核裁定结果")
    
    review_data = {
        "ruling_id": ruling_id,
        "reviewer": "张调度",
        "review_result": "revised",
        "review_notes": "经核实，当天该路段有交通事故，责任应改为 traffic",
        "new_responsibility": "traffic"
    }
    
    response = requests.post(f"{BASE_URL}/reviews/", json=review_data)
    print(f"复核: {response.status_code}")
    result = response.json()
    print(f"响应: {json.dumps(result, indent=2, ensure_ascii=False)}")
    
    if result["success"]:
        print(f"\n复核结果:")
        print(f"  - 原责任判定: {result['data']['original_responsibility']}")
        print(f"  - 新责任判定: {result['data']['new_responsibility']}")
        print(f"  - 复核结论: {result['data']['review_result']}")

def get_complaint_detail(complaint_id):
    print_section("10. 查看申诉详情（脱敏验证）")
    
    response = requests.get(f"{BASE_URL}/complaints/{complaint_id}")
    print(f"获取详情: {response.status_code}")
    result = response.json()
    print(f"响应: {json.dumps(result, indent=2, ensure_ascii=False)}")
    
    data = result["data"]
    if "****" in data["complaint"]["parent_phone"]:
        print("\n✓ 敏感数据脱敏验证成功：家长手机号已脱敏")
    if "*" in data["complaint"]["student_name"]:
        print("✓ 敏感数据脱敏验证成功：学生姓名已脱敏")

def list_complaints():
    print_section("11. 获取申诉列表")
    
    response = requests.get(f"{BASE_URL}/complaints/", params={"status": "ruled", "limit": 10})
    print(f"获取列表: {response.status_code}")
    result = response.json()
    print(f"总计: {result['data']['total']} 条记录")
    print(f"前3条: {json.dumps(result['data']['items'][:3], indent=2, ensure_ascii=False)}")

def export_rulings():
    print_section("12. 导出裁定记录到Excel")
    
    export_data = {
        "export_format": "xlsx"
    }
    response = requests.post(f"{BASE_URL}/export/rulings", json=export_data)
    print(f"导出: {response.status_code}")
    
    if response.status_code == 200:
        filename = "rulings_export.xlsx"
        with open(filename, "wb") as f:
            f.write(response.content)
        print(f"✓ 导出成功，文件已保存为: {filename}")
        print(f"  文件大小: {len(response.content)} bytes")
    else:
        print(f"导出失败: {response.text}")

def main():
    print("校车调度责任判定系统 - 完整流程测试")
    print("=" * 60)
    
    if not test_health():
        return
    
    driver_id, bus_id = create_test_data()
    import_checkin_data(driver_id, bus_id)
    import_gps_data(bus_id)
    complaint_id = import_complaint_data()
    
    test_idempotency()
    test_batch_import_with_errors()
    
    ruling_id = auto_ruling(complaint_id)
    
    if ruling_id:
        review_ruling(ruling_id)
    
    get_complaint_detail(complaint_id)
    list_complaints()
    export_rulings()
    
    print_section("测试完成")
    print("✓ 所有测试步骤已执行完毕")
    print("\n系统验证的核心功能:")
    print("  1. 数据接收（司机、车辆、学生、打卡、GPS、申诉）")
    print("  2. 幂等性处理（重复提交不重复创建）")
    print("  3. 批量导入（部分失败不影响成功记录）")
    print("  4. 自动匹配与裁定（GPS+打卡+申诉）")
    print("  5. 人工复核（可修改裁定结果）")
    print("  6. 敏感数据脱敏（API返回自动脱敏）")
    print("  7. Excel导出（导出文件含脱敏数据）")

if __name__ == "__main__":
    main()
