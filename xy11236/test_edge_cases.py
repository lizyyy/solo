#!/usr/bin/env python3
import requests
import json

BASE = "http://localhost:8000"

print("=" * 60)
print("补充测试: 坏记录处理 & 审批级别控制")
print("=" * 60)

# 1. 测试导入坏数据
print("\n[1] 导入包含错误的CSV文件...")
bad_csv = """cas_number,chinese_name,danger_level,max_single_apply
INVALID-CAS,无效化学品,普通,100
7664-39-3,氢氟酸,腐蚀,500
,缺少CAS号,易燃,200
"""
files = {'file': ('bad_data.csv', bad_csv, 'text/csv')}
r = requests.post(f"{BASE}/import/chemical-rules", files=files)
result = r.json()
print(f"成功: {result['success_count']}, 失败: {result['failed_count']}")

# 2. 查看坏记录
print("\n[2] 查看导入失败的记录...")
r = requests.get(f"{BASE}/bad-records")
bad_records = r.json()
for i, record in enumerate(bad_records, 1):
    print(f"\n  记录{i}:")
    print(f"    行号: {record['row_number']}")
    print(f"    失败原因: {record['error_reason']}")
    print(f"    修改建议: {record['suggestion']}")

# 3. 创建需要高审批级别的申领单
print("\n[3] 创建腐蚀品申领单...")
r = requests.post(f"{BASE}/application/create", json={
    "applicant_id": "S2024002",
    "applicant_name": "李四",
    "applicant_role": "student",
    "cas_number": "7664-39-3",
    "chinese_name": "氢氟酸",
    "quantity": 100,
    "unit": "ml",
    "purpose": "材料刻蚀实验",
    "lab_name": "重点实验室"
})
result = r.json()
app_id = result['application_id']
print(f"申领单ID: {app_id}")

# 4. 使用不足的审批级别审批
print("\n[4] 使用1级审批（需要2级）...")
r = requests.post(f"{BASE}/application/approve", json={
    "application_id": app_id,
    "approver_id": "T2024002",
    "approver_name": "王讲师",
    "approval_level": 1,
    "decision": "approve",
    "comment": "同意申请"
})
result = r.json()
print(f"结果: {json.dumps(result, ensure_ascii=False, indent=2)}")

# 5. 使用正确的审批级别审批
print("\n[5] 使用2级审批...")
r = requests.post(f"{BASE}/application/approve", json={
    "application_id": app_id,
    "approver_id": "T2024003",
    "approver_name": "李教授",
    "approval_level": 2,
    "decision": "approve",
    "comment": "实验必要，同意"
})
result = r.json()
print(f"结果: 成功，审批ID: {result['approval_id']}")

print("\n" + "=" * 60)
print("补充测试完成！")
print("=" * 60)
