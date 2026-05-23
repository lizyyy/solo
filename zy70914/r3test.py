import sys
sys.path.insert(0, ".")
from fastapi.testclient import TestClient
from main import app, global_store
import json, io

c = TestClient(app)

print("=" * 80)
print("第三轮修复验证测试 - 完整测试报告")
print("=" * 80)

# Step 1: 导入自定义赔付规则
print("\n[1/6] 导入自定义赔付规则 (delay >= 60分钟，赔付999元)")
print("-" * 80)
custom_rule = [{
    "rule_id": "CUSTOM_999",
    "rule_name": "延误60分钟赔付999元",
    "claim_type": "delay",
    "flight_type": "domestic",
    "min_delay_minutes": 60,
    "compensation_amount": 999,
    "max_compensation": 999,
    "valid_from": "2024-01-01",
    "description": "航班延误60分钟及以上，赔付999元"
}]
f = io.BytesIO(json.dumps(custom_rule).encode())
r = c.post("/api/import/rules", files={"file": ("custom_rule.json", f, "application/json")})
print(f"  导入状态码: {r.status_code} {'✓' if r.status_code == 200 else '✗'}")
print(f"  成功导入规则数: {r.json().get('imported')}")
print(f"  当前规则总数: {len(global_store.get_all_rules())}")
for x in global_store.get_all_rules():
    print(f"    - 规则ID: {x.rule_id}, 最低延误: {x.min_delay_minutes}分钟, 赔付金额: {x.compensation_amount}元")
print(f"  自定义规则导入成功: {'✓' if r.status_code == 200 and r.json().get('imported') == 1 else '✗'}")

# Step 2: 导入数据
print("\n[2/6] 导入测试数据")
print("-" * 80)
with open("sample_data/claims.csv", "rb") as f:
    r = c.post("/api/import/claims/csv", files={"file": ("claims.csv", f, "text/csv")})
claims_imported = r.json().get("imported")
print(f"  申诉数据导入: {claims_imported} 条 {'✓' if claims_imported == 5 else '✗'}")

with open("sample_data/flights.json", "rb") as f:
    r = c.post("/api/import/flights/json", files={"file": ("flights.json", f, "application/json")})
flights_imported = r.json().get("imported")
print(f"  航班数据导入: {flights_imported} 条 {'✓' if flights_imported >= 1 else '✗'}")

with open("sample_data/photos.json", "rb") as f:
    r = c.post("/api/import/photos", files={"file": ("photos.json", f, "application/json")})
photos_imported = r.json().get("imported")
print(f"  照片索引导入: {photos_imported} 条 {'✓' if photos_imported >= 1 else '✗'}")

data_success = claims_imported == 5 and flights_imported >= 1 and photos_imported >= 1
print(f"  数据导入完成: {'✓' if data_success else '✗'}")

# Step 3: 自动比对验证
print("\n[3/6] 自动比对验证")
print("-" * 80)
r = c.post("/api/compare/all")
data = r.json()
results = data.get("results", [])
total_compared = data.get("total")
print(f"  比对总数: {total_compared} 条 {'✓' if total_compared == 5 else '✗'}")

claim001_result = None
for x in results:
    if x.get("claim_id") == "CLAIM001":
        claim001_result = x
        break

if claim001_result:
    suggested_amount = claim001_result.get("suggested_amount")
    applicable_rules_count = len(claim001_result.get("applicable_rules", []))
    explanation = claim001_result.get("explanation", "")
    explanation_len = len(explanation)
    
    print(f"  CLAIM001 验证:")
    print(f"    - suggested_amount: {suggested_amount} 元")
    print(f"      验证(规则计算而非硬编码400): {'✓' if suggested_amount == 999 else '✗'} (预期: 999)")
    print(f"    - applicable_rules 数量: {applicable_rules_count}")
    print(f"      验证(不为空): {'✓' if applicable_rules_count > 0 else '✗'} (预期: >= 1)")
    print(f"    - explanation 长度: {explanation_len} 字符")
    print(f"      验证(不为空): {'✓' if explanation_len > 0 else '✗'} (预期: > 0)")
    
    # 显示航班延误信息
    flight = global_store.get_flight(claim001_result.get("flight_no"), claim001_result.get("flight_date"))
    if flight:
        print(f"    - 实际延误时间: {flight.delay_minutes} 分钟 (满足 >= 60分钟: {'✓' if flight.delay_minutes >= 60 else '✗'})")
    
    # 显示适用规则详情
    if claim001_result.get("applicable_rules"):
        print(f"    - 适用规则详情:")
        for rule in claim001_result.get("applicable_rules", []):
            if isinstance(rule, dict):
                print(f"      * {rule.get('rule_name')}: 延误 >= {rule.get('min_delay_minutes')}分钟, 赔付 {rule.get('compensation_amount')}元")
    
    compare_success = (suggested_amount == 999 and 
                       applicable_rules_count > 0 and 
                       explanation_len > 0)
    print(f"  自动比对验证通过: {'✓' if compare_success else '✗'}")
