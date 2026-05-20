#!/usr/bin/env python3
import requests
import time
import json

BASE_URL = "http://localhost:8000/api/v1"

def print_response(title, data):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")
    print(json.dumps(data, ensure_ascii=False, indent=2))

def test_all_scenarios():
    print("🎯 开始测试所有业务场景...")
    
    # 1. 测试成功执行
    print("\n\n1️⃣  测试成功执行 (Hello World)")
    r = requests.post(f"{BASE_URL}/requests/", json={
        "student_id": 1,
        "language_id": 1,
        "code_snippet": "print(\"Hello, Code Runner!\")\nfor i in range(5):\n    print(f\"Count: {i}\")",
        "input_data": ""
    })
    req1 = r.json()
    print(f"请求ID: {req1['request_id']}, 初始状态: {req1['status']}")
    
    # 2. 测试语法错误
    print("\n\n2️⃣  测试失败执行 (语法错误)")
    r = requests.post(f"{BASE_URL}/requests/", json={
        "student_id": 1,
        "language_id": 1,
        "code_snippet": "print(\"语法错误测试\"",
        "input_data": ""
    })
    req2 = r.json()
    print(f"请求ID: {req2['request_id']}, 初始状态: {req2['status']}")
    
    # 3. 测试超时终止
    print("\n\n3️⃣  测试超时终止 (无限循环)")
    r = requests.post(f"{BASE_URL}/requests/", json={
        "student_id": 1,
        "language_id": 1,
        "code_snippet": "while True:\n    pass",
        "input_data": ""
    })
    req3 = r.json()
    print(f"请求ID: {req3['request_id']}, 初始状态: {req3['status']}")
    
    # 4. 测试重复提交合并
    print("\n\n4️⃣  测试重复提交合并")
    same_code = "print('重复提交测试')"
    r = requests.post(f"{BASE_URL}/requests/", json={
        "student_id": 1,
        "language_id": 1,
        "code_snippet": same_code,
        "input_data": ""
    })
    req4 = r.json()
    print(f"原始请求ID: {req4['request_id']}")
    
    time.sleep(1)
    
    r = requests.post(f"{BASE_URL}/requests/", json={
        "student_id": 1,
        "language_id": 1,
        "code_snippet": same_code,
        "input_data": ""
    })
    req5 = r.json()
    print(f"重复请求ID: {req5['request_id']}")
    print(f"合并状态: {req5['status']}, 合并自: {req5.get('merged_from')}")
    
    # 等待执行完成
    print("\n\n⏳ 等待所有请求执行完成 (10秒)...")
    time.sleep(10)
    
    # 查询所有请求结果
    print("\n\n📊 查询所有请求执行结果:")
    r = requests.get(f"{BASE_URL}/requests/")
    data = r.json()
    for req in data['items']:
        print(f"\n--- 请求 {req['id']} ({req['request_id']}) ---")
        print(f"状态: {req['status']}")
        if req['stdout']:
            print(f"标准输出:\n{req['stdout'][:200]}")
        if req['stderr']:
            print(f"错误输出:\n{req['stderr'][:200]}")
        if req['exit_code'] is not None:
            print(f"退出码: {req['exit_code']}")
        if req['execution_time_ms']:
            print(f"执行时间: {req['execution_time_ms']}ms")
        print(f"时间线事件数: {len(req['status_history'])}")
    
    # 5. 测试人工修正
    print("\n\n5️⃣  测试人工修正")
    r = requests.put(f"{BASE_URL}/requests/1/manual", json={
        "status": "failed",
        "stdout": "人工修正后的输出",
        "stderr": "",
        "error_message": "管理员标记为失败",
        "execution_time_ms": 100
    })
    print("人工修正响应:", r.status_code)
    
    # 6. 测试配额检查
    print("\n\n6️⃣  测试配额检查")
    r = requests.get(f"{BASE_URL}/students/1/quota")
    quota = r.json()
    print_response("配额信息", quota)
    
    # 7. 测试报告统计
    print("\n\n7️⃣  测试报告统计")
    r = requests.get(f"{BASE_URL}/reports/summary")
    report = r.json()
    print_response("报告统计", report)
    
    print("\n\n✅ 所有场景测试完成!")

if __name__ == "__main__":
    test_all_scenarios()
