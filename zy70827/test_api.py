import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"
API_PREFIX = "/api/v1"


def test_full_workflow():
    print("=" * 60)
    print("直播样品寄送回收系统 - 完整工作流测试")
    print("=" * 60)
    
    print("\n1. 创建测试用户")
    user_response = requests.post(
        f"{BASE_URL}{API_PREFIX}/users",
        params={
            "username": "admin",
            "password": "123456",
            "full_name": "样品管理员"
        }
    )
    print(f"   状态码: {user_response.status_code}")
    if user_response.status_code == 200:
        user_data = user_response.json()
        operator_id = user_data['id']
        print(f"   ✓ 用户创建成功: {user_data}")
    else:
        users_response = requests.get(f"{BASE_URL}{API_PREFIX}/users")
        users = users_response.json()
        operator_id = users[0]['id'] if users else 1
        print(f"   使用现有用户 ID: {operator_id}")
    
    live_date = (datetime.now() + timedelta(days=7)).isoformat()
    
    print("\n2. 创建正常任务（数据完整）")
    normal_task = {
        "task_no": "TASK-001",
        "batch_no": "BATCH-2024-001",
        "samples": [
            {
                "sample_code": "SAMPLE-001",
                "sample_name": "测试样品A",
                "quantity": 10,
                "unit": "件"
            }
        ],
        "brand_batch": {
            "batch_no": "BATCH-2024-001",
            "brand_name": "测试品牌",
            "product_line": "美妆"
        },
        "talent_schedule": {
            "schedule_no": "SCHED-001",
            "talent_name": "测试达人",
            "talent_id": "TALENT-001",
            "live_date": live_date,
            "platform": "抖音",
            "room_id": "ROOM-12345"
        },
        "deposit": {
            "amount": 5000.0,
            "currency": "CNY",
            "deduction_reason": "样品押金"
        },
        "submitted_by": "admin"
    }
    
    response1 = requests.post(
        f"{BASE_URL}{API_PREFIX}/tasks",
        json=normal_task
    )
    print(f"   状态码: {response1.status_code}")
    if response1.status_code == 200:
        task1 = response1.json()
        print(f"   ✓ 任务创建成功")
        print(f"     任务编号: {task1['task_no']}")
        print(f"     分类: {task1['category']}")
        print(f"     状态: {task1['status']}")
        print(f"     分类原因: {task1['category_reason']}")
    else:
        print(f"   ✗ 错误: {response1.text}")
        return
    
    print("\n3. 创建待补充任务（缺少字段）")
    supplement_task = {
        "task_no": "TASK-002",
        "batch_no": "BATCH-2024-002",
        "samples": [
            {
                "sample_code": "",
                "sample_name": "样品B",
                "quantity": 5,
                "unit": "件"
            }
        ],
        "submitted_by": "admin"
    }
    
    response2 = requests.post(
        f"{BASE_URL}{API_PREFIX}/tasks",
        json=supplement_task
    )
    print(f"   状态码: {response2.status_code}")
    if response2.status_code == 200:
        task2 = response2.json()
        print(f"   ✓ 任务创建成功")
        print(f"     任务编号: {task2['task_no']}")
        print(f"     分类: {task2['category']}")
        print(f"     状态: {task2['status']}")
        print(f"     分类原因: {task2['category_reason']}")
        
        print("\n4. 查看错误明细")
        errors_response = requests.get(f"{BASE_URL}{API_PREFIX}/tasks/{task2['id']}/errors")
        errors = errors_response.json()
        print(f"   错误数量: {len(errors)}")
        for err in errors:
            print(f"     - {err['error_type']}: {err['error_message']}")
    
    print("\n5. 创建已拦截任务（重复编号）")
    duplicate_task = {
        "task_no": "TASK-001",
        "batch_no": "BATCH-2024-003",
        "samples": [
            {
                "sample_code": "SAMPLE-003",
                "sample_name": "样品C",
                "quantity": 3,
                "unit": "件"
            }
        ],
        "submitted_by": "admin"
    }
    
    response3 = requests.post(
        f"{BASE_URL}{API_PREFIX}/tasks",
        json=duplicate_task
    )
    print(f"   状态码: {response3.status_code}")
    if response3.status_code == 200:
        task3 = response3.json()
        print(f"   ✓ 任务创建成功")
        print(f"     任务编号: {task3['task_no']}")
        print(f"     分类: {task3['category']}")
        print(f"     状态: {task3['status']}")
        print(f"     分类原因: {task3['category_reason']}")
    
    print("\n6. 查询任务列表")
    list_response = requests.get(f"{BASE_URL}{API_PREFIX}/tasks")
    tasks = list_response.json()
    print(f"   任务总数: {len(tasks)}")
    for t in tasks:
        print(f"     - {t['task_no']} | {t['category']} | {t['status']}")
    
    print("\n7. 测试破损照片校验和结清功能")
    task_id = task1['id']
    
    print(f"   7.1 获取任务 {task_id} 的样品列表")
    samples_response = requests.get(f"{BASE_URL}{API_PREFIX}/tasks/{task_id}/samples")
    samples = samples_response.json()
    sample_id = samples[0]['id']
    print(f"       样品 ID: {sample_id}")
    
    print(f"   7.2 检查是否可以结清（未上传照片）")
    can_settle_response = requests.get(f"{BASE_URL}{API_PREFIX}/tasks/{task_id}/can-settle")
    print(f"       {can_settle_response.json()}")
    
    print(f"   7.3 尝试结清（应该失败）")
    settle_response = requests.post(
        f"{BASE_URL}{API_PREFIX}/tasks/settle",
        json={
            "task_id": task_id,
            "operator_id": operator_id,
            "remark": "测试结清"
        }
    )
    print(f"       状态码: {settle_response.status_code}")
    print(f"       结果: {settle_response.json()}")
    
    print(f"   7.4 上传破损照片")
    photo_response = requests.put(
        f"{BASE_URL}{API_PREFIX}/samples/damage-photo",
        json={
            "sample_id": sample_id,
            "has_damage_photo": True,
            "damage_photo_url": "https://example.com/photo.jpg",
            "operator_id": operator_id,
            "reason": "样品回收检查，已上传照片"
        }
    )
    print(f"       状态码: {photo_response.status_code}")
    if photo_response.status_code == 200:
        print(f"       ✓ 照片状态已更新")
    
    print(f"   7.5 再次检查是否可以结清")
    can_settle_response2 = requests.get(f"{BASE_URL}{API_PREFIX}/tasks/{task_id}/can-settle")
    print(f"       {can_settle_response2.json()}")
    
    print(f"   7.6 再次尝试结清（应该成功）")
    settle_response2 = requests.post(
        f"{BASE_URL}{API_PREFIX}/tasks/settle",
        json={
            "task_id": task_id,
            "operator_id": operator_id,
            "remark": "测试结清，所有照片已上传"
        }
    )
    print(f"       状态码: {settle_response2.status_code}")
    if settle_response2.status_code == 200:
        result = settle_response2.json()
        print(f"       ✓ 结清成功，当前状态: {result['status']}")
    
    print("\n8. 查看审计日志")
    audit_response = requests.get(f"{BASE_URL}{API_PREFIX}/tasks/{task_id}/audit-logs")
    logs = audit_response.json()
    print(f"   日志数量: {len(logs)}")
    for log in logs:
        print(f"     - {log['operated_at']}")
        print(f"       操作人: {log['operator_name']}")
        print(f"       操作: {log['action']}")
        print(f"       字段: {log['field_changed']}")
        print(f"       旧值: {log['old_value']}")
        print(f"       新值: {log['new_value']}")
        print(f"       原因: {log['reason']}")
    
    print("\n9. 查看品牌批次和达人档期")
    brand_response = requests.get(f"{BASE_URL}{API_PREFIX}/brand-batches")
    print(f"   品牌批次: {len(brand_response.json())} 条")
    
    talent_response = requests.get(f"{BASE_URL}{API_PREFIX}/talent-schedules")
    print(f"   达人档期: {len(talent_response.json())} 条")
    
    print("\n" + "=" * 60)
    print("测试完成！")
    print(f"API 文档地址: {BASE_URL}/docs")
    print("=" * 60)


if __name__ == "__main__":
    try:
        test_full_workflow()
    except requests.exceptions.ConnectionError:
        print("错误: 无法连接到服务器，请先运行: python -m uvicorn main:app --reload")
