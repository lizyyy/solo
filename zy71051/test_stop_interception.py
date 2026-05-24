import requests
from datetime import date, timedelta

BASE_URL = "http://localhost:8000"


def test_stop_interception_sign_protection():
    """验证：被停药拦截的药盒无法被签收"""
    print("=" * 60)
    print("测试：停药拦截后的签收保护")
    print("=" * 60)

    today = date.today().isoformat()
    tomorrow = (date.today() + timedelta(days=1)).isoformat()

    print("\n1. 创建老人档案")
    elder_data = {
        "name": "测试老人",
        "id_card": f"TEST{int(date.today().strftime('%Y%m%d%H%M%S'))}",
        "room_number": "101",
        "bed_number": "A",
        "gender": "男",
        "age": 80,
        "contact_person": "家属",
        "contact_phone": "13800000000"
    }
    r = requests.post(f"{BASE_URL}/elders", json=elder_data)
    elder = r.json()
    elder_id = elder["id"]
    print(f"  ✓ 老人ID: {elder_id}")

    print("\n2. 创建医嘱")
    prescription_data = {
        "elder_id": elder_id,
        "doctor_name": "王医生",
        "diagnosis": "高血压",
        "start_date": today,
        "end_date": tomorrow,
        "source": "测试",
        "created_by": "测试员",
        "remark": "测试医嘱",
        "items": [
            {
                "medicine_name": "测试药",
                "specification": "10mg",
                "dosage": "1片",
                "frequency": "每日1次",
                "usage": "口服",
                "quantity": 1,
                "unit": "盒"
            }
        ]
    }
    r = requests.post(f"{BASE_URL}/prescriptions", json=prescription_data)
    prescription = r.json()
    prescription_id = prescription["id"]
    print(f"  ✓ 医嘱ID: {prescription_id}, 版本: {prescription['version']}")

    print("\n3. 创建并审批停药申请")
    stop_data = {
        "prescription_id": prescription_id,
        "applicant": "测试家属",
        "applicant_role": "家属",
        "reason": "测试停药",
        "effective_date": today,
        "source": "测试",
        "remark": "测试"
    }
    r = requests.post(f"{BASE_URL}/stop-requests", json=stop_data)
    stop_req = r.json()
    stop_id = stop_req["id"]
    print(f"  ✓ 停药申请ID: {stop_id}")

    approve_data = {
        "status": "approved",
        "approved_by": "测试医生",
        "remark": "测试"
    }
    r = requests.put(
        f"{BASE_URL}/stop-requests/{stop_id}/approve",
        params={"operator": "测试医生"},
        json=approve_data
    )
    print(f"  ✓ 停药已审批: {r.json()['status']}")

    print("\n4. 创建药盒（应被自动拦截为 stopped 状态）")
    box_data = {
        "elder_id": elder_id,
        "prescription_id": prescription_id,
        "batch_no": f"TEST-STOP-{int(date.today().strftime('%Y%m%d%H%M%S'))}",
        "box_no": "TEST-001",
        "distribution_date": today,
        "time_slot": "morning",
        "medicines": "测试药 1片",
        "source": "测试",
        "prepared_by": "测试药师"
    }
    r = requests.post(f"{BASE_URL}/medicine-boxes", json=box_data)
    box = r.json()
    box_id = box["id"]
    box_status = box["status"]
    print(f"  ✓ 药盒ID: {box_id}")
    print(f"  ✓ 药盒状态: {box_status}")
    
    if box_status != "stopped":
        print(f"  ✗ 失败: 药盒应该被拦截为 stopped 状态，但实际是 {box_status}")
        return False

    print("\n5. 尝试签收已被拦截的药盒（应返回 400 错误）")
    sign_data = {
        "medicine_box_id": box_id,
        "nurse_name": "测试护士",
        "is_backfilled": False,
        "receiver_name": "测试老人",
        "receiver_relation": "本人"
    }
    r = requests.post(f"{BASE_URL}/medicine-boxes/{box_id}/sign", json=sign_data)
    print(f"  ✓ 响应状态码: {r.status_code}")
    print(f"  ✓ 错误信息: {r.json().get('detail', '无')}")
    
    if r.status_code != 400:
        print(f"  ✗ 失败: 应该返回 400，但实际返回 {r.status_code}")
        return False
    
    if "停药拦截" not in r.json().get("detail", ""):
        print(f"  ✗ 失败: 错误信息应包含'停药拦截'")
        return False

    print("\n6. 验证药盒状态仍为 stopped")
    r = requests.get(f"{BASE_URL}/medicine-boxes/{box_id}")
    current_status = r.json()["status"]
    print(f"  ✓ 当前药盒状态: {current_status}")
    
    if current_status != "stopped":
        print(f"  ✗ 失败: 药盒状态应该仍为 stopped，但实际是 {current_status}")
        return False

    print("\n" + "=" * 60)
    print("✓ 所有测试通过！停药拦截已生效，无法签收被拦截的药盒")
    print("=" * 60)
    return True


