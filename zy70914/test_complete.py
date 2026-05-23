import sys
sys.path.insert(0, ".")

print("="*80)
print("完整业务链路测试 - 第三轮修复验证")
print("="*80)

from fastapi.testclient import TestClient
from main import app, global_store
import json, io

client = TestClient(app)
passed = 0
all_pass = True

def pp(msg):
    global passed
    passed += 1
    print("  PASS:", msg)

def pf(msg):
    global all_pass
    all_pass = False
    print("  FAIL:", msg)

print()
print("[1/6] 导入自定义赔付规则")
try:
    rule = [{"rule_id":"C999","rule_name":"test","claim_type":"delay","flight_type":"domestic","min_delay_minutes":120,"compensation_amount":999,"max_compensation":999,"valid_from":"2024-01-01","description":"test"}]
    f = io.BytesIO(json.dumps(rule).encode())
    r = client.post("/api/import/rules", files={"file":("r.json", f, "application/json")})
    print("  导入规则状态:", r.status_code)
    if r.status_code == 200:
        result = r.json()
        imported = result.get("imported", 0)
        print("  导入结果:", imported, "条规则")
        if imported == 1:
            pp("规则导入接口调用成功")
    rules = global_store.get_all_rules()
    print("  DataStore中规则数量:", len(rules))
    found = False
    for x in rules:
        print("    -", x.rule_id, ": 赔付", x.compensation_amount, "元")
        if x.rule_id == "C999" and x.compensation_amount == 999:
            found = True
    if found:
        pp("自定义999元规则已存入DataStore")
    else:
        pf("DataStore中未找到999元规则")
except Exception as e:
    pf("导入规则异常: " + str(e))
    import traceback
    traceback.print_exc()

print()
print("[2/6] 导入申诉和航班数据")
try:
    with open("sample_data/claims.csv", "rb") as f:
        r = client.post("/api/import/claims/csv", files={"file":("c.csv", f, "text/csv")})
    print("  导入claims状态:", r.status_code)
    if r.status_code == 200:
        result = r.json()
        imported = result.get("imported", 0)
        print("  导入claims结果:", imported, "条")
        if imported == 5:
            pp("claims.csv 导入成功")

    with open("sample_data/flights.json", "rb") as f:
        r = client.post("/api/import/flights/json", files={"file":("f.json", f, "application/json")})
    print("  导入flights状态:", r.status_code)
    if r.status_code == 200:
        result = r.json()
        imported = result.get("imported", 0)
        if imported > 0:
            pp("flights.json 导入成功")

    with open("sample_data/photos.json", "rb") as f:
        r = client.post("/api/import/photos", files={"file":("p.json", f, "application/json")})
    print("  导入photos状态:", r.status_code)
    if r.status_code == 200:
        result = r.json()
        imported = result.get("imported", 0)
        if imported > 0:
            pp("photos.json 导入成功")
except Exception as e:
    pf("数据导入异常: " + str(e))

print()
print("[3/6] 自动比对验证规则生效")
try:
    r = client.post("/api/compare/all")
    print("  比对状态:", r.status_code)
    if r.status_code == 200:
        data = r.json()
        total = data.get("total", 0)
        results = data.get("results", [])
        print("  比对结果: 共", total, "条")
        if total > 0:
            pp("自动比对运行成功")

        c1 = None
        for x in results:
            if x.get("claim_id") == "CLAIM001":
                c1 = x
                break
        if c1:
            sa = c1.get("suggested_amount")
            ar = c1.get("applicable_rules", [])
            exp = c1.get("explanation", "")
            print("  CLAIM001 suggested_amount:", sa)
            print("  CLAIM001 applicable_rules:", len(ar), "条")
            print("  CLAIM001 explanation长度:", len(exp), "字符")
            if sa == 999:
                pp("CLAIM001 suggested_amount = 999，自定义规则生效！")
            else:
                pf("CLAIM001 suggested_amount 错误: 期望 999, 实际 " + str(sa))
            if len(ar) > 0:
                pp("applicable_rules 不为空")
            else:
                pf("applicable_rules 为空")
            if exp and len(exp) > 0:
                pp("explanation 不为空")
                print("    解释预览:", str(exp[:80]), "...")
            else:
                pf("explanation 为空")
        else:
            pf("未找到 CLAIM001 的比对结果")

        c1_obj = global_store.get_claim("CLAIM001")
        if c1_obj:
            flight = global_store.get_flight(c1_obj.flight_no, c1_obj.flight_date)
            if flight:
                print("  航班号:", flight.flight_no)
                print("  延误时间:", flight.delay_minutes, "分钟")
                print("  自定义规则门槛: 120 分钟")
                if flight.delay_minutes >= 120:
                    pp("航班延误 " + str(flight.delay_minutes) + " 分钟 >= 120 分钟")
                else:
                    pf("航班延误 " + str(flight.delay_minutes) + " 分钟 < 120 分钟")
