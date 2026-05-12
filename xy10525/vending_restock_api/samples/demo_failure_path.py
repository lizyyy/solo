#!/usr/bin/env python3
import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"


def run_failure_demo():
    print("="*60)
    print("DEMO 5: 失败路径演示（验证异常处理和幂等性）")
    print("="*60)
    
    print("\n场景1: 重复派单验证（同一机器重复创建任务）")
    print("-"*40)
    
    print("\n步骤1: 为M004创建第一个任务")
    task_data = {
        "id": "TASK-DUP-001",
        "machine_id": "M004",
        "priority": 1,
        "items": [
            {"product_id": "P003", "item_type": "restock", "requested_quantity": 30}
        ]
    }
    response = requests.post(f"{BASE_URL}/api/tasks", json=task_data)
    print(f"第一个任务: {response.status_code}")
    
    print("\n步骤2: 尝试为M004创建第二个任务（应该失败）")
    task_data2 = {
        "id": "TASK-DUP-002",
        "machine_id": "M004",
        "priority": 1,
        "items": [
            {"product_id": "P001", "item_type": "restock", "requested_quantity": 50}
        ]
    }
    response = requests.post(f"{BASE_URL}/api/tasks", json=task_data2)
    print(f"第二个任务状态码: {response.status_code}")
    if response.status_code == 400:
        error = response.json()
        print(f"错误码: {error['detail']['code']}")
        print(f"错误信息: {error['detail']['message']}")
        print(f"详情: {error['detail']['details']}")
    
    print("\n场景2: 幂等性验证（重复调用同一请求）")
    print("-"*40)
    
    print("\n步骤3: 使用相同的idempotent-key创建路线（第一次）")
    route_data = {
        "id": "ROUTE-IDEMP-001",
        "name": "幂等测试路线",
        "total_capacity": 200,
        "operator": "测试司机",
        "vehicle_id": "VAN-TEST",
        "scheduled_date": datetime.now().isoformat()
    }
    
    response1 = requests.post(
        f"{BASE_URL}/api/routes",
        json=route_data,
        headers={"idempotent-key": "test-idempotent-001"}
    )
    print(f"第一次调用状态码: {response1.status_code}")
    print(f"路线ID: {response1.json()['id']}")
    
    print("\n步骤4: 使用相同的idempotent-key再次调用（应该返回相同结果，不创建重复）")
    response2 = requests.post(
        f"{BASE_URL}/api/routes",
        json=route_data,
        headers={"idempotent-key": "test-idempotent-001"}
    )
    print(f"第二次调用状态码: {response2.status_code}")
    print(f"路线ID: {response2.json()['id']}")
    print(f"两次返回相同: {response1.json()['id'] == response2.json()['id']}")
    
    print("\n场景3: 无效状态转换验证")
    print("-"*40)
    
    print("\n步骤5: 创建一个任务并完成它")
    task_data3 = {
        "id": "TASK-STATUS-001",
        "machine_id": "M004",
        "priority": 1,
        "items": [
            {"product_id": "P008", "item_type": "restock", "requested_quantity": 10}
        ]
    }
    
    requests.post(f"{BASE_URL}/api/tasks/TASK-DUP-001/complete?operator=测试")
    response = requests.post(f"{BASE_URL}/api/tasks", json=task_data3)
    task_id = response.json()['id']
    
    print(f"\n步骤6: 直接从pending尝试complete（应该先start再complete）")
    response = requests.post(f"{BASE_URL}/api/tasks/{task_id}/complete?operator=测试")
    print(f"状态码: {response.status_code}")
    if response.status_code == 400:
        error = response.json()
        print(f"错误码: {error['detail']['code']}")
        print(f"错误信息: {error['detail']['message']}")
    
    print("\n步骤7: 正确流程: pending -> in_progress -> completed")
    response = requests.post(f"{BASE_URL}/api/tasks/{task_id}/start?operator=测试")
    print(f"start: {response.status_code} -> {response.json()['status']}")
    
    response = requests.post(f"{BASE_URL}/api/tasks/{task_id}/complete?operator=测试")
    print(f"complete: {response.status_code} -> {response.json()['status']}")
    
    print("\n步骤8: 已完成的任务尝试再次start（应该失败）")
    response = requests.post(f"{BASE_URL}/api/tasks/{task_id}/start?operator=测试")
    print(f"状态码: {response.status_code}")
    if response.status_code == 400:
        error = response.json()
        print(f"错误码: {error['detail']['code']}")
        print(f"错误信息: {error['detail']['message']}")
    
    print("\n场景4: 人工修正（记录前后差异和操作者）")
    print("-"*40)
    
    print("\n步骤9: 创建任务后人工修改数量")
    task_data4 = {
        "id": "TASK-MANUAL-001",
        "machine_id": "M004",
        "priority": 1,
        "items": [
            {"product_id": "P002", "item_type": "restock", "requested_quantity": 20}
        ]
    }
    response = requests.post(f"{BASE_URL}/api/tasks", json=task_data4)
    task = response.json()
    print(f"创建任务: {task['id']}")
    
    update_data = {
        "items": [
            {"product_id": "P002", "item_type": "restock", "requested_quantity": 35, "notes": "运营经理要求增加数量"}
        ]
    }
    response = requests.patch(
        f"{BASE_URL}/api/tasks/TASK-MANUAL-001?operator=运营经理",
        json=update_data
    )
    print(f"人工修改: {response.status_code}")
    
    print("\n步骤10: 查看历史记录（人工修改会留下diff）")
    response = requests.get(f"{BASE_URL}/api/tasks/TASK-MANUAL-001")
    task = response.json()
    print(f"\n历史记录:")
    for h in task['history']:
        print(f"  [{h['created_at']}] by {h['operator']}")
        if h['diff_before'] or h['diff_after']:
            print(f"    Before: {h['diff_before']}")
            print(f"    After:  {h['diff_after']}")
        print(f"    Reason: {h['reason']}")
    
    print("\n" + "="*60)
    print("DEMO 5 完成: 失败路径与异常处理 - SUCCESS")
    print("="*60)
    return True


if __name__ == "__main__":
    run_failure_demo()
