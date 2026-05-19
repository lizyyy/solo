import requests
import json
import time
import os
from datetime import datetime

BASE_URL = "http://127.0.0.1:8765"

class bcolors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_test(name, passed, details=""):
    status = f"{bcolors.OKGREEN}✓ PASS{bcolors.ENDC}" if passed else f"{bcolors.FAIL}✗ FAIL{bcolors.ENDC}"
    print(f"  {status}: {name}")
    if details:
        print(f"    {bcolors.OKCYAN}{details}{bcolors.ENDC}")

def test_health_check():
    print(f"\n{bcolors.HEADER}{bcolors.BOLD}[1] 健康检查{bcolors.ENDC}")
    for i in range(5):
        try:
            response = requests.get(f"{BASE_URL}/", timeout=3)
            print(f"  Health check try {i+1}: status={response.status_code}")
            if response.status_code == 200 and response.json()["status"] == "ok":
                print_test("API服务正常", True)
                return True
        except Exception as e:
            print(f"  Health check try {i+1}: {e}")
            time.sleep(1)
    print_test("API服务正常", False, "多次重试失败")
    return False

def test_tenant_operations():
    print(f"\n{bcolors.HEADER}{bcolors.BOLD}[2] 租户管理测试{bcolors.ENDC}")
    all_passed = True
    
    tenant_data = {
        "tenant_id": "test_tenant_001",
        "tenant_name": "测试租户",
        "max_concurrent_tasks": 2,
        "max_daily_exports": 5,
        "max_file_size_mb": 100,
        "max_queue_size": 3,
        "quota_window_hours": 24
    }
    
    try:
        response = requests.post(f"{BASE_URL}/tenants", json=tenant_data)
        passed = response.status_code == 200
        print_test("创建租户", passed)
        all_passed &= passed
    except Exception as e:
        print_test("创建租户", False, str(e))
        return False
    
    try:
        response = requests.post(f"{BASE_URL}/tenants", json=tenant_data)
        passed = response.status_code == 400 and response.json()["detail"]["code"] == "ALREADY_PROCESSED"
        print_test("重复创建租户被拒绝", passed)
        all_passed &= passed
    except Exception as e:
        print_test("重复创建租户被拒绝", False, str(e))
        all_passed = False
    
    try:
        response = requests.get(f"{BASE_URL}/tenants/test_tenant_001")
        passed = response.status_code == 200 and response.json()["tenant_name"] == "测试租户"
        print_test("查询租户信息", passed)
        all_passed &= passed
    except Exception as e:
        print_test("查询租户信息", False, str(e))
        all_passed = False
    
    try:
        update_data = {"max_daily_exports": 10}
        response = requests.put(f"{BASE_URL}/tenants/test_tenant_001", json=update_data)
        passed = response.status_code == 200
        print_test("更新租户配额", passed)
        all_passed &= passed
    except Exception as e:
        print_test("更新租户配额", False, str(e))
        all_passed = False
    
    try:
        response = requests.get(f"{BASE_URL}/tenants/test_tenant_001")
        passed = response.json()["max_daily_exports"] == 10
        print_test("验证配额更新生效", passed)
        all_passed &= passed
    except Exception as e:
        print_test("验证配额更新生效", False, str(e))
        all_passed = False
    
    return all_passed

def test_quota_check():
    print(f"\n{bcolors.HEADER}{bcolors.BOLD}[3] 配额检查测试{bcolors.ENDC}")
    all_passed = True
    
    task_data = {
        "task_id": "task_check_001",
        "tenant_id": "test_tenant_001",
        "task_name": "测试导出任务",
        "file_size_mb": 50,
        "priority": 0
    }
    
    response = requests.post(f"{BASE_URL}/export-tasks/check", json=task_data)
    result = response.json()
    passed = response.status_code == 200 and not result["rejected"]
    print_test("配额充足时检查通过", passed, f"当前并发: {result['current_usage']['concurrent_tasks']}")
    all_passed &= passed
    
    big_task = task_data.copy()
    big_task["task_id"] = "task_check_002"
    big_task["file_size_mb"] = 200
    response = requests.post(f"{BASE_URL}/export-tasks/check", json=big_task)
    result = response.json()
    passed = response.status_code == 200 and result["rejected"] and "FILE_SIZE_EXCEEDS_LIMIT" in result["reason"]
    print_test("文件超限时拒绝", passed, f"原因: {result['reason']}")
    all_passed &= passed
    
    return all_passed

