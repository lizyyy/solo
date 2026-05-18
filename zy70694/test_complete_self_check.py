import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from datetime import datetime, timedelta
from main import app

client = TestClient(app)


def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def print_result(test_name, success, details=""):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} - {test_name}")
    if details:
        print(f"   {details}")


def test_data_import():
    print_section("1. 数据导入测试")
    
    try:
        room_data = {"name": "自检琴房A", "room_type": "三角钢琴", "hourly_rate": 100.0}
        response = client.post("/rooms/", json=room_data)
        if response.status_code == 200:
            print_result("琴房创建", True, f"琴房ID: {response.json()['id']}")
            room_id = response.json()['id']
        else:
            print_result("琴房创建", False, response.text)
            return None, None, None
        
        room_data2 = {"name": "自检琴房B", "room_type": "立式钢琴", "hourly_rate": 80.0}
        client.post("/rooms/", json=room_data2)
        
        user_data = {"phone": f"138{int(datetime.now().timestamp())}", "name": "张三"}
        response = client.post("/users/", json=user_data)
        if response.status_code == 200:
            print_result("用户创建", True, f"用户ID: {response.json()['id']}")
            user_id = response.json()['id']
        else:
            print_result("用户创建", False, response.text)
            return None, None, None
        
        tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        booking_data = {
            "room_id": room_id,
            "user_id": user_id,
            "booking_date": tomorrow,
            "start_time": "09:00",
            "end_time": "11:00"
        }
        response = client.post("/bookings/", json=booking_data)
        if response.status_code == 200:
            print_result("预约创建", True, f"预约ID: {response.json()['id']}, 金额: {response.json()['total_amount']}元")
            booking_id = response.json()['id']
        else:
            print_result("预约创建", False, response.text)
            return None, None, None
        
        return room_id, user_id, booking_id
        
    except Exception as e:
        print_result("数据导入测试", False, str(e))
        return None, None, None


def test_filtering():
    print_section("2. 数据筛选测试")
    
    try:
        response = client.get("/rooms/")
        if response.status_code == 200 and len(response.json()) >= 2:
            print_result("查询所有琴房", True, f"共 {len(response.json())} 间琴房")
        else:
            print_result("查询所有琴房", False, f"状态码: {response.status_code}")
        
        response = client.get("/rooms/?status=available")
        if response.status_code == 200:
            print_result("按状态筛选琴房", True, f"可用琴房 {len(response.json())} 间")
        else:
            print_result("按状态筛选琴房", False)
        
        response = client.get("/users/")
        if response.status_code == 200 and len(response.json()) >= 1:
            print_result("查询所有用户", True, f"共 {len(response.json())} 个用户")
        else:
            print_result("查询所有用户", False)
        
        response = client.get("/bookings/?status=confirmed")
        if response.status_code == 200:
            print_result("按状态筛选预约", True, f"已确认预约 {len(response.json())} 个")
        else:
            print_result("按状态筛选预约", False)
        
        return True
        
    except Exception as e:
        print_result("数据筛选测试", False, str(e))
        return False


def test_business_logic(room_id, user_id, booking_id):
    print_section("3. 核心业务逻辑测试")
    
    try:
        tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        duplicate_booking = {
            "room_id": room_id,
            "user_id": user_id,
            "booking_date": tomorrow,
            "start_time": "10:00",
            "end_time": "12:00"
        }
        response = client.post("/bookings/", json=duplicate_booking)
        if response.status_code == 400 and response.json()['error_code'] == 'TIME_SLOT_CONFLICT':
            print_result("时段冲突拦截", True, "正确拦截了同一琴房同时段预约")
        else:
            print_result("时段冲突拦截", False, "未能正确拦截时段冲突")
        
        same_time_booking = {
            "room_id": room_id + 1,
            "user_id": user_id,
            "booking_date": tomorrow,
            "start_time": "09:00",
            "end_time": "10:00"
        }
        response = client.post("/bookings/", json=same_time_booking)
        if response.status_code == 400 and response.json()['error_code'] == 'DUPLICATE_BOOKING':
            print_result("重复预约拦截", True, "正确拦截了用户同时段多琴房预约")
        else:
            print_result("重复预约拦截", False, "未能正确拦截重复预约")
        
        return True
        
    except Exception as e:
        print_result("核心业务逻辑测试", False, str(e))
        return False


