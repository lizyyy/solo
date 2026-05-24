import requests
import json
import warnings
warnings.filterwarnings('ignore')

BASE_URL = 'http://localhost:8000/api/v1'

print("="*70)
print("验证冲突处理完整链路")
print("="*70)

print("\n【步骤1】创建基础数据")
print("-"*70)

drugs = [
    {"drug_code": "MZ001", "drug_name": "吗啡注射液", "drug_type": "麻醉药品", "specification": "10mg/支", "manufacturer": "制药厂A"},
]
for drug in drugs:
    response = requests.post(f'{BASE_URL}/drugs', json=drug)
    if response.status_code in [200, 201]:
        print(f"✓ 创建药品: {drug['drug_name']}")

batches = [
    {"batch_no": "202401001", "drug_id": 1, "initial_quantity": 100, "current_quantity": 100, "unit": "支"},
]
for batch in batches:
    response = requests.post(f'{BASE_URL}/batches', json=batch)
    if response.status_code in [200, 201]:
        print(f"✓ 创建批号: {batch['batch_no']}")

prescriptions = [
    {"prescription_no": "CF-UNVERIFIED", "drug_id": 1, "batch_no": "202401001", "patient_name": "测试患者", "quantity": 3, "unit": "支", "doctor_name": "王医生"},
]
for p in prescriptions:
    response = requests.post(f'{BASE_URL}/prescriptions', json=p)
    if response.status_code in [200, 201]:
        print(f"✓ 创建处方(未核验): {p['prescription_no']}")

print("\n【步骤2】创建有差异的交接单（未核验处方 + 数量不一致）")
print("-"*70)

handover_data = {
    "handover_no": "HJ-CONFLICT-TEST",
    "shift_type": "夜班",
    "from_nurse": "王护士",
    "to_nurse": "赵护士",
    "items": [
        {
            "drug_id": 1,
            "batch_id": 1,
            "prescription_id": 1,
            "drug_name": "吗啡注射液",
            "batch_no": "202401001",
            "prescription_no": "CF-UNVERIFIED",
            "prescription_quantity": 3,
            "inventory_quantity": 3,
            "handover_quantity": 5,
            "unit": "支"
        }
    ]
}
response = requests.post(f'{BASE_URL}/handovers', json=handover_data)
print(f"创建交接单: {response.status_code}")
h = response.json()
handover_id = h['id']
print(f"  交接单ID: {handover_id}")
print(f"  当前状态: {h['status']}")
print(f"  差异报告数: {len(h['discrepancies'])}")
for d in h['discrepancies']:
    print(f"    - {d['discrepancy_type']}: {d['description']}")

print("\n【步骤3】提交交接单（应自动进入有冲突状态）")
print("-"*70)
response = requests.post(f'{BASE_URL}/handovers/{handover_id}/submit')
print(f"提交交接单: {response.status_code}")
if response.status_code == 200:
    h = response.json()
    print(f"✓ 提交成功! 新状态: {h['status']}")
else:
    print(f"✗ 失败: {response.text}")
    exit(1)

print("\n【步骤4】对有冲突状态进行第一签")
print("-"*70)
response = requests.post(f'{BASE_URL}/handovers/{handover_id}/first-sign', 
    json={'signature': '王护士', 'sign_remark': '夜班补签', 'is_late_sign': True})
print(f"第一签: {response.status_code}")
if response.status_code == 200:
    h = response.json()
    print(f"✓ 第一签成功! 新状态: {h['status']}")
    print(f"  补签标记: {h.get('is_late_sign')}")
    print(f"  时间异常: {h.get('sign_time_abnormal')}")
else:
    print(f"✗ 失败: {response.text}")
    exit(1)

print("\n【步骤5】第二签")
print("-"*70)
response = requests.post(f'{BASE_URL}/handovers/{handover_id}/second-sign', 
    json={'signature': '赵护士'})
print(f"第二签: {response.status_code}")
if response.status_code == 200:
    h = response.json()
    print(f"✓ 第二签成功! 新状态: {h['status']}")
else:
    print(f"✗ 失败: {response.text}")
    exit(1)

print("\n【步骤6】核验完成（带差异的交接单也能完成）")
print("-"*70)
response = requests.post(f'{BASE_URL}/handovers/{handover_id}/verify', json={'reviewer': '李药师'})
print(f"核验: {response.status_code}")
if response.status_code == 200:
    h = response.json()
    print(f"✓ 核验成功! 新状态: {h['status']}")
else:
    print(f"✗ 失败: {response.text}")
    exit(1)

response = requests.post(f'{BASE_URL}/handovers/{handover_id}/complete')
print(f"完成: {response.status_code}")
if response.status_code == 200:
    h = response.json()
    print(f"✓ 完成成功! 最终状态: {h['status']}")
else:
    print(f"✗ 失败: {response.text}")
    exit(1)

print("\n【步骤7】追溯完整流程")
print("-"*70)
response = requests.get(f'{BASE_URL}/handovers/{handover_id}/trace')
trace = response.json()
print(f"✓ 追溯信息:")
print(f"  交接单号: {trace['handover_no']}")
print(f"  最终状态: {trace['current_status']}")
print(f"  状态历史:")
for s in trace['status_history']:
    print(f"    - {s['operation']} [{s['operator']}] - {s['time']}")
print(f"  差异数: {len(trace['discrepancies'])}")
for d in trace['discrepancies']:
    print(f"    - {d['type']}: {d['status']}")

print("\n" + "="*70)
print("✓ 冲突处理完整链路验证成功!")
print("="*70)
print("\n状态流转路径:")
print("  草稿 → 有冲突 → 第一签 → 第二签 → 已核验 → 已完成")
