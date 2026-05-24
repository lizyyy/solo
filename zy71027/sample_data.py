import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000/api/v1"

def print_response(title, response):
    print(f"\n{'='*60}")
    print(f"{title}")
    print(f"{'='*60}")
    print(f"状态码: {response.status_code}")
    if response.status_code in [200, 201]:
        data = response.json()
        print(json.dumps(data, ensure_ascii=False, indent=2))
    else:
        print(f"错误: {response.text}")
    return response.json() if response.status_code in [200, 201] else None

def create_base_data():
    print("\n" + "="*60)
    print("创建基础数据...")
    print("="*60)
    
    drugs = [
        {"drug_code": "MZ001", "drug_name": "吗啡注射液", "drug_type": "麻醉药品", "specification": "10mg/支", "manufacturer": "制药厂A"},
        {"drug_code": "MZ002", "drug_name": "哌替啶注射液", "drug_type": "麻醉药品", "specification": "50mg/支", "manufacturer": "制药厂B"},
        {"drug_code": "JS001", "drug_name": "地西泮片", "drug_type": "精神药品", "specification": "2.5mg/片", "manufacturer": "制药厂C"},
    ]
    
    created_drugs = []
    for drug in drugs:
        response = requests.post(f"{BASE_URL}/drugs", json=drug)
        if response.status_code in [200, 201]:
            created_drugs.append(response.json())
            print(f"✓ 创建药品: {drug['drug_name']}")
    
    batches = [
        {"batch_no": "202401001", "drug_id": 1, "initial_quantity": 100, "current_quantity": 100, "unit": "支"},
        {"batch_no": "202401002", "drug_id": 1, "initial_quantity": 50, "current_quantity": 50, "unit": "支"},
        {"batch_no": "202401003", "drug_id": 2, "initial_quantity": 80, "current_quantity": 80, "unit": "支"},
    ]
    
    for batch in batches:
        response = requests.post(f"{BASE_URL}/batches", json=batch)
        if response.status_code in [200, 201]:
            print(f"✓ 创建批号: {batch['batch_no']}")
    
    prescriptions = [
        {"prescription_no": "CF202401001", "drug_id": 1, "batch_no": "202401001", "patient_name": "张三", "quantity": 5, "unit": "支", "doctor_name": "王医生"},
        {"prescription_no": "CF202401002", "drug_id": 1, "batch_no": "202401001", "patient_name": "李四", "quantity": 3, "unit": "支", "doctor_name": "李医生"},
        {"prescription_no": "CF202401003", "drug_id": 2, "batch_no": "202401003", "patient_name": "王五", "quantity": 2, "unit": "支", "doctor_name": "张医生"},
    ]
    
    for prescription in prescriptions:
        response = requests.post(f"{BASE_URL}/prescriptions", json=prescription)
        if response.status_code in [200, 201]:
            print(f"✓ 创建处方: {prescription['prescription_no']}")
    
    print("\n核验处方 CF202401001...")
    response = requests.post(f"{BASE_URL}/prescriptions/1/verify", json={"verified_by": "李药师"})
    if response.status_code in [200, 201]:
        print("✓ 处方 CF202401001 已核验")
    
    print("\n核验处方 CF202401003...")
    response = requests.post(f"{BASE_URL}/prescriptions/3/verify", json={"verified_by": "李药师"})
    if response.status_code in [200, 201]:
        print("✓ 处方 CF202401003 已核验")
    
    print("\n✓ 基础数据创建完成")

