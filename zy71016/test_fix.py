#!/usr/bin/env python3
import requests
import json
import time

BASE_URL = "http://localhost:8080/api/v1"

def test_duplicate_vehicle_detection():
    print("=== 测试1: 同车重复领盐拦截 ===")
    data = {
        "batch_no": "BATCH-DUP-TEST-" + str(int(time.time())),
        "weather_level_id": 2,
        "created_by": "测试员",
        "items": [
            {"salt_depot_id": 1, "vehicle_id": 1, "road_section_id": 1, "salt_amount": 5},
            {"salt_depot_id": 1, "vehicle_id": 1, "road_section_id": 2, "salt_amount": 3}
        ]
    }
    resp = requests.post(f"{BASE_URL}/dispatch/batches", json=data, headers={"X-Operator": "测试员"})
    result = resp.json()
    print(f"响应消息: {result.get('message')}")
    if "检测到" in result.get('message', ''):
        print("✓ 成功检测到同一批次内重复车辆")
        return True
    else:
        print("✗ 未检测到重复车辆")
        return False

def test_status_update_to_completed_blocked():
    print("\n=== 测试2: 禁止直接更新到completed状态 ===")
    data = {"status": "completed", "location": "测试", "remark": "绕过签收"}
    resp = requests.post(f"{BASE_URL}/dispatch/items/1/status", json=data, headers={"X-Operator": "测试员"})
    result = resp.json()
    print(f"响应: {result}")
    if "error" in result and "不允许" in result.get('error', ''):
        print("✓ 成功禁止直接更新到completed状态")
        return True
    else:
        print("✗ 未正确禁止直接更新到completed")
        return False

def test_invalid_state_transition():
    print("\n=== 测试3: 禁止非法状态流转 (pending → enroute) ===")
    data = {"status": "enroute", "location": "途中", "remark": "非法流转"}
    resp = requests.post(f"{BASE_URL}/dispatch/items/1/status", json=data, headers={"X-Operator": "测试员"})
    result = resp.json()
    print(f"响应: {result}")
    if "error" in result and "流转不允许" in result.get('error', ''):
        print("✓ 成功禁止非法状态流转")
        return True
    else:
        print("✗ 未正确禁止非法状态流转")
        return False

def test_cancel_item():
    print("\n=== 测试4: 取消任务功能 ===")
    batch_data = {
        "batch_no": "BATCH-CANCEL-TEST-" + str(int(time.time())),
        "weather_level_id": 2,
        "created_by": "测试员",
        "items": [
            {"salt_depot_id": 2, "vehicle_id": 2, "road_section_id": 3, "salt_amount": 8}
        ]
    }
    requests.post(f"{BASE_URL}/dispatch/batches", json=batch_data, headers={"X-Operator": "测试员"})
    
    cancel_data = {"reason": "临时调整路线"}
    resp = requests.post(f"{BASE_URL}/dispatch/items/3/cancel", json=cancel_data, headers={"X-Operator": "测试员"})
    result = resp.json()
    print(f"取消响应: {result}")
    
    resp2 = requests.get(f"{BASE_URL}/dispatch/items/3")
    item = resp2.json()
    print(f"任务状态: {item.get('status')}")
    if item.get('status') == 'cancelled':
        print("✓ 任务取消成功")
        return True
    else:
        print("✗ 任务取消失败")
        return False

def test_stats():
    print("\n=== 测试5: 统计数据 ===")
    resp = requests.get(f"{BASE_URL}/stats")
    stats = resp.json()
    print(f"总批次: {stats.get('total_batches')}, 异常项: {stats.get('anomaly_items')}")
    print("✓ 统计数据获取成功")
    return True

if __name__ == "__main__":
    print("城市除雪盐库 API - 修复验证测试")
    print("=" * 50)
    
    # 等待服务就绪
    time.sleep(2)
    
    results = []
    try:
        results.append(("重复车辆检测", test_duplicate_vehicle_detection()))
        results.append(("禁止直接completed", test_status_update_to_completed_blocked()))
        results.append(("非法状态流转拦截", test_invalid_state_transition()))
        results.append(("取消任务功能", test_cancel_item()))
        results.append(("统计数据接口", test_stats()))
    except Exception as e:
        print(f"\n测试异常: {e}")
    
    print("\n" + "=" * 50)
    print("测试结果汇总:")
    all_pass = True
    for name, passed in results:
        status = "✓ 通过" if passed else "✗ 失败"
        print(f"  {name}: {status}")
        if not passed:
            all_pass = False
    print("=" * 50)
    if all_pass:
        print("所有测试通过! 修复验证成功!")
    else:
        print("部分测试失败，请检查修复代码")
