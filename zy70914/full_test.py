#!/usr/bin/env python3
import sys
sys.path.insert(0, ".")
from fastapi.testclient import TestClient
from main import app, global_store
import json
import io

client = TestClient(app)

print("=" * 80)
print("完整业务链路测试 - 第三轮修复验证")
print("=" * 80)
print()

passed = 0
total = 6
all_passed = True

def print_section(title, num):
    print()
    print("=" * 80)
    print(f"[{num}/{total}] {title}")
    print("=" * 80)
    print()

def print_pass(msg):
    global passed
    passed += 1
    print(f"  ✅ PASS: {msg}")

def print_fail(msg):
    global all_passed
    all_passed = False
    print(f"  ❌ FAIL: {msg}")

print_section("导入自定义赔付规则", 1)
try:
    print("  1.1 创建自定义规则：延误120分钟赔付999元")
    custom_rule = [{
        "rule_id": "CUSTOM_RULE_999",
        "rule_name": "延误120分钟赔付999元",
        "claim_type": "delay",
        "flight_type": "domestic",
        "min_delay_minutes": 120,
        "max_delay_minutes": None,
        "compensation_amount": 999,
        "max_compensation": 999,
        "valid_from": "2024-01-01",
        "valid_to": None,
        "description": "国内航班延误120分钟以上赔付999元（自定义规则）",
        "conditions": {}
    }]
    
    rule_json = json.dumps(custom_rule)
    rule_file = io.BytesIO(rule_json.encode('utf-8'))
    
    print("  1.2 调用导入规则API...")
    response = client.post(
        "/api/import/rules",
        files={"file": ("custom_rules.json", rule_file, "application/json")}
    )
    
    if response.status_code == 200:
        result = response.json()
        imported = result.get("imported", 0)
        print(f"      状态码: {response.status_code}")
        print(f"      导入结果: {imported} 条规则")
        if imported == 1:
            print_pass("自定义赔付规则导入成功")
        else:
            print_fail(f"规则导入记录数不符: 期望 1, 实际 {imported}")
    else:
        print_fail(f"规则导入失败: HTTP {response.status_code} - {response.text[:200]}")
    
    print()
    print("  1.3 验证规则已存入DataStore...")
    rules = global_store.get_all_rules()
    print(f"      当前规则数量: {len(rules)}")
    custom_found = False
    for r in rules:
        print(f"        - {r.rule_id}: {r.rule_name}, 赔付{r.compensation_amount}元")
        if r.rule_id == "CUSTOM_RULE_999" and r.compensation_amount == 999:
            custom_found = True
    
    if custom_found:
        print_pass("自定义999元规则已存入DataStore")
    else:
        print_fail("DataStore中未找到自定义999元规则")
        
except Exception as e:
    print_fail(f"导入规则异常: {str(e)}")
    import traceback
    traceback.print_exc()

print_section("导入申诉和航班数据", 2)
try:
    print("  2.1 导入 claims.csv (5条申诉)...")
    with open("sample_data/claims.csv", "rb") as f:
        response = client.post("/api/import/claims/csv", files={"file": ("claims.csv", f, "text/csv")})
    
    if response.status_code == 200:
        result = response.json()
        imported = result.get("imported", 0)
        print(f"      状态码: {response.status_code}")
        print(f"      导入结果: {imported} 条")
        if imported == 5:
            print_pass("claims.csv 导入成功 (5条)")
        else:
            print_fail(f"claims.csv 导入记录数不符: 期望 5, 实际 {imported}")
    else:
        print_fail(f"claims.csv 导入失败: HTTP {response.status_code} - {response.text[:200]}")
    
    print()
    print("  2.2 导入 flights.json...")
    with open("sample_data/flights.json", "rb") as f:
        response = client.post("/api/import/flights/json", files={"file": ("flights.json", f, "application/json")})
    
    if response.status_code == 200:
        result = response.json()
        imported = result.get("imported", 0)
        print(f"      状态码: {response.status_code}")
        print(f"      导入结果: {imported} 条")
        if imported > 0:
            print_pass(f"flights.json 导入成功 ({imported}条)")
        else:
            print_fail("flights.json 未导入任何记录")
    else:
        print_fail(f"flights.json 导入失败: HTTP {response.status_code} - {response.text[:200]}")
    
    print()
    print("  2.3 导入 photos.json...")
    with open("sample_data/photos.json", "rb") as f:
        response = client.post("/api/import/photos", files={"file": ("photos.json", f, "application/json")})
    
    if response.status_code == 200:
        result = response.json()
        imported = result.get("imported", 0)
        print(f"      状态码: {response.status_code}")
        print(f"      导入结果: {imported} 条")
        if imported > 0:
            print_pass(f"photos.json 导入成功 ({imported}条)")
        else:
            print_fail("photos.json 未导入任何记录")
    else:
        print_fail(f"photos.json 导入失败: HTTP {response.status_code} - {response.text[:200]}")
        
