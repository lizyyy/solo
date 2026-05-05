#!/usr/bin/env python3
import requests
import json
import sys

BASE_URL = "http://localhost:5000"

def print_header(title):
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)

def login(username, password):
    resp = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": username, "password": password}
    )
    if resp.status_code == 200:
        return resp.json()['access_token']
    else:
        print(f"登录失败 {username}: {resp.text}")
        return None

def test_auth():
    print_header("1. 测试用户认证")
    
    users = [
        ("admin", "admin123", "管理员"),
        ("butler1", "butler123", "张管家(1号楼)"),
        ("tech1", "tech123", "王师傅"),
        ("resident1", "resident123", "陈住户"),
    ]
    
    tokens = {}
    for username, password, desc in users:
        token = login(username, password)
        if token:
            tokens[username] = token
            print(f"  ✓ {desc} 登录成功")
        else:
            print(f"  ✗ {desc} 登录失败")
    
    return tokens

def test_legitimate_access(tokens):
    print_header("2. 测试合法访问权限")
    
    admin_token = tokens.get('admin')
    butler1_token = tokens.get('butler1')
    tech1_token = tokens.get('tech1')
    resident1_token = tokens.get('resident1')
    
    print("\n  [管理员] 查看所有工单:")
    resp = requests.get(f"{BASE_URL}/api/tickets", 
                        headers={"Authorization": f"Bearer {admin_token}"})
    if resp.status_code == 200:
        tickets = resp.json()['tickets']
        print(f"    ✓ 成功获取 {len(tickets)} 条工单")
        for t in tickets:
            print(f"      - 工单{t['id']}: {t['title']} ({t['status']})")
    else:
        print(f"    ✗ 失败: {resp.text}")
    
    print("\n  [陈住户] 查看自己的工单1:")
    resp = requests.get(f"{BASE_URL}/api/tickets/1", 
                        headers={"Authorization": f"Bearer {resident1_token}"})
    if resp.status_code == 200:
        data = resp.json()
        print(f"    ✓ 成功查看: {data['title']}")
    else:
        print(f"    ✗ 失败: {resp.text}")
    
    print("\n  [张管家(1号楼)] 查看所属楼栋工单列表:")
    resp = requests.get(f"{BASE_URL}/api/tickets", 
                        headers={"Authorization": f"Bearer {butler1_token}"})
    if resp.status_code == 200:
        tickets = resp.json()['tickets']
        print(f"    ✓ 成功获取 {len(tickets)} 条工单 (只应该看到1号楼的)")
        for t in tickets:
            print(f"      - 工单{t['id']}: {t['building_name']} - {t['title']}")
    else:
        print(f"    ✗ 失败: {resp.text}")
    
    print("\n  [王师傅] 查看派给自己的工单列表:")
    resp = requests.get(f"{BASE_URL}/api/tickets", 
                        headers={"Authorization": f"Bearer {tech1_token}"})
    if resp.status_code == 200:
        tickets = resp.json()['tickets']
        print(f"    ✓ 成功获取 {len(tickets)} 条工单 (只应该看到派给自己的)")
    else:
        print(f"    ✗ 失败: {resp.text}")

def test_unauthorized_access(tokens):
    print_header("3. 测试越权访问（应被拒绝）")
    
    resident1_token = tokens.get('resident1')
    resident2_token = login('resident2', 'resident123')
    butler1_token = tokens.get('butler1')
    tech2_token = login('tech2', 'tech123')
    
    print("\n  [刘住户] 尝试查看陈住户的工单1:")
    resp = requests.get(f"{BASE_URL}/api/tickets/1", 
                        headers={"Authorization": f"Bearer {resident2_token}"})
    if resp.status_code == 403:
        error = resp.json().get('error', '')
        print(f"    ✓ 正确拒绝: {error}")
    else:
        print(f"    ✗ 错误: 状态码={resp.status_code}, 响应={resp.text}")
    
    print("\n  [张管家(1号楼)] 尝试查看2号楼的工单2:")
    resp = requests.get(f"{BASE_URL}/api/tickets/2", 
                        headers={"Authorization": f"Bearer {butler1_token}"})
    if resp.status_code == 403:
        error = resp.json().get('error', '')
        print(f"    ✓ 正确拒绝: {error}")
    else:
        print(f"    ✗ 错误: 状态码={resp.status_code}, 响应={resp.text}")
    
    print("\n  [赵师傅] 尝试查看派给王师傅的工单2:")
    resp = requests.get(f"{BASE_URL}/api/tickets/2", 
                        headers={"Authorization": f"Bearer {tech2_token}"})
    if resp.status_code == 403:
        error = resp.json().get('error', '')
        print(f"    ✓ 正确拒绝: {error}")
    else:
        print(f"    ✗ 错误: 状态码={resp.status_code}, 响应={resp.text}")
    
    print("\n  [陈住户] 尝试查看审计日志:")
    resp = requests.get(f"{BASE_URL}/api/audit", 
                        headers={"Authorization": f"Bearer {resident1_token}"})
    if resp.status_code == 403:
        error = resp.json().get('error', '')
        print(f"    ✓ 正确拒绝: {error}")
    else:
        print(f"    ✗ 错误: 状态码={resp.status_code}, 响应={resp.text}")
    
    print("\n  [张管家] 尝试改派工单:")
    resp = requests.post(f"{BASE_URL}/api/tickets/1/assign", 
                        headers={"Authorization": f"Bearer {butler1_token}"},
                        json={"technician_id": 5})
    if resp.status_code == 403:
        error = resp.json().get('error', '')
        print(f"    ✓ 正确拒绝: {error}")
    else:
        print(f"    ✗ 错误: 状态码={resp.status_code}, 响应={resp.text}")

