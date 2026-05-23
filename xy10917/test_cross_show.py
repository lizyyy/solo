import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://127.0.0.1:8000/api/v1"

def test_cross_show_seat_validation():
    print("=" * 60)
    print("测试：跨场次座位归属验证")
    print("=" * 60)

    print("\n1. 创建演出场次1...")
    show1_data = {
        "name": "演出A - 测试场次1",
        "venue": "测试剧场",
        "show_time": (datetime.now() + timedelta(days=7)).isoformat(),
        "total_seats": 5,
        "seats": [
            {"row": "A", "number": "1", "section": "VIP", "price": 100},
            {"row": "A", "number": "2", "section": "VIP", "price": 100},
            {"row": "A", "number": "3", "section": "VIP", "price": 100},
            {"row": "B", "number": "1", "section": "Standard", "price": 50},
            {"row": "B", "number": "2", "section": "Standard", "price": 50}
        ]
    }
    try:
        response = requests.post(f"{BASE_URL}/shows", json=show1_data)
        result = response.json()
        show1_id = result["data"]["show_id"]
        print(f"   演出1创建成功，ID: {show1_id}")
    except Exception as e:
        print(f"   错误: {e}")
        print("   请确保服务已启动: python -m uvicorn main:app --reload")
        return

    print("\n2. 创建演出场次2...")
    show2_data = {
        "name": "演出B - 测试场次2",
        "venue": "测试剧场",
        "show_time": (datetime.now() + timedelta(days=8)).isoformat(),
        "total_seats": 3,
        "seats": [
            {"row": "A", "number": "1", "section": "VIP", "price": 150},
            {"row": "A", "number": "2", "section": "VIP", "price": 150},
            {"row": "A", "number": "3", "section": "VIP", "price": 150}
        ]
    }
    try:
        response = requests.post(f"{BASE_URL}/shows", json=show2_data)
        result = response.json()
        show2_id = result["data"]["show_id"]
        print(f"   演出2创建成功，ID: {show2_id}")
    except Exception as e:
        print(f"   错误: {e}")
        return

    print("\n3. 获取演出1的座位ID...")
    try:
        response = requests.get(f"{BASE_URL}/shows/{show1_id}/seats")
        show1_seats = response.json()
        show1_seat_ids = [s["id"] for s in show1_seats]
        print(f"   演出1的座位ID: {show1_seat_ids}")
        print(f"   演出1的座位归属show_id: {[s['show_id'] for s in show1_seats]}")
    except Exception as e:
        print(f"   错误: {e}")
        return

    print("\n4. 获取演出2的座位ID...")
    try:
        response = requests.get(f"{BASE_URL}/shows/{show2_id}/seats")
        show2_seats = response.json()
        show2_seat_ids = [s["id"] for s in show2_seats]
        print(f"   演出2的座位ID: {show2_seat_ids}")
        print(f"   演出2的座位归属show_id: {[s['show_id'] for s in show2_seats]}")
    except Exception as e:
        print(f"   错误: {e}")
        return

    print("\n" + "-" * 60)
    print("测试场景1: 演出2 + 演出1的座位ID (跨场次)")
    print("-" * 60)
    order_data = {
        "show_id": show2_id,
        "contact_name": "跨场次测试",
        "contact_phone": "15000000001",
        "group_name": "跨场次测试组",
        "requested_seats_count": 2,
        "seat_ids": show1_seat_ids[:2],
        "notes": "测试跨场次座位"
    }
    print(f"   请求show_id: {show2_id}")
    print(f"   请求seat_ids: {show1_seat_ids[:2]} (属于演出{show1_id})")
    try:
        response = requests.post(f"{BASE_URL}/orders", json=order_data)
        result = response.json()
        print(f"   返回状态: {result.get('status')}")
        print(f"   返回消息: {result.get('message')}")
        if result.get('data') and result['data'].get('error'):
            print(f"   错误详情: {result['data']['error']}")
        
        if result.get('status') == 'seat_not_available' and '不属于当前演出' in result['data'].get('error', ''):
            print("   ✓ 测试通过：跨场次座位被正确拦截")
        else:
            print("   ✗ 测试失败：跨场次座位未被拦截")
    except Exception as e:
        print(f"   错误: {e}")

    print("\n" + "-" * 60)
    print("测试场景2: 演出1 + 演出1的座位ID (正确归属)")
    print("-" * 60)
    order_data2 = {
        "show_id": show1_id,
        "contact_name": "正常测试",
        "contact_phone": "15000000002",
        "group_name": "正常测试组",
        "requested_seats_count": 2,
        "seat_ids": show1_seat_ids[:2],
        "notes": "测试正常座位"
    }
    print(f"   请求show_id: {show1_id}")
    print(f"   请求seat_ids: {show1_seat_ids[:2]} (属于演出{show1_id})")
    try:
        response = requests.post(f"{BASE_URL}/orders", json=order_data2)
        result = response.json()
        print(f"   返回状态: {result.get('status')}")
        print(f"   返回消息: {result.get('message')}")
        
        if result.get('status') == 'locked':
            print("   ✓ 测试通过：正确场次的座位正常锁定")
            order_id = result['data']['order_id']
            print(f"     创建的订单ID: {order_id}")
        else:
            print("   ✗ 测试失败：正常座位锁定失败")
    except Exception as e:
        print(f"   错误: {e}")

    print("\n" + "-" * 60)
    print("测试场景3: 混合跨场次和同场次座位ID")
    print("-" * 60)
    mixed_seat_ids = [show1_seat_ids[0], show2_seat_ids[0]]
    order_data3 = {
        "show_id": show2_id,
        "contact_name": "混合测试",
        "contact_phone": "15000000003",
        "group_name": "混合测试组",
        "requested_seats_count": 2,
        "seat_ids": mixed_seat_ids,
        "notes": "测试混合座位"
    }
    print(f"   请求show_id: {show2_id}")
    print(f"   请求seat_ids: {mixed_seat_ids}")
    print(f"   seat_id {show1_seat_ids[0]} 属于演出{show1_id}, seat_id {show2_seat_ids[0]} 属于演出{show2_id}")
    try:
        response = requests.post(f"{BASE_URL}/orders", json=order_data3)
        result = response.json()
        print(f"   返回状态: {result.get('status')}")
        print(f"   返回消息: {result.get('message')}")
        if result.get('data') and result['data'].get('error'):
            print(f"   错误详情: {result['data']['error']}")
        
        if result.get('status') == 'seat_not_available':
            print("   ✓ 测试通过：混合跨场次座位被正确拦截")
        else:
            print("   ✗ 测试失败：混合跨场次座位未被拦截")
    except Exception as e:
        print(f"   错误: {e}")

    print("\n" + "-" * 60)
    print("测试场景4: 验证异常日志已记录跨场次错误")
    print("-" * 60)
    try:
        response = requests.get(f"{BASE_URL}/exception-logs?resolved=false")
        logs = response.json()
        print(f"   未解决异常日志总数: {len(logs)}")
        cross_show_logs = [l for l in logs if '不属于当前演出' in (l.get('error_message') or '')]
        if cross_show_logs:
            print(f"   找到跨场次相关日志: {len(cross_show_logs)} 条")
            for log in cross_show_logs[:2]:
                print(f"     - 日志ID: {log['id']}")
                print(f"       错误消息: {log['error_message']}")
            print("   ✓ 测试通过：跨场次异常日志已正确记录")
        else:
            print("   未找到跨场次相关日志")
    except Exception as e:
        print(f"   错误: {e}")

    print("\n" + "-" * 60)
    print("测试场景5: 验证数据一致性 - 检查演出可用座位数")
    print("-" * 60)
    try:
        response = requests.get(f"{BASE_URL}/shows/{show1_id}")
        show1 = response.json()
        response = requests.get(f"{BASE_URL}/shows/{show2_id}")
        show2 = response.json()
        print(f"   演出{show1_id}可用座位: {show1['available_seats']} / {show1['total_seats']}")
        print(f"   演出{show2_id}可用座位: {show2['available_seats']} / {show2['total_seats']}")
        if show1['available_seats'] == show1['total_seats'] - 2 and show2['available_seats'] == show2['total_seats']:
            print("   ✓ 测试通过：演出可用座位数正确，跨场次没有错误扣减")
        else:
            print("   ✗ 测试失败：演出可用座位数不正确")
    except Exception as e:
        print(f"   错误: {e}")

    print("\n" + "=" * 60)
    print("测试完成!")
    print("=" * 60)

if __name__ == "__main__":
    test_cross_show_seat_validation()