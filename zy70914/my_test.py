#!/usr/bin/env python3
import sys
sys.path.insert(0, ".")
from fastapi.testclient import TestClient
from main import app
import json

client = TestClient(app)

print("=" * 80)
print("完整业务链路测试 - 第二轮修复验证")
print("=" * 80)
print()

passed = 0
total = 7
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

print_section("数据导入", 1)
try:
    print("  1.1 导入 claims.csv (5条申诉)...")
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
    print("  1.2 导入 flights.json...")
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
    print("  1.3 导入 photos.json...")
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
    
    print()
    print("  1.4 验证数据持久化...")
    response = client.get("/api/statistics/claims")
    if response.status_code == 200:
        data = response.json()
        total_claims = data.get("total_claims", 0)
        print(f"      查询到 {total_claims} 条申诉记录")
        if total_claims == 5:
            print_pass("DataStore 单例生效，数据持久化成功")
        else:
            print_fail(f"数据不匹配: 期望 5, 实际 {total_claims}")
    else:
        print_fail(f"查询失败: HTTP {response.status_code}")
        
except Exception as e:
    print_fail(f"数据导入异常: {str(e)}")

print_section("自动比对", 2)
try:
    print("  2.1 调用 /api/compare/all...")
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
        print("  2.2 验证每条结果有 auto_status 和 suggested_amount...")
        all_have_fields = True
        for r in results:
            if "auto_status" not in r or "suggested_amount" not in r:
                all_have_fields = False
                break
        if all_have_fields:
            print_pass("所有结果都包含 auto_status 和 suggested_amount")
        else:
            print_fail("部分结果缺少 auto_status 或 suggested_amount")
        
        print()
        print("  2.3 验证 CLAIM001 有航班匹配和差异检测...")
        claim001 = next((r for r in results if r.get("claim_id") == "CLAIM001"), None)
        if claim001:
            has_matched_flight = claim001.get("matched_flight") is not None
            has_discrepancies = len(claim001.get("discrepancies", [])) > 0
            print(f"      匹配航班: {'是' if has_matched_flight else '否'}")
            print(f"      差异数量: {len(claim001.get('discrepancies', []))}")
            print(f"      auto_status: {claim001.get('auto_status')}")
            print(f"      suggested_amount: {claim001.get('suggested_amount')}")
            if has_matched_flight and has_discrepancies:
                print_pass("CLAIM001 有航班匹配和差异检测")
            else:
                print_fail("CLAIM001 缺少航班匹配或差异检测")
        else:
            print_fail("未找到 CLAIM001 的比对结果")
        
        print()
        print("  2.4 验证 CLAIM002 有超时申报检测...")
        claim002 = next((r for r in results if r.get("claim_id") == "CLAIM002"), None)
        if claim002:
            discrepancies = claim002.get("discrepancies", [])
            has_overtime = any(
                d.get("type") == "overtime_declaration" 
                for d in discrepancies
            )
            print(f"      差异数量: {len(discrepancies)}")
            for d in discrepancies:
                print(f"        - {d.get('type')}: {d.get('description', '')[:50]}...")
            if has_overtime:
                print_pass("CLAIM002 检测到超时申报")
            else:
                print_fail("CLAIM002 未检测到超时申报")
        else:
            print_fail("未找到 CLAIM002 的比对结果")
            
except Exception as e:
    print_fail(f"自动比对异常: {str(e)}")
    import traceback
    traceback.print_exc()

print_section("差异解释", 3)
try:
    print("  注意: /api/explanation 端点不存在，使用 /api/report 代替...")
    response = client.get("/api/report/CLAIM001")
    
    if response.status_code == 200:
        data = response.json()
        print(f"      状态码: {response.status_code}")
        
        comparison = data.get("comparison_result", {})
        if comparison:
            auto_status = comparison.get("auto_status")
            claimed_amount = comparison.get("claimed_amount")
            suggested_amount = comparison.get("suggested_amount")
            discrepancies = comparison.get("discrepancies", [])
            matched_flight = comparison.get("matched_flight")
            
            print(f"      预审结果 (auto_status): {auto_status}")
            print(f"      申报金额: {claimed_amount}")
            print(f"      建议金额: {suggested_amount}")
            print(f"      差异项数: {len(discrepancies)}")
            print(f"      航班信息: {'有' if matched_flight else '无'}")
            
            all_present = all([
                auto_status is not None,
                claimed_amount is not None,
                suggested_amount is not None,
                len(discrepancies) > 0,
                matched_flight is not None
            ])
            
            if all_present:
                print_pass("报告包含所有必要信息（预审结果、金额、差异、航班）")
            else:
                print_fail("报告缺少部分必要信息")
        else:
            print_fail("未找到比对结果")
    else:
        print_fail(f"获取报告失败: HTTP {response.status_code} - {response.text[:200]}")
        
