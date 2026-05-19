import requests
import json

BASE_URL = "http://localhost:8001/api"


def init_users():
    users = [
        {"name": "张教授", "employee_id": "T001", "role": "teacher", "department": "化学学院", "phone": "13800138001", "email": "zhang@university.edu"},
        {"name": "李老师", "employee_id": "T002", "role": "teacher", "department": "化工学院", "phone": "13800138002", "email": "li@university.edu"},
        {"name": "王小明", "employee_id": "S001", "role": "student", "department": "化学学院", "phone": "13800138003", "email": "wang_stu@university.edu"},
        {"name": "管理员", "employee_id": "A001", "role": "admin", "department": "实验室管理处", "phone": "13800138000", "email": "admin@university.edu"}
    ]
    user_ids = {}
    for user in users:
        response = requests.post(f"{BASE_URL}/users/", json=user)
        if response.status_code == 200:
            data = response.json()
            user_ids[data["employee_id"]] = data["id"]
            print(f"已创建用户: {data['name']} (ID: {data['id']})")
        else:
            print(f"创建用户失败 {user['name']}: {response.text}")
    return user_ids


def init_reagents():
    from datetime import datetime, timedelta
    reagents = [
        {"name": "乙醇", "cas_number": "64-17-5", "specification": "95% 500ml", "hazard_level": "low", "total_stock": 50.0, "available_stock": 50.0, "unit": "瓶", "manufacturer": "国药集团", "batch_number": "20240101", "expiry_date": (datetime.now() + timedelta(days=365)).isoformat(), "location": "A01-01"},
        {"name": "盐酸", "cas_number": "7647-01-0", "specification": "36% 500ml", "hazard_level": "medium", "total_stock": 30.0, "available_stock": 30.0, "unit": "瓶", "manufacturer": "西陇化工", "batch_number": "20240102", "expiry_date": (datetime.now() + timedelta(days=730)).isoformat(), "location": "A01-02"},
        {"name": "浓硫酸", "cas_number": "7664-93-9", "specification": "98% 500ml", "hazard_level": "high", "total_stock": 20.0, "available_stock": 20.0, "unit": "瓶", "manufacturer": "国药集团", "batch_number": "20240103", "expiry_date": (datetime.now() + timedelta(days=730)).isoformat(), "location": "B01-01"},
        {"name": "氰化钾", "cas_number": "151-50-8", "specification": "99% 100g", "hazard_level": "extreme", "total_stock": 5.0, "available_stock": 5.0, "unit": "瓶", "manufacturer": "阿拉丁", "batch_number": "20240104", "expiry_date": (datetime.now() + timedelta(days=1095)).isoformat(), "location": "C01-01"},
        {"name": "氢氧化钠", "cas_number": "1310-73-2", "specification": "AR 500g", "hazard_level": "medium", "total_stock": 40.0, "available_stock": 40.0, "unit": "瓶", "manufacturer": "国药集团", "batch_number": "20240105", "expiry_date": (datetime.now() + timedelta(days=730)).isoformat(), "location": "A01-03"},
        {"name": "过期试剂", "cas_number": "TEST-001", "specification": "测试用", "hazard_level": "low", "total_stock": 10.0, "available_stock": 10.0, "unit": "瓶", "manufacturer": "测试", "batch_number": "20230001", "expiry_date": (datetime.now() - timedelta(days=30)).isoformat(), "location": "TEST-01"}
    ]
    reagent_ids = {}
    for reagent in reagents:
        response = requests.post(f"{BASE_URL}/reagents/", json=reagent)
        if response.status_code == 200:
            data = response.json()
            reagent_ids[data["name"]] = data["id"]
            print(f"已创建试剂: {data['name']} (ID: {data['id']})")
        else:
            print(f"创建试剂失败 {reagent['name']}: {response.text}")
    return reagent_ids


def create_test_records(user_ids, reagent_ids):
    records = [
        {"reagent_id": reagent_ids["乙醇"], "quantity": 2.0, "recipient_id": user_ids["S001"], "purpose": "有机合成实验"},
        {"reagent_id": reagent_ids["盐酸"], "quantity": 1.0, "recipient_id": user_ids["S001"], "purpose": "酸碱滴定实验"},
        {"reagent_id": reagent_ids["浓硫酸"], "quantity": 1.0, "recipient_id": user_ids["T001"], "purpose": "催化反应"},
        {"reagent_id": reagent_ids["浓硫酸"], "quantity": 1.0, "recipient_id": user_ids["S001"], "purpose": "学生尝试领用高危试剂"},
        {"reagent_id": reagent_ids["过期试剂"], "quantity": 1.0, "recipient_id": user_ids["T001"], "purpose": "测试过期校验"},
        {"reagent_id": reagent_ids["氰化钾"], "quantity": 10.0, "recipient_id": user_ids["T001"], "purpose": "测试库存不足校验"}
    ]
    batch_data = {
        "records": records,
        "created_by_id": user_ids["A001"]
    }
    response = requests.post(f"{BASE_URL}/records/batch/", json=batch_data)
    if response.status_code == 200:
        result = response.json()
        print(f"\n批量创建结果:")
        print(f"  批次ID: {result['batch_id']}")
        print(f"  总数: {result['total_count']}, 成功: {result['success_count']}, 失败: {result['failed_count']}")
        if result['failed_items']:
            print(f"  失败详情:")
            for item in result['failed_items']:
                print(f"    - 第{item['index']}条: {item['exception_type']} - {item['message']}")
        return result
    else:
        print(f"批量创建失败: {response.text}")
        return None


if __name__ == "__main__":
    print("=" * 60)
    print("开始初始化高校实验室试剂管理系统测试数据")
    print("=" * 60)
    print("\n1. 创建用户...")
    user_ids = init_users()
    print("\n2. 创建试剂...")
    reagent_ids = init_reagents()
    print("\n3. 创建测试领用记录（包含正常和异常场景）...")
    batch_result = create_test_records(user_ids, reagent_ids)
    print("\n" + "=" * 60)
    print("初始化完成！")
    print("=" * 60)
    print("\n测试数据说明:")
    print("- 用户: 2位老师, 1位学生, 1位管理员")
    print("- 试剂: 低/中/高/极高危险等级各有代表，包含1瓶过期试剂")
    print("- 领用记录: 6条测试用例")
    print("  ✓ 学生领用低/中危试剂（正常）")
    print("  ✓ 老师领用高危试剂（正常）")
    print("  ✗ 学生领用高危试剂（应失败：危险等级校验）")
    print("  ✗ 领用过期试剂（应失败：过期校验）")
    print("  ✗ 领用数量超库存（应失败：库存校验）")
