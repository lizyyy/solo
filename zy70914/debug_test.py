#!/usr/bin/env python3
import sys
sys.path.insert(0, ".")
print("Step 1: Import modules")
from fastapi.testclient import TestClient
print("Step 2: Import main")
from main import app, global_store
import json
import io

print("Step 3: Create client")
client = TestClient(app)

print("=" * 80)
print("完整业务链路测试 - 第三轮修复验证")
print("=" * 80)

print("\n[1/6] 导入自定义赔付规则")
try:
    print("  1.1 创建自定义规则")
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
        "description": "国内航班延误120分钟以上赔付999元",
        "conditions": {}
    }]
    
    rule_json = json.dumps(custom_rule)
    rule_file = io.BytesIO(rule_json.encode('utf-8'))
    
    print("  1.2 调用导入规则API")
    response = client.post(
        "/api/import/rules",
        files={"file": ("custom_rules.json", rule_file, "application/json")}
    )
    print(f"      状态码: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        print(f"      导入结果: {result}")
    else:
        print(f"      错误: {response.text}")
    
    print("  1.3 验证规则已存入DataStore")
    rules = global_store.get_all_rules()
    print(f"      当前规则数量: {len(rules)}")
    for r in rules:
        print(f"        - {r.rule_id}: 赔付{r.compensation_amount}元")
        
except Exception as e:
    print(f"  ERROR: {str(e)}")
    import traceback
    traceback.print_exc()

print("\n[2/6] 导入申诉和航班数据")
try:
    print("  2.1 导入 claims.csv")
    with open("sample_data/claims.csv", "rb") as f:
        response = client.post("/api/import/claims/csv", files={"file": ("claims.csv", f, "text/csv")})
    print(f"      状态码: {response.status_code}")
    if response.status_code == 200:
        print(f"      结果: {response.json()}")
    
    print("  2.2 导入 flights.json")
    with open("sample_data/flights.json", "rb") as f:
        response = client.post("/api/import/flights/json", files={"file": ("flights.json", f, "application/json")})
    print(f"      状态码: {response.status_code}")
    if response.status_code == 200:
        print(f"      结果: {response.json()}")
    
    print("  2.3 导入 photos.json")
    with open("sample_data/photos.json", "rb") as f:
        response = client.post("/api/import/photos", files={"file": ("photos.json", f, "application/json")})
    print(f"      状态码: {response.status_code}")
    if response.status_code == 200:
        print(f"      结果: {response.json()}")
        
except Exception as e:
    print(f"  ERROR: {str(e)}")
    import traceback
    traceback.print_exc()

print("\n[3/6] 自动比对验证规则生效")
try:
    print("  3.1 调用 /api/compare/all")
    response = client.post("/api/compare/all")
    print(f"      状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        total_compared = data.get("total", 0)
        results = data.get("results", [])
        print(f"      比对结果: 共 {total_compared} 条")
        
        print("  3.2 验证 CLAIM001")
        claim001 = next((r for r in results if r.get("claim_id") == "CLAIM001"), None)
        if claim001:
            print(f"      suggested_amount: {claim001.get('suggested_amount')}")
            print(f"      applicable_rules: {len(claim001.get('applicable_rules', []))} 条")
            print(f"      explanation: {len(claim001.get('explanation', ''))} 字符")
        else:
            print("      未找到 CLAIM001")
            
except Exception as e:
    print(f"  ERROR: {str(e)}")
    import traceback
    traceback.print_exc()

print("\n[4/6] 人工复核")
try:
    print("  4.1 复核 CLAIM001")
    response = client.post(
        "/api/review/CLAIM001",
        data={
            "reviewer": "测试审核员",
            "status": "approved",
            "reviewed_amount": 999,
            "review_notes": "审核通过",
            "adjustment_reason": ""
        }
    )
    print(f"      状态码: {response.status_code}")
    
    print("  4.2 验证结果")
    response = client.get("/api/comparisons/CLAIM001")
    if response.status_code == 200:
        data = response.json()
        result = data.get("result", {})
        print(f"      final_status: {result.get('final_status')}")
        print(f"      final_amount: {result.get('final_amount')}")
        
except Exception as e:
    print(f"  ERROR: {str(e)}")
    import traceback
    traceback.print_exc()

print("\n[5/6] 统计汇总验证同步")
try:
    print("  5.1 调用 /api/statistics/summary")
    response = client.get("/api/statistics/summary")
    print(f"      状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        summary = data.get("summary", {})
        print(f"      total_claimed_amount: {summary.get('total_claimed_amount')}")
        print(f"      total_approved_amount: {summary.get('total_approved_amount')}")
        
except Exception as e:
    print(f"  ERROR: {str(e)}")
    import traceback
    traceback.print_exc()

print("\n[6/6] 导出报告验证")
try:
    print("  6.1 调用 /api/export/csv")
    response = client.get("/api/export/csv")
    print(f"      状态码: {response.status_code}")
    print(f"      文件大小: {len(response.content)} 字节")
    if len(response.content) > 0:
        content_text = response.content.decode('utf-8-sig')
        print(f"      包含 CLAIM001: {'CLAIM001' in content_text}")
        print(f"      包含 999: {'999' in content_text}")
    
    print("  6.2 调用 /api/export/excel")
    response = client.get("/api/export/excel")
    print(f"      状态码: {response.status_code}")
    print(f"      文件大小: {len(response.content)} 字节")
        
except Exception as e:
    print(f"  ERROR: {str(e)}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 80)
print("测试完成")
print("=" * 80)
