#!/usr/bin/env python3
import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"


def run_expiry_recovery_demo():
    print("="*60)
    print("DEMO 3: 临期商品回收流程")
    print("="*60)
    
    print("\n步骤1: 分析机器M002的补货需求（含过期商品P007好丽友派）")
    response = requests.get(f"{BASE_URL}/api/tasks/analyze/M002")
    print(f"状态码: {response.status_code}")
    analysis = response.json()
    
    print(f"\n机器: {analysis['machine_name']}")
    print(f"位置: {analysis['location']}")
    print(f"是否有故障: {analysis['has_fault']}")
    print(f"待处理任务数: {analysis['pending_tasks_count']}")
    
    print(f"\n补货需求详情:")
    for demand in analysis['demands']:
        print(f"  - {demand['product_id']}: {demand['reason']}")
        if demand['expiry_date']:
            print(f"    保质期: {demand['expiry_date']}")
    
    print("\n步骤2: 创建临期回收任务RECOVERY-001")
    task_data = {
        "id": "RECOVERY-001",
        "machine_id": "M002",
        "priority": 2,
        "notes": "M002科技园东门 - 缺货补货+过期商品回收",
        "assigned_operator": "陈师傅",
        "items": [
            {"product_id": "P002", "item_type": "restock", "requested_quantity": 35},
            {"product_id": "P006", "item_type": "restock", "requested_quantity": 19},
            {"product_id": "P007", "item_type": "recovery", "requested_quantity": 10}
        ]
    }
    response = requests.post(f"{BASE_URL}/api/tasks", json=task_data)
    print(f"任务创建: {response.status_code}")
    task = response.json()
    print(f"任务ID: {task['id']}")
    for item in task['items']:
        print(f"  {item['product_id']} ({item['item_type']}): {item['requested_quantity']}")
    
    print("\n步骤3: 创建回收路线ROUTE-RECOVERY")
    route_data = {
        "id": "ROUTE-RECOVERY",
        "name": "临期商品回收路线",
        "total_capacity": 300,
        "operator": "陈师傅",
        "vehicle_id": "VAN-RECOVERY",
        "scheduled_date": datetime.now().isoformat()
    }
    response = requests.post(f"{BASE_URL}/api/routes", json=route_data)
    print(f"路线创建: {response.status_code}")
    
    print("\n步骤4: 加入回收任务到路线")
    response = requests.post(f"{BASE_URL}/api/routes/ROUTE-RECOVERY/tasks/RECOVERY-001?operator=质量控制员")
    print(f"状态码: {response.status_code}")
    
    print("\n步骤5: 执行路线和任务")
    requests.post(f"{BASE_URL}/api/routes/ROUTE-RECOVERY/dispatch?operator=调度员")
    requests.post(f"{BASE_URL}/api/routes/ROUTE-RECOVERY/start?operator=陈师傅")
    requests.post(f"{BASE_URL}/api/tasks/RECOVERY-001/start?operator=陈师傅")
    
    actual_items = [
        {"product_id": "P002", "actual_quantity": 35},
        {"product_id": "P006", "actual_quantity": 19},
        {"product_id": "P007", "actual_quantity": 10}
    ]
    response = requests.post(
        f"{BASE_URL}/api/tasks/RECOVERY-001/execute?operator=陈师傅",
        json=actual_items
    )
    print(f"执行记录: {response.status_code}")
    
    requests.post(f"{BASE_URL}/api/tasks/RECOVERY-001/complete?operator=陈师傅")
    requests.post(f"{BASE_URL}/api/routes/ROUTE-RECOVERY/complete?operator=陈师傅")
    
    print("\n步骤6: 生成日报，查看回收统计")
    response = requests.get(f"{BASE_URL}/api/reports/daily")
    report = response.json()
    
    print(f"\n今日日报:")
    print(f"  总路线: {report['total_routes']}, 完成: {report['completed_routes']}")
    print(f"  总任务: {report['total_tasks']}, 完成: {report['completed_tasks']}")
    print(f"  补货总数: {report['total_quantity_restocked']}")
    print(f"  回收总数: {report['total_quantity_recovered']}")
    
    print(f"\n临期回收商品列表:")
    for item in report['recovery_items']:
        print(f"  {item['product_name']} @ {item['machine_name']}: {item['quantity']}个, 距过期{item['days_until_expiry']}天")
    
    print("\n" + "="*60)
    print("DEMO 3 完成: 临期商品回收流程 - SUCCESS")
    print("="*60)
    return True


if __name__ == "__main__":
    run_expiry_recovery_demo()
