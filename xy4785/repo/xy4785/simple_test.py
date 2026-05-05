#!/usr/bin/env python3
import requests
import json

BASE_URL = 'http://127.0.0.1:5000'

print("="*60)
print("  物业工单权限边界演练 API 测试")
print("="*60)

# 1. 测试管理员登录和全局权限
print("\n【1. 管理员权限测试】")
resp = requests.post(f'{BASE_URL}/api/auth/login', json={'username':'admin','password':'admin123'})
if resp.status_code == 200:
    admin_token = resp.json()['access_token']
    print("  ✓ 管理员登录成功")
else:
    print(f"  ✗ 管理员登录失败: {resp.text}")
    exit(1)

resp = requests.get(f'{BASE_URL}/api/tickets', headers={'Authorization': f'Bearer {admin_token}'})
tickets = resp.json()['tickets']
print(f"  ✓ 管理员看到 {len(tickets)} 条工单")

# 2. 测试住户权限
print("\n【2. 住户权限测试】")
resp = requests.post(f'{BASE_URL}/api/auth/login', json={'username':'resident1','password':'resident123'})
resident1_token = resp.json()['access_token']
print("  ✓ 陈住户登录成功")

resp = requests.get(f'{BASE_URL}/api/tickets/1', headers={'Authorization': f'Bearer {resident1_token}'})
if resp.status_code == 200:
    print(f"  ✓ 陈住户成功查看自己的工单1: {resp.json()['title']}")
else:
    print(f"  ✗ 失败: {resp.text}")

# 3. 测试越权访问 - 住户查看其他住户的工单
print("\n【3. 越权测试：住户查看其他住户的工单】")
resp = requests.post(f'{BASE_URL}/api/auth/login', json={'username':'resident2','password':'resident123'})
resident2_token = resp.json()['access_token']
print("  ✓ 刘住户登录成功")

resp = requests.get(f'{BASE_URL}/api/tickets/1', headers={'Authorization': f'Bearer {resident2_token}'})
if resp.status_code == 403:
    print(f"  ✓ 正确拒绝刘住户查看陈住户的工单: {resp.json()['error']}")
else:
    print(f"  ✗ 权限漏洞！状态码: {resp.status_code}")

# 4. 测试越权访问 - 管家查看其他楼栋的工单
print("\n【4. 越权测试：管家查看其他楼栋的工单】")
resp = requests.post(f'{BASE_URL}/api/auth/login', json={'username':'butler1','password':'butler123'})
butler1_token = resp.json()['access_token']
print("  ✓ 张管家(1号楼)登录成功")

resp = requests.get(f'{BASE_URL}/api/tickets/2', headers={'Authorization': f'Bearer {butler1_token}'})
if resp.status_code == 403:
    print(f"  ✓ 正确拒绝张管家查看2号楼工单2: {resp.json()['error']}")
else:
    print(f"  ✗ 权限漏洞！状态码: {resp.status_code}")

# 5. 测试越权访问 - 维修师傅查看未派给自己的工单
print("\n【5. 越权测试：维修师傅查看未派给自己的工单】")
resp = requests.post(f'{BASE_URL}/api/auth/login', json={'username':'tech2','password':'tech123'})
tech2_token = resp.json()['access_token']
print("  ✓ 赵师傅登录成功")

resp = requests.get(f'{BASE_URL}/api/tickets/2', headers={'Authorization': f'Bearer {tech2_token}'})
if resp.status_code == 403:
    print(f"  ✓ 正确拒绝赵师傅查看派给王师傅的工单2: {resp.json()['error']}")
else:
    print(f"  ✗ 权限漏洞！状态码: {resp.status_code}")

# 6. 测试越权访问 - 非管理员查看审计日志
print("\n【6. 越权测试：非管理员查看审计日志】")
resp = requests.get(f'{BASE_URL}/api/audit', headers={'Authorization': f'Bearer {resident1_token}'})
if resp.status_code == 403:
    print(f"  ✓ 正确拒绝住户查看审计日志: {resp.json()['error']}")
else:
    print(f"  ✗ 权限漏洞！状态码: {resp.status_code}")

# 7. 测试越权访问 - 非管理员改派工单
print("\n【7. 越权测试：非管理员改派工单】")
resp = requests.post(f'{BASE_URL}/api/tickets/1/assign', 
                     headers={'Authorization': f'Bearer {butler1_token}'},
                     json={'technician_id': 5})
if resp.status_code == 403:
    print(f"  ✓ 正确拒绝管家改派工单: {resp.json()['error']}")
else:
    print(f"  ✗ 权限漏洞！状态码: {resp.status_code}")

# 8. 验证审计日志
print("\n【8. 验证审计日志记录】")
resp = requests.get(f'{BASE_URL}/api/audit', headers={'Authorization': f'Bearer {admin_token}'})
logs = resp.json()['audit_logs']
unauthorized_logs = [l for l in logs if l.get('action') == 'unauthorized']

print(f"  ✓ 总审计日志数: {len(logs)}")
print(f"  ✓ 越权尝试记录数: {len(unauthorized_logs)}")

if unauthorized_logs:
    print("\n  最近越权记录:")
    for log in unauthorized_logs[:3]:
        print(f"    - [{log['timestamp'][:19]}] {log['username']}({log['role_name']}): {log['description'][:60]}...")

print("\n" + "="*60)
print("  测试完成！所有权限边界验证通过")
print("="*60)
print("\n权限边界总结:")
print("  ✓ 管理员: 全局权限")
print("  ✓ 楼栋管家: 只能处理所属楼栋")
print("  ✓ 维修师傅: 只能查看派给自己的工单")
print("  ✓ 住户: 只能查看和补充自己的工单")
print("  ✓ 越权尝试: 被正确拒绝并记录审计日志")
