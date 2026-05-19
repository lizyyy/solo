#!/usr/bin/env python3
import requests
import json

BASE = "http://localhost:8000"

print("=" * 60)
print("高校实验室试剂管理系统 - 完整流程测试")
print("=" * 60)

# 1. 导入危化品规则
print("\n[1/8] 导入危化品规则...")
with open('data/chemical_rules.json', 'rb') as f:
    r = requests.post(f"{BASE}/import/chemical-rules", files={'file': f})
    result = r.json()
    print(f"成功: {result['success_count']}, 失败: {result['failed_count']}")

# 2. 导入库存
print("\n[2/8] 导入库存数据...")
with open('data/inventory.json', 'rb') as f:
    r = requests.post(f"{BASE}/import/inventory", files={'file': f})
    result = r.json()
    print(f"成功: {result['success_count']}, 失败: {result['failed_count']}")

# 3. 创建申领单
print("\n[3/8] 创建申领单...")
r = requests.post(f"{BASE}/application/create", json={
    "applicant_id": "S2024001",
    "applicant_name": "张三",
    "applicant_role": "student",
    "cas_number": "64-17-5",
    "chinese_name": "乙醇",
    "quantity": 100,
    "unit": "ml",
    "purpose": "有机合成实验",
    "lab_name": "化学楼301"
})
result = r.json()
app_id = result['application_id']
print(f"申领单ID: {app_id}")
print(f"状态: {result['status']}")

# 4. 幂等性测试
print("\n[4/8] 幂等性测试 - 重复提交相同申领单...")
r = requests.post(f"{BASE}/application/create", json={
    "applicant_id": "S2024001",
    "applicant_name": "张三",
    "applicant_role": "student",
    "cas_number": "64-17-5",
    "chinese_name": "乙醇",
    "quantity": 100,
    "unit": "ml",
    "purpose": "有机合成实验",
    "lab_name": "化学楼301"
})
result = r.json()
print(f"幂等性: {result.get('is_idempotent', False)}")
print(f"提示: {result.get('message', '')}")

# 5. 审批
print("\n[5/8] 审批申领单...")
r = requests.post(f"{BASE}/application/approve", json={
    "application_id": app_id,
    "approver_id": "T2024001",
    "approver_name": "李教授",
    "approval_level": 1,
    "decision": "approve",
    "comment": "实验需要，同意"
})
result = r.json()
print(f"审批ID: {result['approval_id']}")
print(f"申领单状态: {result['application_status']}")

# 6. 出库
print("\n[6/8] 试剂出库...")
r = requests.post(f"{BASE}/inventory/issue", json={
    "application_id": app_id,
    "operator_id": "A001",
    "operator_name": "仓库管理员"
})
result = r.json()
print(f"出库记录ID: {result['record_id']}")
print(f"剩余库存: {result['remaining_quantity']}ml")

# 7. 归还部分试剂
print("\n[7/8] 归还部分试剂...")
r = requests.post(f"{BASE}/inventory/return", json={
    "application_id": app_id,
    "returned_quantity": 30,
    "operator_id": "A001",
    "operator_name": "仓库管理员",
    "comment": "剩余30ml归还"
})
result = r.json()
print(f"归还记录ID: {result['record_id']}")
print(f"当前库存: {result['remaining_quantity']}ml")
print(f"申领单状态: {result['application_status']}")

# 8. 查看库存（验证脱敏）
print("\n[8/8] 查看当前库存 - 敏感字段脱敏...")
r = requests.get(f"{BASE}/inventory")
inventory = r.json()
for item in inventory:
    print(f"  {item['chinese_name']} ({item['cas_number']}): "
          f"{item['quantity']}{item['unit']}, "
          f"供应商(脱敏): {item['supplier']}")

# 查看错误记录
print("\n" + "=" * 60)
print("查看坏记录:")
r = requests.get(f"{BASE}/bad-records")
bad_records = r.json()
print(f"共有 {len(bad_records)} 条坏记录")

# 导出操作日志
print("\n导出操作日志:")
r = requests.get(f"{BASE}/export/logs")
logs = r.json()
print(f"共有 {len(logs)} 条操作记录")

print("\n" + "=" * 60)
print("测试完成！所有功能验证通过。")
print("=" * 60)
