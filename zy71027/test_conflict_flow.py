import requests
import json

BASE_URL = 'http://localhost:8000/api/v1'

print("="*60)
print("验证冲突样例提交和处理链路")
print("="*60)

response = requests.get(f'{BASE_URL}/handovers', params={'status': '有冲突'})
data = response.json()
print(f'\n1. 冲突状态交接单数: {len(data)}')

if data:
    h = data[0]
    handover_id = h['id']
    print(f'   交接单号: {h["handover_no"]}')
    print(f'   当前状态: {h["status"]}')
    print(f'   差异数: {len(h["discrepancies"])}')
    for d in h['discrepancies']:
        print(f'     - {d["discrepancy_type"]}: {d["description"]}')
    
    print(f'\n2. 对冲突状态交接单进行第一签...')
    response = requests.post(f'{BASE_URL}/handovers/{handover_id}/first-sign', json={'signature': '王护士'})
    print(f'   状态码: {response.status_code}')
    if response.status_code == 200:
        result = response.json()
        print(f'   ✓ 第一签成功! 新状态: {result["status"]}')
    else:
        print(f'   ✗ 失败: {response.text}')

print("\n" + "="*60)
print("验证补签时间异常功能")
print("="*60)

handover_data = {
    "handover_no": "HJ-TEST-LATE",
    "shift_type": "夜班",
    "from_nurse": "测试护士A",
    "to_nurse": "测试护士B",
    "items": [
        {
            "drug_name": "吗啡注射液",
            "batch_no": "202401001",
            "prescription_no": "CF202401001",
            "prescription_quantity": 2,
            "inventory_quantity": 2,
            "handover_quantity": 2,
            "unit": "支"
        }
    ]
}
response = requests.post(f'{BASE_URL}/handovers', json=handover_data)
if response.status_code == 200:
    h = response.json()
    handover_id2 = h['id']
    print(f'\n1. 创建测试交接单成功: {h["handover_no"]}')
    
    response = requests.post(f'{BASE_URL}/handovers/{handover_id2}/submit')
    print(f'2. 提交交接单: {response.status_code}')
    
    print(f'\n3. 第一签（标记为补签）...')
    response = requests.post(f'{BASE_URL}/handovers/{handover_id2}/first-sign', 
        json={'signature': '测试护士A', 'sign_remark': '夜班后补签', 'is_late_sign': True})
    print(f'   状态码: {response.status_code}')
    if response.status_code == 200:
        result = response.json()
        print(f'   ✓ 第一签成功! 补签标记: {result.get("is_late_sign")}')
        print(f'   ✓ 时间异常标记: {result.get("sign_time_abnormal")}')

print("\n" + "="*60)
print("验证完成!")
print("="*60)
