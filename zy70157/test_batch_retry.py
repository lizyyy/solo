#!/usr/bin/env python3
"""批任务补偿窗口 API 测试脚本"""
import sys
import time
import httpx
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"


def print_separator(title=""):
    print("=" * 60)
    if title:
        print(f"  {title}")
        print("=" * 60)


def check_server():
    """检查服务是否启动"""
    try:
        response = httpx.get(f"{BASE_URL}/health", timeout=5)
        return response.status_code == 200
    except:
        return False


def test_complete_flow():
    """测试完整的补跑流程"""
    job_id = "TEST_JOB_001"
    task_a_id = "TASK_A_001"
    task_b_id = "TASK_B_001"
    business_date = "2026-05-10"
    
    print_separator("步骤1：创建批作业")
    
    job_payload = {
        "id": job_id,
        "name": "数据同步批处理作业",
        "description": "每日数据同步任务",
        "retry_window_hours": 48,
        "max_retries": 5,
        "is_active": True
    }
    
    response = httpx.post(f"{BASE_URL}/api/jobs", json=job_payload)
    print(f"创建作业: {response.status_code}")
    print(f"响应: {response.json()}")
    
    print_separator("步骤2：添加任务依赖关系 (A -> B)")
    
    dep_payload = {
        "job_id": job_id,
        "source_task": "extract_data",
        "target_task": "transform_data",
        "is_soft_dependency": False
    }
    
    response = httpx.post(f"{BASE_URL}/api/dependencies", json=dep_payload)
    print(f"添加依赖: {response.status_code}")
    print(f"响应: {response.json()}")
    
    print_separator("步骤3：创建任务实例")
    
    task_a_payload = {
        "id": task_a_id,
        "job_id": job_id,
        "task_name": "extract_data",
        "business_date": business_date,
        "max_retries": 3,
        "input_data": {"source": "database", "table": "users"}
    }
    
    response = httpx.post(f"{BASE_URL}/api/task-instances", json=task_a_payload)
    print(f"创建任务A (extract_data): {response.status_code}")
    print(f"响应: {response.json()}")
    
    task_b_payload = {
        "id": task_b_id,
        "job_id": job_id,
        "task_name": "transform_data",
        "business_date": business_date,
        "max_retries": 3,
        "input_data": {"transform_type": "clean_and_normalize"}
    }
    
    response = httpx.post(f"{BASE_URL}/api/task-instances", json=task_b_payload)
    print(f"创建任务B (transform_data): {response.status_code}")
    print(f"响应: {response.json()}")
    
    print_separator("步骤4：模拟任务A执行失败")
    
    response = httpx.post(
        f"{BASE_URL}/api/task-instances/{task_a_id}/fail",
        params={"error_message": "数据库连接超时"}
    )
    print(f"任务A失败: {response.status_code}")
    print(f"响应: {response.json()}")
    
    print_separator("步骤5：检查任务B的依赖（应该显示任务A失败）")
    
    response = httpx.get(
        f"{BASE_URL}/api/task-instances/{task_b_id}/check-dependencies"
    )
    print(f"任务B依赖检查: {response.status_code}")
    result = response.json()
    print(f"依赖检查结果: {result}")
    print(f"任务B是否可执行: {'是' if result['is_ready'] else '否'}")
    print(f"失败的前置任务: {result['failed_dependencies']}")
    
    print_separator("步骤6：检查任务A的补跑窗口")
    
    response = httpx.get(
        f"{BASE_URL}/api/task-instances/{task_a_id}/check-window"
    )
    print(f"任务A窗口检查: {response.status_code}")
    result = response.json()
    print(f"窗口检查结果: {result}")
    print(f"是否在窗口内: {'是' if result['is_within_window'] else '否'}")
    
    print_separator("步骤7：检查任务A的重入锁（应该可以获取）")
    
    response = httpx.get(
        f"{BASE_URL}/api/task-instances/{task_a_id}/check-reentrancy"
    )
    print(f"任务A重入检查: {response.status_code}")
    result = response.json()
    print(f"重入检查结果: {result}")
    print(f"是否可以获取锁: {'是' if result['can_acquire'] else '否'}")
    
    print_separator("步骤8：为任务A创建补跑申请")
    
    retry_payload = {
        "task_instance_id": task_a_id,
        "requester": "system_operator",
        "reason": "数据库连接已恢复，需要补跑",
        "retry_type": "single",
        "target_retry_count": 3,
        "skip_rules": {
            "skip_if_predecessor_failed": False,
            "skip_if_already_succeeded": True,
            "skip_if_retry_count_exceeded": True
        }
    }
    
    response = httpx.post(f"{BASE_URL}/api/retry-requests", json=retry_payload)
    print(f"创建补跑申请: {response.status_code}")
    retry_request = response.json()
    print(f"补跑申请ID: {retry_request['id']}")
    print(f"申请状态: {retry_request['status']}")
    print(f"是否在窗口内: {retry_request['is_within_window']}")
    request_id = retry_request["id"]
    
    print_separator("步骤9：校验补跑申请（审批前预览）")
    
    response = httpx.post(f"{BASE_URL}/api/retry-requests/{request_id}/validate")
    print(f"校验补跑条件: {response.status_code}")
    validation = response.json()
    print(f"校验是否通过: {'是' if validation['is_valid'] else '否'}")
    print(f"错误: {validation['errors']}")
    print(f"警告: {validation['warnings']}")
    
    print_separator("步骤10：审批通过补跑申请")
    
    approve_payload = {
        "approved_by": "admin_user",
        "notes": "确认为临时网络问题导致的失败"
    }
    
    response = httpx.post(
        f"{BASE_URL}/api/retry-requests/{request_id}/approve",
        json=approve_payload
    )
    print(f"审批补跑申请: {response.status_code}")
    approved = response.json()
    print(f"审批后状态: {approved['status']}")
    print(f"审批人: {approved['approved_by']}")
    
    print_separator("步骤11：执行补跑")
    
    execute_payload = {
        "task_instance_id": task_a_id,
        "executor_id": "batch_executor_01"
    }
    
    response = httpx.post(
        f"{BASE_URL}/api/retry-requests/{request_id}/execute",
        json=execute_payload
    )
    print(f"执行补跑: {response.status_code}")
    result = response.json()
    print(f"执行结果: {result}")
    print(f"补跑成功: {'是' if result.get('success') else '否'}")
    print(f"最终状态: {result.get('status')}")
    
    print_separator("步骤12：查看任务A执行报告")
    
    response = httpx.get(
        f"{BASE_URL}/api/task-instances/{task_a_id}/reports"
    )
    print(f"获取执行报告: {response.status_code}")
    reports = response.json()
    print(f"报告数量: {len(reports)}")
    if reports:
        latest = reports[0]
        print(f"最新报告ID: {latest['id']}")
        print(f"报告状态: {latest['status']}")
        print(f"是否影响最终结果: {'是' if latest['affected_final_result'] else '否'}")
        print(f"输出快照: {latest.get('output_snapshot')}")
    
    print_separator("步骤13：查看任务A最新状态")
    
    response = httpx.get(f"{BASE_URL}/api/task-instances/{task_a_id}")
    print(f"获取任务A详情: {response.status_code}")
    task_a = response.json()
    print(f"任务A状态: {task_a['status']}")
    print(f"重试次数: {task_a['retry_count']}/{task_a['max_retries']}")
    print(f"输出数据: {task_a.get('output_data')}")
    
    print_separator("步骤14：再次检查任务B的依赖（现在应该可执行）")
    
    response = httpx.get(
        f"{BASE_URL}/api/task-instances/{task_b_id}/check-dependencies"
    )
    print(f"任务B依赖检查: {response.status_code}")
    result = response.json()
    print(f"依赖检查结果: {result}")
    print(f"任务B是否可执行: {'是' if result['is_ready'] else '否'}")
    
    print_separator("步骤15：查看异常记录列表")
    
    response = httpx.get(f"{BASE_URL}/api/exceptions", params={"resolved": False})
    print(f"获取待处理异常: {response.status_code}")
    exceptions = response.json()
    print(f"待处理异常数量: {len(exceptions)}")
    for exc in exceptions:
        print(f"  - [{exc['exception_type']}] {exc['title']}: {exc['details']}")
    
    print_separator("测试完成")
    print("请按照说明文档，通过以上步骤验证各功能模块是否正常工作。")