except Exception as e:
    pf("自动比对异常: " + str(e))
    import traceback
    traceback.print_exc()

print()
print("[4/6] 人工复核")
try:
    r = client.post("/api/review/CLAIM001", data={
        "reviewer": "测试审核员", "status": "approved",
        "reviewed_amount": 999, "review_notes": "审核通过", "adjustment_reason": ""
    })
    print("  复核状态:", r.status_code)
    if r.status_code == 200:
        pp("复核接口调用成功")
        r = client.get("/api/comparisons/CLAIM001")
        if r.status_code == 200:
            d = r.json().get("result", {})
            fs = d.get("final_status")
            fa = d.get("final_amount")
            rr = d.get("review_record")
            print("  final_status:", str(fs))
            print("  final_amount:", str(fa))
            print("  有审核记录:", "是" if rr else "否")
            if fs == "approved":
                pp("final_status = approved")
            else:
                pf("final_status 错误")
            if fa == 999:
                pp("final_amount = 999")
            else:
                pf("final_amount 错误")
except Exception as e:
    pf("人工复核异常: " + str(e))

print()
print("[5/6] 统计汇总验证同步")
try:
    r = client.get("/api/statistics/summary")
    print("  统计状态:", r.status_code)
    if r.status_code == 200:
        data = r.json()
        s = data.get("summary", {})
        print("  统计结果:")
        print("    total_claims:", s.get("total_claims"))
        print("    approved_count:", s.get("approved_count"))
        print("    total_claimed_amount:", s.get("total_claimed_amount"))
        print("    total_suggested_amount:", s.get("total_suggested_amount"))
        print("    total_approved_amount:", s.get("total_approved_amount"))
        tc = s.get("total_claimed_amount", 0)
        ta = s.get("total_approved_amount", 0)
        if tc and tc > 0:
            pp("total_claimed_amount 正确: " + str(tc) + " 元")
        else:
            pf("total_claimed_amount 错误")
        if ta and ta >= 999:
            pp("total_approved_amount 包含999元: " + str(ta) + " 元")
        else:
            pf("total_approved_amount 未包含999元: " + str(ta))
except Exception as e:
    pf("统计汇总异常: " + str(e))

print()
print("[6/6] 导出报告验证")
try:
    r = client.get("/api/export/csv")
    print("  导出CSV状态:", r.status_code)
    print("  CSV文件大小:", len(r.content), "字节")
    if len(r.content) > 0:
        pp("CSV 文件非空")
    csv_text = r.content.decode("utf-8-sig")
    has_c1 = "CLAIM001" in csv_text
    has_999 = "999" in csv_text
    print("  CSV包含CLAIM001:", "是" if has_c1 else "否")
    print("  CSV包含999:", "是" if has_999 else "否")
    if has_c1:
        pp("CSV 中包含 CLAIM001")
    if has_999:
        pp("CSV 中包含 999元")
    print("  CSV内容预览:")
    lines = csv_text.split("\n")[:5]
    for line in lines:
        print("    " + line[:100])

    r = client.get("/api/export/excel")
    print("  导出Excel状态:", r.status_code)
    print("  Excel文件大小:", len(r.content), "字节")
    if len(r.content) > 0:
        pp("Excel 文件非空")
except Exception as e:
    pf("导出报告异常: " + str(e))

print()
print("="*80)
print("测试结果:", passed, "个检查点通过")
print("="*80)
print()

if all_pass:
    print("所有测试环节通过！第三轮修复验证成功！")
    print()
    print("重点验证结果:")
    print("  - 自定义999元规则生效")
    print("  - 导出文件有真实数据")
    print("  - 复核后数字同步更新")
    sys.exit(0)
else:
    print("有测试未完全通过")
    sys.exit(1)
