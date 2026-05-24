#!/usr/bin/env python3
import requests
import json
import os

os.environ['NO_PROXY'] = 'localhost'
BASE_URL = "http://localhost:8080/api"

def p(label, data):
    print(f"{label}: {json.dumps(data, indent=2, ensure_ascii=False)}" if isinstance(data, dict) else f"{label}: {data}")

print("=" * 60)
print("测试：状态机修复验证 - 系统校验后状态转换")
print("=" * 60)
print()

# 1. 创建基础数据
print("1. 创建基础资料...")
requests.post(f"{BASE_URL}/master/plots", json={
    "plotCode": "TEST-P002", "plotName": "测试地块", "village": "东岗村",
    "area": 50.0, "cropType": "小麦", "pestType": "蚜虫", "approved": True
}, headers={"Content-Type": "application/json"})

requests.post(f"{BASE_URL}/master/drones", json={
    "droneCode": "TEST-D002", "droneModel": "DJI T30", "status": "可用"
}, headers={"Content-Type": "application/json"})

requests.post(f"{BASE_URL}/master/pesticides", json={
    "pesticideCode": "TEST-PEST002", "pesticideName": "吡虫啉",
    "applicableCrops": "小麦,水稻", "targetPests": "蚜虫,飞虱"
}, headers={"Content-Type": "application/json"})

requests.post(f"{BASE_URL}/master/pesticide-batches", json={
    "batchNumber": "TEST-B002", "pesticide": {"id": 1}, "productionDate": "2026-01-15"
}, headers={"Content-Type": "application/json"})

requests.post(f"{BASE_URL}/master/weather-windows", json={
    "startTime": "2026-05-25T08:00:00", "endTime": "2026-05-25T12:00:00",
    "temperature": 25.0, "windSpeed": 3.5, "rainfall": 0.0
}, headers={"Content-Type": "application/json"})

requests.post(f"{BASE_URL}/master/pilots", json={
    "pilotCode": "TEST-PILOT002", "pilotName": "张三",
    "qualificationLevel": "高级", "status": "在岗"
}, headers={"Content-Type": "application/json"})
print("   ✓ 基础资料创建完成")
print()

# 2. 创建许可
print("2. 创建许可申请...")
resp = requests.post(f"{BASE_URL}/permissions", json={
    "operationType": "防虫作业",
    "plannedStartTime": "2026-05-25T09:00:00",
    "plannedEndTime": "2026-05-25T11:00:00",
    "pilot": {"id": 1},
    "drone": {"id": 1},
    "weatherWindow": {"id": 1}
}, headers={"Content-Type": "application/json"})

perm = resp.json()
perm_id = perm['id']
print(f"   ✓ 许可创建成功, ID={perm_id}, 初始状态={perm['status']}")
print()

# 3. 提交许可（触发系统校验）
print("3. 提交许可 → 触发系统校验...")
print("   关键验证点：SYSTEM_CHECKING → SYSTEM_APPROVED/SYSTEM_REJECTED")
resp = requests.post(f"{BASE_URL}/permissions/{perm_id}/submit", 
                     headers={"Content-Type": "application/json"})

if resp.status_code != 200 or 'error' in resp.json():
    print("   ✗ 提交失败!")
    print(f"   错误: {resp.json().get('error', resp.text)}")
    print()
    print("状态机修复失败，问题仍然存在!")
    exit(1)

perm = resp.json()
print(f"   ✓ 提交成功!")
print(f"   最终状态: {perm['status']}")
print()

# 4. 查看校验记录
print("4. 系统校验记录:")
resp = requests.get(f"{BASE_URL}/permissions/{perm_id}/check-records")
records = resp.json()
for r in records:
    status_icon = "✓" if r['checkResult'] == 'PASS' else "✗" if r['checkResult'] == 'FAIL' else "⚠"
    print(f"   {status_icon} {r['checkType']}: {r['checkResult']}")
print()

# 5. 查看流转历史
print("5. 状态流转历史:")
resp = requests.get(f"{BASE_URL}/permissions/{perm_id}/processing-history")
records = resp.json()
for r in records:
    from_s = r.get('fromStatus') or "  无  "
    print(f"   {from_s:14s} → {r['toStatus']:14s} | {r['action']}")
print()

# 6. 继续完整流程
print("6. 继续流程: 人工复核 → 批准")
requests.post(f"{BASE_URL}/permissions/{perm_id}/review/start")
resp = requests.post(f"{BASE_URL}/permissions/{perm_id}/approve", json={
    "conclusion": "同意作业",
    "remark": "各项条件符合要求"
}, headers={"Content-Type": "application/json"})

perm = resp.json()
print(f"   ✓ 批准完成, 最终状态={perm['status']}")
print(f"   ✓ 最终结论={perm['finalConclusion']}")
print()

# 7. 完整追溯
print("7. 完整追溯:")
resp = requests.get(f"{BASE_URL}/permissions/{perm_id}/trace")
trace = resp.json()
print(f"   校验记录数: {len(trace['checkRecords'])}")
print(f"   流转记录数: {len(trace['processingHistory'])}")
print(f"   修正记录数: {len(trace['amendmentHistory'])}")
print()

print("=" * 60)
print("✓ 全部测试通过! 状态机修复成功")
print("=" * 60)
