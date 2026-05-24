import requests

BASE = "http://localhost:8000"

print("=" * 50)
print("消毒记录核心功能测试")
print("=" * 50)

print("\n1. 录入消毒记录")
resp = requests.post(f"{BASE}/api/sterilization-records/", json={
    "cycle_number": "CYCLE-TEST-001",
    "batch_number": "BATCH-TEST-001",
    "sterilizer_id": "STER-001",
    "start_time": "2024-05-20T08:00:00",
    "end_time": "2024-05-20T09:00:00",
    "result": "合格",
    "operator": "消毒员王师傅"
})
print(f"   结果: {resp.json()}")
assert resp.status_code == 200, "消毒记录录入失败"
print("   ✅ 消毒记录录入成功")

print("\n2. 提交材料 - 有消毒记录（校验通过）")
resp = requests.post(f"{BASE}/api/raw-materials/", json={
    "batch_number": "BATCH-TEST-001",
    "sterilization_cycle": "CYCLE-TEST-001",
    "operating_room": "手术室1",
    "receiving_nurse": "张护士",
    "isolation_reason": "正常领用",
    "submission_time": "2024-05-20T10:00:00",
    "surgery_time": "2024-05-20T11:00:00"
})
data = resp.json()
steri_valid = data.get("sterilization_validation", {}).get("valid")
steri_result = data.get("sterilization_validation", {}).get("result")
print(f"   状态: {data.get('status')}")
print(f"   消毒校验通过: {steri_valid}")
print(f"   消毒结果: {steri_result}")
assert steri_valid == True, "有消毒记录时校验应该通过"
assert steri_result == "合格", "消毒结果应该为合格"
print("   ✅ 消毒校验通过")
order_id = data.get("order_id")

print("\n3. 提交材料 - 无消毒记录（校验不通过）")
resp = requests.post(f"{BASE}/api/raw-materials/", json={
    "batch_number": "BATCH-NO-RECORD",
    "sterilization_cycle": "CYCLE-NO-RECORD",
    "operating_room": "手术室2",
    "receiving_nurse": "李护士",
    "isolation_reason": "无消毒记录测试",
    "submission_time": "2024-05-20T10:00:00",
    "surgery_time": "2024-05-20T11:00:00"
})
data = resp.json()
steri_valid = data.get("sterilization_validation", {}).get("valid")
risk_level = data.get("sterilization_validation", {}).get("risk_level")
issues = data.get("sterilization_validation", {}).get("issues", [])
print(f"   状态: {data.get('status')}")
print(f"   消毒校验通过: {steri_valid}")
print(f"   风险等级: {risk_level}")
print(f"   问题: {issues}")
assert steri_valid == False, "无消毒记录时校验应该不通过"
assert risk_level == "critical", "风险等级应该为 critical"
assert len(issues) > 0, "应该有问题提示"
print("   ✅ 无消毒记录检测成功")

print("\n4. 人工放行 - 消毒校验集成")
resp = requests.post(f"{BASE}/api/decisions/", json={
    "isolation_order_id": order_id,
    "decision_type": "approve",
    "conclusion": "同意放行，消毒记录验证通过",
    "reason": "材料齐全，消毒记录完整",
    "operator": "李护士长"
})
data = resp.json()
print(f"   判定状态: {data.get('status')}")
print(f"   订单状态: {data.get('order_status')}")
print(f"   消毒校验: {data.get('sterilization_validation', {}).get('valid')}")
assert data.get("order_status") == "released", "应该放行成功"
print("   ✅ 放行判定成功")

print("\n5. 消毒炉次追踪")
resp = requests.get(f"{BASE}/api/sterilization-trace/CYCLE-TEST-001")
data = resp.json()
print(f"   炉次: {data.get('cycle')}")
print(f"   消毒记录数: {len(data.get('sterilization_records', []))}")
print(f"   隔离单数: {data.get('order_count')}")
assert len(data.get('sterilization_records', [])) > 0, "应该有消毒记录"
print("   ✅ 炉次追踪正常")

print("\n6. 批号追踪（含消毒信息）")
resp = requests.get(f"{BASE}/api/batch-trace/BATCH-TEST-001")
data = resp.json()
print(f"   批号: {data.get('batch_number')}")
print(f"   消毒记录数: {data.get('sterilization_records_count')}")
print(f"   全部合格: {data.get('all_sterilization_passed')}")
print("   ✅ 批号追踪正常")

print("\n" + "=" * 50)
print("🎉 所有消毒记录相关功能测试通过！")
print("=" * 50)