def demo_normal_flow():
    print("\n" + "="*60)
    print("场景一: 正常交接流程")
    print("="*60)
    
    print("\n1. 创建交接单...")
    handover_data = {
        "handover_no": "HJ202401001",
        "shift_type": "夜班",
        "from_nurse": "张护士",
        "to_nurse": "李护士",
        "items": [
            {
                "drug_id": 1,
                "batch_id": 1,
                "prescription_id": 1,
                "drug_name": "吗啡注射液",
                "batch_no": "202401001",
                "prescription_no": "CF202401001",
                "prescription_quantity": 5,
                "inventory_quantity": 5,
                "handover_quantity": 5,
                "unit": "支"
            }
        ]
    }
    response = requests.post(f"{BASE_URL}/handovers", json=handover_data)
    handover = print_response("创建交接单", response)
    
    if handover:
        handover_id = handover["id"]
        
        print("\n2. 提交交接单...")
        response = requests.post(f"{BASE_URL}/handovers/{handover_id}/submit")
        print_response("提交交接单", response)
        
        print("\n3. 第一签 (张护士)...")
        response = requests.post(f"{BASE_URL}/handovers/{handover_id}/first-sign", json={"signature": "张护士"})
        print_response("第一签", response)
        
        print("\n4. 第二签 (李护士)...")
        response = requests.post(f"{BASE_URL}/handovers/{handover_id}/second-sign", json={"signature": "李护士"})
        print_response("第二签", response)
        
        print("\n5. 审核核验 (王药师)...")
        response = requests.post(f"{BASE_URL}/handovers/{handover_id}/verify", json={"reviewer": "王药师"})
        print_response("审核核验", response)
        
        print("\n6. 完成交接...")
        response = requests.post(f"{BASE_URL}/handovers/{handover_id}/complete")
        print_response("完成交接", response)
        
        print("\n7. 查看追溯信息...")
        response = requests.get(f"{BASE_URL}/handovers/{handover_id}/trace")
        print_response("追溯信息", response)

def demo_conflict_flow():
    print("\n" + "="*60)
    print("场景二: 有冲突的交接流程 (处方未核验、数量不一致)")
    print("="*60)
    
    print("\n1. 创建有冲突的交接单...")
    handover_data = {
        "handover_no": "HJ202401002",
        "shift_type": "夜班",
        "from_nurse": "王护士",
        "to_nurse": "赵护士",
        "items": [
            {
                "drug_id": 1,
                "batch_id": 1,
                "prescription_id": 2,
                "drug_name": "吗啡注射液",
                "batch_no": "202401001",
                "prescription_no": "CF202401002",
                "prescription_quantity": 3,
                "inventory_quantity": 3,
                "handover_quantity": 5,
                "unit": "支"
            }
        ]
    }
    response = requests.post(f"{BASE_URL}/handovers", json=handover_data)
    handover = print_response("创建交接单", response)
    
    if handover:
        handover_id = handover["id"]
        
        print("\n2. 提交交接单 (自动检测到冲突)...")
        response = requests.post(f"{BASE_URL}/handovers/{handover_id}/submit")
        print_response("提交交接单", response)
        
        print("\n3. 查看差异报告...")
        response = requests.get(f"{BASE_URL}/discrepancies", params={"handover_id": handover_id})
        print_response("差异报告列表", response)