def test_export_task_workflow():
    print(f"\n{bcolors.HEADER}{bcolors.BOLD}[4] 导出任务工作流测试{bcolors.ENDC}")
    all_passed = True
    
    for i in range(1, 3):
        task_data = {
            "task_id": f"task_workflow_{i:03d}",
            "tenant_id": "test_tenant_001",
            "task_name": f"工作流任务{i}",
            "file_size_mb": 10,
            "priority": 0
        }
        response = requests.post(f"{BASE_URL}/export-tasks", json=task_data)
        passed = response.status_code == 200 and response.json()["status"] == "PROCESSING"
        print_test(f"创建并发任务{i} (PROCESSING)", passed)
        all_passed &= passed
    
    task_data = {
        "task_id": "task_workflow_003",
        "tenant_id": "test_tenant_001",
        "task_name": "排队任务",
        "file_size_mb": 10,
        "priority": 1
    }
    response = requests.post(f"{BASE_URL}/export-tasks", json=task_data)
    passed = response.status_code == 200 and response.json()["status"] == "PENDING"
    print_test("并发满时任务进入队列 (PENDING)", passed)
    all_passed &= passed
    
    response = requests.get(f"{BASE_URL}/tenants/test_tenant_001/usage")
    usage = response.json()
    passed = usage["concurrent_tasks"] == 2 and usage["queue_size"] == 1
    print_test("验证使用量统计", passed, f"并发: {usage['concurrent_tasks']}, 队列: {usage['queue_size']}")
    all_passed &= passed
    
    response = requests.put(f"{BASE_URL}/export-tasks/task_workflow_001/complete")
    passed = response.status_code == 200
    print_test("完成第一个任务", passed)
    all_passed &= passed
    
    response = requests.get(f"{BASE_URL}/export-tasks/task_workflow_003")
    passed = response.json()["status"] == "PROCESSING"
    print_test("队列任务自动启动", passed, f"状态: {response.json()['status']}")
    all_passed &= passed
    
    return all_passed

def test_quota_exceeded_rejection():
    print(f"\n{bcolors.HEADER}{bcolors.BOLD}[5] 配额超限拒绝测试{bcolors.ENDC}")
    all_passed = True
    
    for i in range(4, 8):
        task_data = {
            "task_id": f"task_quota_{i:03d}",
            "tenant_id": "test_tenant_001",
            "task_name": f"配额测试任务{i}",
            "file_size_mb": 10,
            "priority": 0
        }
        requests.post(f"{BASE_URL}/export-tasks", json=task_data)
        requests.put(f"{BASE_URL}/export-tasks/task_quota_{i:03d}/complete")
    
    task_data = {
        "task_id": "task_quota_reject",
        "tenant_id": "test_tenant_001",
        "task_name": "被拒绝任务",
        "file_size_mb": 10,
        "priority": 0
    }
    response = requests.post(f"{BASE_URL}/export-tasks", json=task_data)
    passed = response.status_code == 429 and "QUOTA_EXCEEDED" in response.json()["detail"]["code"]
    print_test("日配额超限时拒绝", passed, f"状态码: {response.status_code}")
    all_passed &= passed
    
    response = requests.get(f"{BASE_URL}/rejections", params={"tenant_id": "test_tenant_001"})
    rejections = response.json()
    passed = len(rejections) >= 1
    print_test("拒绝记录可查询", passed, f"拒绝记录数: {len(rejections)}")
    all_passed &= passed
    
    if rejections:
        rejection_id = rejections[0]["rejection_id"]
        response = requests.put(
            f"{BASE_URL}/rejections/{rejection_id}/review",
            params={"review_status": "APPROVED", "reviewed_by": "admin"}
        )
        passed = response.status_code == 200
        print_test("拒绝记录审核", passed)
        all_passed &= passed
    
    return all_passed