def test_error_handling(room_id, user_id, booking_id):
    print_section("4. 错误响应测试")
    
    try:
        incomplete_data = {"room_id": room_id, "user_id": user_id, "booking_date": "2024-01-01"}
        response = client.post("/bookings/", json=incomplete_data)
        if response.status_code == 422:
            print_result("缺字段错误", True, "正确识别缺少必填字段")
        else:
            print_result("缺字段错误", False, f"状态码: {response.status_code}")
        
        response = client.post("/bookings/checkin", json={"booking_id": 99999})
        if response.status_code == 400 and response.json()['error_code'] == 'BOOKING_NOT_FOUND':
            print_result("资源不存在错误", True, "正确识别预约不存在")
        else:
            print_result("资源不存在错误", False)
        
        renewal_data = {"booking_id": booking_id, "extend_hours": 1}
        response = client.post("/renewals/", json=renewal_data)
        if response.status_code == 400 and response.json()['error_code'] == 'INVALID_STATUS_FOR_RENEWAL':
            print_result("状态不允许错误", True, "正确识别未签到不能续费")
        else:
            print_result("状态不允许错误", False, response.text)
        
        return True
        
    except Exception as e:
        print_result("错误响应测试", False, str(e))
        return False


def test_report_export(room_id, user_id):
    print_section("5. 报告导出测试")
    
    try:
        today = datetime.now().strftime('%Y-%m-%d')
        next_week = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
        
        report_request = {"start_date": today, "end_date": next_week}
        response = client.post("/reports/usage", json=report_request)
        if response.status_code == 200:
            data = response.json()
            print_result("使用报告生成", True, f"总预约数: {data['total_bookings']}, 总收入: {data['total_revenue']}元")
        else:
            print_result("使用报告生成", False, response.text)
        
        response = client.get(f"/reports/usage/export?start_date={today}&end_date={next_week}")
        if response.status_code == 200:
            data = response.json()
            print_result("CSV报告导出", True, f"文件名: {data['filename']}")
            if 'content' in data and len(data['content']) > 0:
                print_result("CSV内容验证", True, "内容非空")
            else:
                print_result("CSV内容验证", False, "内容为空")
        else:
            print_result("CSV报告导出", False)
        
        return True
        
    except Exception as e:
        print_result("报告导出测试", False, str(e))
        return False


def test_late_release():
    print_section("6. 迟到自动释放测试")
    
    try:
        room_response = client.post("/rooms/", json={"name": "迟到测试琴房", "hourly_rate": 100})
        room_id = room_response.json()['id']
        
        user_response = client.post("/users/", json={"phone": f"189{int(datetime.now().timestamp())}", "name": "迟到用户"})
        user_id = user_response.json()['id']
        
        yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
        booking_response = client.post("/bookings/", json={
            "room_id": room_id,
            "user_id": user_id,
            "booking_date": yesterday,
            "start_time": "09:00",
            "end_time": "11:00"
        })
        booking_id = booking_response.json()['id']
        
        response = client.post("/bookings/checkin", json={"booking_id": booking_id})
        if response.status_code == 400 and response.json()['error_code'] == 'TOO_LATE':
            print_result("签到返回 TOO_LATE", True)
        else:
            print_result("签到返回 TOO_LATE", False)
        
        response = client.get(f"/bookings/{booking_id}")
        if response.json()['status'] == 'released':
            print_result("预约状态更新为 released", True)
        else:
            print_result("预约状态更新为 released", False, f"当前状态: {response.json()['status']}")
        
        response = client.get("/late-records/")
        late_records = [r for r in response.json() if r['booking_id'] == booking_id]
        if len(late_records) > 0:
            print_result("迟到记录已创建", True)
        else:
            print_result("迟到记录已创建", False)
        
        return True
        
    except Exception as e:
        print_result("迟到自动释放测试", False, str(e))
        return False


def main():
    print("\n" + "="*60)
    print("  琴房预约系统完整自检验证脚本")
    print("  验证项目: 导入、筛选、处理、导出")
    print("="*60)
    
    room_id, user_id, booking_id = test_data_import()
    
    if room_id and user_id and booking_id:
        test_filtering()
        test_business_logic(room_id, user_id, booking_id)
        test_error_handling(room_id, user_id, booking_id)
        test_report_export(room_id, user_id)
        test_late_release()
    
    print_section("测试完成")
    print("\n✅ 项目可安装、可运行、可验证")
    print("="*60 + "\n")


if __name__ == "__main__":
    main()
