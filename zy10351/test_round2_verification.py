#!/usr/bin/env python3
"""
第二轮修复验证测试脚本
测试以下问题的修复：
1. expire_task 不传操作人绕过权限校验
2. cleanup_task 不传操作人绕过权限校验
3. REVOKED 状态任务可重新登记为 REGISTERED
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000/api/v1"


def print_test_result(test_name, success, message=""):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} - {test_name}")
    if message:
        print(f"   {message}")
    print()


def run_tests():
    print("="*70)
    print("  任务输出归档 API - 第二轮修复验证测试")
    print("="*70)
    print()

    try:
        # ============================================================
        # 测试场景 1: expire_task 不传操作人应返回 403
        # ============================================================
        print("🔍 测试场景 1: 不传操作人调用 expire_task")
        task_number1 = f"TEST-EXP-NOOP-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # 1.1 创建任务
        create_data = {
            "task_number": task_number1,
            "task_name": "过期测试任务",
            "archive_strategy": "manual",
            "access_level": "read",
            "owner": "owner_user",
            "expire_days": 90
        }
        resp = requests.post(f"{BASE_URL}/tasks", json=create_data)
        assert resp.status_code == 200, "创建任务失败"
        
        # 1.2 所有者登记输出
        register_data = {
            "output_file_path": "/data/test.txt",
            "output_file_name": "test.txt",
            "output_file_size": 1024,
            "output_file_hash": "abc123",
            "operator": "owner_user"
        }
        resp = requests.post(f"{BASE_URL}/tasks/{task_number1}/register", json=register_data)
        assert resp.status_code == 200, "登记输出失败"
        
        # 1.3 所有者归档
        archive_data = {
            "target_location": "/archive/test.txt",
            "operator": "owner_user"
        }
        resp = requests.post(f"{BASE_URL}/tasks/{task_number1}/archive", json=archive_data)
        assert resp.status_code == 200, "归档失败"
        task_status = resp.json()['status']
        assert task_status == "archived", f"归档后状态应为 archived，实际为 {task_status}"
        
        # 1.4 不传操作人调用 expire (应返回 403)
        print("测试: 不传 operator 参数调用过期接口")
        resp = requests.post(f"{BASE_URL}/tasks/{task_number1}/expire")
        assert resp.status_code == 403, f"不传操作人标记过期应返回 403，实际返回: {resp.status_code}"
        print_test_result("不传操作人调用 expire 被正确拦截", True, f"status_code={resp.status_code}")
        
        # 1.5 传空字符串操作人调用 expire (应返回 403)
        print("测试: 传空字符串 operator 调用过期接口")
        resp = requests.post(f"{BASE_URL}/tasks/{task_number1}/expire", params={"operator": ""})
        assert resp.status_code == 403, f"空操作人标记过期应返回 403，实际返回: {resp.status_code}"
        print_test_result("空操作人调用 expire 被正确拦截", True, f"status_code={resp.status_code}")
        
        # 1.6 非所有者调用 expire (应返回 403)
        print("测试: 非所有者调用过期接口")
        resp = requests.post(f"{BASE_URL}/tasks/{task_number1}/expire", params={"operator": "hacker"})
        assert resp.status_code == 403, f"非所有者标记过期应返回 403，实际返回: {resp.status_code}"
        print_test_result("非所有者调用 expire 被正确拦截", True, f"status_code={resp.status_code}")
        
        # 1.7 所有者调用 expire (应成功)
        print("测试: 所有者调用过期接口")
        resp = requests.post(f"{BASE_URL}/tasks/{task_number1}/expire", params={"operator": "owner_user"})
        assert resp.status_code == 200, f"所有者标记过期应成功，实际返回: {resp.status_code}"
        task_status = resp.json()['status']
        assert task_status == "expired", f"过期后状态应为 expired，实际为 {task_status}"
        print_test_result("所有者调用 expire 成功", True, f"status={task_status}")
        
        # ============================================================
        # 测试场景 2: cleanup_task 不传操作人应返回 403
        # ============================================================
        print("\n" + "="*70)
        print("🔍 测试场景 2: 不传操作人调用 cleanup_task")
        
        task_number2 = f"TEST-CLEAN-NOOP-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # 2.1 创建任务
        create_data['task_number'] = task_number2
        create_data['task_name'] = "清理测试任务"
        resp = requests.post(f"{BASE_URL}/tasks", json=create_data)
        assert resp.status_code == 200, "创建任务失败"
        
        # 2.2 所有者登记、归档、过期
        register_data['operator'] = "owner_user"
        resp = requests.post(f"{BASE_URL}/tasks/{task_number2}/register", json=register_data)
        assert resp.status_code == 200, "登记输出失败"
        
        archive_data['operator'] = "owner_user"
        resp = requests.post(f"{BASE_URL}/tasks/{task_number2}/archive", json=archive_data)
        assert resp.status_code == 200, "归档失败"
        
        resp = requests.post(f"{BASE_URL}/tasks/{task_number2}/expire", params={"operator": "owner_user"})
        assert resp.status_code == 200, "标记过期失败"
        
        # 2.3 不传操作人调用 cleanup (应返回 403)
        print("测试: 不传 operator 参数调用清理接口")
        resp = requests.post(f"{BASE_URL}/tasks/{task_number2}/cleanup")
        assert resp.status_code == 403, f"不传操作人清理应返回 403，实际返回: {resp.status_code}"
        print_test_result("不传操作人调用 cleanup 被正确拦截", True, f"status_code={resp.status_code}")
        
        # 2.4 非所有者调用 cleanup (应返回 403)
        print("测试: 非所有者调用清理接口")
        resp = requests.post(f"{BASE_URL}/tasks/{task_number2}/cleanup", params={"operator": "hacker"})
        assert resp.status_code == 403, f"非所有者清理应返回 403，实际返回: {resp.status_code}"
        print_test_result("非所有者调用 cleanup 被正确拦截", True, f"status_code={resp.status_code}")
        
        # 2.5 所有者调用 cleanup (应成功)
        print("测试: 所有者调用清理接口")
        resp = requests.post(f"{BASE_URL}/tasks/{task_number2}/cleanup", 
                           params={"operator": "owner_user", "reason": "test"})
        assert resp.status_code == 200, f"所有者清理应成功，实际返回: {resp.status_code}"
        task_status = resp.json()['status']
        assert task_status == "cleaned", f"清理后状态应为 cleaned，实际为 {task_status}"
        print_test_result("所有者调用 cleanup 成功", True, f"status={task_status}")
        
        # ============================================================
        # 测试场景 3: REVOKED 状态任务不可重新登记
        # ============================================================
        print("\n" + "="*70)
        print("🔍 测试场景 3: REVOKED 状态任务不可重新登记")
        
        task_number3 = f"TEST-REVOKE-LOCK-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # 3.1 创建任务
        create_data['task_number'] = task_number3
        create_data['task_name'] = "撤销锁定测试任务"
        resp = requests.post(f"{BASE_URL}/tasks", json=create_data)
        assert resp.status_code == 200, "创建任务失败"
        
        # 3.2 所有者登记输出
        register_data['operator'] = "owner_user"
        resp = requests.post(f"{BASE_URL}/tasks/{task_number3}/register", json=register_data)
        assert resp.status_code == 200, "登记输出失败"
        
        # 3.3 所有者撤销任务
        revoke_data = {
            "reason": "任务不再需要",
            "operator": "owner_user"
        }
        resp = requests.post(f"{BASE_URL}/tasks/{task_number3}/revoke", json=revoke_data)
        assert resp.status_code == 200, "撤销失败"
        task_status = resp.json()['status']
        assert task_status == "revoked", f"撤销后状态应为 revoked，实际为 {task_status}"
        print_test_result("任务成功撤销为 revoked 状态", True, f"status={task_status}")
        
        # 3.4 尝试重新登记 (应返回 400，不可重新登记)
        print("测试: 已撤销任务尝试重新登记输出")
        register_data2 = {
            "output_file_path": "/data/new_file.txt",
            "output_file_name": "new_file.txt",
            "output_file_size": 2048,
            "output_file_hash": "new_hash_xyz",
            "operator": "owner_user"
        }
        resp = requests.post(f"{BASE_URL}/tasks/{task_number3}/register", json=register_data2)
        assert resp.status_code == 400, f"已撤销任务重新登记应返回 400，实际返回: {resp.status_code}"
        error_msg = resp.json().get('detail', {}).get('message', '')
        assert "已撤销" in error_msg or "revoked" in error_msg.lower(), f"错误信息应包含'已撤销'，实际为: {error_msg}"
        print_test_result("已撤销任务重新登记被正确拦截", True, 
                         f"status_code={resp.status_code}, message={error_msg}")
        
        # 3.5 验证状态仍然是 revoked
        resp = requests.get(f"{BASE_URL}/tasks/{task_number3}")
        task_status = resp.json()['status']
        assert task_status == "revoked", f"尝试重新登记后状态应仍为 revoked，实际为 {task_status}"
        print_test_result("尝试重新登记后状态仍保持 revoked", True, f"status={task_status}")
        
        # ============================================================
        # 测试场景 4: 验证时间线记录
        # ============================================================
        print("\n" + "="*70)
        print("🔍 测试场景 4: 验证时间线记录完整性")
        resp = requests.get(f"{BASE_URL}/tasks/{task_number3}/timelines")
        assert resp.status_code == 200, "获取时间线失败"
        timelines = resp.json()
        print(f"共 {len(timelines)} 条时间线记录:")
        for tl in timelines:
            print(f"  - [{tl['timestamp']}] {tl['action']} by {tl['operator'] or 'unknown'}: {tl['description']}")
        
        actions = [tl['action'] for tl in timelines]
        assert "CREATE" in actions, "时间线应包含 CREATE"
        assert "REGISTER" in actions, "时间线应包含 REGISTER"
        assert "REVOKE" in actions, "时间线应包含 REVOKE"
        print_test_result("时间线记录完整", True, "包含 CREATE, REGISTER, REVOKE")
        
        # ============================================================
        # 测试场景 5: 验证过期后不可再归档
        # ============================================================
        print("\n" + "="*70)
        print("🔍 测试场景 5: 状态流转验证 - 过期后不可重新归档")
        
        task_number4 = f"TEST-STATUS-FLOW-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        create_data['task_number'] = task_number4
        resp = requests.post(f"{BASE_URL}/tasks", json=create_data)
        assert resp.status_code == 200
        
        register_data['operator'] = "owner_user"
        resp = requests.post(f"{BASE_URL}/tasks/{task_number4}/register", json=register_data)
        assert resp.status_code == 200
        
        archive_data['operator'] = "owner_user"
        resp = requests.post(f"{BASE_URL}/tasks/{task_number4}/archive", json=archive_data)
        assert resp.status_code == 200
        
        resp = requests.post(f"{BASE_URL}/tasks/{task_number4}/expire", params={"operator": "owner_user"})
        assert resp.status_code == 200
        
        # 尝试过期后重新归档 (应返回 400)
        resp = requests.post(f"{BASE_URL}/tasks/{task_number4}/archive", json=archive_data)
        assert resp.status_code == 400, f"已过期任务重新归档应返回 400，实际返回: {resp.status_code}"
        print_test_result("已过期任务重新归档被正确拦截", True, f"status_code={resp.status_code}")
        
        # ============================================================
        # 所有测试通过
        # ============================================================
        print("\n" + "="*70)
        print("🎉 第二轮所有测试通过！修复验证成功！")
        print("="*70)
        print("\n修复的问题总结:")
        print("  1. ✅ expire_task 不传操作人不再绕过权限校验 (返回 403)")
        print("  2. ✅ cleanup_task 不传操作人不再绕过权限校验 (返回 403)")
        print("  3. ✅ REVOKED 状态任务不可重新登记为 REGISTERED (状态锁定)")
        print("  4. ✅ 状态流转更加严格，异常可解释性增强")

    except AssertionError as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
    except requests.exceptions.ConnectionError:
        print("\n❌ 错误: 无法连接到 API 服务")
        print("请先启动服务: python main.py")
    except Exception as e:
        print(f"\n❌ 发生未知错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    run_tests()
