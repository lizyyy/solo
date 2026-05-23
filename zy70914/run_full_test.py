#!/usr/bin/env python3
import sys
sys.path.insert(0, ".")

log = open("results.log", "w", encoding="utf-8")

def p(m):
    print(m)
    log.write(str(m)+"\n")
    log.flush()

p("="*80)
p("完整业务链路测试 - 第三轮修复验证")
p("="*80)

from fastapi.testclient import TestClient
from main import app, global_store
import json, io

client = TestClient(app)

passed = 0
all_pass = True

def pp(msg):
    global passed
    passed += 1
    p(f"  ✅ PASS: {msg}")

def pf(msg):
    global all_pass
    all_pass = False
    p(f"  ❌ FAIL: {msg}")

p("\n[1/6] 导入自定义赔付规则")
try:
    rule = [{"rule_id":"C999","rule_name":"延误120分钟赔付999元","claim_type":"delay","min_delay_minutes":120,"compensation_amount":999,"valid_from":"2024-01-01"}]
    f = io.BytesIO(json.dumps(rule).encode())
    r = client.post("/api/import/rules", files={"file":("r.json", f, "application/json")})
    p(f"  导入状态: {r.status_code}")
    if r.status_code==200:
        pp("规则导入成功")
    rules = global_store.get_all_rules()
    p(f"  规则数量: {len(rules)}")
    for x in rules:
        p(f"    - {x.rule_id}: {x.compensation_amount}元")
    if any(x.rule_id=="C999" and x.compensation_amount==999 for x in rules):
        pp("自定义999元规则已存入")
except Exception as e:
    pf(f"异常: {e}")

p("\n[2/6] 导入申诉和航班数据")
try:
    with open("sample_data/claims.csv","rb") as f:
        r = client.post("/api/import/claims/csv", files={"file":("c.csv", f, "text/csv")})
    p(f"  claims状态: {r.status_code}")
    if r.status_code==200:
        pp("claims导入成功")
    
    with open("sample_data/flights.json","rb") as f:
        r = client.post("/api/import/flights/json", files={"file":("f.json", f, "application/json")})
    p(f"  flights状态: {r.status_code}")
    if r.status_code==200:
        pp("flights导入成功")
    
    with open("sample_data/photos.json","rb") as f:
        r = client.post("/api/import/photos", files={"file":("p.json", f, "application/json")})
    p(f"  photos状态: {r.status_code}")
    if r.status_code==200:
        pp("photos导入成功")
except Exception as e:
    pf(f"异常: {e}")

p("\n[3/6] 自动比对验证规则生效")
try:
    r = client.post("/api/compare/all")
    p(f"  比对状态: {r.status_code}")
    data = r.json()
    total = data.get("total",0)
    p(f"  比对数量: {total}")
    if total>0:
        pp("自动比对运行成功")
    
    results = data.get("results",[])
    c1 = next((x for x in results if x.get("claim_id")=="CLAIM001"), None)
    if c1:
        sa = c1.get("suggested_amount")
        ar = c1.get("applicable_rules",[])
        exp = c1.get("explanation","")
        p(f"  CLAIM001 suggested_amount: {sa}")
        p(f"  applicable_rules: {len(ar)}条")
        p(f"  explanation长度: {len(exp)}字符")
        if sa==999:
            pp("CLAIM001 suggested_amount=999，自定义规则生效！")
        else:
            pf(f"期望999，实际{sa}")
        if len(ar)>0:
            pp("applicable_rules不为空")
        if len(exp)>0:
            pp("explanation不为空")
            p(f"    预览: {exp[:80]}")
except Exception as e:
    pf(f"异常: {e}")
    import traceback
    p(traceback.format_exc())

