import sys
sys.path.insert(0, ".")
from fastapi.testclient import TestClient
from main import app, global_store
from app.services import (
    DataStore, DataImporter, ComparisonEngine, 
    ReviewService, RecalculationService, ReportGenerator, ExplanationGenerator
)
import json, io

print("=" * 80)
print("第四轮修复 - 完整功能验证测试")
print("=" * 80)

test_results = {}

print("\n[1/8] 服务可导入验证")
print("-" * 80)
try:
    services = [
        ("DataStore", DataStore),
        ("DataImporter", DataImporter),
        ("ComparisonEngine", ComparisonEngine),
        ("ReviewService", ReviewService),
        ("RecalculationService", RecalculationService),
        ("ReportGenerator", ReportGenerator),
        ("ExplanationGenerator", ExplanationGenerator),
    ]
    
    all_imported = True
    for name, service_class in services:
        status = "PASS" if service_class is not None else "FAIL"
        print(f"  {name}: {status}")
        if service_class is None:
            all_imported = False
    
    test_results["服务可导入"] = all_imported
    print(f"  结果: {'PASS' if all_imported else 'FAIL'}")
except Exception as e:
    print(f"  错误: {e}")
    test_results["服务可导入"] = False

print("\n[2/8] API可启动验证")
print("-" * 80)
try:
    c = TestClient(app)
    r = c.get("/")
    status_ok = r.status_code == 200
    response_ok = r.json().get("status") == "ok"
    api_ok = status_ok and response_ok
    
    print(f"  状态码: {r.status_code} {'PASS' if status_ok else 'FAIL'}")
    print(f"  响应内容: {r.json()}")
    print(f"  结果: {'PASS' if api_ok else 'FAIL'}")
    test_results["API可启动"] = api_ok
except Exception as e:
    print(f"  错误: {e}")
    test_results["API可启动"] = False

global_store.clear_all()

print("\n[3/8] 数据导入验证")
print("-" * 80)
c = TestClient(app)
data_import_success = True

print("  3.1 导入CSV申诉数据")
with open("sample_data/claims.csv", "rb") as f:
    r = c.post("/api/import/claims/csv", files={"file": ("claims.csv", f, "text/csv")})
claims_imported = r.json().get("imported", 0)
claims_ok = claims_imported == 5
print(f"    导入数量: {claims_imported} 条 {'PASS' if claims_ok else 'FAIL'} (预期: 5)")
data_import_success = data_import_success and claims_ok

print("  3.2 导入JSON航班数据")
with open("sample_data/flights.json", "rb") as f:
    r = c.post("/api/import/flights/json", files={"file": ("flights.json", f, "application/json")})
flights_imported = r.json().get("imported", 0)
flights_ok = flights_imported >= 1
print(f"    导入数量: {flights_imported} 条 {'PASS' if flights_ok else 'FAIL'} (预期: >= 1)")
data_import_success = data_import_success and flights_ok

print("  3.3 导入JSON照片数据")
with open("sample_data/photos.json", "rb") as f:
    r = c.post("/api/import/photos", files={"file": ("photos.json", f, "application/json")})
photos_imported = r.json().get("imported", 0)
photos_ok = photos_imported >= 1
print(f"    导入数量: {photos_imported} 条 {'PASS' if photos_ok else 'FAIL'} (预期: >= 1)")
data_import_success = data_import_success and photos_ok

print("  3.4 导入JSON赔付规则")
with open("sample_data/rules.json", "rb") as f:
    r = c.post("/api/import/rules", files={"file": ("rules.json", f, "application/json")})
rules_imported = r.json().get("imported", 0)
rules_ok = rules_imported >= 1
print(f"    导入数量: {rules_imported} 条 {'PASS' if rules_ok else 'FAIL'} (预期: >= 1)")
data_import_success = data_import_success and rules_ok

print(f"  结果: {'PASS' if data_import_success else 'FAIL'}")
test_results["数据导入"] = data_import_success

print("\n[4/8] 自动比对验证")
print("-" * 80)
r = c.post("/api/compare/all")
data = r.json()
results = data.get("results", [])
total_compared = data.get("total", 0)

print(f"  比对总数: {total_compared} 条 {'PASS' if total_compared == 5 else 'FAIL'} (预期: 5)")

claim001_result = None
for x in results:
    if x.get("claim_id") == "CLAIM001":
        claim001_result = x
        break

compare_success = False
if claim001_result:
    suggested_amount = claim001_result.get("suggested_amount")
    applicable_rules = claim001_result.get("applicable_rules", [])
    explanation = claim001_result.get("explanation", "")
    
    has_suggested = suggested_amount is not None and suggested_amount >= 0
    has_rules = len(applicable_rules) > 0
    has_explanation = len(explanation) > 0
    
    print(f"  CLAIM001 验证:")
    print(f"    - suggested_amount: {suggested_amount} 元 {'PASS' if has_suggested else 'FAIL'}")
    print(f"    - applicable_rules: {len(applicable_rules)} 条 {'PASS' if has_rules else 'FAIL'}")
    print(f"    - explanation 长度: {len(explanation)} 字符 {'PASS' if has_explanation else 'FAIL'}")
    
    compare_success = has_suggested and has_rules and has_explanation
else:
    print("  FAIL 未找到 CLAIM001 的比对结果")

print(f"  结果: {'PASS' if compare_success else 'FAIL'}")
test_results["自动比对"] = compare_success

