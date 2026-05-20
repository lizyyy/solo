#!/usr/bin/env python3
import requests
import time
import sys

BASE = 'http://localhost:8000/api/v1'

def test():
    print("=" * 60)
    print("  验证修复: 创建运行请求完整流程")
    print("=" * 60)
    
    print("\n📋 步骤1: 健康检查")
    r = requests.get('http://localhost:8000/api/health')
    print(f"   状态: {r.status_code} - {r.json()['status']}")
    
    print("\n📋 步骤2: 查询现有数据")
    r = requests.get(f'{BASE}/students/')
    students = r.json()
    print(f"   学生数量: {len(students)}")
    student_id = students[0]['id'] if students else 1
    
    r = requests.get(f'{BASE}/languages/')
    languages = r.json()
    print(f"   语言数量: {len(languages)}")
    language_id = languages[0]['id'] if languages else 1
    
    print("\n🚀 步骤3: 创建代码运行请求")
    code = '''print("Hello World!")
print("Code Runner Test")
for i in range(3):
    print(f"Count: {i}")'''
    
    r = requests.post(f'{BASE}/requests/', json={
        'student_id': student_id,
        'language_id': language_id,
        'code_snippet': code,
        'input_data': ''
    })
    print(f"   HTTP状态: {r.status_code}")
    
    if r.status_code != 200:
        print(f"   错误: {r.text}")
        return False
    
    data = r.json()
    req_id = data['request_id']
    print(f"   请求ID: {req_id}")
    print(f"   初始状态: {data['status']}")
    
    print("\n⏳ 步骤4: 等待执行完成 (6秒)")
    time.sleep(6)
    
    print("\n📊 步骤5: 查询执行结果")
    r = requests.get(f'{BASE}/requests/{req_id}')
    data = r.json()
    print(f"   最终状态: {data['status']}")
    print(f"   容器ID: {data.get('container_id', 'N/A')}")
    print(f"   退出码: {data.get('exit_code', 'N/A')}")
    print(f"   执行时间: {data.get('execution_time_ms', 'N/A')}ms")
    print(f"   标准输出: {repr(data.get('stdout'))}")
    print(f"   错误输出: {repr(data.get('stderr'))}")
    print(f"   时间线事件: {len(data.get('status_history', []))} 个")
    
    print("\n📋 步骤6: 查看状态时间线")
    for h in data['status_history']:
        print(f"   {h['timestamp'][11:19]}: {h['from_status'] or '(新)'} -> {h['to_status']} | {h['message']}")
    
    # 验证
    success = (
        data['status'] == 'success' and 
        data['stdout'] is not None and 
        'Hello World' in data['stdout'] and
        len(data['status_history']) >= 4
    )
    
    print("\n" + "=" * 60)
    if success:
        print("✅ 修复验证通过!")
        return True
    else:
        print("❌ 修复验证失败")
        return False

if __name__ == '__main__':
    result = test()
    sys.exit(0 if result else 1)
