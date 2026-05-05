import requests
import json
from datetime import datetime, timedelta

BASE_URL = 'http://localhost:5001'

def print_response(response, title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")
    print(f"Status Code: {response.status_code}")
    try:
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2, ensure_ascii=False)}")
        return data
    except:
        print(f"Response: {response.text}")
        return None

def test_complete_flow():
    print("="*60)
    print("  测试共享练琴房后端服务")
    print("="*60)
    
    print("\n1. 获取所有房间...")
    response = requests.get(f"{BASE_URL}/api/rooms")
    rooms = print_response(response, "获取房间列表")
    
    print("\n2. 获取所有会员...")
    response = requests.get(f"{BASE_URL}/api/members")
    members = print_response(response, "获取会员列表")
    
    if not rooms or not members:
        print("错误：无法获取房间或会员数据")
        return
    
    room_id = rooms[0]['id']
    member_id = members[0]['id']
    
    print(f"\n使用房间ID: {room_id}, 会员ID: {member_id}")
    
    now = datetime.now()
    start_time = (now + timedelta(minutes=10)).strftime('%Y-%m-%d %H:%M:%S')
    end_time = (now + timedelta(hours=1, minutes=10)).strftime('%Y-%m-%d %H:%M:%S')
    
    print(f"\n3. 创建预约 (时间: {start_time} - {end_time})...")
    reservation_data = {
        'member_id': member_id,
        'room_id': room_id,
        'start_time': start_time,
        'end_time': end_time
    }
    response = requests.post(
        f"{BASE_URL}/api/reservations",
        json=reservation_data,
        headers={'Content-Type': 'application/json'}
    )
    reservation = print_response(response, "创建预约")
    
    if not reservation or 'door_code' not in reservation:
        print("错误：创建预约失败")
        return
    
    door_code = reservation['door_code']
    reservation_id = reservation['id']
    print(f"\n生成的门禁码: {door_code}")
    
    print(f"\n4. 查看webhook日志 (应该有DOOR_CODE_GENERATED事件)...")
    response = requests.get(f"{BASE_URL}/webhook/logs")
    print_response(response, "Webhook日志")
    
    print(f"\n5. 核验门禁码 (应该成功)...")
    verify_data = {
        'door_code': door_code,
        'room_id': room_id
    }
    response = requests.post(
        f"{BASE_URL}/api/verify",
        json=verify_data,
        headers={'Content-Type': 'application/json'}
    )
    verify_result = print_response(response, "核验门禁码")
    
    print(f"\n6. 再次核验同一门禁码 (应该失败，因为已使用)...")
    response = requests.post(
        f"{BASE_URL}/api/verify",
        json=verify_data,
        headers={'Content-Type': 'application/json'}
    )
    print_response(response, "再次核验门禁码")
    
    print(f"\n7. 查看审计日志...")
    response = requests.get(f"{BASE_URL}/api/audit-logs")
    print_response(response, "审计日志")
    
    print(f"\n8. 查看更新后的会员信息 (次数应该减少)...")
    response = requests.get(f"{BASE_URL}/api/members/{member_id}")
    print_response(response, "会员信息")
    
    print(f"\n9. 查看webhook日志 (应该有DOOR_VERIFICATION事件)...")
    response = requests.get(f"{BASE_URL}/webhook/logs")
    print_response(response, "Webhook日志")
    
    print("\n" + "="*60)
    print("  测试完成！")
    print("="*60)

def test_error_scenarios():
    print("\n\n" + "="*60)
    print("  测试错误场景")
    print("="*60)
    
    print("\n1. 获取房间和会员...")
    rooms = requests.get(f"{BASE_URL}/api/rooms").json()
    members = requests.get(f"{BASE_URL}/api/members").json()
    
    if not rooms or not members:
        print("错误：无法获取测试数据")
        return
    
    room_id = rooms[0]['id']
    member_id = members[0]['id']
    
    now = datetime.now()
    start_time = (now + timedelta(hours=2)).strftime('%Y-%m-%d %H:%M:%S')
    end_time = (now + timedelta(hours=3)).strftime('%Y-%m-%d %H:%M:%S')
    
    print(f"\n2. 创建一个新预约用于测试取消...")
    reservation_data = {
        'member_id': member_id,
        'room_id': room_id,
        'start_time': start_time,
        'end_time': end_time
    }
    response = requests.post(
        f"{BASE_URL}/api/reservations",
        json=reservation_data,
        headers={'Content-Type': 'application/json'}
    )
    reservation = print_response(response, "创建测试预约")
    
    if not reservation or 'door_code' not in reservation:
        print("错误：创建预约失败")
        return
    
    test_door_code = reservation['door_code']
    test_reservation_id = reservation['id']
    
    print(f"\n3. 使用错误的房间ID核验...")
    wrong_room_id = 999 if room_id == 1 else 1
    verify_data = {
        'door_code': test_door_code,
        'room_id': wrong_room_id
    }
    response = requests.post(
        f"{BASE_URL}/api/verify",
        json=verify_data,
        headers={'Content-Type': 'application/json'}
    )
    print_response(response, "错误房间核验")
    
    print(f"\n4. 取消预约...")
    response = requests.post(
        f"{BASE_URL}/api/reservations/{test_reservation_id}/cancel",
        headers={'Content-Type': 'application/json'}
    )
    print_response(response, "取消预约")
    
    print(f"\n5. 使用已取消的预约核验...")
    verify_data = {
        'door_code': test_door_code,
        'room_id': room_id
    }
    response = requests.post(
        f"{BASE_URL}/api/verify",
        json=verify_data,
        headers={'Content-Type': 'application/json'}
    )
    print_response(response, "已取消预约核验")
    
    print(f"\n6. 查看更新后的会员信息 (次数应该返还)...")
    response = requests.get(f"{BASE_URL}/api/members/{member_id}")
    print_response(response, "会员信息")
    
    print(f"\n7. 使用不存在的门禁码核验...")
    verify_data = {
        'door_code': '999999',
        'room_id': room_id
    }
    response = requests.post(
        f"{BASE_URL}/api/verify",
        json=verify_data,
        headers={'Content-Type': 'application/json'}
    )
    print_response(response, "不存在的门禁码")
    
    print("\n" + "="*60)
    print("  错误场景测试完成！")
    print("="*60)

if __name__ == '__main__':
    test_complete_flow()
    test_error_scenarios()