except Exception as e:
    print_fail(f"数据导入异常: {str(e)}")
    import traceback
    traceback.print_exc()

print_section("自动比对验证规则生效", 3)
try:
    print("  3.1 调用 /api/compare/all...")
    response = client.post("/api/compare/all")
    
    if response.status_code == 200:
        data = response.json()
        total_compared = data.get("total", 0)
        results = data.get("results", [])
        print(f"      状态码: {response.status_code}")
        print(f"      比对结果: 共 {total_compared} 条")
        
        if total_compared > 0:
            print_pass("自动比对运行成功")
        else:
            print_fail("没有比对结果")
        
        print()
        print("  3.2 验证 CLAIM001 的 suggested_amount = 999（使用自定义规则）...")
        claim001 = next((r for r in results if r.get("claim_id") == "CLAIM001"), None)
        if claim001:
            suggested_amount = claim001.get("suggested_amount")
            applicable_rules = claim001.get("applicable_rules", [])
            explanation = claim001.get("explanation", "")
            
            print(f"      suggested_amount: {suggested_amount}")
            print(f"      applicable_rules 数量: {len(applicable_rules)}")
            print(f"      explanation 长度: {len(explanation)} 字符")
            
            if suggested_amount == 999:
                print_pass("CLAIM001 suggested_amount = 999，自定义规则生效！")
            else:
                print_fail(f"CLAIM001 suggested_amount 错误: 期望 999, 实际 {suggested_amount}")
            
            if len(applicable_rules) > 0:
                print_pass("applicable_rules 不为空")
                for rule in applicable_rules:
                    print(f"        - {rule.get('rule_id')}: {rule.get('rule_name')}")
            else:
                print_fail("applicable_rules 为空")
            
            if explanation and len(explanation) > 0:
                print_pass("explanation 不为空")
                print(f"        解释预览: {explanation[:100]}...")
            else:
                print_fail("explanation 为空")
        else:
            print_fail("未找到 CLAIM001 的比对结果")
        
        print()
        print("  3.3 显示 CLAIM001 航班延误时间验证...")
        claim001_obj = global_store.get_claim("CLAIM001")
        if claim001_obj:
            flight = global_store.get_flight(claim001_obj.flight_no, claim001_obj.flight_date)
            if flight:
                print(f"      航班号: {flight.flight_no}")
                print(f"      延误时间: {flight.delay_minutes} 分钟")
                print(f"      自定义规则门槛: 120 分钟")
                if flight.delay_minutes >= 120:
                    print_pass(f"航班延误 {flight.delay_minutes} 分钟 >= 120 分钟，符合自定义规则条件")
                else:
                    print_fail(f"航班延误 {flight.delay_minutes} 分钟 < 120 分钟，不符合自定义规则条件")
            else:
                print_fail("未找到匹配的航班")
            
except Exception as e:
    print_fail(f"自动比对异常: {str(e)}")
    import traceback
    traceback.print_exc()

print_section("人工复核", 4)
try:
    print("  4.1 复核 CLAIM001 设置为 approved，金额999...")
    response = client.post(
        "/api/review/CLAIM001",
        data={
            "reviewer": "测试审核员",
            "status": "approved",
            "reviewed_amount": 999,
            "review_notes": "审核通过，按自定义规则赔付999元",
            "adjustment_reason": ""
        }
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"      状态码: {response.status_code}")
        print_pass("复核接口调用成功")
        
        print()
        print("  4.2 验证 final_status 和 final_amount 更新...")
        response = client.get("/api/comparisons/CLAIM001")
        if response.status_code == 200:
            data = response.json()
            result = data.get("result", {})
            final_status = result.get("final_status")
            final_amount = result.get("final_amount")
            review_record = result.get("review_record")
            
            print(f"      final_status: {final_status}")
            print(f"      final_amount: {final_amount}")
            print(f"      有审核记录: {'是' if review_record else '否'}")
            
            if final_status == "approved":
                print_pass("final_status = approved")
            else:
                print_fail(f"final_status 错误: 期望 approved, 实际 {final_status}")
            
            if final_amount == 999:
                print_pass("final_amount = 999")
            else:
                print_fail(f"final_amount 错误: 期望 999, 实际 {final_amount}")
        else:
            print_fail(f"查询比对结果失败: HTTP {response.status_code}")
    else:
        print_fail(f"复核失败: HTTP {response.status_code} - {response.text[:200]}")
        
