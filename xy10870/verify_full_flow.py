#!/usr/bin/env python3
import requests
import time
import sys
import os

BASE = 'http://localhost:8000/api/v1'

def check_service():
    """检查服务是否运行"""
    try:
        r = requests.get('http://localhost:8000/api/health', timeout=3)
        return r.status_code == 200
    except:
        return False

def reset_database():
    """重置数据库"""
    import subprocess
    print("🔄 重置数据库...")
    
    os.chdir(os.path.join(os.path.dirname(__file__), 'backend'))
    
    # 删除旧数据库
    if os.path.exists('code_runner.db'):
        os.remove('code_runner.db')
        print("   旧数据库已删除")
    
    # 运行init_data.py
    result = subprocess.run(
        ['python3', 'init_data.py'],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        print(f"   数据库初始化失败: {result.stderr}")
        return False
    print("   数据库初始化成功")
    return True

def test_full_flow():
    print("=" * 70)
    print("  验证完整流程: 创建请求 → 状态推进 → 真实执行 → 结果查询")
    print("=" * 70)
    
    # 1. 检查服务
    print("\n📋 步骤1: 检查服务状态")
    if not check_service():
        print("   ❌ 后端服务未启动")
        print("   请先启动后端服务: cd backend && python -m uvicorn main:app --reload")
        return False
    print("   ✅ 后端服务运行正常")
    
    # 2. 查询学生和语言
    print("\n📋 步骤2: 查询学生和语言")
    r = requests.get(f'{BASE}/students/')
    students = r.json()
    print(f"   学生数量: {len(students)}")
    if not students:
        print("   ❌ 没有学生数据")
        return False
    
    r = requests.get(f'{BASE}/languages/')
    languages = r.json()
    print(f"   语言数量: {len(languages)}")
    if not languages:
        print("   ❌ 没有语言数据")
        return False
    
    student_id = students[0]['id']
    language_id = languages[0]['id']
    student_name = students[0]['name']
    language_name = languages[0]['name']
    print(f"   测试学生: {student_name} (ID={student_id})")
    print(f"   测试语言: {language_name} (ID={language_id})")
    
    # 3. 检查配额和pending请求
    print("\n📋 步骤3: 检查配额和pending请求")
    r = requests.get(f'{BASE}/students/{student_id}/quota')
    quota = r.json()
    print(f"   配额: {quota['used_quota']}/{quota['max_quota']}")
    
    # 4. 创建成功执行的代码请求
    print("\n🚀 步骤4: 创建成功执行请求 (Hello World)")
    code = '''print("Hello World!")
print("Code Runner Test")
result = 1 + 2 + 3
print(f"Result: {result}")'''
    
    r = requests.post(f'{BASE}/requests/', json={
        'student_id': student_id,
        'language_id': language_id,
        'code_snippet': code,
        'input_data': ''
    })
    
    if r.status_code != 200:
        print(f"   ❌ 创建请求失败: {r.status_code} - {r.text}")
        return False
    
    req = r.json()
    req_id = req['request_id']
    print(f"   ✅ 请求创建成功")
    print(f"      请求ID: {req_id}")
    print(f"      初始状态: {req['status']}")
    
    # 5. 等待并查询状态变化
    print("\n⏳ 步骤5: 等待执行完成...")
    for i in range(10):
        time.sleep(1)
        r = requests.get(f'{BASE}/requests/{req_id}')
        current = r.json()
        print(f"   第{i+1}秒: 状态={current['status']}", end='')
        if current['status'] in ['success', 'failed', 'timeout']:
            print(" ✓ 执行完成")
            break
        print()
    else:
        print("   ⚠️  执行超时，继续查询结果")
    
    # 6. 查询最终结果
    print("\n📊 步骤6: 查询执行结果")
    r = requests.get(f'{BASE}/requests/{req_id}')
    final = r.json()
    
    print(f"   最终状态: {final['status']}")
    print(f"   容器ID: {final.get('container_id', 'N/A')}")
    print(f"   退出码: {final.get('exit_code', 'N/A')}")
    print(f"   执行时间: {final.get('execution_time_ms', 'N/A')}ms")
    print(f"   标准输出: {repr(final.get('stdout'))}")
    print(f"   错误输出: {repr(final.get('stderr'))}")
    print(f"   时间线事件: {len(final['status_history'])} 个")
    
    print("\n   📜 状态时间线:")
    for h in final['status_history']:
        print(f"      {h['timestamp'][11:19]}: {h['from_status'] or '(新)':>8s} → {h['to_status']:>8s} | {h['message']}")
    
    # 7. 验证结果
    success = (
        final['status'] == 'success' and 
        final['stdout'] is not None and 
        'Hello World' in final['stdout'] and
        len(final['status_history']) >= 4
    )
    
    print("\n" + "=" * 70)
    if success:
        print("✅ 完整流程验证通过!")
        print("   - 创建请求成功")
        print("   - 状态正确推进 (pending→queued→running→success)")
        print("   - 真实代码执行成功")
        print("   - 执行结果正确保存")
        print("   - 时间线记录完整")
        return True
    else:
        print("❌ 验证失败")
        return False

if __name__ == '__main__':
    result = test_full_flow()
    sys.exit(0 if result else 1)
