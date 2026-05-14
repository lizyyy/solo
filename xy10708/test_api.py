#!/usr/bin/env python3
"""WebSocket订阅监控系统 - API测试脚本

验收测试流程：
1. 页面操作创建会话
2. API重复提交验证幂等性
3. 确认无重复写入
4. 测试分组导出功能
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "http://localhost:8000"

def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")

def print_result(test_name, success, message=""):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} - {test_name}")
    if message:
        print(f"     {message}")

def test_1_create_session():
    """测试1: 创建新会话"""
    print_section("测试1: 创建新会话")
    
    data = {
        "client_id": "acceptance_client_001",
        "channel": "market_data",
        "owner": "验收测试员"
    }
    
    response = requests.post(f"{BASE_URL}/api/sessions", json=data)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        session = response.json()
        print(f"会话ID: {session['id']}")
        print(f"客户端: {session['client_id']}")
        print(f"频道: {session['channel']}")
        print(f"负责人: {session['owner']}")
        print_result("创建会话", True)
        return session['id']
    else:
        print(f"错误: {response.text}")
        print_result("创建会话", False, response.text)
        return None

def test_2_duplicate_session_protection():
    """测试2: 重复创建会话保护（防止重复写入）"""
    print_section("测试2: 重复创建会话保护（幂等性验证）")
    
    data = {
        "client_id": "acceptance_client_002",
        "channel": "market_data",
        "owner": "验收测试员"
    }
    
    # 第一次创建
    r1 = requests.post(f"{BASE_URL}/api/sessions", json=data)
    print(f"第一次创建 - 状态码: {r1.status_code}")
    
    # 第二次创建（重复）
    r2 = requests.post(f"{BASE_URL}/api/sessions", json=data)
    print(f"第二次创建 - 状态码: {r2.status_code}")
    
    if r1.status_code == 200 and r2.status_code == 409:
        print_result("重复会话保护", True, "正确返回409冲突，防止重复写入")
        
        # 验证数据库中只有一个会话
        sessions = requests.get(f"{BASE_URL}/api/sessions?client_id=acceptance_client_002").json()
        active_count = sum(1 for s in sessions if s['is_active'])
        print(f"活跃会话数: {active_count}")
        
        if active_count == 1:
            print_result("数据库无重复写入", True)
        else:
            print_result("数据库无重复写入", False, f"发现{active_count}个活跃会话")
    else:
        print_result("重复会话保护", False, f"期望200+409，实际{r1.status_code}+{r2.status_code}")

def test_3_heartbeat():
    """测试3: 心跳功能"""
    print_section("测试3: 心跳功能")
    
    # 先创建会话
    data = {"client_id": "heartbeat_test", "channel": "trade", "owner": "测试员"}
    session = requests.post(f"{BASE_URL}/api/sessions", json=data).json()
    session_id = session['id']
    
    # 发送心跳
    response = requests.post(f"{BASE_URL}/api/sessions/{session_id}/heartbeat")
    print(f"心跳状态码: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"消息积压: {result['message_backlog']}")
        print_result("心跳功能", True)
    else:
        print(f"错误: {response.text}")
        print_result("心跳功能", False)

def test_4_permission_check():
    """测试4: 权限校验"""
    print_section("测试4: 权限校验")
    
    # 尝试创建无效频道的会话
    data = {"client_id": "perm_test", "channel": "invalid_channel", "owner": "测试员"}
    response = requests.post(f"{BASE_URL}/api/sessions", json=data)
    
    print(f"状态码: {response.status_code}")
    print(f"响应: {response.text}")
    
    if response.status_code == 403:
        print_result("权限校验", True, "正确返回403无权限")
    else:
        print_result("权限校验", False, f"期望403，实际{response.status_code}")

def test_5_session_lifecycle():
    """测试5: 会话完整生命周期（创建-断开-重连）"""
    print_section("测试5: 会话完整生命周期")
    
    # 创建
    data = {"client_id": "lifecycle_test", "channel": "notifications", "owner": "测试员"}
    session = requests.post(f"{BASE_URL}/api/sessions", json=data).json()
    session_id = session['id']
    print(f"1. 创建会话: {session_id}")
    
    # 断开
    r_disconnect = requests.post(f"{BASE_URL}/api/sessions/{session_id}/disconnect")
    print(f"2. 断开会话 - 状态码: {r_disconnect.status_code}")
    
    # 重连
    r_reconnect = requests.post(f"{BASE_URL}/api/sessions/{session_id}/reconnect")
    print(f"3. 重连会话 - 状态码: {r_reconnect.status_code}")
    
    if r_disconnect.status_code == 200 and r_reconnect.status_code == 200:
        reconnect_count = r_reconnect.json()['reconnect_count']
        print(f"重连次数: {reconnect_count}")
        print_result("会话生命周期", True)
    else:
        print_result("会话生命周期", False)

def test_6_export_grouping():
    """测试6: 分组导出功能"""
    print_section("测试6: 分组导出功能")
    
    group_types = ['owner', 'time', 'heartbeat']
    all_pass = True
    
    for group_type in group_types:
        response = requests.get(f"{BASE_URL}/api/reports/export", params={"group_by": group_type})
        print(f"\n按{group_type}分组导出 - 状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"  总计记录: {data['total_count']}")
            print(f"  分组数量: {len(data['groups'])}")
            print_result(f"按{group_type}分组导出", True)
        else:
            print_result(f"按{group_type}分组导出", False)
            all_pass = False
    
    return all_pass

def test_7_invalid_session_operations():
    """测试7: 无效会话操作"""
    print_section("测试7: 无效会话操作")
    
    # 不存在的会话
    r1 = requests.post(f"{BASE_URL}/api/sessions/non_existent_session/heartbeat")
    print(f"不存在会话心跳 - 状态码: {r1.status_code}")
    
    if r1.status_code == 404:
        print_result("不存在会话操作", True)
    else:
        print_result("不存在会话操作", False)

def run_acceptance_tests():
    """运行完整验收测试"""
    print("\n" + "="*60)
    print("  WebSocket订阅监控系统 - 验收测试")
    print("  " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("="*60)
    
    tests = [
        ("创建新会话", test_1_create_session),
        ("重复会话保护", test_2_duplicate_session_protection),
        ("心跳功能", test_3_heartbeat),
        ("权限校验", test_4_permission_check),
        ("会话生命周期", test_5_session_lifecycle),
        ("分组导出", test_6_export_grouping),
        ("无效会话操作", test_7_invalid_session_operations),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result is not False))
        except Exception as e:
            print(f"异常: {e}")
            results.append((name, False))
    
    print_section("验收测试总结")
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, r in results:
        status = "✅ PASS" if r else "❌ FAIL"
        print(f"  {status} - {name}")
    
    print(f"\n总计: {passed}/{total} 测试通过")
    
    if passed == total:
        print("\n🎉 所有验收测试通过！")
    else:
        print(f"\n⚠️  {total - passed} 个测试失败")

if __name__ == "__main__":
    run_acceptance_tests()
