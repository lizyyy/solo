#!/usr/bin/env python3
import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"


def run_normal_restock_demo():
    print("="*60)
    print("DEMO 1: 正常补货流程（从分析到完成）")
    print("="*60)
    
    print("\n步骤1: 分析机器M001的补货需求")
    response = requests.get(f"{BASE_URL}/api/tasks/analyze/M001")
    print(f"状态码: {response.status_code}")
    analysis = response.json()
    print(json.dumps(analysis, indent=2, ensure_ascii=False, default=str))
    
    print("\n步骤2: 基于分析结果创建补货任务TASK-001")
    task_data = {
        "id": "TASK-001",
        "machine_id": "M001",
        "priority": 1,
        "notes": "M001办公楼大厅常规补货+临期回收",
        "assigned_operator": "李师傅",
        "items": [
            {"product_id": "P001", "item_type": "restock", "requested_quantity": 48},
            {"product_id": "P002", "item_type": "restock", "requested_quantity": 32},
            {"product_id": "P004", "item_type": "restock", "requested_quantity": 22},
            {"product_id": "P003", "item_type": "recovery", "requested_quantity": 15}
        ]
    }
    response = requests.post(
        f"{BASE_URL}/api/tasks",
        json=task_data,
        headers={"idempotent-key": "demo-task-001"}
    )
    print(f"状态码: {response.status_code}")
    task = response.json()
    print(f"任务ID: {task['id']}, 状态: {task['status']}")
    
    print("\n步骤3: 创建路线ROUTE-001（容量600）")
    route_data = {
        "id": "ROUTE-001",
        "name": "A座路线",
        "total_capacity": 600,
        "operator": "李师傅",
        "vehicle_id": "VAN-001",
        "scheduled_date": datetime.now().isoformat()
    }
    response = requests.post(
        f"{BASE_URL}/api/routes",
        json=route_data,
        headers={"idempotent-key": "demo-route-001"}
    )
    print(f"状态码: {response.status_code}")
    route = response.json()
    print(f"路线ID: {route['id']}, 总容量: {route['total_capacity']}, 已用: {route['used_capacity']}")
    
    print("\n步骤4: 将任务TASK-001添加到路线ROUTE-001")
    response = requests.post(
        f"{BASE_URL}/api/routes/ROUTE-001/tasks/TASK-001?operator=调度员小王",
        headers={"idempotent-key": "demo-add-task-001"}
    )
    print(f"状态码: {response.status_code}")
    route = response.json()
    print(f"路线已用容量: {route['used_capacity']}, 剩余: {route['total_capacity'] - route['used_capacity']}")
    
    print("\n步骤5: 派发路线（planned -> dispatched）")
    response = requests.post(f"{BASE_URL}/api/routes/ROUTE-001/dispatch?operator=调度员小王")
    print(f"状态码: {response.status_code}")
    route = response.json()
    print(f"路线状态: {route['status']}")
    
    print("\n步骤6: 开始执行路线（dispatched -> in_progress）")
    response = requests.post(f"{BASE_URL}/api/routes/ROUTE-001/start?operator=李师傅")
    print(f"状态码: {response.status_code}")
    route = response.json()
    print(f"路线状态: {route['status']}, 开始时间: {route['started_at']}")
    
    print("\n步骤7: 开始执行任务（pending -> in_progress）")
    response = requests.post(f"{BASE_URL}/api/tasks/TASK-001/start?operator=李师傅")
    print(f"状态码: {response.status_code}")
    task = response.json()
    print(f"任务状态: {task['status']}")
    
    print("\n步骤8: 记录实际执行数量（模拟实际补货45瓶可乐，少3瓶）")
    actual_items = [
        {"product_id": "P001", "actual_quantity": 45},
        {"product_id": "P002", "actual_quantity": 32},
        {"product_id": "P004", "actual_quantity": 22},
        {"product_id": "P003", "actual_quantity": 15}
    ]
    response = requests.post(
        f"{BASE_URL}/api/tasks/TASK-001/execute?operator=李师傅",
        json=actual_items
    )
    print(f"状态码: {response.status_code}")
    task = response.json()
    print("任务商品明细:")
    for item in task['items']:
        print(f"  {item['product_id']}: 请求{item['requested_quantity']}, 实际{item['actual_quantity']}")
    
    print("\n步骤9: 完成任务（in_progress -> completed）")
    response = requests.post(f"{BASE_URL}/api/tasks/TASK-001/complete?operator=李师傅")
    print(f"状态码: {response.status_code}")
    task = response.json()
    print(f"任务状态: {task['status']}, 完成时间: {task['completed_at']}")
    
    print("\n步骤10: 完成路线（in_progress -> completed）")
    response = requests.post(f"{BASE_URL}/api/routes/ROUTE-001/complete?operator=李师傅")
    print(f"状态码: {response.status_code}")
    route = response.json()
    print(f"路线状态: {route['status']}, 完成时间: {route['completed_at']}")
    
    print("\n步骤11: 查看任务历史记录（验证完整轨迹）")
    response = requests.get(f"{BASE_URL}/api/tasks/TASK-001")
    task = response.json()
    print(f"\n任务 {task['id']} 历史记录:")
    for h in task['history']:
        print(f"  [{h['created_at']}] {h['status_from']} -> {h['status_to']} by {h['operator']}: {h['reason']}")
    
    print("\n步骤12: 查看路线详细信息")
    response = requests.get(f"{BASE_URL}/api/routes/ROUTE-001/detail")
    detail = response.json()
    print(f"\n路线详情:")
    print(f"  ID: {detail['route_id']}")
    print(f"  状态: {detail['status']}")
    print(f"  容量: {detail['used_capacity']}/{detail['total_capacity']} (剩余{detail['remaining_capacity']})")
    print(f"  任务数: {len(detail['tasks'])}")
    
    print("\n" + "="*60)
    print("DEMO 1 完成: 正常补货流程 - SUCCESS")
    print("="*60)
    return True


if __name__ == "__main__":
    run_normal_restock_demo()
