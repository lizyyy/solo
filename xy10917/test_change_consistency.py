import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://127.0.0.1:8000/api/v1"

def test_seat_change_consistency():
    print("=" * 60)
    print("测试：换座审核后数据一致性验证")
    print("=" * 60)

    print("\n1. 创建演出场次（3个座位）...")
    show_data = {
        "name": "换座一致性测试演出",
        "venue": "测试剧场",
        "show_time": (datetime.now() + timedelta(days=7)).isoformat(),
        "total_seats": 3,
        "seats": [
            {"row": "A", "number": "1", "section": "VIP", "price": 200},
            {"row": "A", "number": "2", "section": "VIP", "price": 200},
            {"row": "A", "number": "3", "section": "Standard", "price": 100}
        ]
    }
    try:
        response = requests.post(f"{BASE_URL}/shows", json=show_data)
        result = response.json()
        show_id = result["data"]["show_id"]
        print(f"   演出创建成功，ID: {show_id}")
    except Exception as e:
        print(f"   错误: {e}")
        print("   请确保服务已启动: python -m uvicorn main:app --reload")
        return

    print("\n2. 检查初始状态...")
    try:
        response = requests.get(f"{BASE_URL}/shows/{show_id}")
        show = response.json()
        print(f"   演出总座位: {show['total_seats']}")
        print(f"   演出可用座位: {show['available_seats']}")
        assert show['available_seats'] == 3, "初始可用座位数应为3"
        print("   ✓ 初始状态正确")
    except Exception as e:
        print(f"   错误: {e}")
        return

    print("\n3. 获取座位ID列表...")
    try:
        response = requests.get(f"{BASE_URL}/shows/{show_id}/seats")
        seats = response.json()
        seat_ids = [s["id"] for s in seats]
        print(f"   座位ID: {seat_ids}")
        print(f"   座位价格: {[s['price'] for s in seats]}")
    except Exception as e:
        print(f"   错误: {e}")
        return

    print("\n4. 创建团体订单，锁定前2个座位...")
    locked_seat_ids = seat_ids[:2]
    order_data = {
        "show_id": show_id,
        "contact_name": "换座测试用户",
        "contact_phone": "16000000001",
        "group_name": "换座测试组",
        "requested_seats_count": 2,
        "seat_ids": locked_seat_ids,
        "notes": "用于换座测试"
    }
    try:
        response = requests.post(f"{BASE_URL}/orders", json=order_data)
        result = response.json()
        order_id = result["data"]["order_id"]
        print(f"   订单创建成功，ID: {order_id}")
        print(f"   锁定座位: {locked_seat_ids}")
    except Exception as e:
        print(f"   错误: {e}")
        return

    print("\n5. 锁座后检查演出可用座位数...")
    try:
        response = requests.get(f"{BASE_URL}/shows/{show_id}")
        show = response.json()
        print(f"   演出可用座位: {show['available_seats']}")
        assert show['available_seats'] == 1, "锁座2个后可用座位应为1"
        print("   ✓ 锁座后可用座位数正确")
    except Exception as e:
        print(f"   错误: {e}")
        return

    print("\n6. 检查订单初始数据...")
    try:
        response = requests.get(f"{BASE_URL}/orders/{order_id}")
        order = response.json()
        print(f"   订单请求座位数: {order['requested_seats_count']}")
        print(f"   订单实际座位数: {order['actual_seats_count']}")
        print(f"   订单总金额: {order['total_amount']}")
        assert order['actual_seats_count'] == 2, "实际座位数应为2"
        assert order['total_amount'] == 400, "总金额应为400 (200*2)"
        print("   ✓ 订单初始数据正确")
    except Exception as e:
        print(f"   错误: {e}")
        return

    print("\n" + "-" * 60)
    print("核心测试: 提交并批准换座申请 (2座 → 1座)")
    print("-" * 60)
    original_seat_ids = locked_seat_ids
    new_seat_ids = [seat_ids[2]]
    print(f"   原座位: {original_seat_ids} (2个座位)")
    print(f"   新座位: {new_seat_ids} (1个座位)")

    print("\n7. 提交换座申请...")
    change_data = {
        "order_id": order_id,
        "show_id": show_id,
        "original_seat_ids": original_seat_ids,
        "requested_seat_ids": new_seat_ids,
        "new_seat_count": 1,
        "reason": "人数减少，只需1个座位"
    }
    try:
        response = requests.post(f"{BASE_URL}/change-requests", json=change_data)
        result = response.json()
        change_request_id = result["data"]["request_id"]
        print(f"   换座申请创建成功，ID: {change_request_id}")
        print(f"   当前状态: {result['status']}")
    except Exception as e:
        print(f"   错误: {e}")
        return

    print("\n8. 审核批准换座申请...")
    review_data = {
        "status": "approved",
        "review_notes": "同意换座申请，人数从2改为1",
        "reviewed_by": "测试管理员",
        "compensation_amount": 0
    }
    try:
        response = requests.post(
            f"{BASE_URL}/change-requests/{change_request_id}/review",
            json=review_data
        )
        result = response.json()
        print(f"   审核结果状态: {result['status']}")
        print(f"   审核消息: {result['message']}")
        assert result['status'] == 'approved', "审核状态应为approved"
        print("   ✓ 换座审核批准成功")
    except Exception as e:
        print(f"   错误: {e}")
        return

    print("\n" + "-" * 60)
    print("验证数据一致性")
    print("-" * 60)

    print("\n9. 检查座位状态...")
    try:
        response = requests.get(f"{BASE_URL}/shows/{show_id}/seats")
        seats = response.json()
        available_seats = [s for s in seats if s["status"] == "available"]
        locked_seats = [s for s in seats if s["status"] == "locked"]
        print(f"   实际可用座位数: {len(available_seats)}")
        print(f"   实际锁定座位数: {len(locked_seats)}")
        print(f"   可用座位ID: {[s['id'] for s in available_seats]}")
        print(f"   锁定座位ID: {[s['id'] for s in locked_seats]}")
    except Exception as e:
        print(f"   错误: {e}")
        return

    print("\n10. 检查演出可用座位数统计...")
    try:
        response = requests.get(f"{BASE_URL}/shows/{show_id}")
        show = response.json()
        print(f"   演出统计可用座位: {show['available_seats']}")
        print(f"   实际可用座位数: {len(available_seats)}")
        if show['available_seats'] == len(available_seats):
            print(f"   ✓ 演出统计与实际座位状态一致!")
        else:
            print(f"   ✗ 数据不一致: 统计={show['available_seats']}, 实际={len(available_seats)}")
            print(f"     (修复前的问题: 统计显示1，实际应有2个可用)")
    except Exception as e:
        print(f"   错误: {e}")
        return

    print("\n11. 检查更新后的订单数据...")
    try:
        response = requests.get(f"{BASE_URL}/orders/{order_id}")
        order = response.json()
        print(f"   订单请求座位数: {order['requested_seats_count']}")
        print(f"   订单实际座位数: {order['actual_seats_count']}")
        print(f"   订单总金额: {order['total_amount']}")
        print(f"   订单状态: {order['status']}")
        
        all_pass = True
        if order['requested_seats_count'] == 1:
            print("   ✓ 请求座位数已更新为1")
        else:
            print(f"   ✗ 请求座位数错误: {order['requested_seats_count']}, 应为1")
            all_pass = False
            
        if order['actual_seats_count'] == 1:
            print("   ✓ 实际座位数已更新为1")
        else:
            print(f"   ✗ 实际座位数错误: {order['actual_seats_count']}, 应为1")
            all_pass = False
            
        if order['total_amount'] == 100:
            print("   ✓ 总金额已更新为100")
        else:
            print(f"   ✗ 总金额错误: {order['total_amount']}, 应为100")
            all_pass = False
            
        if order['status'] == 'modified':
            print("   ✓ 订单状态已更新为modified")
        else:
            print(f"   ✗ 订单状态错误: {order['status']}")
            all_pass = False
    except Exception as e:
        print(f"   错误: {e}")
        return

    print("\n12. 检查锁座报告数据...")
    try:
        response = requests.get(f"{BASE_URL}/reports/lock-report/{show_id}")
        report = response.json()
        summary = report["data"]["summary"]
        print(f"   报告总座位: {summary['total_seats']}")
        print(f"   报告可用座位: {summary['available_seats']}")
        print(f"   报告锁定座位: {summary['locked_seats']}")
        
        if summary['available_seats'] == len(available_seats):
            print(f"   ✓ 报告可用座位数与实际一致!")
        else:
            print(f"   ✗ 报告数据不一致")
    except Exception as e:
        print(f"   错误: {e}")
        return

    print("\n" + "=" * 60)
    if all_pass and show['available_seats'] == len(available_seats):
        print("✅ 所有测试通过! 换座后数据一致性已保证")
    else:
        print("❌ 部分测试失败")
    print("=" * 60)

if __name__ == "__main__":
    test_seat_change_consistency()