#!/usr/bin/env python3
import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"


def run_fault_interrupt_demo():
    print("="*60)
    print("DEMO 4: 故障插单（机器故障自动暂停补货）")
    print("="*60)
    
    print("\n步骤1: 为机器M003创建待处理补货任务")
    task_data = {
        "id": "TASK-FAULT-001",
        "machine_id": "M003",
        "priority": 1,
        "notes": "食堂常规补货",
        "assigned_operator": "赵师傅",
        "items": [
            {"product_id": "P001", "item_type": "restock", "requested_quantity": 52},
            {"product_id": "P002", "item_type": "restock", "requested_quantity": 38},
            {"product_id": "P005", "item_type": "restock", "requested_quantity": 35}
        ]
    }
    response = requests.post(f"{BASE_URL}/api/tasks", json=task_data)
    print(f"任务创建: {response.status_code}")
    task = response.json()
    print(f"任务ID: {task['id']}, 状态: {task['status']}")
    
    print("\n步骤2: 检查当前M003状态（无故障）")
    response = requests.get(f"{BASE_URL}/api/tasks/analyze/M003")
    analysis = response.json()
    print(f"是否有故障: {analysis['has_fault']}")
    print(f"待处理任务数: {analysis['pending_tasks_count']}")
    
    print("\n步骤3: 报告M003故障（硬件故障，取货口卡住）")
    fault_data = {
        "id": "FAULT-001",
        "machine_id": "M003",
        "fault_type": "硬件故障-取货机构",
        "description": "用户反馈取货口卡住，商品无法取出，显示错误代码E102",
        "priority": 2,
        "assigned_operator": "张维修"
    }
    response = requests.post(
        f"{BASE_URL}/api/faults",
        json=fault_data,
        headers={"idempotent-key": "demo-fault-001"}
    )
    print(f"故障创建: {response.status_code}")
    fault = response.json()
    print(f"故障ID: {fault['id']}, 状态: {fault['status']}, 优先级: {fault['priority']}")
    
    print("\n步骤4: 验证原有任务是否被自动取消")
    response = requests.get(f"{BASE_URL}/api/tasks/TASK-FAULT-001")
    task = response.json()
    print(f"原有任务状态: {task['status']}")
    if task['status'] == 'cancelled':
        print(f"取消原因: {task['failed_reason']}")
    
    print(f"\n任务历史记录:")
    for h in task['history']:
        print(f"  [{h['created_at']}] {h['status_from']} -> {h['status_to']} by {h['operator']}: {h['reason']}")
    
    print("\n步骤5: 再次分析M003（显示有活动故障）")
    response = requests.get(f"{BASE_URL}/api/tasks/analyze/M003")
    analysis = response.json()
    print(f"是否有故障: {analysis['has_fault']}")
    if analysis['active_fault']:
        print(f"故障信息: {analysis['active_fault']['fault_type']} - {analysis['active_fault']['description']}")
    
    print("\n步骤6: 尝试为故障机器创建新补货任务（应该失败）")
    task_data2 = {
        "id": "TASK-FAULT-002",
        "machine_id": "M003",
        "priority": 1,
        "items": [
            {"product_id": "P001", "item_type": "restock", "requested_quantity": 50}
        ]
    }
    response = requests.post(f"{BASE_URL}/api/tasks", json=task_data2)
    print(f"状态码: {response.status_code}")
    if response.status_code == 400:
        error = response.json()
        print(f"错误码: {error['detail']['code']}")
        print(f"错误信息: {error['detail']['message']}")
    
    print("\n步骤7: 维修人员处理故障，标记为已解决")
    response = requests.post(
        f"{BASE_URL}/api/faults/FAULT-001/resolve?resolution_notes=取货口齿轮磨损更换，校准传感器，测试3次正常&operator=张维修"
    )
    print(f"故障解决: {response.status_code}")
    fault = response.json()
    print(f"故障状态: {fault['status']}, 解决时间: {fault['resolved_at']}")
    
    print("\n步骤8: 故障解决后，再次分析M003状态")
    response = requests.get(f"{BASE_URL}/api/tasks/analyze/M003")
    analysis = response.json()
    print(f"是否有故障: {analysis['has_fault']}")
    print(f"待处理任务数: {analysis['pending_tasks_count']}")
    
    print("\n步骤9: 现在可以为M003创建新的补货任务了")
    task_data3 = {
        "id": "TASK-FAULT-003",
        "machine_id": "M003",
        "priority": 2,
        "notes": "故障修复后加急补货",
        "items": [
            {"product_id": "P001", "item_type": "restock", "requested_quantity": 52},
            {"product_id": "P002", "item_type": "restock", "requested_quantity": 38}
        ]
    }
    response = requests.post(f"{BASE_URL}/api/tasks", json=task_data3)
    print(f"新任务创建: {response.status_code}")
    if response.status_code == 201:
        task = response.json()
        print(f"任务ID: {task['id']}, 状态: {task['status']}")
    
    print("\n" + "="*60)
    print("DEMO 4 完成: 故障插单流程 - SUCCESS")
    print("="*60)
    return True


if __name__ == "__main__":
    run_fault_interrupt_demo()
