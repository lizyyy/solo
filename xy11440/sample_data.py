import requests
import json

BASE_URL = "http://localhost:8000"


def login(username, password):
    response = requests.post(
        f"{BASE_URL}/token",
        data={"username": username, "password": password}
    )
    return response.json()["access_token"]


def create_batch(token, batch_no, supplier, delivery_date):
    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "batch_no": batch_no,
        "supplier_name": supplier,
        "delivery_date": delivery_date
    }
    response = requests.post(f"{BASE_URL}/batches", headers=headers, json=data)
    print(f"创建批次: {response.status_code}")
    if response.status_code == 200:
        return response.json()
    print(f"  错误: {response.text}")
    return None


def add_record(token, batch_id, record_type, ref_no, product, qty, price, amount, record_date, supplier_in_record, raw_content):
    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "batch_id": batch_id,
        "record_type": record_type,
        "external_ref_no": ref_no,
        "raw_content": raw_content,
        "product_name": product,
        "quantity": qty,
        "unit_price": price,
        "amount": amount,
        "record_date": record_date,
        "supplier_name_in_record": supplier_in_record
    }
    response = requests.post(f"{BASE_URL}/records", headers=headers, json=data)
    print(f"  添加记录 {ref_no}: {response.status_code}")
    if response.status_code == 200:
        return response.json()
    print(f"    错误: {response.text}")
    return None


def submit_for_review(token, batch_id, reason=""):
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(
        f"{BASE_URL}/batches/{batch_id}/submit",
        headers=headers,
        json={"reason": reason}
    )
    print(f"提交复核: {response.status_code}")
    return response.json()


def review_batch(token, batch_id, reason=""):
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(
        f"{BASE_URL}/batches/{batch_id}/review",
        headers=headers,
        json={"reason": reason}
    )
    print(f"复核通过: {response.status_code}")
    return response.json()


def freeze_batch(token, batch_id, reason=""):
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.post(
        f"{BASE_URL}/batches/{batch_id}/freeze",
        headers=headers,
        json={"reason": reason}
    )
    print(f"冻结结算: {response.status_code}")
    return response.json()


def create_dirty_record_missing_field(token, batch_id):
    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "batch_id": batch_id,
        "record_type": "delivery_note",
        "external_ref_no": "DIRTY-MISSING-001",
        "raw_content": "这是一条缺少字段的脏记录",
        "product_name": "香蕉",
        "quantity": 50,
        "unit_price": 3.0
    }
    response = requests.post(f"{BASE_URL}/records", headers=headers, json=data)
    print(f"创建缺字段脏记录: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"  脏数据类型: {result['dirty_type']}")
        print(f"  脏数据说明: {result['dirty_note']}")
        return result
    return None


def create_dirty_record_cross_date(token, batch_id):
    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "batch_id": batch_id,
        "record_type": "weighing_record",
        "external_ref_no": "DIRTY-CROSS-001",
        "raw_content": "这是一条跨日的脏记录",
        "product_name": "橙子",
        "quantity": 80,
        "unit_price": 4.0,
        "amount": 320.0,
        "record_date": "2024-01-20T10:00:00",
        "supplier_name_in_record": "红星果园"
    }
    response = requests.post(f"{BASE_URL}/records", headers=headers, json=data)
    print(f"创建跨日脏记录: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"  脏数据类型: {result['dirty_type']}")
        print(f"  脏数据说明: {result['dirty_note']}")
        return result
    return None


def create_dirty_record_amount_conflict(token, batch_id):
    headers = {"Authorization": f"Bearer {token}"}
    data = {
        "batch_id": batch_id,
        "record_type": "delivery_note",
        "external_ref_no": "DIRTY-AMOUNT-001",
        "raw_content": "这是一条金额冲突的脏记录",
        "product_name": "葡萄",
        "quantity": 30,
        "unit_price": 10.0,
        "amount": 350.0,
        "record_date": "2024-01-15T10:00:00",
        "supplier_name_in_record": "红星果园"
    }
    response = requests.post(f"{BASE_URL}/records", headers=headers, json=data)
    print(f"创建金额冲突脏记录: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"  脏数据类型: {result['dirty_type']}")
        print(f"  脏数据说明: {result['dirty_note']}")
        return result
    return None


def get_export(token):
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/export/batches", headers=headers)
    print(f"获取导出数据: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"  导出记录数: {data['total_count']}")
        for row in data['data']:
            print(f"    - {row['batch_no']}: {row['supplier_name']}")
            print(f"      状态: {row['status_before_freeze']} -> {row['status_after_freeze']}")
            print(f"      重复计算警告: {row['duplicate_calculation_warning']}")
        return data
    return None


def get_dashboard(token):
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/manager/dashboard", headers=headers)
    print(f"获取管理看板: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(json.dumps(data, indent=2, ensure_ascii=False))
        return data
    return None


def main():
    print("=" * 60)
    print("生鲜分拣损耗异常回执状态机 - 样例数据脚本")
    print("=" * 60)
    
    print("\n1. 登录系统...")
    entry_token = login("entry_user", "entry123")
    review_token = login("review_user", "review123")
    supervisor_token = login("supervisor_user", "super123")
    print("   ✓ 登录成功")
    
    print("\n2. 创建正常批次 - 全流程演示...")
    batch1 = create_batch(entry_token, "SAMPLE-NORMAL-001", "红星果园", "2024-01-15T10:00:00")
    if batch1:
        batch_id = batch1["id"]
        add_record(entry_token, batch_id, "delivery_note", "DEL-001", "苹果", 100, 5.0, 500.0, 
                   "2024-01-15T10:00:00", "红星果园", "送货单001号")
        add_record(entry_token, batch_id, "weighing_record", "WEIGH-001", "苹果", 95, 5.0, 475.0,
                   "2024-01-15T10:00:00", "红星果园", "称重记录001号")
        add_record(entry_token, batch_id, "return_basket_photo", "PHOTO-001", "苹果", 5, 0, 0,
                   "2024-01-15T10:00:00", "红星果园", "退筐照片")
        add_record(entry_token, batch_id, "external_receipt", "EXT-001", "苹果", 0, 0, 0,
                   "2024-01-15T10:00:00", "红星果园", "外部回执")
        
        submit_for_review(entry_token, batch_id, "资料完整，申请复核")
        review_batch(review_token, batch_id, "复核通过，损耗计算合理")
        freeze_batch(supervisor_token, batch_id, "确认冻结，准备结算")
    
    print("\n3. 创建批次 - 演示脏记录识别...")
    batch2 = create_batch(entry_token, "SAMPLE-DIRTY-001", "绿叶农场", "2024-01-15T10:00:00")
    if batch2:
        batch_id = batch2["id"]
        create_dirty_record_missing_field(entry_token, batch_id)
        create_dirty_record_cross_date(entry_token, batch_id)
        create_dirty_record_amount_conflict(entry_token, batch_id)
    
    print("\n4. 查看导出数据...")
    get_export(review_token)
    
    print("\n5. 查看主管看板...")
    get_dashboard(supervisor_token)
    
    print("\n" + "=" * 60)
    print("样例数据创建完成！")
    print("=" * 60)


if __name__ == "__main__":
    main()
