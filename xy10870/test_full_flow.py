#!/usr/bin/env python3
import requests
import time
import sys

BASE = 'http://localhost:8000/api/v1'

def test_full_flow():
    print("=" * 60)
    print("  测试完整代码执行流程")
    print("=" * 60)
    
    # 重置数据库
    print("\n📋 步骤1: 检查健康状态")
    r = requests.get('http://localhost:8000/api/health')
    print(f"   健康检查: {r.status_code}")
    print(f"   响应: {r.text}")
    
    print("\n👤 步骤2: 创建学生")
    r = requests.post(f'{BASE}/students/', json={
        'student_id': 'TEST001',
        'name': '测试学生',
        'email': 'test@test.com'
    })
    print(f"   状态码: {r.status_code}")
    if r.status_code != 200:
        print(f"   错误: {r.text}")
    else:
        print(f"   学生ID: {r.json()['id']}")
    
    print("\n🌐 步骤3: 创建语言环境")
    r = requests.post(f'{BASE}/languages/', json={
        'name': 'Python',
        'version': '3.9',
        'container_image': 'python:3.9',
        'timeout_seconds': 10
    })
    print(f"   状态码: {r.status_code}")
    if r.status_code != 200:
        print(f"   错误: {r.text}")
    else:
        print(f"   语言ID: {r.json()['id']}")
    
    print("\n🚀 步骤4: 创建代码运行请求")
    r = requests.post(f'{BASE}/requests/', json={
        'student_id': 1,
        'language_id': 1,
        'code_snippet': 'print("Hello World!")\nprint("Code Runner Test")',
        'input_data': ''
    })
    print(f"   状态码: {r.status_code}")
    if r.status_code != 200:
        print(f"   错误: {r.text}")
        return False
    
    data = r.json()
    req_id = data['request_id']
    print(f"   请求ID: {req_id}")
    print(f"   初始状态: {data['status']}")
    
    print("\n⏳ 步骤5: 等待执行完成 (5秒)")
    time.sleep(5)
    
    print("\n📊 步骤6: 查询执行结果")
    r = requests.get(f'{BASE}/requests/{req_id}')
    data = r.json()
    print(f"   最终状态: {data['status']}")
    print(f"   容器ID: {data.get('container_id', 'N/A')}")
    print(f"   退出码: {data.get('exit_code', 'N/A')}")
    print(f"   执行时间: {data.get('execution_time_ms', 'N/A')}ms")
    print(f"   标准输出: {repr(data.get('stdout'))}")
    print(f"   错误输出: {repr(data.get('stderr'))}")
    print(f"   时间线事件: {len(data.get('status_history', []))} 个")
    
    # 验证结果
    success = (
        data['status'] == 'success' and 
        data['stdout'] is not None and 
        'Hello World' in data['stdout']
    )
    
    print("\n" + "=" * 60)
    if success:
        print("✅ 完整流程测试通过!")
        return True
    else:
        print("❌ 测试失败 - 代码未正确执行")
        return False

if __name__ == '__main__':
    result = test_full_flow()
    sys.exit(0 if result else 1)