except Exception as e:
    print_fail(f"差异解释异常: {str(e)}")

print_section("人工复核", 4)
try:
    print("  4.1 调用 /api/review/CLAIM001...")
    response = client.post(
        "/api/review/CLAIM001",
        data={
            "reviewer": "测试审核员",
            "status": "approved",
            "reviewed_amount": 400,
            "review_notes": "审核通过，按标准赔付",
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
            
            if final_status == "approved" and final_amount == 400:
                print_pass("final_status 和 final_amount 正确更新")
            else:
                print_fail(f"更新不正确: status={final_status}, amount={final_amount}")
        else:
            print_fail(f"查询比对结果失败: HTTP {response.status_code}")
    else:
        print_fail(f"复核失败: HTTP {response.status_code} - {response.text[:200]}")
        
except Exception as e:
    print_fail(f"人工复核异常: {str(e)}")
    import traceback
    traceback.print_exc()

print_section("重新计算", 5)
try:
    print("  5.1 修改 CLAIM004 申诉金额...")
    from app.services import global_store
    claim = global_store.get_claim("CLAIM004")
    if claim:
        old_amount = claim.claim_amount
        claim.claim_amount = 500
        global_store.add_claim(claim)
        print(f"      原金额: {old_amount} -> 新金额: {claim.claim_amount}")
        print_pass("CLAIM004 申诉金额已修改")
    else:
        print_fail("未找到 CLAIM004")
    
    print()
    print("  5.2 调用 /api/recalculate/CLAIM004...")
    response = client.post(
        "/api/recalculate/CLAIM004",
        data={"reason": "修改申诉金额后重新计算"}
    )
    
    if response.status_code == 200:
        data = response.json()
        result = data.get("result", {})
        recalculation_count = result.get("recalculation_count", 0)
        print(f"      状态码: {response.status_code}")
        print(f"      recalculation_count: {recalculation_count}")
        
        if recalculation_count >= 1:
            print_pass("recalculation_count 已增加")
        else:
            print_fail(f"recalculation_count 未增加: {recalculation_count}")
    else:
        print_fail(f"重新计算失败: HTTP {response.status_code} - {response.text[:200]}")
        
except Exception as e:
    print_fail(f"重新计算异常: {str(e)}")
    import traceback
    traceback.print_exc()

print_section("统计汇总", 6)
try:
    print("  调用 /api/statistics/summary...")
    response = client.get("/api/statistics/summary")
    
    if response.status_code == 200:
        data = response.json()
        summary = data.get("summary", {})
        print(f"      状态码: {response.status_code}")
        print(f"      统计结果:")
        print(f"        total_claims: {summary.get('total_claims')}")
        print(f"        approved_count: {summary.get('approved_count')}")
        print(f"        total_claimed_amount: {summary.get('total_claimed_amount')}")
        print(f"        total_approved_amount: {summary.get('total_approved_amount')}")
        
        has_required = all([
            summary.get("total_claims") is not None,
            summary.get("approved_count") is not None,
            summary.get("total_claimed_amount") is not None,
            summary.get("total_approved_amount") is not None
        ])
        
        if has_required:
            print_pass("统计汇总包含所有必要字段")
        else:
            print_fail("统计汇总缺少必要字段")
    else:
        print_fail(f"统计汇总失败: HTTP {response.status_code} - {response.text[:200]}")
        
except Exception as e:
    print_fail(f"统计汇总异常: {str(e)}")
    import traceback
    traceback.print_exc()

print_section("导出报告", 7)
try:
    print("  调用 /api/export/excel...")
    response = client.get("/api/export/excel")
    
    if response.status_code == 200:
        content_type = response.headers.get("content-type", "")
        content_disposition = response.headers.get("content-disposition", "")
        content_length = len(response.content)
        
        print(f"      状态码: {response.status_code}")
        print(f"      Content-Type: {content_type}")
        print(f"      Content-Disposition: {content_disposition}")
        print(f"      文件大小: {content_length} 字节")
        
        is_excel = "excel" in content_type or "vnd.openxmlformats" in content_type
        has_content = content_length > 0
        
        if is_excel and has_content:
            print_pass("Excel 报告导出成功")
        else:
            print_fail(f"Excel 导出格式或内容不正确")
    else:
        print_fail(f"导出报告失败: HTTP {response.status_code} - {response.text[:200]}")
        
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
    print("🎉 所有测试环节通过！第二轮修复验证成功！")
    sys.exit(0)
else:
    print(f"⚠️  有 {total - passed} 个环节未完全通过")
    sys.exit(1)