def test_queue_full_rejection():
    print(f"\n{bcolors.HEADER}{bcolors.BOLD}[6] 队列已满拒绝测试{bcolors.ENDC}")
    all_passed = True
    
    requests.post(f"{BASE_URL}/tenants", json={
        "tenant_id": "test_tenant_002",
        "tenant_name": "队列测试租户",
        "max_concurrent_tasks": 1,
        "max_daily_exports": 100,
        "max_file_size_mb": 100,
        "max_queue_size": 2,
        "quota_window_hours": 24
    })
    
    task_data = {
        "task_id": "queue_task_001",
        "tenant_id": "test_tenant_002",
        "task_name": "占用并发任务",
        "file_size_mb": 10,
        "priority": 0
    }
    requests.post(f"{BASE_URL}/export-tasks", json=task_data)
    
    for i in range(2, 4):
        task_data = {
            "task_id": f"queue_task_{i:03d}",
            "tenant_id": "test_tenant_002",
            "task_name": f"排队任务{i}",
            "file_size_mb": 10,
            "priority": 0
        }
        requests.post(f"{BASE_URL}/export-tasks", json=task_data)
    
    task_data = {
        "task_id": "queue_task_reject",
        "tenant_id": "test_tenant_002",
        "task_name": "被拒绝任务",
        "file_size_mb": 10,
        "priority": 0
    }
    response = requests.post(f"{BASE_URL}/export-tasks", json=task_data)
    passed = response.status_code == 429
    print_test("队列满时拒绝新任务", passed, f"状态码: {response.status_code}")
    all_passed &= passed
    
    return all_passed

def test_error_codes():
    print(f"\n{bcolors.HEADER}{bcolors.BOLD}[7] 错误码分类测试{bcolors.ENDC}")
    all_passed = True
    
    response = requests.get(f"{BASE_URL}/tenants/nonexistent")
    passed = response.status_code == 404 and response.json()["detail"]["code"] == "TENANT_NOT_FOUND"
    print_test("租户不存在错误码", passed)
    all_passed &= passed
    
    response = requests.get(f"{BASE_URL}/export-tasks/nonexistent_task")
    passed = response.status_code == 404 and response.json()["detail"]["code"] == "TASK_NOT_FOUND"
    print_test("任务不存在错误码", passed)
    all_passed &= passed
    
    response = requests.put(f"{BASE_URL}/export-tasks/task_workflow_002/complete")
    passed = response.status_code == 200
    if passed:
        response = requests.put(f"{BASE_URL}/export-tasks/task_workflow_002/complete")
        passed = response.status_code == 400 and response.json()["detail"]["code"] == "INVALID_STATUS"
    print_test("状态不允许错误码", passed)
    all_passed &= passed
    
    response = requests.put(f"{BASE_URL}/tenants/test_tenant_001", json={})
    passed = response.status_code == 400 and response.json()["detail"]["code"] == "MISSING_FIELD"
    print_test("缺少字段错误码", passed)
    all_passed &= passed
    
    response = requests.post(f"{BASE_URL}/export-tasks", json={})
    passed = response.status_code == 400 and response.json()["detail"]["code"] == "MISSING_FIELD"
    print_test("创建任务缺字段返回MISSING_FIELD", passed, f"实际响应: {response.json()}")
    all_passed &= passed
    
    return all_passed

def test_pending_task_quota_consumption():
    print(f"\n{bcolors.HEADER}{bcolors.BOLD}[8] PENDING任务配额消耗测试{bcolors.ENDC}")
    all_passed = True
    
    requests.post(f"{BASE_URL}/tenants", json={
        "tenant_id": "test_tenant_quota",
        "tenant_name": "配额测试租户",
        "max_concurrent_tasks": 1,
        "max_daily_exports": 3,
        "max_file_size_mb": 100,
        "max_queue_size": 5,
        "quota_window_hours": 24
    })
    
    task1 = {"task_id": "quota_test_001", "tenant_id": "test_tenant_quota", "task_name": "任务1", "file_size_mb": 10, "priority": 0}
    requests.post(f"{BASE_URL}/export-tasks", json=task1)
    
    task2 = {"task_id": "quota_test_002", "tenant_id": "test_tenant_quota", "task_name": "任务2", "file_size_mb": 10, "priority": 0}
    requests.post(f"{BASE_URL}/export-tasks", json=task2)
    
    task3 = {"task_id": "quota_test_003", "tenant_id": "test_tenant_quota", "task_name": "任务3", "file_size_mb": 10, "priority": 0}
    requests.post(f"{BASE_URL}/export-tasks", json=task3)
    
    response = requests.get(f"{BASE_URL}/tenants/test_tenant_quota/usage")
    usage = response.json()
    passed = usage["window_exports"] == 3
    print_test("PENDING任务占用窗口配额", passed, f"窗口导出数: {usage['window_exports']}, 期望: 3")
    all_passed &= passed
    
    task4 = {"task_id": "quota_test_004", "tenant_id": "test_tenant_quota", "task_name": "任务4", "file_size_mb": 10, "priority": 0}
    response = requests.post(f"{BASE_URL}/export-tasks", json=task4)
    passed = response.status_code == 429
    print_test("配额满后拒绝新任务", passed, f"状态码: {response.status_code}")
    all_passed &= passed
    
    response = requests.put(f"{BASE_URL}/export-tasks/quota_test_001/complete")
    print_test("完成第一个任务", response.status_code == 200)
    
    response = requests.get(f"{BASE_URL}/export-tasks/quota_test_002")
    passed = response.json()["status"] == "PROCESSING"
    print_test("队列任务自动启动(无需重新扣配额)", passed, f"状态: {response.json()['status']}")
    all_passed &= passed
    
    response = requests.get(f"{BASE_URL}/tenants/test_tenant_quota/usage")
    usage = response.json()
    passed = usage["window_exports"] == 3
    print_test("队列任务启动后配额不变", passed, f"窗口导出数: {usage['window_exports']}")
    all_passed &= passed
    
    return all_passed