def test_normal_sign_flow():
    """验证：正常状态的药盒可以正常签收"""
    print("\n" + "=" * 60)
    print("测试：正常流程下的签收功能")
    print("=" * 60)

    today = date.today().isoformat()

    print("\n1. 创建老人档案")
    elder_data = {
        "name": "正常老人",
        "id_card": f"NORMAL{int(date.today().strftime('%Y%m%d%H%M%S'))}",
        "room_number": "102",
        "bed_number": "B",
        "gender": "女",
        "age": 75,
        "contact_person": "家属",
        "contact_phone": "13900000000"
    }
    r = requests.post(f"{BASE_URL}/elders", json=elder_data)
    elder = r.json()
    elder_id = elder["id"]
    print(f"  ✓ 老人ID: {elder_id}")

    print("\n2. 创建医嘱（不停药）")
    prescription_data = {
        "elder_id": elder_id,
        "doctor_name": "李医生",
        "diagnosis": "糖尿病",
        "start_date": today,
        "source": "测试",
        "created_by": "测试员",
        "remark": "正常医嘱",
        "items": [
            {
                "medicine_name": "正常药",
                "specification": "0.5g",
                "dosage": "1片",
                "frequency": "每日2次",
                "usage": "口服",
                "quantity": 1,
                "unit": "盒"
            }
        ]
    }
    r = requests.post(f"{BASE_URL}/prescriptions", json=prescription_data)
    prescription = r.json()
    prescription_id = prescription["id"]
    print(f"  ✓ 医嘱ID: {prescription_id}")

    print("\n3. 创建药盒（状态应为 pending）")
    box_data = {
        "elder_id": elder_id,
        "prescription_id": prescription_id,
        "batch_no": f"TEST-NORMAL-{int(date.today().strftime('%Y%m%d%H%M%S'))}",
        "box_no": "NORMAL-001",
        "distribution_date": today,
        "time_slot": "morning",
        "medicines": "正常药 1片",
        "source": "测试",
        "prepared_by": "测试药师"
    }
    r = requests.post(f"{BASE_URL}/medicine-boxes", json=box_data)
    box = r.json()
    box_id = box["id"]
    print(f"  ✓ 药盒ID: {box_id}, 状态: {box['status']}")

    print("\n4. 转换状态为 prepared")
    r = requests.put(
        f"{BASE_URL}/medicine-boxes/{box_id}/status",
        params={"new_status": "prepared", "operator": "测试药师"}
    )
    print(f"  ✓ 状态: {r.json()['status']}")

    print("\n5. 正常签收（应返回 200）")
    sign_data = {
        "medicine_box_id": box_id,
        "nurse_name": "正常护士",
        "is_backfilled": False,
        "receiver_name": "正常老人",
        "receiver_relation": "本人"
    }
    r = requests.post(f"{BASE_URL}/medicine-boxes/{box_id}/sign", json=sign_data)
    print(f"  ✓ 响应状态码: {r.status_code}")
    print(f"  ✓ 签收后状态: {r.json()['status']}")
    print(f"  ✓ 签收人: {r.json()['signed_by']}")
    
    if r.status_code != 200 or r.json()["status"] != "signed":
        print(f"  ✗ 失败: 正常签收应该成功")
        return False

    print("\n6. 尝试重复签收（应返回 400）")
    r = requests.post(f"{BASE_URL}/medicine-boxes/{box_id}/sign", json=sign_data)
    print(f"  ✓ 响应状态码: {r.status_code}")
    print(f"  ✓ 错误信息: {r.json().get('detail', '无')}")
    
    if r.status_code != 400:
        print(f"  ✗ 失败: 重复签收应该被拒绝")
        return False

    print("\n" + "=" * 60)
    print("✓ 正常流程测试通过！")
    print("=" * 60)
    return True


if __name__ == "__main__":
    try:
        success1 = test_stop_interception_sign_protection()
        success2 = test_normal_sign_flow()
        
        print("\n" + "=" * 60)
        if success1 and success2:
            print("✓ 全部测试通过！业务规则已闭环")
        else:
            print("✗ 部分测试失败")
        print("=" * 60)
        
    except requests.exceptions.ConnectionError:
        print("错误: 无法连接到服务器")
    except Exception as e:
        print(f"测试出错: {e}")
        import traceback
        traceback.print_exc()
