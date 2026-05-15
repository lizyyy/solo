#!/usr/bin/env python3

import requests
import json
import time

BASE_URL = "http://localhost:8000"


def check_service():
    """检查服务是否启动"""
    print("检查服务状态...", end="")
    for i in range(30):
        try:
            response = requests.get(f"{BASE_URL}/health", timeout=2)
            if response.status_code == 200:
                print(" ✓")
                return True
        except:
            pass
        print(".", end="", flush=True)
        time.sleep(1)
    print(" ✗")
    print("服务启动超时，请先运行 ./start.sh 启动服务")
    return False


def test_create_main_task():
    """测试创建主任务"""
    print("\n=== 测试: 创建主任务 ===")
    data = {
        "task_id": "TEST_MAIN_001",
        "name": "测试主任务",
        "description": "测试描述"
    }
    response = requests.post(f"{BASE_URL}/tasks/", json=data)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        print("✓ 创建成功")
        return True
    else:
        print(f"✗ 创建失败: {response.text}")
        return False


def test_create_sub_tasks():
    """测试创建子任务"""
    print("\n=== 测试: 创建子任务 ===")
    success = True
    for i in range(1, 4):
        data = {
            "sub_task_id": f"TEST_SUB_{i:03d}",
            "name": f"测试子任务{i}",
            "description": f"子任务{i}描述",
            "order": i
        }
        response = requests.post(f"{BASE_URL}/tasks/TEST_MAIN_001/sub-tasks/", json=data)
        if response.status_code == 200:
            print(f"✓ 子任务 TEST_SUB_{i:03d} 创建成功")
        else:
            print(f"✗ 子任务 TEST_SUB_{i:03d} 创建失败: {response.status_code}")
            success = False
    return success


def test_add_resources():
    """测试添加临时资源"""
    print("\n=== 测试: 添加临时资源 ===")
    resources = [
        ("TEST_SUB_001", "RES_TEST_001", "temp_file", "/tmp/test1.csv", 1000),
        ("TEST_SUB_002", "RES_TEST_002", "temp_file", "/tmp/test2.csv", 2000),
        ("TEST_SUB_003", "RES_TEST_003", "db_conn", "db://test", 0),
    ]
    
    success = True
    for sub_task_id, resource_id, res_type, location, size in resources:
        data = {
            "resource_id": resource_id,
            "resource_type": res_type,
            "resource_location": location,
            "size_bytes": size
        }
        response = requests.post(f"{BASE_URL}/sub-tasks/{sub_task_id}/resources/", json=data)
        if response.status_code == 200:
            print(f"✓ 资源 {resource_id} 添加成功")
        else:
            print(f"✗ 资源 {resource_id} 添加失败: {response.status_code}")
            success = False
    return success


def test_cancel_task():
    """测试发起任务取消"""
    print("\n=== 测试: 发起任务取消 ===")
    data = {
        "task_id": "TEST_MAIN_001",
        "reason_code": "TEST_CANCEL",
        "reason_message": "测试取消原因",
        "triggered_by": "tester",
        "suppress_notification": True,
        "idempotency_key": "test_idempotency_001"
    }
    response = requests.post(f"{BASE_URL}/tasks/cancel", json=data)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"✓ 取消请求成功: {json.dumps(result, indent=2, ensure_ascii=False)}")
        return True
    else:
        print(f"✗ 取消请求失败: {response.text}")
        return False


def test_propagate_cancel():
    """测试执行取消传播"""
    print("\n=== 测试: 执行取消传播 ===")
    response = requests.post(f"{BASE_URL}/tasks/TEST_MAIN_001/propagate")
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"✓ 传播执行成功: {json.dumps(result, indent=2, ensure_ascii=False)}")
        return True
    else:
        print(f"✗ 传播执行失败: {response.text}")
        return False


def test_get_progress():
    """测试查询传播进度"""
    print("\n=== 测试: 查询传播进度 ===")
    response = requests.get(f"{BASE_URL}/tasks/TEST_MAIN_001/progress")
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"✓ 查询成功: {json.dumps(result, indent=2, ensure_ascii=False)}")
        return True
    else:
        print(f"✗ 查询失败: {response.text}")
        return False


def test_get_task_detail():
    """测试查询任务详情"""
    print("\n=== 测试: 查询任务详情 ===")
    response = requests.get(f"{BASE_URL}/tasks/TEST_MAIN_001")
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print("✓ 查询成功")
        print(f"  主任务状态: {result['main_task']['status']}")
        print(f"  子任务数量: {len(result['sub_tasks'])}")
        print(f"  取消原因存在: {result['cancel_reason'] is not None}")
        print(f"  传播状态存在: {result['propagation'] is not None}")
        return True
    else:
        print(f"✗ 查询失败: {response.text}")
        return False


def test_get_cleanup_results():
    """测试查询清理结果"""
    print("\n=== 测试: 查询清理结果 ===")
    response = requests.get(f"{BASE_URL}/tasks/TEST_MAIN_001/cleanup-results")
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        results = response.json()
        print(f"✓ 查询成功，清理结果数量: {len(results)}")
        for i, result in enumerate(results):
            print(f"  {i+1}. 资源ID: {result['resource_id']}, 状态: {result['status']}")
        return True
    else:
        print(f"✗ 查询失败: {response.text}")
        return False


