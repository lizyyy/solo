#!/usr/bin/env python3
import requests
import time
import sys

BASE = 'http://localhost:8000/api/v1'

def test_code_execution():
    print("=== 测试真实代码执行 ===")
    
    # 创建成功执行请求
    print("\n1. 创建成功执行请求 (Hello World)")
    r = requests.post(f'{BASE}/requests/', json={
        'student_id': 1,
        'language_id': 1,
        'code_snippet': 'print("Hello World!")\nprint("Code Runner Test")',
        'input_data': ''
    })
    req = r.json()
    req_id = req['request_id']
    print(f"   请求ID: {req_id}")
    print(f"   初始状态: {req['status']}")
    
    # 等待执行
    print("\n   等待执行完成 (5秒)...")
    time.sleep(5)
    
    # 查询结果
    r = requests.get(f'{BASE}/requests/{req_id}')
    req = r.json()
    print(f"\n   最终状态: {req['status']}")
    print(f"   容器ID: {req.get('container_id', 'N/A')}")
    print(f"   退出码: {req.get('exit_code', 'N/A')}")
    print(f"   执行时间: {req.get('execution_time_ms', 'N/A')}ms")
    print(f"   标准输出: {repr(req.get('stdout'))}")
    print(f"   错误输出: {repr(req.get('stderr'))}")
    print(f"   时间线事件数: {len(req['status_history'])}")
    
    success = req['status'] == 'success' and req['stdout'] is not None
    print(f"\n   测试结果: {'✓ 通过' if success else '✗ 失败'}")
    
    # 测试语法错误
    print("\n2. 创建语法错误请求")
    r = requests.post(f'{BASE}/requests/', json={
        'student_id': 1,
        'language_id': 1,
        'code_snippet': 'print("语法错误"',
        'input_data': ''
    })
    req = r.json()
    req_id = req['request_id']
    print(f"   请求ID: {req_id}")
    
    print("\n   等待执行完成 (5秒)...")
    time.sleep(5)
    
    r = requests.get(f'{BASE}/requests/{req_id}')
    req = r.json()
    print(f"\n   最终状态: {req['status']}")
    print(f"   退出码: {req.get('exit_code', 'N/A')}")
    print(f"   错误输出: {repr(req.get('stderr'))[:100]}")
    
    failed = req['status'] == 'failed' and req['stderr'] is not None
    print(f"   测试结果: {'✓ 通过' if failed else '✗ 失败'}")
    
    return success and failed

if __name__ == '__main__':
    print("🎯 开始验证修复...\n")
    result = test_code_execution()
    print(f"\n{'='*50}")
    print(f"总体测试结果: {'✅ 全部通过' if result else '❌ 部分失败'}")
    sys.exit(0 if result else 1)