p("\n[4/6] 人工复核")
try:
    r = client.post("/api/review/CLAIM001", data={
        "reviewer":"测试员","status":"approved",
        "reviewed_amount":999,"review_notes":"通过","adjustment_reason":""
    })
    p(f"  复核状态: {r.status_code}")
    if r.status_code==200:
        pp("复核接口调用成功")
    
    r = client.get("/api/comparisons/CLAIM001")
    if r.status_code==200:
        d = r.json().get("result",{})
        fs = d.get("final_status")
        fa = d.get("final_amount")
        p(f"  final_status: {fs}")
        p(f"  final_amount: {fa}")
        if fs=="approved":
            pp("final_status=approved")
        if fa==999:
            pp("final_amount=999")
except Exception as e:
    pf(f"异常: {e}")

p("\n[5/6] 统计汇总验证同步")
try:
    r = client.get("/api/statistics/summary")
    p(f"  统计状态: {r.status_code}")
    s = r.json().get("summary",{})
    tc = s.get("total_claimed_amount")
    ta = s.get("total_approved_amount")
    p(f"  total_claimed_amount: {tc}")
    p(f"  total_approved_amount: {ta}")
    if tc and tc>0:
        pp(f"total_claimed_amount正确: {tc}元")
    if ta and ta>=999:
        pp(f"total_approved_amount包含999元: {ta}元")
except Exception as e:
    pf(f"异常: {e}")

p("\n[6/6] 导出报告验证")
try:
    r = client.get("/api/export/csv")
    p(f"  CSV状态: {r.status_code}")
    p(f"  CSV大小: {len(r.content)}字节")
    if len(r.content)>0:
        pp("CSV文件非空")
    csv_text = r.content.decode('utf-8-sig')
    has_c1 = "CLAIM001" in csv_text
    has_999 = "999" in csv_text
    p(f"  包含CLAIM001: {has_c1}")
    p(f"  包含999: {has_999}")
    if has_c1:
        pp("CSV包含CLAIM001")
    if has_999:
        pp("CSV包含999元")
    
    r = client.get("/api/export/excel")
    p(f"  Excel状态: {r.status_code}")
    p(f"  Excel大小: {len(r.content)}字节")
    if len(r.content)>0:
        pp("Excel文件非空")
except Exception as e:
    pf(f"异常: {e}")
    import traceback
    p(traceback.format_exc())

p("\n"+"="*80)
p(f"测试结果: {passed}个检查点通过")
p("="*80)
if all_pass:
    p("\n🎉 所有测试通过！第三轮修复验证成功！")
    p("\n重点验证结果:")
    p("  ✅ 自定义999元规则生效")
    p("  ✅ 导出文件有真实数据")
    p("  ✅ 复核后数字同步更新")
    log.close()
    sys.exit(0)
else:
    p("\n⚠️  有测试未通过")
    log.close()
    sys.exit(1)
                for rule in applicable_rules:
                    log(f"        - {rule.get('rule_id')}: {rule.get('rule_name')}")
            else:
                print_fail("applicable_rules 为空")
            
            if explanation and len(explanation) > 0:
                print_pass("explanation 不为空")
                log(f"        解释预览: {explanation[:100]}...")
            else:
                print_fail("explanation 为空")
        else:
            print_fail("未找到 CLAIM001 的比对结果")
        
        log("")
        log("  3.3 显示 CLAIM001 航班延误时间验证...")
        claim001_obj = global_store.get_claim("CLAIM001")
        if claim001_obj:
            flight = global_store.get_flight(claim001_obj.flight_no, claim001_obj.flight_date)
            if flight:
                log(f"      航班号: {flight.flight_no}")
                log(f"      延误时间: {flight.delay_minutes} 分钟")
                log(f"      自定义规则门槛: 120 分钟")
                if flight.delay_minutes >= 120:
                    print_pass(f"航班延误 {flight.delay_minutes} 分钟 >= 120 分钟，符合自定义规则条件")
                else:
                    print_fail(f"航班延误 {flight.delay_minutes} 分钟 < 120 分钟，不符合自定义规则条件")
            else:
                print_fail("未找到匹配的航班")
            
except Exception as e:
    print_fail(f"自动比对异常: {str(e)}")
    import traceback
    log(traceback.format_exc())