else:
    print("  ✗ 未找到 CLAIM001 的比对结果")
    compare_success = False

# Step 4: 人工复核
print("\n[4/6] 人工复核验证")
print("-" * 80)
r = c.post("/api/review/CLAIM001", data={
    "reviewer": "测试审核员",
    "status": "approved",
    "reviewed_amount": 999,
    "review_notes": "审核通过，符合自定义赔付规则",
    "adjustment_reason": ""
})
print(f"  复核请求状态码: {r.status_code} {'✓' if r.status_code == 200 else '✗'}")

# 验证复核结果
r = c.get("/api/comparisons/CLAIM001")
result_data = r.json().get("result", {})
final_status = result_data.get("final_status")
final_amount = result_data.get("final_amount")

print(f"  CLAIM001 复核结果:")
print(f"    - final_status: {final_status}")
print(f"      验证: {'✓' if final_status == 'approved' else '✗'} (预期: approved)")
print(f"    - final_amount: {final_amount} 元")
print(f"      验证: {'✓' if final_amount == 999 else '✗'} (预期: 999元)")

review_success = r.status_code == 200 and final_status == "approved" and final_amount == 999
print(f"  人工复核验证通过: {'✓' if review_success else '✗'}")

# Step 5: 统计汇总验证
print("\n[5/6] 统计汇总验证")
print("-" * 80)
r = c.get("/api/statistics/summary")
summary = r.json().get("summary", {})
total_claimed = summary.get("total_claimed_amount")
total_suggested = summary.get("total_suggested_amount")
total_approved = summary.get("total_approved_amount")
approved_count = summary.get("approved_count")

print(f"  统计数据:")
print(f"    - 总申报金额: {total_claimed} 元")
print(f"    - 总建议赔付金额: {total_suggested} 元")
print(f"    - 总已批准金额: {total_approved} 元")
print(f"    - 已批准申诉数: {approved_count}")

# 验证包含复核的999元
has_999 = total_approved >= 999
print(f"  验证(包含复核999元): {'✓' if has_999 else '✗'} (预期: total_approved >= 999)")

stats_success = has_999 and approved_count >= 1
print(f"  统计汇总验证通过: {'✓' if stats_success else '✗'}")

# Step 6: 导出报告验证
print("\n[6/6] 导出报告验证")
print("-" * 80)

# CSV 导出
r = c.get("/api/export/csv")
csv_size = len(r.content)
csv_content = r.content.decode("utf-8-sig")
csv_has_claim001 = "CLAIM001" in csv_content
csv_has_999 = "999" in csv_content
csv_not_empty = csv_size > 100

print(f"  CSV 导出报告:")
print(f"    - 文件大小: {csv_size} 字节")
print(f"    - 非空验证: {'✓' if csv_not_empty else '✗'} (预期: > 100字节)")
print(f"    - 包含CLAIM001: {'✓' if csv_has_claim001 else '✗'}")
print(f"    - 包含999元: {'✓' if csv_has_999 else '✗'}")

# Excel 导出
r = c.get("/api/export/excel")
excel_size = len(r.content)
excel_not_empty = excel_size > 1000

print(f"  Excel 导出报告:")
print(f"    - 文件大小: {excel_size} 字节")
print(f"    - 非空验证: {'✓' if excel_not_empty else '✗'} (预期: > 1000字节)")

export_success = csv_not_empty and csv_has_claim001 and csv_has_999 and excel_not_empty
print(f"  导出报告验证通过: {'✓' if export_success else '✗'}")

# 最终总结
print("\n" + "=" * 80)
print("测试总结")
print("=" * 80)
all_tests = [
    ("自定义规则导入", r.status_code == 200),
    ("测试数据导入", data_success),
    ("自动比对验证", compare_success),
    ("人工复核验证", review_success),
    ("统计汇总验证", stats_success),
    ("导出报告验证", export_success),
]

passed = 0
failed = 0
for test_name, result in all_tests:
    status = "✓ 通过" if result else "✗ 失败"
    print(f"  {test_name}: {status}")
    if result:
        passed += 1
    else:
        failed += 1

print("-" * 80)
print(f"总计: {passed} 项通过, {failed} 项失败")
print(f"测试结果: {'全部通过 ✓' if failed == 0 else '存在失败项 ✗'}")
print("=" * 80)
