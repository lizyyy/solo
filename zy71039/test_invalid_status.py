import requests
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"


def test_invalid_status_transition():
    """测试非法状态流转会被API拒绝"""
    print("=" * 60)
    print("测试: 非法状态流转校验")
    print("=" * 60)
    
    print("\n1. 创建测试数据...")
    area_data = {"name": "测试区域", "building": "测试楼"}
    resp = requests.post(f"{BASE_URL}/roof-areas/", json=area_data)
    area_id = resp.json()['id']
    
    material_data = {
        "roof_area_id": area_id,
        "position_desc": "测试位置",
        "leak_level": "中度"
    }
    resp = requests.post(f"{BASE_URL}/raw-materials/", json=material_data)
    point_id = resp.json()['inspection_point_id']
    
    wo_data = {"inspection_point_id": point_id, "description": "测试工单"}
    resp = requests.post(f"{BASE_URL}/work-orders/", json=wo_data)
    work_order = resp.json()
    wo_id = work_order['id']
    print(f"   工单ID: {wo_id}, 当前状态: {work_order['status']}")
    
    print("\n2. 测试非法流转: 待判定 --X--> 维修中 (应该失败)")
    status_data = {
        "work_order_id": wo_id,
        "new_status": "维修中",
        "operator": "测试员",
        "reason": "非法流转测试"
    }
    resp = requests.post(f"{BASE_URL}/work-orders/status", json=status_data)
    if resp.status_code == 400:
        print(f"   ✅ 正确拒绝! 状态码: {resp.status_code}")
        print(f"   错误信息: {resp.json()['detail']}")
    else:
        print(f"   ❌ 错误! 状态码: {resp.status_code}")
    
    print("\n3. 测试合法流转: 待判定 --> 已确认待维修 (应该成功)")
    status_data = {
        "work_order_id": wo_id,
        "new_status": "已确认待维修",
        "operator": "测试员",
        "reason": "合法流转测试"
    }
    resp = requests.post(f"{BASE_URL}/work-orders/status", json=status_data)
    if resp.status_code == 200:
        print(f"   ✅ 流转成功! 新状态: {resp.json()['status']}")
    else:
        print(f"   ❌ 错误! 状态码: {resp.status_code}, {resp.text}")
    
    print("\n4. 测试非法流转: 已确认待维修 --X--> 待复测 (应该失败)")
    status_data = {
        "work_order_id": wo_id,
        "new_status": "待复测",
        "operator": "测试员",
        "reason": "非法流转测试"
    }
    resp = requests.post(f"{BASE_URL}/work-orders/status", json=status_data)
    if resp.status_code == 400:
        print(f"   ✅ 正确拒绝! 状态码: {resp.status_code}")
        print(f"   错误信息: {resp.json()['detail']}")
    else:
        print(f"   ❌ 错误! 状态码: {resp.status_code}")
    
    print("\n5. 测试合法流转: 已确认待维修 --> 维修中 (应该成功)")
    status_data = {
        "work_order_id": wo_id,
        "new_status": "维修中",
        "operator": "测试员",
        "reason": "合法流转测试"
    }
    resp = requests.post(f"{BASE_URL}/work-orders/status", json=status_data)
    if resp.status_code == 200:
        print(f"   ✅ 流转成功! 新状态: {resp.json()['status']}")
    else:
        print(f"   ❌ 错误! 状态码: {resp.status_code}")
    
    print("\n" + "=" * 60)
    print("状态机校验验证完成！")
    print("=" * 60)


if __name__ == "__main__":
    try:
        test_invalid_status_transition()
    except requests.exceptions.ConnectionError:
        print("❌ 无法连接到服务器，请先运行: python main.py")
