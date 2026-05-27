import requests
import json
import os

BASE_URL = 'http://localhost:5000/api'

def test_create_batch():
    print("=== 测试创建批次 ===")
    data = {
        "name": "2024年1月结算批次",
        "operator": "admin",
        "remark": "1月短租房水电押金结算"
    }
    response = requests.post(f'{BASE_URL}/batches', json=data)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"结果: {json.dumps(result, ensure_ascii=False, indent=2)}")
    return result['data']['id'] if result['code'] == 0 else None

def test_upload_csv(batch_id):
    print("\n=== 测试上传CSV抄表数据 ===")
    csv_path = os.path.join(os.path.dirname(__file__), 'sample_data', 'meter_reading.csv')
    with open(csv_path, 'rb') as f:
        files = {'file': ('meter_reading.csv', f, 'text/csv')}
        data = {'batch_id': batch_id, 'operator': 'admin'}
        response = requests.post(f'{BASE_URL}/files/upload/csv', files=files, data=data)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"结果: {json.dumps(result, ensure_ascii=False, indent=2)}")

def test_list_batches():
    print("\n=== 测试获取批次列表 ===")
    response = requests.get(f'{BASE_URL}/batches')
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"批次数量: {result['data']['total']}")
    return result['data']['items'][0]['id'] if result['data']['items'] else None

def test_list_records(batch_id):
    print("\n=== 测试获取记录列表 ===")
    params = {'batch_id': batch_id, 'page': 1, 'per_page': 10}
    response = requests.get(f'{BASE_URL}/records', params=params)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"记录数量: {result['data']['total']}")
    for item in result['data']['items']:
        print(f"  - {item['record_no']}: {item['tenant_name']} - {item['status']}")
    return result['data']['items'][0]['id'] if result['data']['items'] else None

def test_get_record_detail(record_id):
    print("\n=== 测试获取记录详情 ===")
    response = requests.get(f'{BASE_URL}/records/{record_id}')
    print(f"状态码: {response.status_code}")
    result = response.json()
    data = result['data']
    print(f"记录编号: {data['record_no']}")
    print(f"租客姓名: {data['tenant_name']}")
    print(f"押金金额: {data['deposit_amount']}")
    print(f"应退押金: {data['refund_amount']}")
    print(f"操作日志数量: {len(data['operation_logs'])}")

def test_approve_record(record_id):
    print("\n=== 测试审核通过记录 ===")
    data = {
        "operator": "manager",
        "reason": "数据核对无误，予以通过"
    }
    response = requests.post(f'{BASE_URL}/records/{record_id}/approve', json=data)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"结果: {json.dumps(result, ensure_ascii=False, indent=2)}")

def test_reject_record(record_id):
    print("\n=== 测试退回记录 ===")
    data = {
        "operator": "manager",
        "reason": "电表读数异常，需要重新核对"
    }
    response = requests.post(f'{BASE_URL}/records/{record_id}/reject', json=data)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"结果: {json.dumps(result, ensure_ascii=False, indent=2)}")

def test_request_material(record_id):
    print("\n=== 测试要求补材料 ===")
    data = {
        "operator": "manager",
        "reason": "缺少退房验房照片，请补充上传"
    }
    response = requests.post(f'{BASE_URL}/records/{record_id}/request_material', json=data)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"结果: {json.dumps(result, ensure_ascii=False, indent=2)}")

def test_refund_reversal(record_id):
    print("\n=== 测试退款冲正 ===")
    data = {
        "operator": "finance",
        "reversed_amount": 100,
        "reason": "发现损坏赔偿少计，补扣100元"
    }
    response = requests.post(f'{BASE_URL}/records/{record_id}/refund_reversal', json=data)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"结果: {json.dumps(result, ensure_ascii=False, indent=2)}")

def test_update_damage(record_id):
    print("\n=== 测试更新损坏赔偿 ===")
    data = {
        "operator": "checker",
        "damage_amount": 150,
        "reason": "墙面有污渍，沙发有破损，合计赔偿150元"
    }
    response = requests.post(f'{BASE_URL}/records/{record_id}/update_damage', json=data)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"结果: {json.dumps(result, ensure_ascii=False, indent=2)}")

def test_export_records():
    print("\n=== 测试导出明细 ===")
    params = {'format': 'xlsx', 'operator': 'admin'}
    response = requests.get(f'{BASE_URL}/exports/records', params=params)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        print("导出成功，文件已下载")
        with open('exported_records.xlsx', 'wb') as f:
            f.write(response.content)

def test_search_records():
    print("\n=== 测试按条件查询记录 ===")
    params = {
        'property_id': 'PROP001',
        'checkout_start': '2024-01-01',
        'checkout_end': '2024-01-31',
        'page': 1,
        'per_page': 10
    }
    response = requests.get(f'{BASE_URL}/records', params=params)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"查询到 {result['data']['total']} 条记录")

def main():
    try:
        batch_id = test_create_batch()
        if batch_id:
            test_upload_csv(batch_id)
        
        batch_id = test_list_batches()
        if batch_id:
            record_id = test_list_records(batch_id)
            if record_id:
                test_get_record_detail(record_id)
                test_approve_record(record_id)
                test_reject_record(record_id)
                test_request_material(record_id)
                test_update_damage(record_id)
                test_refund_reversal(record_id)
                test_get_record_detail(record_id)
        
        test_search_records()
        test_export_records()
        
        print("\n=== 测试完成 ===")
    except Exception as e:
        print(f"测试出错: {e}")

if __name__ == '__main__':
    main()
