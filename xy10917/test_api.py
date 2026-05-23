import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://127.0.0.1:8000/api/v1"

def test_api():
    print("=" * 60)
    print("剧场座位保留 API 测试脚本")
    print("=" * 60)

    print("\n1. 获取所有演出场次...")
    try:
        response = requests.get(f"{BASE_URL}/shows")
        shows = response.json()
        print(f"   找到 {len(shows)} 场演出")
        if shows:
            show_id = shows[0]["id"]
            print(f"   使用演出 ID: {show_id}")
    except Exception as e:
        print(f"   错误: {e}")
        return

    print("\n2. 获取演出座位信息...")
    try:
        response = requests.get(f"{BASE_URL}/shows/{show_id}/seats")
        seats = response.json()
        available = [s for s in seats if s["status"] == "available"]
        locked = [s for s in seats if s["status"] == "locked"]
        print(f"   总座位数: {len(seats)}")
        print(f"   可用座位: {len(available)}")
        print(f"   已锁定: {len(locked)}")
    except Exception as e:
        print(f"   错误: {e}")

    print("\n3. 创建新的团体订单...")
    available_seat_ids = [s["id"] for s in available[:3]]
    if available_seat_ids:
        order_data = {
            "show_id": show_id,
            "contact_name": "测试用户",
            "contact_phone": "13900139000",
            "group_name": "API测试组",
            "requested_seats_count": 3,
            "seat_ids": available_seat_ids,
            "notes": "API测试订单"
        }
        try:
            response = requests.post(f"{BASE_URL}/orders", json=order_data)
            result = response.json()
            print(f"   状态: {result['status']}")
            print(f"   消息: {result['message']}")
            if result["data"]:
                order_id = result["data"].get("order_id")
                print(f"   订单ID: {order_id}")
        except Exception as e:
            print(f"   错误: {e}")

    print("\n4. 获取所有团体订单...")
    try:
        response = requests.get(f"{BASE_URL}/orders")
        orders = response.json()
        print(f"   订单总数: {len(orders)}")
        for o in orders[:3]:
            print(f"     - {o['group_name'] or '匿名'}: {o['status']}")
    except Exception as e:
        print(f"   错误: {e}")

    print("\n5. 获取所有换座申请...")
    try:
        response = requests.get(f"{BASE_URL}/change-requests")
        changes = response.json()
        print(f"   换座申请数: {len(changes)}")
        pending = [c for c in changes if c["status"] == "pending_review"]
        print(f"   待审核: {len(pending)}")
        if pending:
            change_id = pending[0]["id"]
            print(f"   待审核申请ID: {change_id}")
    except Exception as e:
        print(f"   错误: {e}")

    print("\n6. 审核换座申请...")
    if 'change_id' in locals() and pending:
        review_data = {
            "status": "approved",
            "review_notes": "同意换座申请",
            "reviewed_by": "管理员",
            "compensation_amount": 0
        }
        try:
            response = requests.post(
                f"{BASE_URL}/change-requests/{change_id}/review",
                json=review_data
            )
            result = response.json()
            print(f"   状态: {result['status']}")
            print(f"   消息: {result['message']}")
        except Exception as e:
            print(f"   错误: {e}")

    print("\n7. 获取异常日志...")
    try:
        response = requests.get(f"{BASE_URL}/exception-logs")
        logs = response.json()
        print(f"   异常日志数: {len(logs)}")
        unresolved = [l for l in logs if not l["resolved"]]
        print(f"   未解决: {len(unresolved)}")
    except Exception as e:
        print(f"   错误: {e}")

    print("\n8. 生成锁座报告...")
    try:
        response = requests.get(f"{BASE_URL}/reports/lock-report/{show_id}")
        report = response.json()
        print(f"   状态: {report['status']}")
        if report["data"]:
            summary = report["data"]["summary"]
            print(f"   总座位: {summary['total_seats']}")
            print(f"   可用: {summary['available_seats']}")
            print(f"   锁定: {summary['locked_seats']}")
            print(f"   活跃窗口: {summary['active_windows']}")
    except Exception as e:
        print(f"   错误: {e}")

    print("\n9. 检查超时保留窗口...")
    try:
        response = requests.post(f"{BASE_URL}/reserve-windows/check-expired")
        result = response.json()
        print(f"   消息: {result['message']}")
    except Exception as e:
        print(f"   错误: {e}")

    print("\n10. 导出报告...")
    try:
        response = requests.get(f"{BASE_URL}/reports/export/{show_id}")
        export_data = response.json()
        print(f"   导出文件名: {export_data['filename']}")
        print(f"   包含订单数: {len(export_data['data']['orders'])}")
    except Exception as e:
        print(f"   错误: {e}")

    print("\n" + "=" * 60)
    print("测试完成! 详细文档请访问: http://127.0.0.1:8000/docs")
    print("=" * 60)

if __name__ == "__main__":
    test_api()