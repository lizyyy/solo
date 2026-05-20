import requests
import json

BASE_URL = "http://localhost:8000"

def print_response(title, response):
    print(f"\n{'='*60}")
    print(f" {title}")
    print(f"{'='*60}")
    if response.status_code == 200:
        print(json.dumps(response.json(), ensure_ascii=False, indent=2))
    else:
        print(f"状态码: {response.status_code}")
        print(response.text)

print("开始初始化院线对账服务...")

try:
    print("\n1️⃣ 创建影片合同")
    with open("sample_contract.json", "r", encoding="utf-8") as f:
        contract_data = json.load(f)
    response = requests.post(f"{BASE_URL}/api/contracts/", json=contract_data)
    print_response("创建合同结果", response)
    
    print("\n2️⃣ 导入场次CSV")
    with open("sample_sessions.csv", "rb") as f:
        files = {"file": ("sample_sessions.csv", f, "text/csv")}
        response = requests.post(f"{BASE_URL}/api/sessions/import", files=files)
    print_response("导入场次结果", response)
    
    print("\n3️⃣ 导入票房JSON")
    with open("sample_boxoffice.json", "rb") as f:
        files = {"file": ("sample_boxoffice.json", f, "application/json")}
        response = requests.post(f"{BASE_URL}/api/boxoffice/import", files=files)
    print_response("导入票房结果", response)
    
    print("\n4️⃣ 执行自动对账")
    response = requests.post(f"{BASE_URL}/api/reconciliation/run")
    result = response.json()
    print_response("对账执行结果", response)
    
    batch_id = result.get("batch_id")
    if batch_id:
        print(f"\n5️⃣ 获取对账记录 (批次: {batch_id})")
        response = requests.get(f"{BASE_URL}/api/reconciliation/records", params={"batch_id": batch_id})
        records = response.json()
        print_response("对账记录列表", response)
        
        if records:
            disputed_record = None
            for r in records:
                if r["status"] == "disputed":
                    disputed_record = r
                    break
            
            if disputed_record:
                print(f"\n6️⃣ 复核有差异的场次 (ID: {disputed_record['id']})")
                review_data = {
                    "status": "approved",
                    "reviewer": "张三",
                    "notes": "经核实，跨日场次符合合同约定，补贴上限计算正确，退票扣减无误。予以通过。",
                    "discrepancy_explanation": "本场次为跨日零点场，实际放映时间跨越5月15日和5月16日，按合同约定计算补贴上限；退票10张扣减22.5元符合5%费率。"
                }
                response = requests.post(
                    f"{BASE_URL}/api/reconciliation/records/{disputed_record['id']}/review",
                    json=review_data
                )
                print_response("复核结果", response)
        
        print(f"\n7️⃣ 导出对账报告")
        response = requests.get(f"{BASE_URL}/api/reports/export/{batch_id}", params={"format": "xlsx"})
        if response.status_code == 200:
            with open(f"reconciliation_report_{batch_id}.xlsx", "wb") as f:
                f.write(response.content)
            print(f"✅ 报告已保存: reconciliation_report_{batch_id}.xlsx")
        else:
            print(f"❌ 导出失败: {response.text}")

    print("\n🎉 初始化完成！")
    print("\n📋 样例数据说明:")
    print("  - 影片: 流浪地球3")
    print("  - 场次: 4场 (含1场跨日场次)")
    print("  - 补贴规则: 5元/张，单日上限10000元")
    print("  - 退票扣减: 5%费率")
    print("  - 最低票房承诺: 50000元")
    print("  - 包含1条需要人工复核的差异记录（跨日场次+补贴上限触发）")
    
except Exception as e:
    print(f"\n❌ 错误: {e}")
    print("请确保服务已启动: uvicorn main:app --reload")