def test_export_report():
    print(f"\n{bcolors.HEADER}{bcolors.BOLD}[9] 用量报告导出测试{bcolors.ENDC}")
    all_passed = True
    
    response = requests.get(f"{BASE_URL}/reports/usage/export", params={"tenant_id": "test_tenant_001"})
    passed = response.status_code == 200 and "text/csv" in response.headers["content-type"]
    print_test("导出CSV报告", passed, f"文件大小: {len(response.content)} bytes")
    all_passed &= passed
    
    if passed:
        print(f"    {bcolors.OKCYAN}CSV内容预览:{bcolors.ENDC}")
        lines = response.text.split("\n")[:3]
        for line in lines:
            if line:
                print(f"      {line}")
    
    return all_passed

def run_all_tests():
    print(f"{bcolors.BOLD}{bcolors.HEADER}")
    print("="*60)
    print("    异步导出配额拒绝理由后端API - 自检脚本")
    print("="*60)
    print(f"{bcolors.ENDC}")
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"目标地址: {BASE_URL}")
    
    results = []
    
    results.append(("健康检查", test_health_check()))
    results.append(("租户管理", test_tenant_operations()))
    results.append(("配额检查", test_quota_check()))
    results.append(("任务工作流", test_export_task_workflow()))
    results.append(("配额超限拒绝", test_quota_exceeded_rejection()))
    results.append(("队列满拒绝", test_queue_full_rejection()))
    results.append(("错误码分类", test_error_codes()))
    results.append(("PENDING任务配额", test_pending_task_quota_consumption()))
    results.append(("报告导出", test_export_report()))
    
    print(f"\n{bcolors.HEADER}{bcolors.BOLD}")
    print("="*60)
    print("    测试结果汇总")
    print("="*60)
    print(f"{bcolors.ENDC}")
    
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)
    
    for name, passed in results:
        status = f"{bcolors.OKGREEN}通过{bcolors.ENDC}" if passed else f"{bcolors.FAIL}失败{bcolors.ENDC}"
        print(f"  {name}: {status}")
    
    print(f"\n{bcolors.BOLD}总计: {passed_count}/{total_count} 测试通过{bcolors.ENDC}")
    
    if passed_count == total_count:
        print(f"\n{bcolors.OKGREEN}{bcolors.BOLD}✓ 所有测试通过！API功能正常。{bcolors.ENDC}")
    else:
        print(f"\n{bcolors.FAIL}{bcolors.BOLD}✗ 部分测试失败，请检查API实现。{bcolors.ENDC}")
    
    return passed_count == total_count

if __name__ == "__main__":
    if os.path.exists("export_quota.db"):
        os.remove("export_quota.db")
        print("已清理旧数据库文件")
    
    import subprocess
    import sys
    
    print("启动API服务...")
    server = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8765"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    time.sleep(4)
    for i in range(5):
        try:
            requests.get(f"{BASE_URL}/", timeout=2)
            break
        except:
            time.sleep(1)
    
    try:
        success = run_all_tests()
    finally:
        print("\n停止API服务...")
        server.terminate()
        server.wait()
    
    sys.exit(0 if success else 1)
