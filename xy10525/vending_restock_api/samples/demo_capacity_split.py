#!/usr/bin/env python3
import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"


def run_capacity_split_demo():
    print("="*60)
    print("DEMO 2: 容量不足拆分路线")
    print("="*60)
    
    print("\n步骤1: 分析机器M001和M003的补货需求（合计大订单）")
    response_m1 = requests.get(f"{BASE_URL}/api/tasks/analyze/M001")
    response_m3 = requests.get(f"{BASE_URL}/api/tasks/analyze/M003")
    print(f"M001总缺货: {response_m1.json()['total_shortage']}")
    print(f"M003总缺货: {response_m3.json()['total_shortage']}")
    
    print("\n步骤2: 创建大任务TASK-BIG-001（需要容量约400）")
    task_data = {
        "id": "TASK-BIG-001",
        "machine_id": "M001",
        "priority": 1,
        "items": [
            {"product_id": "P001", "item_type": "restock", "requested_quantity": 200},
            {"product_id": "P002", "item_type": "restock", "requested_quantity": 150},
            {"product_id": "P005", "item_type": "restock", "requested_quantity": 30}
        ]
    }
    response = requests.post(f"{BASE_URL}/api/tasks", json=task_data)
    print(f"任务创建: {response.status_code}")
    
    print("\n步骤3: 创建小容量路线ROUTE-SMALL（容量仅200）")
    route_data = {
        "id": "ROUTE-SMALL",
        "name": "小型货车路线",
        "total_capacity": 200,
        "operator": "王司机",
        "vehicle_id": "VAN-SMALL-01",
        "scheduled_date": datetime.now().isoformat()
    }
    response = requests.post(f"{BASE_URL}/api/routes", json=route_data)
    print(f"路线创建: {response.status_code}, 总容量: {response.json()['total_capacity']}")
    
    print("\n步骤4: 尝试将大任务加入小容量路线（应该失败，容量不足）")
    response = requests.post(f"{BASE_URL}/api/routes/ROUTE-SMALL/tasks/TASK-BIG-001?operator=调度员")
    print(f"状态码: {response.status_code}")
    if response.status_code == 400:
        error = response.json()
        print(f"错误码: {error['detail']['code']}")
        print(f"错误信息: {error['detail']['message']}")
        print(f"详情: {error['detail']['details']}")
    
    print("\n步骤5: 方案A - 创建大容量路线ROUTE-BIG（容量600）")
    route_data = {
        "id": "ROUTE-BIG",
        "name": "大型货车路线",
        "total_capacity": 600,
        "operator": "李司机",
        "vehicle_id": "TRUCK-01",
        "scheduled_date": datetime.now().isoformat()
    }
    response = requests.post(f"{BASE_URL}/api/routes", json=route_data)
    print(f"大路线创建: {response.status_code}, 总容量: {response.json()['total_capacity']}")
    
    print("\n步骤6: 将大任务加入大容量路线（应该成功）")
    response = requests.post(f"{BASE_URL}/api/routes/ROUTE-BIG/tasks/TASK-BIG-001?operator=调度员")
    print(f"状态码: {response.status_code}")
    route = response.json()
    print(f"已用容量: {route['used_capacity']}, 剩余: {route['total_capacity'] - route['used_capacity']}")
    
    print("\n步骤7: 方案B - 拆分任务（模拟）")
    print("创建第二个任务TASK-SPLIT-002作为拆分后的第二部分")
    task_data2 = {
        "id": "TASK-SPLIT-002",
        "machine_id": "M003",
        "priority": 1,
        "items": [
            {"product_id": "P001", "item_type": "restock", "requested_quantity": 100},
            {"product_id": "P002", "item_type": "restock", "requested_quantity": 80}
        ]
    }
    response = requests.post(f"{BASE_URL}/api/tasks", json=task_data2)
    print(f"拆分任务创建: {response.status_code}")
    
    print("\n步骤8: 创建第二条路线ROUTE-ALT（容量300）")
    route_data2 = {
        "id": "ROUTE-ALT",
        "name": "备选路线",
        "total_capacity": 300,
        "operator": "张司机",
        "vehicle_id": "VAN-002",
        "scheduled_date": datetime.now().isoformat()
    }
    response = requests.post(f"{BASE_URL}/api/routes", json=route_data2)
    print(f"备选路线创建: {response.status_code}")
    
    print("\n步骤9: 将拆分任务加入备选路线")
    response = requests.post(f"{BASE_URL}/api/routes/ROUTE-ALT/tasks/TASK-SPLIT-002?operator=调度员")
    print(f"状态码: {response.status_code}")
    route = response.json()
    print(f"已用容量: {route['used_capacity']}, 剩余: {route['total_capacity'] - route['used_capacity']}")
    
    print("\n步骤10: 验证两条路线的总容量分配")
    response1 = requests.get(f"{BASE_URL}/api/routes/ROUTE-BIG")
    response2 = requests.get(f"{BASE_URL}/api/routes/ROUTE-ALT")
    r1 = response1.json()
    r2 = response2.json()
    print(f"\n路线ROUTE-BIG: {r1['used_capacity']}/{r1['total_capacity']}")
    print(f"路线ROUTE-ALT: {r2['used_capacity']}/{r2['total_capacity']}")
    print(f"总使用容量: {r1['used_capacity'] + r2['used_capacity']}")
    
    print("\n" + "="*60)
    print("DEMO 2 完成: 容量不足拆分路线 - SUCCESS")
    print("="*60)
    return True


if __name__ == "__main__":
    run_capacity_split_demo()
