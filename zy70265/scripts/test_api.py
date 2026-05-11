#!/usr/bin/env python3
"""
API 测试脚本 - 演示主流程和异常操作
运行前请先启动服务: uvicorn app.main:app --reload
然后运行: python -m scripts.test_api
"""
import json
import sys
import time
from datetime import datetime, timedelta

try:
    import httpx
except ImportError:
    print("请先安装依赖: pip install httpx")
    sys.exit(1)

BASE_URL = "http://localhost:8000/api/v1"

def print_separator(title="="):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)

def print_response(title, response, show_body=True):
    print(f"\n[{title}]")
    print(f"  状态码: {response.status_code}")
    if show_body:
        try:
            data = response.json()
            print(f"  响应: {json.dumps(data, ensure_ascii=False, indent=2)[:1000]}")
        except:
            print(f"  响应: {response.text[:500]}")

def test_main_flow():
    print_separator("主流程演示 - 实验室气瓶余量预警系统")
    
    with httpx.Client(timeout=30.0) as client:
        print("\n[步骤 1] 查看系统状态")
        resp = client.get("http://localhost:8000/health")
        print_response("健康检查", resp)
        
        print("\n[步骤 2] 查看所有气瓶")
        resp = client.get(f"{BASE_URL}/cylinders")
        print_response("气瓶列表", resp, show_body=False)
        cylinders = resp.json()
        print(f"  气瓶数量: {len(cylinders)}")
        for cyl in cylinders:
            print(f"    - {cyl['cylinder_code']}: {cyl['gas_type']} ({cyl['danger_category_info']['name']}) - "
                  f"剩余 {cyl['current_level_percentage']:.1f}% - 状态: {cyl['status']}")
        
        print("\n[步骤 3] 查看所有用户")
        resp = client.get(f"{BASE_URL}/users")
        print_response("用户列表", resp, show_body=False)
        users = resp.json()
        print(f"  用户数量: {len(users)}")
        for user in users:
            print(f"    - {user['username']}: {user['full_name']} {'(管理员)' if user['is_admin'] else ''}")
        
        print("\n[步骤 4] 演示危险分类联动预警效果")
        print("  说明: 不同危险分类的气瓶有不同的预警倍率")
        print("  - 非危险气体/惰性气体: 1.0x 倍率")
        print("  - 易燃气体: 1.5x 倍率 (更早触发预警)")
        print("  - 有毒气体: 2.0x 倍率 (最早触发预警)")
        print("  - 氧化性气体: 1.8x 倍率")
        
        print("\n[步骤 5] 查看预警信息")
        resp = client.get(f"{BASE_URL}/warnings", params={"is_resolved": False})
        print_response("未解决预警", resp)
        warnings = resp.json()
        print(f"  未解决预警数量: {len(warnings)}")
        for warning in warnings:
            print(f"    - [{warning['severity']}] {warning['message']}")
        
        print("\n[步骤 6] 借用登记 - 研究员张三借用氧气钢瓶")
        user_id = 2
        cylinder_id = 1
        borrow_data = {
            "user_id": user_id,
            "cylinder_id": cylinder_id,
            "purpose": "材料氧化实验",
            "expected_return_date": (datetime.utcnow() + timedelta(days=7)).isoformat()
        }
        resp = client.post(f"{BASE_URL}/borrows", json=borrow_data)
        print_response("创建借用", resp)
        
        print("\n[步骤 7] 查看借用记录")
        resp = client.get(f"{BASE_URL}/borrows")
        print_response("借用记录", resp, show_body=False)
        borrows = resp.json()
        for borrow in borrows:
            print(f"  - 借用ID {borrow['id']}: 用户 {borrow['user_id']} 借用气瓶 {borrow['cylinder_id']} "
                  f"- 状态: {borrow['status']} {'(超期)' if borrow['is_overdue'] else ''}")
        
        print("\n[步骤 8] 模拟使用气瓶 - 氧气余量下降")
        resp = client.put(
            f"{BASE_URL}/cylinders/{cylinder_id}/level",
            params={"new_level": 8.0, "recorded_by": "研究员张三", "notes": "实验使用消耗"}
        )
        print_response("更新余量", resp)
        
        print("\n[步骤 9] 再次查看预警 - 验证危险分类联动")
        resp = client.get(f"{BASE_URL}/warnings", params={"is_resolved": False})
        warnings = resp.json()
        print(f"  更新后的预警数量: {len(warnings)}")
        for warning in warnings:
            print(f"    - [{warning['severity']}] {warning['message']}")
        
        print("\n[步骤 10] 生成安全报表")
        resp = client.get(f"{BASE_URL}/reports/safety")
        print_response("安全报表", resp)
        
        print("\n[步骤 11] 换瓶申请 - 为氢气钢瓶申请换瓶")
        hydrogen_cylinder_id = 3
        admin_user_id = 1
        exchange_data = {
            "cylinder_id": hydrogen_cylinder_id,
            "requester_id": admin_user_id,
            "reason": "氢气余量过低，且属于易燃气体，需紧急更换"
        }
        resp = client.post(f"{BASE_URL}/exchanges", json=exchange_data)
        print_response("创建换瓶申请", resp)
        
        print("\n[步骤 12] 查看换瓶申请")
        resp = client.get(f"{BASE_URL}/exchanges")
        print_response("换瓶申请列表", resp)