def demo_reject_flow():
    print("\n" + "="*60)
    print("场景三: 驳回后重新提交 (可查看上一轮驳回原因)")
    print("="*60)
    
    print("\n1. 创建交接单...")
    handover_data = {
        "handover_no": "HJ202401003",
        "shift_type": "夜班",
        "from_nurse": "刘护士",
        "to_nurse": "陈护士",
        "items": [
            {
                "drug_id": 2,
                "batch_id": 3,
                "prescription_id": 3,
                "drug_name": "哌替啶注射液",
                "batch_no": "202401003",
                "prescription_no": "CF202401003",
                "prescription_quantity": 2,
                "inventory_quantity": 2,
                "handover_quantity": 2,
                "unit": "支"
            }
        ]
    }
    response = requests.post(f"{BASE_URL}/handovers", json=handover_data)
    handover = print_response("创建交接单", response)
    
    if handover:
        handover_id = handover["id"]
        
        print("\n2. 提交交接单...")
        response = requests.post(f"{BASE_URL}/handovers/{handover_id}/submit")
        print_response("提交交接单", response)
        
        print("\n3. 第一签...")
        response = requests.post(f"{BASE_URL}/handovers/{handover_id}/first-sign", json={"signature": "刘护士"})
        print_response("第一签", response)
        
        print("\n4. 驳回交接单 (审核人发现问题)...")
        response = requests.post(f"{BASE_URL}/handovers/{handover_id}/reject", json={
            "reviewer": "周药师",
            "reject_reason": "批号与处方不符，请核对后重新提交"
        })
        print_response("驳回交接单", response)
        
        print("\n5. 重新提交 (关联上一轮交接单)...")
        handover_data2 = {
            "handover_no": "HJ202401003-R1",
            "shift_type": "夜班",
            "from_nurse": "刘护士",
            "to_nurse": "陈护士",
            "previous_handover_id": handover_id,
            "items": [
                {
                    "drug_id": 2,
                    "batch_id": 3,
                    "prescription_id": 3,
                    "drug_name": "哌替啶注射液",
                    "batch_no": "202401003",
                    "prescription_no": "CF202401003",
                    "prescription_quantity": 2,
                    "inventory_quantity": 2,
                    "handover_quantity": 2,
                    "unit": "支"
                }
            ]
        }
        response = requests.post(f"{BASE_URL}/handovers", json=handover_data2)
        handover2 = print_response("创建新交接单(重新提交)", response)
        
        if handover2:
            handover_id2 = handover2["id"]
            
            print("\n6. 查看新交接单详情 (包含上一轮驳回原因)...")
            response = requests.get(f"{BASE_URL}/handovers/{handover_id2}")
            detail = print_response("交接单详情", response)
            if detail and detail.get("previous_reject_reason"):
                print(f"\n✓ 上一轮驳回原因: {detail['previous_reject_reason']}")

def demo_withdraw_flow():
    print("\n" + "="*60)
    print("场景四: 撤回交接单")
    print("="*60)
    
    print("\n1. 创建交接单...")
    handover_data = {
        "handover_no": "HJ202401004",
        "shift_type": "夜班",
        "from_nurse": "孙护士",
        "to_nurse": "周护士",
        "items": [
            {
                "drug_id": 2,
                "batch_id": 3,
                "prescription_id": 3,
                "drug_name": "哌替啶注射液",
                "batch_no": "202401003",
                "prescription_no": "CF202401003",
                "prescription_quantity": 2,
                "inventory_quantity": 2,
                "handover_quantity": 2,
                "unit": "支"
            }
        ]
    }
    response = requests.post(f"{BASE_URL}/handovers", json=handover_data)
    handover = print_response("创建交接单", response)
    
    if handover:
        handover_id = handover["id"]
        
        print("\n2. 提交交接单...")
        response = requests.post(f"{BASE_URL}/handovers/{handover_id}/submit")
        print_response("提交交接单", response)
        
        print("\n3. 第一签...")
        response = requests.post(f"{BASE_URL}/handovers/{handover_id}/first-sign", json={"signature": "孙护士"})
        print_response("第一签", response)
        
        print("\n4. 撤回交接单 (发现有误)...")
        response = requests.post(f"{BASE_URL}/handovers/{handover_id}/withdraw", json={
            "operator": "孙护士",
            "reason": "发现数量统计有误，需要重新核对"
        })
        print_response("撤回交接单", response)
        
        print("\n5. 查看追溯信息...")
        response = requests.get(f"{BASE_URL}/handovers/{handover_id}/trace")
        print_response("追溯信息", response)