def test_cancel_completed_task():
    """测试异常场景：取消已完成的任务"""
    print("\n=== 测试异常场景: 取消已完成的任务 ===")
    
    # 先创建一个新任务
    requests.post(f"{BASE_URL}/tasks/", json={
        "task_id": "TEST_COMPLETED",
        "name": "已完成的任务"
    })
    
    # 将任务状态设为 completed
    requests.put(f"{BASE_URL}/tasks/TEST_COMPLETED/status?status=completed")
    
    # 尝试取消
    data = {
        "task_id": "TEST_COMPLETED",
        "reason_code": "TEST",
        "reason_message": "测试"
    }
    response = requests.post(f"{BASE_URL}/tasks/cancel", json=data)
    print(f"状态码: {response.status_code}")
    if response.status_code == 400:
        print("✓ 正确返回错误（预期行为：不能取消已完成的任务）")
        return True
    else:
        print(f"✗ 预期返回400，但得到 {response.status_code}")
        return False


def test_simulate_propagation_failure():
    """测试异常场景：模拟传播过程中失败"""
    print("\n=== 测试异常场景: 模拟传播过程中失败 ===")
    
    # 先创建一个新任务和子任务
    requests.post(f"{BASE_URL}/tasks/", json={
        "task_id": "TEST_FAIL",
        "name": "测试传播失败的任务"
    })
    
    for i in range(1, 4):
        requests.post(f"{BASE_URL}/tasks/TEST_FAIL/sub-tasks/", json={
            "sub_task_id": f"TEST_FAIL_SUB_{i}",
            "name": f"失败测试子任务{i}",
            "order": i
        })
    
    # 先发起取消
    requests.post(f"{BASE_URL}/tasks/cancel", json={
        "task_id": "TEST_FAIL",
        "reason_code": "TEST",
        "reason_message": "测试"
    })
    
    # 执行传播，指定在索引1处失败
    response = requests.post(f"{BASE_URL}/tasks/TEST_FAIL/propagate?fail_at_index=1")
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"✓ 传播完成（包含预期的失败）")
        print(f"  失败子任务数量: {result.get('failed_sub_tasks', 0)}")
        print(f"  传播状态: {result.get('propagation_status')}")
        return True
    else:
        print(f"✗ 请求失败: {response.text}")
        return False


def test_idempotency():
    """测试幂等性：重复提交相同请求不会产生脏数据"""
    print("\n=== 测试幂等性: 重复提交不会产生脏数据 ===")
    
    # 创建一个新任务
    requests.post(f"{BASE_URL}/tasks/", json={
        "task_id": "TEST_IDEMPOTENT",
        "name": "幂等性测试任务"
    })
    
    idempotency_key = "test_idempotency_key_001"
    data = {
        "task_id": "TEST_IDEMPOTENT",
        "reason_code": "TEST_IDEMPOTENT",
        "reason_message": "幂等性测试",
        "idempotency_key": idempotency_key
    }
    
    # 第一次提交
    response1 = requests.post(f"{BASE_URL}/tasks/cancel", json=data)
    result1 = response1.json()
    
    # 第二次提交（相同的 idempotency_key）
    response2 = requests.post(f"{BASE_URL}/tasks/cancel", json=data)
    result2 = response2.json()
    
    # 比较结果应该相同
    if result1 == result2:
        print("✓ 两次请求返回相同结果，幂等性生效")
        return True
    else:
        print("✗ 两次请求结果不同，幂等性可能有问题")
        return False


def test_not_found_task():
    """测试异常场景：查询不存在的任务"""
    print("\n=== 测试异常场景: 查询不存在的任务 ===")
    response = requests.get(f"{BASE_URL}/tasks/NON_EXISTENT_TASK")
    print(f"状态码: {response.status_code}")
    if response.status_code == 404:
        print("✓ 正确返回404（预期行为）")
        return True
    else:
        print(f"✗ 预期返回404，但得到 {response.status_code}")
        return False


def main():
    print("=" * 60)
    print("任务取消传播 API - 完整测试套件")
    print("=" * 60)
    
    if not check_service():
        return
    
    tests = [
        test_create_main_task,
        test_create_sub_tasks,
        test_add_resources,
        test_cancel_task,
        test_propagate_cancel,
        test_get_progress,
        test_get_task_detail,
        test_get_cleanup_results,
        test_cancel_completed_task,
        test_simulate_propagation_failure,
        test_idempotency,
        test_not_found_task,
    ]
    
    results = []
    for test in tests:
        try:
            result = test()
            results.append((test.__name__, result))
        except Exception as e:
            print(f"✗ 测试 {test.__name__} 异常: {e}")
            results.append((test.__name__, False))
    
    print("\n" + "=" * 60)
    print("测试结果汇总")
    print("=" * 60)
    
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status} - {name}")
    
    print("-" * 60)
    print(f"总计: {passed}/{total} 测试通过")
    
    if passed == total:
        print("✓ 所有测试通过！")
    else:
        print("✗ 部分测试失败，请检查！")
    
    print("\n提示: 你可以访问 http://localhost:8000/docs 查看完整的 API 文档")


if __name__ == "__main__":
    main()