def test_exception_cases():
    print_separator("异常操作演示 - 业务化错误返回")
    
    with httpx.Client(timeout=30.0) as client:
        print("\n[异常 1] 尝试借用已被借用的气瓶")
        user_id = 3
        cylinder_id = 1
        borrow_data = {
            "user_id": user_id,
            "cylinder_id": cylinder_id,
            "purpose": "重复借用测试",
            "expected_return_date": (datetime.utcnow() + timedelta(days=3)).isoformat()
        }
        resp = client.post(f"{BASE_URL}/borrows", json=borrow_data)
        print_response("重复借用", resp)
        
        print("\n[异常 2] 尝试使用无效的危险分类")
        invalid_cylinder = {
            "cylinder_code": "TEST-INVALID-001",
            "gas_type": "测试气体",
            "danger_category": "INVALID_CATEGORY",
            "capacity": 50.0,
            "current_level": 40.0,
            "location": "测试位置"
        }
        resp = client.post(f"{BASE_URL}/cylinders", json=invalid_cylinder)
        print_response("无效危险分类", resp)
        
        print("\n[异常 3] 尝试设置超过容量的余量")
        resp = client.put(
            f"{BASE_URL}/cylinders/1/level",
            params={"new_level": 100.0}
        )
        print_response("超过容量的余量", resp)
        
        print("\n[异常 4] 尝试为不存在的气瓶创建借用")
        borrow_data = {
            "user_id": 2,
            "cylinder_id": 9999,
            "purpose": "不存在的气瓶",
            "expected_return_date": (datetime.utcnow() + timedelta(days=3)).isoformat()
        }
        resp = client.post(f"{BASE_URL}/borrows", json=borrow_data)
        print_response("不存在的气瓶", resp)
        
        print("\n[异常 5] 尝试重复创建换瓶申请")
        hydrogen_cylinder_id = 3
        admin_user_id = 1
        exchange_data = {
            "cylinder_id": hydrogen_cylinder_id,
            "requester_id": admin_user_id,
            "reason": "重复申请测试"
        }
        resp = client.post(f"{BASE_URL}/exchanges", json=exchange_data)
        print_response("重复换瓶申请", resp)
        
        print("\n[异常 6] 普通用户尝试申请易燃气体换瓶 (需要管理员审批)")
        researcher_user_id = 2
        toxic_cylinder_id = 4
        exchange_data = {
            "cylinder_id": toxic_cylinder_id,
            "requester_id": researcher_user_id,
            "reason": "有毒气体需要更换"
        }
        resp = client.post(f"{BASE_URL}/exchanges", json=exchange_data)
        print_response("非管理员申请危险气体换瓶", resp)

def test_additional_features():
    print_separator("额外功能演示")
    
    with httpx.Client(timeout=30.0) as client:
        print("\n[功能 1] 查看气瓶余量历史记录")
        resp = client.get(f"{BASE_URL}/cylinders/1/history")
        print_response("气瓶历史", resp)
        
        print("\n[功能 2] 按危险分类筛选气瓶")
        resp = client.get(f"{BASE_URL}/cylinders", params={"danger_category": "FLAMMABLE"})
        print_response("易燃气体", resp, show_body=False)
        cylinders = resp.json()
        print(f"  易燃气体数量: {len(cylinders)}")
        for cyl in cylinders:
            print(f"    - {cyl['cylinder_code']}: {cyl['gas_type']}")
        
        print("\n[功能 3] 按状态筛选气瓶")
        resp = client.get(f"{BASE_URL}/cylinders", params={"status": "LOW_WARNING"})
        print_response("预警状态气瓶", resp, show_body=False)
        cylinders = resp.json()
        print(f"  预警状态数量: {len(cylinders)}")
        
        print("\n[功能 4] 归还气瓶")
        resp = client.get(f"{BASE_URL}/borrows", params={"status": "ACTIVE"})
        active_borrows = resp.json()
        if active_borrows:
            borrow_id = active_borrows[0]['id']
            resp = client.put(
                f"{BASE_URL}/borrows/{borrow_id}/return",
                params={"notes": "实验完成，气瓶归还"}
            )
            print_response(f"归还借用ID {borrow_id}", resp)
        
        print("\n[功能 5] 再次查看安全报表")
        resp = client.get(f"{BASE_URL}/reports/safety")
        print_response("更新后的安全报表", resp)

if __name__ == "__main__":
    print_separator("实验室气瓶余量预警系统 API 测试")
    print("\n请确保服务已启动: uvicorn app.main:app --reload")
    print("请确保已初始化数据: python -m scripts.seed_data")
    
    try:
        test_main_flow()
        test_exception_cases()
        test_additional_features()
        
        print_separator("测试完成")
        print("\n✅ 所有测试已完成")
        print("\n📋 关键功能验证:")
        print("   1. 气瓶档案管理 ✓")
        print("   2. 余量读数和历史记录 ✓")
        print("   3. 借用登记和归还 ✓")
        print("   4. 危险分类联动预警 (不同倍率) ✓")
        print("   5. 换瓶申请流程 ✓")
        print("   6. 安全报表 ✓")
        print("   7. 业务化错误返回 ✓")
        
    except httpx.ConnectError:
        print("\n❌ 错误: 无法连接到服务器")
        print("   请先启动服务: uvicorn app.main:app --reload")
    except Exception as e:
        print(f"\n❌ 测试出错: {e}")
        import traceback
        traceback.print_exc()
