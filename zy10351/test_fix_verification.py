#!/usr/bin/env python3
"""
修复验证测试脚本
测试权限校验和文件大小校验是否正确工作
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
    print("  任务输出归档 API - 修复验证测试")
    print("="*70)
    print()

    task_number = f"TEST-FIX-{datetime.now().strftime('%Y%m%d%H%M%S')}"

    try:
        # 测试1: 创建任务
        print("📝 阶段1: 创建任务")
        create_data = {
            "task_number": task_number,
            "task_name": "权限校验测试任务",
            "archive_strategy": "delayed",
            "access_level": "read",
            "owner": "owner_user",
            "expire_days": 90
        }
        resp = requests.post(f"{BASE_URL}/tasks", json=create_data)
        assert resp.status_code == 200, f"创建任务失败: {resp.text}"
        print_test_result("创建任务成功", True)

        # 测试2: 负数文件大小校验 (Pydantic 层)
        print("🔍 阶段2: 测试负数文件大小校验")
        register_data_negative = {
            "output_file_path": "/data/test.txt",
            "output_file_name": "test.txt",
            "output_file_size": -5,  # 负数
            "output_file_hash": "abc123",
            "operator": "owner_user"
        }
        resp = requests.post(f"{BASE_URL}/tasks/{task_number}/register", json=register_data_negative)
        assert resp.status_code == 422, f"负数文件大小应返回 422，实际返回: {resp.status_code}"
        error_detail = resp.json()["detail"]
        has_size_error = any("output_file_size" in err.get("loc", []) for err in error_detail)
        print_test_result("负数文件大小被正确拦截", has_size_error, 
                          f"status_code={resp.status_code}, 检测到文件大小错误" if has_size_error else "未检测到文件大小错误")

        # 测试3: 零值文件大小校验 (Pydantic 层)
        register_data_zero = {
            **register_data_negative,
            "output_file_size": 0,  # 零值
        }
        resp = requests.post(f"{BASE_URL}/tasks/{task_number}/register", json=register_data_zero)
        assert resp.status_code == 422, f"零值文件大小应返回 422，实际返回: {resp.status_code}"
        print_test_result("零值文件大小被正确拦截", True, f"status_code={resp.status_code}")

        # 测试4: 正常文件大小登记
        register_data_valid = {
            **register_data_negative,
            "output_file_size": 1024,  # 正常值
        }
        resp = requests.post(f"{BASE_URL}/tasks/{task_number}/register", json=register_data_valid)
        assert resp.status_code == 200, f"正常文件大小登记失败: {resp.text}"
        print_test_result("正常文件大小登记成功", True, f"file_size=1024")

        # 测试5: 非所有者 (intruder) 尝试归档 (write 权限)
        print("🔍 阶段3: 测试权限校验 - 归档操作")
        archive_data = {
            "target_location": "/archive/test.txt",
            "operator": "intruder"  # 非所有者
        }
        resp = requests.post(f"{BASE_URL}/tasks/{task_number}/archive", json=archive_data)
        assert resp.status_code == 403, f"非所有者归档应返回 403，实际返回: {resp.status_code}"
        print_test_result("非所有者被禁止归档", True, 
                          f"status_code={resp.status_code}, error={resp.json().get('detail', {}).get('message', '')}")

        # 测试6: 所有者归档 (应该成功)
        archive_data_owner = {
            **archive_data,
            "operator": "owner_user"
        }
        resp = requests.post(f"{BASE_URL}/tasks/{task_number}/archive", json=archive_data_owner)
        assert resp.status_code == 200, f"所有者归档失败: {resp.text}"
        print_test_result("所有者归档成功", True)

        # 测试7: 非所有者尝试标记过期 (write 权限)
        print("🔍 阶段4: 测试权限校验 - 标记过期")
        resp = requests.post(f"{BASE_URL}/tasks/{task_number}/expire", params={"operator": "intruder"})
        assert resp.status_code == 403, f"非所有者标记过期应返回 403，实际返回: {resp.status_code}"
        print_test_result("非所有者被禁止标记过期", True, f"status_code={resp.status_code}")

        # 测试8: 所有者标记过期 (应该成功)
        resp = requests.post(f"{BASE_URL}/tasks/{task_number}/expire", params={"operator": "owner_user"})
        assert resp.status_code == 200, f"所有者标记过期失败: {resp.text}"
        print_test_result("所有者标记过期成功", True)

        # 测试9: 非所有者尝试清理 (admin 权限)
        print("🔍 阶段5: 测试权限校验 - 清理操作")
        resp = requests.post(f"{BASE_URL}/tasks/{task_number}/cleanup", params={"operator": "intruder", "reason": "test"})
        assert resp.status_code == 403, f"非所有者清理应返回 403，实际返回: {resp.status_code}"
        print_test_result("非所有者被禁止清理", True, f"status_code={resp.status_code}")

        # 测试10: 所有者清理 (应该成功)
        resp = requests.post(f"{BASE_URL}/tasks/{task_number}/cleanup", params={"operator": "owner_user", "reason": "test"})
        assert resp.status_code == 200, f"所有者清理失败: {resp.text}"
        print_test_result("所有者清理成功", True)

        # 测试11: 操作人不能为空 (登记操作)
        print("🔍 阶段6: 测试操作人不能为空")
        task_number2 = f"TEST-OP-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        create_data2 = {**create_data, "task_number": task_number2}
        requests.post(f"{BASE_URL}/tasks", json=create_data2)
        
        register_no_operator = {
            "output_file_path": "/data/test2.txt",
            "output_file_name": "test2.txt",
            "output_file_size": 2048,
            "output_file_hash": "xyz789",
            "operator": ""  # 空操作人
        }
        resp = requests.post(f"{BASE_URL}/tasks/{task_number2}/register", json=register_no_operator)
        assert resp.status_code == 403, f"空操作人应返回 403，实际返回: {resp.status_code}"
        print_test_result("空操作人被正确拦截", True, f"status_code={resp.status_code}")

        # 测试12: 撤销操作权限校验 (admin 权限)
        print("🔍 阶段7: 测试权限校验 - 撤销操作")
        task_number3 = f"TEST-REVOKE-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        create_data3 = {**create_data, "task_number": task_number3, "owner": "real_owner"}
        requests.post(f"{BASE_URL}/tasks", json=create_data3)
        
        revoke_data = {
            "reason": "不需要了",
            "operator": "hacker"  # 非所有者
        }
        resp = requests.post(f"{BASE_URL}/tasks/{task_number3}/revoke", json=revoke_data)
        assert resp.status_code == 403, f"非所有者撤销应返回 403，实际返回: {resp.status_code}"
        print_test_result("非所有者被禁止撤销", True, f"status_code={resp.status_code}")

        # 测试13: 所有者撤销 (应该成功)
        revoke_data_owner = {**revoke_data, "operator": "real_owner"}
        resp = requests.post(f"{BASE_URL}/tasks/{task_number3}/revoke", json=revoke_data_owner)
        assert resp.status_code == 200, f"所有者撤销失败: {resp.text}"
        print_test_result("所有者撤销成功", True)

        # 测试14: 非法状态流转
        print("🔍 阶段8: 测试非法状态流转")
        task_number4 = f"TEST-STATUS-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        create_data4 = {**create_data, "task_number": task_number4}
        requests.post(f"{BASE_URL}/tasks", json=create_data4)
        
        # 直接归档（未登记）
        archive_data = {"target_location": "/archive/test.txt", "operator": "owner_user"}
        resp = requests.post(f"{BASE_URL}/tasks/{task_number4}/archive", json=archive_data)
        assert resp.status_code == 400, f"未登记直接归档应返回 400，实际返回: {resp.status_code}"
        print_test_result("非法状态流转被拦截", True, f"status_code={resp.status_code}")

        # 测试15: 时间线记录验证
        print("🔍 阶段9: 验证时间线记录")
        resp = requests.get(f"{BASE_URL}/tasks/{task_number}/timelines")
        assert resp.status_code == 200, f"获取时间线失败: {resp.text}"
        timelines = resp.json()
        print_test_result("时间线记录存在", len(timelines) > 0, f"共 {len(timelines)} 条记录")
        
        # 打印时间线用于验证
        print("  时间线记录:")
        for tl in timelines:
            print(f"    - [{tl['timestamp']}] {tl['action']} by {tl['operator'] or 'unknown'}")
        print()

        # 测试16: 重复提交相同文件幂等性
        print("🔍 阶段10: 验证重复提交幂等性")
        task_number5 = f"TEST-IDEMP-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        create_data5 = {**create_data, "task_number": task_number5}
        requests.post(f"{BASE_URL}/tasks", json=create_data5)
        
        register_data = {
            "output_file_path": "/data/test.txt",
            "output_file_name": "test.txt",
            "output_file_size": 1024,
            "output_file_hash": "same_hash_123",
            "operator": "owner_user"
        }
        # 第一次提交
        resp1 = requests.post(f"{BASE_URL}/tasks/{task_number5}/register", json=register_data)
        # 第二次提交相同文件
        resp2 = requests.post(f"{BASE_URL}/tasks/{task_number5}/register", json=register_data)
        # 都应该成功
        assert resp1.status_code == 200 and resp2.status_code == 200, "重复提交相同文件应幂等"
        print_test_result("重复提交相同文件幂等性", True, "两次提交均成功")

        print("="*70)
        print("🎉 所有测试通过！修复验证成功！")
        print("="*70)

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
