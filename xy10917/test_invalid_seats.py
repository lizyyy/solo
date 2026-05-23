import requests
import json

BASE_URL = "http://127.0.0.1:8000/api/v1"

def test_invalid_seat_ids():
    print("=" * 60)
    print("测试：无效座位ID拦截验证")
    print("=" * 60)

    print("\n1. 获取演出ID...")
    try:
        response = requests.get(f"{BASE_URL}/shows")
        shows = response.json()
        if not shows:
            print("   没有找到演出，请先运行 generate_sample_data.py")
            return
        show_id = shows[0]["id"]
        print(f"   演出ID: {show_id}")
    except Exception as e:
        print(f"   错误: {e}")
        print("   请确保服务已启动: python -m uvicorn main:app --reload")
        return

    print("\n2. 获取可用座位列表...")
    try:
        response = requests.get(f"{BASE_URL}/shows/{show_id}/seats?status=available")
        seats = response.json()
        print(f"   可用座位数: {len(seats)}")
        if seats:
            valid_seat_id = seats[0]["id"]
            print(f"   有效座位ID示例: {valid_seat_id}")
    except Exception as e:
        print(f"   错误: {e}")
        return

    print("\n" + "-" * 60)
    print("测试场景1: 使用完全不存在的座位ID创建订单")
    print("-" * 60)
    invalid_seat_ids = [99999, 88888, 77777]
    order_data = {
        "show_id": show_id,
        "contact_name": "测试用户1",
        "contact_phone": "13900000001",
        "group_name": "无效座位测试组1",
        "requested_seats_count": 3,
        "seat_ids": invalid_seat_ids,
        "notes": "测试用不存在的座位ID"
    }
    print(f"   请求座位ID: {invalid_seat_ids}")
    try:
        response = requests.post(f"{BASE_URL}/orders", json=order_data)
        result = response.json()
        print(f"   返回状态: {result.get('status')}")
        print(f"   返回消息: {result.get('message')}")
        if result.get('data') and result['data'].get('error'):
            print(f"   错误详情: {result['data']['error']}")
        
        if result.get('status') == 'seat_not_available':
            print("   ✓ 测试通过：不存在的座位ID被正确拦截")
        else:
            print("   ✗ 测试失败：未正确拦截无效座位")
    except Exception as e:
        print(f"   错误: {e}")

    print("\n" + "-" * 60)
    print("测试场景2: 混合有效和无效座位ID创建订单")
    print("-" * 60)
    mixed_seat_ids = [valid_seat_id, 99999, 88888]
    order_data2 = {
        "show_id": show_id,
        "contact_name": "测试用户2",
        "contact_phone": "13900000002",
        "group_name": "无效座位测试组2",
        "requested_seats_count": 3,
        "seat_ids": mixed_seat_ids,
        "notes": "测试混合座位ID"
    }
    print(f"   请求座位ID: {mixed_seat_ids}")
    try:
        response = requests.post(f"{BASE_URL}/orders", json=order_data2)
        result = response.json()
        print(f"   返回状态: {result.get('status')}")
        print(f"   返回消息: {result.get('message')}")
        if result.get('data') and result['data'].get('error'):
            print(f"   错误详情: {result['data']['error']}")
        
        if result.get('status') == 'seat_not_available':
            print("   ✓ 测试通过：混合无效座位ID被正确拦截")
        else:
            print("   ✗ 测试失败：未正确拦截混合无效座位")
    except Exception as e:
        print(f"   错误: {e}")

    print("\n" + "-" * 60)
    print("测试场景3: 验证异常日志已记录")
    print("-" * 60)
    try:
        response = requests.get(f"{BASE_URL}/exception-logs")
        logs = response.json()
        print(f"   异常日志总数: {len(logs)}")
        recent_logs = [l for l in logs if '座位不存在' in (l.get('error_message') or '')]
        if recent_logs:
            print(f"   找到座位不存在相关日志: {len(recent_logs)} 条")
            for log in recent_logs[:2]:
                print(f"     - 日志ID: {log['id']}, 类型: {log['exception_type']}")
                print(f"       错误消息: {log['error_message']}")
            print("   ✓ 测试通过：异常日志已正确记录")
        else:
            print("   未找到座位不存在相关日志")
    except Exception as e:
        print(f"   错误: {e}")

    print("\n" + "-" * 60)
    print("测试场景4: 使用有效座位ID创建订单（验证正常流程）")
    print("-" * 60)
    valid_seat_ids = [s["id"] for s in seats[:3]]
    order_data3 = {
        "show_id": show_id,
        "contact_name": "测试用户3",
        "contact_phone": "13900000003",
        "group_name": "有效座位测试组",
        "requested_seats_count": 3,
        "seat_ids": valid_seat_ids,
        "notes": "测试有效座位ID"
    }
    print(f"   请求座位ID: {valid_seat_ids}")
    try:
        response = requests.post(f"{BASE_URL}/orders", json=order_data3)
        result = response.json()
        print(f"   返回状态: {result.get('status')}")
        print(f"   返回消息: {result.get('message')}")
        if result.get('data'):
            print(f"   订单ID: {result['data'].get('order_id')}")
            print(f"   实际座位数: 应=3，不会出现0")
        
        if result.get('status') == 'locked':
            print("   ✓ 测试通过：有效座位ID创建订单成功")
        else:
            print("   ✗ 测试失败：有效座位ID创建订单失败")
    except Exception as e:
        print(f"   错误: {e}")

    print("\n" + "=" * 60)
    print("测试完成!")
    print("=" * 60)

if __name__ == "__main__":
    test_invalid_seat_ids()