except Exception as e:
    print_fail(f"人工复核异常: {str(e)}")
    import traceback
    traceback.print_exc()

print_section("统计汇总验证同步", 5)
try:
    print("  5.1 调用 /api/statistics/summary...")
    response = client.get("/api/statistics/summary")
    
    if response.status_code == 200:
        data = response.json()
        summary = data.get("summary", {})
        print(f"      状态码: {response.status_code}")
        print(f"      统计结果:")
        print(f"        total_claims: {summary.get('total_claims')}")
        print(f"        approved_count: {summary.get('approved_count')}")
        print(f"        total_claimed_amount: {summary.get('total_claimed_amount')}")
        print(f"        total_suggested_amount: {summary.get('total_suggested_amount')}")
        print(f"        total_approved_amount: {summary.get('total_approved_amount')}")
        
        total_claimed = summary.get("total_claimed_amount", 0)
        total_approved = summary.get("total_approved_amount", 0)
        
        if total_claimed is not None and total_claimed > 0:
            print_pass(f"total_claimed_amount 正确: {total_claimed} 元")
        else:
            print_fail(f"total_claimed_amount 错误: {total_claimed}")
        
        if total_approved >= 999:
            print_pass(f"total_approved_amount 包含999元: {total_approved} 元")
        else:
            print_fail(f"total_approved_amount 未包含999元: {total_approved}")
    else:
        print_fail(f"统计汇总失败: HTTP {response.status_code} - {response.text[:200]}")
        
except Exception as e:
    print_fail(f"统计汇总异常: {str(e)}")
    import traceback
    traceback.print_exc()

print_section("导出报告验证", 6)
try:
    print("  6.1 调用 /api/export/csv...")
    response = client.get("/api/export/csv")
    
    if response.status_code == 200:
        content_type = response.headers.get("content-type", "")
        content_disposition = response.headers.get("content-disposition", "")
        content_length = len(response.content)
        content_text = response.content.decode('utf-8-sig')
        
        print(f"      状态码: {response.status_code}")
        print(f"      Content-Type: {content_type}")
        print(f"      文件大小: {content_length} 字节")
        
        if content_length > 0:
            print_pass("CSV 文件非空")
        else:
            print_fail("CSV 文件为空")
        
        has_claim001 = "CLAIM001" in content_text
        has_999 = "999" in content_text
        
        print(f"      包含 CLAIM001: {'是' if has_claim001 else '否'}")
        print(f"      包含 999: {'是' if has_999 else '否'}")
        
        if has_claim001:
            print_pass("CSV 中包含 CLAIM001")
        else:
            print_fail("CSV 中不包含 CLAIM001")
        
        if has_999:
            print_pass("CSV 中包含 999元")
        else:
            print_fail("CSV 中不包含 999元")
        
        print()
        print("      CSV内容预览:")
        lines = content_text.split('\n')[:5]
        for line in lines:
            print(f"        {line[:100]}")
    else:
        print_fail(f"导出CSV失败: HTTP {response.status_code} - {response.text[:200]}")
    
    print()
    print("  6.2 调用 /api/export/excel...")
    response = client.get("/api/export/excel")
    
    if response.status_code == 200:
        content_type = response.headers.get("content-type", "")
        content_length = len(response.content)
        
        print(f"      状态码: {response.status_code}")
        print(f"      Content-Type: {content_type}")
        print(f"      文件大小: {content_length} 字节")
        
        if content_length > 0:
            print_pass("Excel 文件非空")
        else:
            print_fail("Excel 文件为空")
    else:
        print_fail(f"导出Excel失败: HTTP {response.status_code} - {response.text[:200]}")
        
except Exception as e:
    print_fail(f"导出报告异常: {str(e)}")
    import traceback
    traceback.print_exc()

print()
print("=" * 80)
print(f"测试结果: {passed}/{total} 个环节通过")
print("=" * 80)
print()

if all_passed:
    print("🎉 所有测试环节通过！第三轮修复验证成功！")
    print()
    print("重点验证结果:")
    print("  ✅ 自定义999元规则生效")
    print("  ✅ 导出文件有真实数据")
    print("  ✅ 复核后数字同步更新")
    sys.exit(0)
else:
    print(f"⚠️  有 {total - passed} 个环节未完全通过")
    sys.exit(1)