def demo_manual_fix_flow():
    print("\n" + "="*60)
    print("场景五: 人工修正后完成交接")
    print("="*60)
    
    print("\n1. 创建有问题的交接单...")
    handover_data = {
        "handover_no": "HJ202401005",
        "shift_type": "夜班",
        "from_nurse": "吴护士",
        "to_nurse": "郑护士",
        "items": [
            {
                "drug_id": 1,
                "batch_id": 1,
                "prescription_id": 2,
                "drug_name": "吗啡注射液",
                "batch_no": "202401001",
                "prescription_no": "CF202401002",
                "prescription_quantity": 3,
                "inventory_quantity": 3,
                "handover_quantity": 3,
                "unit": "支"
            }
        ]
    }
    response = requests.post(f"{BASE_URL}/handovers", json=handover_data)
    handover = print_response("创建交接单", response)
    
    if handover:
        handover_id = handover["id"]
        
        print("\n2. 提交交接单 (检测到处方未核验)...")
        response = requests.post(f"{BASE_URL}/handovers/{handover_id}/submit")
        print_response("提交交接单", response)
        
        print("\n3. 先核验处方 CF202401002...")
        response = requests.post(f"{BASE_URL}/prescriptions/2/verify", json={"verified_by": "赵药师"})
        print_response("核验处方", response)
        
        print("\n4. 人工修正交接单...")
        response = requests.post(f"{BASE_URL}/handovers/{handover_id}/manual-fix", json={
            "operator": "赵药师",
            "fix_description": "处方已核验，修正后数据一致",
            "items": [
                {
                    "drug_id": 1,
                    "batch_id": 1,
                    "prescription_id": 2,
                    "drug_name": "吗啡注射液",
                    "batch_no": "202401001",
                    "prescription_no": "CF202401002",
                    "prescription_quantity": 3,
                    "inventory_quantity": 3,
                    "handover_quantity": 3,
                    "unit": "支"
                }
            ]
        })
        print_response("人工修正", response)
        
        print("\n5. 核验并完成交接...")
        response = requests.post(f"{BASE_URL}/handovers/{handover_id}/verify", json={"reviewer": "赵药师"})
        print_response("审核核验", response)
        
        response = requests.post(f"{BASE_URL}/handovers/{handover_id}/complete")
        print_response("完成交接", response)

def demo_export():
    print("\n" + "="*60)
    print("场景六: 导出数据")
    print("="*60)
    
    print("\n1. 导出交接班记录 (Excel)...")
    response = requests.get(f"{BASE_URL}/export/handovers", params={"format": "excel"})
    if response.status_code == 200:
        with open("handovers_export.xlsx", "wb") as f:
            f.write(response.content)
        print("✓ 已导出到 handovers_export.xlsx")
    
    print("\n2. 导出差异报告 (CSV)...")
    response = requests.get(f"{BASE_URL}/export/discrepancies", params={"format": "csv"})
    if response.status_code == 200:
        with open("discrepancies_export.csv", "w", encoding="utf-8") as f:
            f.write(response.text)
        print("✓ 已导出到 discrepancies_export.csv")

def demo_list_queries():
    print("\n" + "="*60)
    print("场景七: 查询列表")
    print("="*60)
    
    print("\n1. 查询所有交接单...")
    response = requests.get(f"{BASE_URL}/handovers")
    data = print_response("交接单列表", response)
    
    if data:
        print(f"\n共 {len(data)} 条交接单记录")
        for h in data:
            print(f"  - {h['handover_no']}: {h['from_nurse']} → {h['to_nurse']} [{h['status']}]")
    
    print("\n2. 查询所有差异报告...")
    response = requests.get(f"{BASE_URL}/discrepancies")
    data = print_response("差异报告列表", response)
    
    if data:
        print(f"\n共 {len(data)} 条差异报告")

if __name__ == "__main__":
    print("管制药品交接 API - 测试样例演示")
    print("请确保服务已启动: uvicorn app.main:app --reload")
    print()
    
    try:
        response = requests.get("http://localhost:8000/health")
        if response.status_code != 200:
            print("❌ 服务未启动，请先启动服务后再运行测试脚本")
            exit(1)
    except:
        print("❌ 无法连接到服务，请先启动服务: uvicorn app.main:app --reload")
        exit(1)
    
    print("✓ 服务连接成功")
    
    create_base_data()
    
    demo_normal_flow()
    demo_conflict_flow()
    demo_reject_flow()
    demo_withdraw_flow()
    demo_manual_fix_flow()
    demo_export()
    demo_list_queries()
    
    print("\n" + "="*60)
    print("所有演示场景完成！")
    print("="*60)
    print("\nAPI 文档地址: http://localhost:8000/docs")