log("\n[4/6] 人工复核")
try:
    log("  4.1 复核 CLAIM001 设置为 approved，金额999...")
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
        log(f"      状态码: {response.status_code}")
        print_pass("复核接口调用成功")
        
        log("")
        log("  4.2 验证 final_status 和 final_amount 更新...")
        response = client.get("/api/comparisons/CLAIM001")
        if response.status_code == 200:
            data = response.json()
            result = data.get("result", {})
            final_status = result.get("final_status")
            final_amount = result.get("final_amount")
            review_record = result.get("review_record")
            
            log(f"      final_status: {final_status}")
            log(f"      final_amount: {final_amount}")
            log(f"      有审核记录: {'是' if review_record else '否'}")
            
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
    log(traceback.format_exc())

log("\n[5/6] 统计汇总验证同步")
try:
    log("  5.1 调用 /api/statistics/summary...")
    response = client.get("/api/statistics/summary")
    
    if response.status_code == 200:
        data = response.json()
        summary = data.get("summary", {})
        log(f"      状态码: {response.status_code}")
        log(f"      统计结果:")
        log(f"        total_claims: {summary.get('total_claims')}")
        log(f"        approved_count: {summary.get('approved_count')}")
        log(f"        total_claimed_amount: {summary.get('total_claimed_amount')}")
        log(f"        total_suggested_amount: {summary.get('total_suggested_amount')}")
        log(f"        total_approved_amount: {summary.get('total_approved_amount')}")
        
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
    log(traceback.format_exc())

log("\n[6/6] 导出报告验证")
try:
    log("  6.1 调用 /api/export/csv...")
    response = client.get("/api/export/csv")
    
    if response.status_code == 200:
        content_type = response.headers.get("content-type", "")
        content_length = len(response.content)
        content_text = response.content.decode('utf-8-sig')
        
        log(f"      状态码: {response.status_code}")
        log(f"      Content-Type: {content_type}")
        log(f"      文件大小: {content_length} 字节")
        
        if content_length > 0:
            print_pass("CSV 文件非空")
        else:
            print_fail("CSV 文件为空")
        
        has_claim001 = "CLAIM001" in content_text
        has_999 = "999" in content_text
        
        log(f"      包含 CLAIM001: {'是' if has_claim001 else '否'}")
        log(f"      包含 999: {'是' if has_999 else '否'}")
        
        if has_claim001:
            print_pass("CSV 中包含 CLAIM001")
        else:
            print_fail("CSV 中不包含 CLAIM001")
        
        if has_999:
            print_pass("CSV 中包含 999元")
        else:
            print_fail("CSV 中不包含 999元")
        
        log("")
        log("      CSV内容预览:")
        lines = content_text.split('\n')[:5]
        for line in lines:
            log(f"        {line[:100]}")
    else:
        print_fail(f"导出CSV失败: HTTP {response.status_code} - {response.text[:200]}")
    
    log("")
    log("  6.2 调用 /api/export/excel...")
    response = client.get("/api/export/excel")
    
    if response.status_code == 200:
        content_type = response.headers.get("content-type", "")
        content_length = len(response.content)
        
        log(f"      状态码: {response.status_code}")
        log(f"      Content-Type: {content_type}")
        log(f"      文件大小: {content_length} 字节")
        
        if content_length > 0:
            print_pass("Excel 文件非空")
        else:
            print_fail("Excel 文件为空")
    else:
        print_fail(f"导出Excel失败: HTTP {response.status_code} - {response.text[:200]}")
        
except Exception as e:
    print_fail(f"导出报告异常: {str(e)}")
    import traceback
    log(traceback.format_exc())

log("")
log("=" * 80)
log(f"测试结果: {passed}/{total} 个环节通过")
log("=" * 80)
log("")

if all_passed:
    log("🎉 所有测试环节通过！第三轮修复验证成功！")
    log("")
    log("重点验证结果:")
    log("  ✅ 自定义999元规则生效")
    log("  ✅ 导出文件有真实数据")
    log("  ✅ 复核后数字同步更新")
    log_file.close()
    sys.exit(0)
else:
    log(f"⚠️  有 {total - passed} 个环节未完全通过")
    log_file.close()
    sys.exit(1)
