import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from datetime import datetime, timedelta
from main import app

client = TestClient(app)


def print_test(name, success, details=""):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} - {name}")
    if details:
        print(f"   {details}")


def test_late_release_fix():
    print("\n" + "="*60)
    print("  测试: 迟到30分钟自动释放功能修复验证")
    print("="*60 + "\n")

    # 1. 创建琴房
    print("步骤1: 创建琴房...")
    room_data = {"name": "测试琴房A", "room_type": "三角钢琴", "hourly_rate": 100.0}
    response = client.post("/rooms/", json=room_data)
    room_id = response.json()['id']
    print_test("琴房创建", response.status_code == 200, f"ID: {room_id}")

    # 2. 创建用户
    print("\n步骤2: 创建用户...")
    user_data = {"phone": f"138{int(datetime.now().timestamp())}", "name": "测试用户"}
    response = client.post("/users/", json=user_data)
    user_id = response.json()['id']
    print_test("用户创建", response.status_code == 200, f"ID: {user_id}")

    # 3. 创建昨天的预约（确保已超时30分钟以上）
    print("\n步骤3: 创建昨天的预约...")
    yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
    booking_data = {
        "room_id": room_id,
        "user_id": user_id,
        "booking_date": yesterday,
        "start_time": "09:00",
        "end_time": "11:00"
    }
    response = client.post("/bookings/", json=booking_data)
    booking_id = response.json()['id']
    print_test("预约创建", response.status_code == 200, f"ID: {booking_id}")

    # 4. 检查初始状态
    print("\n步骤4: 检查初始状态...")
    response = client.get(f"/bookings/{booking_id}")
    initial_status = response.json()['status']
    print_test("初始状态为 confirmed", initial_status == "confirmed", f"当前状态: {initial_status}")

    response = client.get(f"/rooms/{room_id}")
    initial_room_status = response.json()['status']
    print_test("琴房初始状态为 available", initial_room_status == "available", f"当前状态: {initial_room_status}")

    response = client.get("/late-records/")
    initial_late_count = len([r for r in response.json() if r['booking_id'] == booking_id])
    print_test("迟到记录初始为空", initial_late_count == 0, f"当前记录数: {initial_late_count}")

    # 5. 调用签到（应该触发TOO_LATE）
    print("\n步骤5: 调用签到（预期迟到超过30分钟）...")
    response = client.post("/bookings/checkin", json={"booking_id": booking_id})
    print_test("签到返回 TOO_LATE 错误", 
               response.status_code == 400 and response.json()['error_code'] == 'TOO_LATE',
               f"状态码: {response.status_code}, 错误码: {response.json().get('error_code')}")

    # 6. 验证预约状态是否已更新为 released
    print("\n步骤6: 验证预约状态...")
    response = client.get(f"/bookings/{booking_id}")
    final_status = response.json()['status']
    is_late_released = response.json()['is_late_released']
    print_test("预约状态已更新为 released", final_status == "released", f"当前状态: {final_status}")
    print_test("is_late_released 标记为 True", is_late_released == True, f"标记值: {is_late_released}")

    # 7. 验证琴房状态是否恢复 available
    print("\n步骤7: 验证琴房状态...")
    response = client.get(f"/rooms/{room_id}")
    final_room_status = response.json()['status']
    print_test("琴房状态恢复为 available", final_room_status == "available", f"当前状态: {final_room_status}")

    # 8. 验证迟到记录是否已创建
    print("\n步骤8: 验证迟到记录...")
    response = client.get("/late-records/")
    late_records = [r for r in response.json() if r['booking_id'] == booking_id]
    print_test("迟到记录已创建", len(late_records) == 1, f"记录数: {len(late_records)}")
    
    if late_records:
        record = late_records[0]
        print_test("is_released 标记为 True", record['is_released'] == True, f"标记值: {record['is_released']}")
        print_test("late_minutes >= 30", record['late_minutes'] >= 30, f"迟到分钟数: {record['late_minutes']}")

    # 9. 验证再次签到返回 BOOKING_RELEASED
    print("\n步骤9: 验证再次签到...")
    response = client.post("/bookings/checkin", json={"booking_id": booking_id})
    print_test("再次签到返回 BOOKING_RELEASED",
               response.status_code == 400 and response.json()['error_code'] == 'BOOKING_RELEASED',
               f"错误码: {response.json().get('error_code')}")

    print("\n" + "="*60)
    print("  测试完成！")
    print("="*60 + "\n")


if __name__ == "__main__":
    test_late_release_fix()