def test_edge_cases():
    """测试边界情况"""
    print_separator("边界情况测试")
    
    job_id = "EDGE_JOB_001"
    task_id = "EDGE_TASK_001"
    business_date = "2026-05-10"
    
    print("\n1. 创建一个短窗口的作业 (1小时窗口)")
    
    job_payload = {
        "id": job_id,
        "name": "边界测试作业",
        "retry_window_hours": 1,
        "max_retries": 1,
        "is_active": True
    }
    
    response = httpx.post(f"{BASE_URL}/api/jobs", json=job_payload)
    print(f"   创建作业: {response.status_code}")
    
    print("\n2. 创建任务实例并立即失败")
    
    task_payload = {
        "id": task_id,
        "job_id": job_id,
        "task_name": "edge_task",
        "business_date": business_date,
        "max_retries": 1
    }
    
    response = httpx.post(f"{BASE_URL}/api/task-instances", json=task_payload)
    print(f"   创建任务: {response.status_code}")
    
    response = httpx.post(
        f"{BASE_URL}/api/task-instances/{task_id}/fail",
        params={"error_message": "边界测试失败"}
    )
    print(f"   任务失败: {response.status_code}")
    
    print("\n3. 创建补跑申请")
    
    retry_payload = {
        "task_instance_id": task_id,
        "requester": "tester",
        "reason": "边界测试",
        "target_retry_count": 1
    }
    
    response = httpx.post(f"{BASE_URL}/api/retry-requests", json=retry_payload)
    print(f"   创建补跑申请: {response.status_code}")
    request = response.json()
    request_id = request["id"]
    print(f"   申请ID: {request_id}")
    print(f"   是否在窗口内: {request['is_within_window']}")
    
    print("\n4. 审批并执行第一次")
    
    response = httpx.post(
        f"{BASE_URL}/api/retry-requests/{request_id}/approve",
        json={"approved_by": "admin"}
    )
    print(f"   审批: {response.status_code}")
    
    response = httpx.post(
        f"{BASE_URL}/api/retry-requests/{request_id}/execute",
        json={"task_instance_id": task_id, "executor_id": "test"}
    )
    print(f"   执行: {response.status_code}")
    result = response.json()
    print(f"   执行结果: {result.get('status')}")
    
    print("\n5. 再次失败任务，然后创建第二个补跑申请")
    
    response = httpx.post(
        f"{BASE_URL}/api/task-instances/{task_id}/fail",
        params={"error_message": "再次失败"}
    )
    print(f"   任务再次失败: {response.status_code}")
    task = httpx.get(f"{BASE_URL}/api/task-instances/{task_id}").json()
    print(f"   当前重试次数: {task['retry_count']}/{task['max_retries']}")
    
    retry_payload2 = {
        "task_instance_id": task_id,
        "requester": "tester",
        "reason": "再次补跑测试",
        "target_retry_count": 1
    }
    
    response = httpx.post(f"{BASE_URL}/api/retry-requests", json=retry_payload2)
    print(f"   创建第二个补跑申请: {response.status_code}")
    request2 = response.json()
    request_id2 = request2["id"]
    
    print("\n6. 校验第二个补跑申请（应该因为重试次数超限而失败）")
    
    response = httpx.post(f"{BASE_URL}/api/retry-requests/{request_id2}/validate")
    validation = response.json()
    print(f"   校验是否通过: {'是' if validation['is_valid'] else '否'}")
    print(f"   错误信息: {validation['errors']}")
    
    print("\n7. 审批并尝试执行（应该失败）")
    
    response = httpx.post(
        f"{BASE_URL}/api/retry-requests/{request_id2}/approve",
        json={"approved_by": "admin"}
    )
    print(f"   审批: {response.status_code}")
    
    response = httpx.post(
        f"{BASE_URL}/api/retry-requests/{request_id2}/execute",
        json={"task_instance_id": task_id, "executor_id": "test"}
    )
    print(f"   执行: {response.status_code}")
    result = response.json()
    print(f"   执行结果: {result.get('status')}")
    print(f"   校验错误: {result.get('validation_errors')}")
    
    print("\n8. 查看异常记录（应该有条目）")
    
    response = httpx.get(f"{BASE_URL}/api/exceptions")
    exceptions = response.json()
    print(f"   异常记录数量: {len(exceptions)}")
    for exc in exceptions[:3]:
        print(f"   - [{exc['exception_type']}] {exc['title']}")
    
    print_separator("边界测试完成")


if __name__ == "__main__":
    print("\n批任务补偿窗口 API 测试脚本")
    print("=" * 60)
    
    if not check_server():
        print("\n❌ 错误：无法连接到服务器")
        print("请先启动服务器: python -m uvicorn app.main:app --reload")
        sys.exit(1)
    
    print("✅ 服务器连接成功\n")
    
    test_complete_flow()
    print("\n" + "=" * 60 + "\n")
    test_edge_cases()
