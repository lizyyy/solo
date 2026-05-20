import json
import csv
from datetime import datetime, timedelta

def generate_sample_contract():
    contract = {
        "film_name": "流浪地球3",
        "film_code": "LDLQ-2024-001",
        "start_date": "2024-05-01T00:00:00",
        "end_date": "2024-05-31T23:59:59",
        "minimum_boxoffice": 50000,
        "subsidy_per_ticket": 5,
        "subsidy_daily_cap": 10000,
        "subsidy_total_cap": 200000,
        "refund_deduction_rate": 0.05,
        "boxoffice_share_rate": 0.43
    }
    
    with open("sample_contract.json", "w", encoding="utf-8") as f:
        json.dump(contract, f, ensure_ascii=False, indent=2)
    
    print("✅ 样例合同已生成: sample_contract.json")
    return contract

def generate_sample_sessions():
    base_date = datetime(2024, 5, 15)
    
    sessions = [
        {
            "session_code": "LDLQ-20240515-001",
            "film_name": "流浪地球3",
            "film_code": "LDLQ-2024-001",
            "hall_name": "1号厅",
            "show_time": (base_date + timedelta(hours=10)).strftime("%Y-%m-%d %H:%M:%S"),
            "end_time": (base_date + timedelta(hours=12, minutes=15)).strftime("%Y-%m-%d %H:%M:%S"),
            "scheduled_seats": 150,
            "ticket_price": 45
        },
        {
            "session_code": "LDLQ-20240515-002",
            "film_name": "流浪地球3",
            "film_code": "LDLQ-2024-001",
            "hall_name": "2号厅",
            "show_time": (base_date + timedelta(hours=14)).strftime("%Y-%m-%d %H:%M:%S"),
            "end_time": (base_date + timedelta(hours=16, minutes=15)).strftime("%Y-%m-%d %H:%M:%S"),
            "scheduled_seats": 200,
            "ticket_price": 45
        },
        {
            "session_code": "LDLQ-20240515-003",
            "film_name": "流浪地球3",
            "film_code": "LDLQ-2024-001",
            "hall_name": "1号厅",
            "show_time": (base_date + timedelta(hours=23)).strftime("%Y-%m-%d %H:%M:%S"),
            "end_time": (base_date + timedelta(hours=25, minutes=15)).strftime("%Y-%m-%d %H:%M:%S"),
            "scheduled_seats": 150,
            "ticket_price": 45
        },
        {
            "session_code": "LDLQ-20240516-001",
            "film_name": "流浪地球3",
            "film_code": "LDLQ-2024-001",
            "hall_name": "IMAX厅",
            "show_time": (base_date + timedelta(days=1, hours=13)).strftime("%Y-%m-%d %H:%M:%S"),
            "end_time": (base_date + timedelta(days=1, hours=15, minutes=15)).strftime("%Y-%m-%d %H:%M:%S"),
            "scheduled_seats": 300,
            "ticket_price": 80
        }
    ]
    
    with open("sample_sessions.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=sessions[0].keys())
        writer.writeheader()
        writer.writerows(sessions)
    
    print("✅ 样例场次已生成: sample_sessions.csv")
    return sessions

def generate_sample_boxoffice():
    base_date = datetime(2024, 5, 15)
    
    records = [
        {
            "session_code": "LDLQ-20240515-001",
            "film_name": "流浪地球3",
            "film_code": "LDLQ-2024-001",
            "show_time": (base_date + timedelta(hours=10)).strftime("%Y-%m-%d %H:%M:%S"),
            "tickets_sold": 145,
            "tickets_refunded": 5,
            "gross_boxoffice": 6525,
            "refund_amount": 225,
            "net_boxoffice": 6300,
            "service_fee": 435
        },
        {
            "session_code": "LDLQ-20240515-002",
            "film_name": "流浪地球3",
            "film_code": "LDLQ-2024-001",
            "show_time": (base_date + timedelta(hours=14)).strftime("%Y-%m-%d %H:%M:%S"),
            "tickets_sold": 198,
            "tickets_refunded": 2,
            "gross_boxoffice": 8910,
            "refund_amount": 90,
            "net_boxoffice": 8820,
            "service_fee": 594
        },
        {
            "session_code": "LDLQ-20240515-003",
            "film_name": "流浪地球3",
            "film_code": "LDLQ-2024-001",
            "show_time": (base_date + timedelta(hours=23)).strftime("%Y-%m-%d %H:%M:%S"),
            "tickets_sold": 120,
            "tickets_refunded": 10,
            "gross_boxoffice": 5400,
            "refund_amount": 450,
            "net_boxoffice": 4950,
            "service_fee": 360
        },
        {
            "session_code": "LDLQ-20240516-001",
            "film_name": "流浪地球3",
            "film_code": "LDLQ-2024-001",
            "show_time": (base_date + timedelta(days=1, hours=13)).strftime("%Y-%m-%d %H:%M:%S"),
            "tickets_sold": 280,
            "tickets_refunded": 15,
            "gross_boxoffice": 22400,
            "refund_amount": 1200,
            "net_boxoffice": 21200,
            "service_fee": 1680
        }
    ]
    
    data = {
        "generated_at": datetime.now().isoformat(),
        "records": records
    }
    
    with open("sample_boxoffice.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print("✅ 样例票房数据已生成: sample_boxoffice.json")
    return records

def generate_init_script():
    script = """import requests
import json

BASE_URL = "http://localhost:8000"

def print_response(title, response):
    print(f"\\n{'='*60}")
    print(f" {title}")
    print(f"{'='*60}")
    if response.status_code == 200:
        print(json.dumps(response.json(), ensure_ascii=False, indent=2))
    else:
        print(f"状态码: {response.status_code}")
        print(response.text)

print("开始初始化院线对账服务...")

try:
    print("\\n1️⃣ 创建影片合同")
    with open("sample_contract.json", "r", encoding="utf-8") as f:
        contract_data = json.load(f)
    response = requests.post(f"{BASE_URL}/api/contracts/", json=contract_data)
    print_response("创建合同结果", response)
    
    print("\\n2️⃣ 导入场次CSV")
    with open("sample_sessions.csv", "rb") as f:
        files = {"file": ("sample_sessions.csv", f, "text/csv")}
        response = requests.post(f"{BASE_URL}/api/sessions/import", files=files)
    print_response("导入场次结果", response)
    
    print("\\n3️⃣ 导入票房JSON")
    with open("sample_boxoffice.json", "rb") as f:
        files = {"file": ("sample_boxoffice.json", f, "application/json")}
        response = requests.post(f"{BASE_URL}/api/boxoffice/import", files=files)
    print_response("导入票房结果", response)
    
    print("\\n4️⃣ 执行自动对账")
    response = requests.post(f"{BASE_URL}/api/reconciliation/run")
    result = response.json()
    print_response("对账执行结果", response)
    
    batch_id = result.get("batch_id")
    if batch_id:
        print(f"\\n5️⃣ 获取对账记录 (批次: {batch_id})")
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
                print(f"\\n6️⃣ 复核有差异的场次 (ID: {disputed_record['id']})")
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
        
        print(f"\\n7️⃣ 导出对账报告")
        response = requests.get(f"{BASE_URL}/api/reports/export/{batch_id}", params={"format": "xlsx"})
        if response.status_code == 200:
            with open(f"reconciliation_report_{batch_id}.xlsx", "wb") as f:
                f.write(response.content)
            print(f"✅ 报告已保存: reconciliation_report_{batch_id}.xlsx")
        else:
            print(f"❌ 导出失败: {response.text}")

    print("\\n🎉 初始化完成！")
    print("\\n📋 样例数据说明:")
    print("  - 影片: 流浪地球3")
    print("  - 场次: 4场 (含1场跨日场次)")
    print("  - 补贴规则: 5元/张，单日上限10000元")
    print("  - 退票扣减: 5%费率")
    print("  - 最低票房承诺: 50000元")
    print("  - 包含1条需要人工复核的差异记录（跨日场次+补贴上限触发）")
    
except Exception as e:
    print(f"\\n❌ 错误: {e}")
    print("请确保服务已启动: uvicorn main:app --reload")
"""
    
    with open("init_demo.py", "w", encoding="utf-8") as f:
        f.write(script)
    
    print("✅ 初始化脚本已生成: init_demo.py")

if __name__ == "__main__":
    generate_sample_contract()
    generate_sample_sessions()
    generate_sample_boxoffice()
    generate_init_script()
    print("\\n🎯 所有样例数据生成完成！")
    print("\\n📖 使用步骤:")
    print("  1. 安装依赖: pip install -r requirements.txt")
    print("  2. 启动服务: uvicorn main:app --reload")
    print("  3. 运行初始化: python init_demo.py")
    print("  4. 访问文档: http://localhost:8000/docs")