print("\n[5/8] 人工复核验证")
print("-" * 80)
r = c.post("/api/review/CLAIM001", data={
    "reviewer": "测试审核员",
    "status": "approved",
    "reviewed_amount": 400,
    "review_notes": "审核通过，符合赔付规则",
    "adjustment_reason": ""
})
review_request_ok = r.status_code == 200
print(f"  复核请求状态: {r.status_code} {'PASS' if review_request_ok else 'FAIL'}")

r = c.get("/api/comparisons/CLAIM001")
result_data = r.json().get("result", {})
final_status = result_data.get("final_status")
final_amount = result_data.get("final_amount")

has_final_status = final_status == "approved"
has_final_amount = final_amount == 400
review_success = review_request_ok and has_final_status and has_final_amount

print(f"  复核结果验证:")
print(f"    - final_status: {final_status} {'PASS' if has_final_status else 'FAIL'} (预期: approved)")
print(f"    - final_amount: {final_amount} 元 {'PASS' if has_final_amount else 'FAIL'} (预期: 400元)")

print(f"  结果: {'PASS' if review_success else 'FAIL'}")
test_results["人工复核"] = review_success

print("\n[6/8] 统计汇总验证")
print("-" * 80)
r = c.get("/api/statistics/summary")
summary = r.json().get("summary", {})

total_claimed = summary.get("total_claimed_amount", 0)
total_suggested = summary.get("total_suggested_amount", 0)
total_approved = summary.get("total_approved_amount", 0)
approved_count = summary.get("approved_count", 0)
total_claims = summary.get("total_claims", 0)

print(f"  统计数据:")
print(f"    - 总申诉数: {total_claims} {'PASS' if total_claims == 5 else 'FAIL'} (预期: 5)")
print(f"    - 总申报金额: {total_claimed} 元")
print(f"    - 总建议赔付金额: {total_suggested} 元")
print(f"    - 总已批准金额: {total_approved} 元")
print(f"    - 已批准申诉数: {approved_count}")

stats_ok = (total_claims == 5 and 
            total_claimed > 0 and 
            total_suggested > 0 and 
            total_approved >= 400 and 
            approved_count >= 1)

print(f"  结果: {'PASS' if stats_ok else 'FAIL'}")
test_results["统计汇总"] = stats_ok

print("\n[7/8] CSV导出验证")
print("-" * 80)
r = c.get("/api/export/csv")
csv_size = len(r.content)
csv_content = r.content.decode("utf-8-sig")
csv_lines = csv_content.split('\n')

csv_has_header = len(csv_lines) > 1 and "claim_id" in csv_lines[0]
csv_has_data = len(csv_lines) > 2
csv_has_claim001 = "CLAIM001" in csv_content
csv_not_empty = csv_size > 100

csv_ok = csv_not_empty and csv_has_header and csv_has_data and csv_has_claim001

print(f"  文件大小: {csv_size} 字节 {'PASS' if csv_not_empty else 'FAIL'} (预期: > 100)")
print(f"  包含表头: {'PASS' if csv_has_header else 'FAIL'}")
print(f"  包含数据行: {'PASS' if csv_has_data else 'FAIL'}")
print(f"  包含CLAIM001: {'PASS' if csv_has_claim001 else 'FAIL'}")

print(f"  结果: {'PASS' if csv_ok else 'FAIL'}")
test_results["CSV导出"] = csv_ok

print("\n[8/8] Excel导出验证")
print("-" * 80)
r = c.get("/api/export/excel")
excel_size = len(r.content)

excel_not_empty = excel_size > 1000
excel_ok = excel_not_empty

print(f"  文件大小: {excel_size} 字节 {'PASS' if excel_not_empty else 'FAIL'} (预期: > 1000)")

print(f"  结果: {'PASS' if excel_ok else 'FAIL'}")
test_results["Excel导出"] = excel_ok

print("\n" + "=" * 80)
print("测试总结")
print("=" * 80)

passed = 0
failed = 0
for test_name, result in test_results.items():
    status = "PASS" if result else "FAIL"
    print(f"  {test_name}: {status}")
    if result:
        passed += 1
    else:
        failed += 1

print("-" * 80)
print(f"总计: {passed} 项通过, {failed} 项失败")
print(f"测试结果: {'全部通过' if failed == 0 else '存在失败项'}")
print("=" * 80)
print(f"  包含数据行: {'✓' if csv_has_data else '✗'}")
print(f"  包含CLAIM001: {'✓' if csv_has_claim001 else '✗'}")
print(f"  预览前3行:")
for i, line in enumerate(csv_lines[:3]):
    if line.strip():
        print(f"    {i+1}: {line[:80]}")

print(f"  结果: {'✓ 通过' if csv_ok else '✗ 失败'}")
test_results["CSV导出"] = csv_ok

# ============================================
# Test 8: Excel导出
# ============================================
print("\n[8/8] Excel导出验证")
print("-" * 80)
r = c.get("/api/export/excel")
excel_size = len(r.content)

excel_not_empty = excel_size > 1000
excel_ok = excel_not_empty

print(f"  文件大小: {excel_size} 字节 {'✓' if excel_not_empty else '✗'} (预期: > 1000)")
print(f"  文件格式校验: {'✓' if r.content[:2] == b'PK' else '✗'} (ZIP格式)")

print(f"  结果: {'✓ 通过' if excel_ok else '✗ 失败'}")
test_results["Excel导出"] = excel_ok

# ============================================
# 最终总结
# ============================================
print("\n" + "=" * 80)
print("测试总结")
print("=" * 80)

passed = 0
failed = 0
for test_name, result in test_results.items():
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
