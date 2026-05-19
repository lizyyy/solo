#!/usr/bin/env python3
import requests
import json
import time

BASE_URL = "http://localhost:8001"


def print_step(step_num, title):
    print(f"\n{'='*60}")
    print(f"步骤 {step_num}: {title}")
    print(f"{'='*60}")


def print_response(response):
    print(f"状态码: {response.status_code}")
    if response.status_code in [200, 201]:
        data = response.json()
        print(f"响应: {json.dumps(data, ensure_ascii=False, indent=2)}")
        return data
    else:
        print(f"错误: {response.text}")
        return None


def test_main_flow():
    print("开始测试会展设备租赁管理系统主流程...")
    
    print_step(1, "创建展位")
    booths = [
        {"booth_number": "A01", "company_name": "科技公司A", "contact_person": "张三", "contact_phone": "13800138001", "area": 36.0},
        {"booth_number": "A02", "company_name": "科技公司B", "contact_person": "李四", "contact_phone": "13800138002", "area": 48.0},
    ]
    created_booths = []
    for booth in booths:
        response = requests.post(f"{BASE_URL}/booths/", json=booth)
        data = print_response(response)
        if data:
            created_booths.append(data)
    
    print_step(2, "创建设备（桁架、灯具、屏幕）")
    equipment_list = [
        {"barcode": "TRUSS001", "name": "标准桁架3m", "category": "桁架", "specification": "300x300mm, 3m", "daily_rate": 50.0, "deposit": 500.0},
        {"barcode": "TRUSS002", "name": "标准桁架2m", "category": "桁架", "specification": "300x300mm, 2m", "daily_rate": 40.0, "deposit": 400.0},
        {"barcode": "LIGHT001", "name": "LED帕灯", "category": "灯具", "specification": "18颗10W, RGBW", "daily_rate": 80.0, "deposit": 800.0},
        {"barcode": "LIGHT002", "name": "追光灯", "category": "灯具", "specification": "230W", "daily_rate": 150.0, "deposit": 1500.0},
        {"barcode": "SCREEN001", "name": "P3 LED屏幕1㎡", "category": "屏幕", "specification": "P3, 室内", "daily_rate": 200.0, "deposit": 2000.0},
        {"barcode": "SCREEN002", "name": "P2.5 LED屏幕1㎡", "category": "屏幕", "specification": "P2.5, 室内", "daily_rate": 250.0, "deposit": 2500.0},
    ]
    created_equipment = []
    for eq in equipment_list:
        response = requests.post(f"{BASE_URL}/equipment/", json=eq)
        data = print_response(response)
        if data:
            created_equipment.append(data)
    
    print_step(3, "测试重复扫码验证（同一设备重复添加）")
    duplicate_rental = {
        "booth_id": created_booths[0]["id"],
        "items": [
            {"equipment_id": created_equipment[0]["id"], "quantity": 1},
            {"equipment_id": created_equipment[0]["id"], "quantity": 1},
        ]
    }
    response = requests.post(f"{BASE_URL}/rentals/", json=duplicate_rental)
    print_response(response)
    
    print_step(4, "测试跨展位借用验证（A02借用已被A01借出的设备）")
    valid_rental = {
        "booth_id": created_booths[0]["id"],
        "items": [
            {"equipment_id": created_equipment[0]["id"], "quantity": 1},
            {"equipment_id": created_equipment[2]["id"], "quantity": 1},
        ]
    }
    response = requests.post(f"{BASE_URL}/rentals/", json=valid_rental)
    data = print_response(response)
    rental_id_1 = data["rental"]["id"] if data else None
    
    cross_booth_rental = {
        "booth_id": created_booths[1]["id"],
        "items": [
            {"equipment_id": created_equipment[0]["id"], "quantity": 1},
        ]
    }
    response = requests.post(f"{BASE_URL}/rentals/", json=cross_booth_rental)
    print_response(response)
    
    print_step(5, "正常借用流程（A02借用其他设备）")
    valid_rental2 = {
        "booth_id": created_booths[1]["id"],
        "items": [
            {"equipment_id": created_equipment[1]["id"], "quantity": 1},
            {"equipment_id": created_equipment[4]["id"], "quantity": 1},
        ]
    }
    response = requests.post(f"{BASE_URL}/rentals/", json=valid_rental2)
    data = print_response(response)
    rental_id_2 = data["rental"]["id"] if data else None
    
    print_step(6, "测试损坏扣减（归还损坏设备）")
    return_with_damage = {
        "rental_id": rental_id_1,
        "items": [
            {"equipment_id": created_equipment[0]["id"], "quantity": 1, "status": "damaged", "damage_level": "moderate", "remarks": "桁架表面有划痕"},
            {"equipment_id": created_equipment[2]["id"], "quantity": 1, "status": "good"},
        ]
    }
    response = requests.post(f"{BASE_URL}/returns/", json=return_with_damage)
    print_response(response)
    
    print_step(7, "测试正常归还")
    return_normal = {
        "rental_id": rental_id_2,
        "items": [
            {"equipment_id": created_equipment[1]["id"], "quantity": 1, "status": "good"},
            {"equipment_id": created_equipment[4]["id"], "quantity": 1, "status": "good"},
        ]
    }
    response = requests.post(f"{BASE_URL}/returns/", json=return_normal)
    print_response(response)
    
    print_step(8, "测试回滚功能")
    rental3 = {
        "booth_id": created_booths[0]["id"],
        "items": [
            {"equipment_id": created_equipment[3]["id"], "quantity": 1},
        ]
    }
    response = requests.post(f"{BASE_URL}/rentals/", json=rental3)
    data = print_response(response)
    rental_id_3 = data["rental"]["id"] if data else None
    
    if rental_id_3:
        response = requests.post(f"{BASE_URL}/rentals/{rental_id_3}/rollback/", params={"reason": "操作错误，需要回滚"})
        print_response(response)
    
    print_step(9, "查看审计日志")
    response = requests.get(f"{BASE_URL}/audit-logs/")
    data = print_response(response)
    if data:
        print(f"\n审计日志记录数: {len(data)}")
        for log in data[-5:]:
            print(f"  - {log['action']}: {log['status']} - {log['reason']}")
    
    print_step(10, "查看展位列表（脱敏后的敏感字段）")
    response = requests.get(f"{BASE_URL}/booths/")
    data = print_response(response)
    if data:
        for booth in data:
            print(f"  展位: {booth['booth_number']} - {booth['company_name']}")
    
    print("\n" + "="*60)
    print("测试完成！")
    print("="*60)


if __name__ == "__main__":
    try:
        test_main_flow()
    except requests.exceptions.ConnectionError:
        print("错误: 无法连接到服务器，请先启动服务:")
        print("  cd exhibition_rental_system")
        print("  pip install -r requirements.txt")
        print("  uvicorn app.main:app --reload")
    except Exception as e:
        print(f"测试过程中发生错误: {e}")
        import traceback
        traceback.print_exc()