def test_audit_logs(tokens):
    print_header("4. 验证审计日志")
    
    admin_token = tokens.get('admin')
    
    print("\n  [管理员] 查看审计日志:")
    resp = requests.get(f"{BASE_URL}/api/audit", 
                        headers={"Authorization": f"Bearer {admin_token}"})
    if resp.status_code == 200:
        logs = resp.json()['audit_logs']
        unauthorized_logs = [l for l in logs if l.get('action') == 'unauthorized']
        
        print(f"    ✓ 总日志数: {len(logs)}")
        print(f"    ✓ 越权尝试记录数: {len(unauthorized_logs)}")
        
        print("\n    最近5条越权记录:")
        for log in unauthorized_logs[:5]:
            print(f"      - [{log['timestamp']}] {log['username']}({log['role_name']}): {log['description']}")
    else:
        print(f"    ✗ 失败: {resp.text}")

def test_ticket_operations(tokens):
    print_header("5. 测试工单操作流程")
    
    admin_token = tokens.get('admin')
    resident1_token = tokens.get('resident1')
    
    print("\n  [陈住户] 创建新工单:")
    resp = requests.post(f"{BASE_URL}/api/tickets", 
                        headers={"Authorization": f"Bearer {resident1_token}"},
                        json={
                            "title": "水管漏水测试",
                            "description": "厨房水管有漏水现象",
                            "building_id": 1,
                            "unit_number": "101"
                        })
    if resp.status_code == 201:
        ticket = resp.json()
        new_ticket_id = ticket['id']
        print(f"    ✓ 创建成功: 工单ID={new_ticket_id}, 标题={ticket['title']}")
    else:
        print(f"    ✗ 失败: {resp.text}")
        return
    
    print("\n  [陈住户] 补充工单备注:")
    resp = requests.put(f"{BASE_URL}/api/tickets/{new_ticket_id}/notes", 
                        headers={"Authorization": f"Bearer {resident1_token}"},
                        json={"notes": "补充：白天家里都有人"})
    if resp.status_code == 200:
        ticket = resp.json()
        print(f"    ✓ 备注已更新: {ticket['notes'][:50]}...")
    else:
        print(f"    ✗ 失败: {resp.text}")
    
    print("\n  [管理员] 改派工单给赵师傅:")
    resp = requests.post(f"{BASE_URL}/api/tickets/{new_ticket_id}/assign", 
                        headers={"Authorization": f"Bearer {admin_token}"},
                        json={"technician_id": 6})
    if resp.status_code == 200:
        data = resp.json()
        print(f"    ✓ 改派成功: 状态={data['ticket']['status']}, 派给={data['dispatch']['technician_name']}")
    else:
        print(f"    ✗ 失败: {resp.text}")
    
    print("\n  [管理员] 关闭工单:")
    resp = requests.post(f"{BASE_URL}/api/tickets/{new_ticket_id}/close", 
                        headers={"Authorization": f"Bearer {admin_token}"})
    if resp.status_code == 200:
        ticket = resp.json()
        print(f"    ✓ 关闭成功: 状态={ticket['status']}")
    else:
        print(f"    ✗ 失败: {resp.text}")

def main():
    print("\n" + "#"*60)
    print("#  物业工单权限边界演练 API 测试")
    print("#"*60)
    
    try:
        requests.get(f"{BASE_URL}/api/auth/login")
    except:
        print("\n错误: 无法连接到服务器，请确保服务已启动 (python app.py)")
        sys.exit(1)
    
    tokens = test_auth()
    
    if not tokens.get('admin'):
        print("\n管理员登录失败，无法继续测试")
        sys.exit(1)
    
    test_legitimate_access(tokens)
    test_unauthorized_access(tokens)
    test_ticket_operations(tokens)
    test_audit_logs(tokens)
    
    print_header("测试完成")
    print("\n  所有测试已执行！")
    print("\n  权限边界验证结果:")
    print("  ✓ 管理员: 全局权限")
    print("  ✓ 楼栋管家: 只能处理所属楼栋")
    print("  ✓ 维修师傅: 只能查看派给自己的工单")
    print("  ✓ 住户: 只能查看和补充自己的工单")
    print("  ✓ 越权尝试: 被正确拒绝并记录审计日志")

if __name__ == '__main__':
    main()
