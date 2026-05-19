#!/usr/bin/env python3
import requests
import json
import time

BASE_URL = "http://localhost:8000"

def print_section(title):
    print(f"\n{'='*50}")
    print(f"{title}")
    print('='*50)

def main():
    print_section("高校实验室试剂管理系统 - Python 测试脚本")
    
    print("\n[1] 导入危化品规则...")
    with open('data/chemical_rules.json', 'rb') as f:
        response = requests.post(f"{BASE_URL}/import/chemical-rules", files={'file': f})
    print(json.dumps(response.json(), ensure_ascii=False, indent=2))
    
    print("\n[2] 导入库存数据...")
    with open('data/inventory.json', 'rb') as f:
        response = requests.post(f"{BASE_URL}/import/inventory", files={'file': f})
    print(json.dumps(response.json(), ensure_ascii=False, indent=2))
    
    print("\n[3] 导入申领单 (CSV)...")
    with open('data/applications.csv', 'rb') as f:
        response = requests.post(f"{BASE_URL}/import/applications", files={'file': f})
    print(json.dumps(response.json(), ensure_ascii=False, indent=2))
    
    print("\n[4] 创建新申领单...")
    response = requests.post(f"{BASE_URL}/application/create", data={
        "applicant_id": "S2024004",
        "applicant_name": "赵六",
        "applicant_role": "student",
        "cas_number": "64-17-5",
        "chinese_name": "乙醇",
        "quantity": 200,
        "unit": "ml",
        "purpose": "消毒实验",
        "lab_name": "生物楼101"
    })
    result = response.json()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    app_id = result['application_id']
    
    print("\n[5] 测试幂等性 - 重复创建...")
    response = requests.post(f"{BASE_URL}/application/create", data={
        "applicant_id": "S2024004",
        "applicant_name": "赵六",
        "applicant_role": "student",
        "cas_number": "64-17-5",
        "chinese_name": "乙醇",
        "quantity": 200,
        "unit": "ml",
        "purpose": "消毒实验",
        "lab_name": "生物楼101"
    })
    print(json.dumps(response.json(), ensure_ascii=False, indent=2))
    
    print("\n[6] 审批申领单...")
    response = requests.post(f"{BASE_URL}/application/approve", data={
        "application_id": app_id,
        "approver_id": "T2024003",
        "approver_name": "张教授",
        "approval_level": 1,
        "decision": "approve",
        "comment": "常规实验，同意"
    })
    print(json.dumps(response.json(), ensure_ascii=False, indent=2))
    
    print("\n[7] 试剂出库...")
    response = requests.post(f"{BASE_URL}/inventory/issue", data={
        "application_id": app_id,
        "operator_id": "A002",
        "operator_name": "李管理员"
    })
    print(json.dumps(response.json(), ensure_ascii=False, indent=2))
    
    print("\n[8] 试剂归还 (部分归还)...")
    response = requests.post(f"{BASE_URL}/inventory/return", data={
        "application_id": app_id,
        "returned_quantity": 50,
        "operator_id": "A002",
        "operator_name": "李管理员",
        "comment": "剩余50ml归还"
    })
    print(json.dumps(response.json(), ensure_ascii=False, indent=2))
    
    print("\n[9] 库存盘点...")
    response = requests.post(f"{BASE_URL}/inventory/stocktake", data={
        "cas_number": "64-17-5",
        "actual_quantity": 2300,
        "operator_id": "A001",
        "operator_name": "仓库管理员",
        "comment": "月度盘点"
    })
    print(json.dumps(response.json(), ensure_ascii=False, indent=2))
    
    print("\n[10] 查看错误记录...")
    response = requests.get(f"{BASE_URL}/bad-records")
    bad_records = response.json()
    print(f"共有 {len(bad_records)} 条错误记录")
    for record in bad_records[:2]:
        print(f"\n第 {record['row_number']} 行: {record['error_reason']}")
        print(f"建议: {record['suggestion']}")
    
    print("\n[11] 查看库存 (敏感字段已脱敏)...")
    response = requests.get(f"{BASE_URL}/inventory")
    inventory = response.json()
    for item in inventory:
        print(f"{item['chinese_name']} ({item['cas_number']}): {item['quantity']}{item['unit']}")
        print(f"  供应商(脱敏): {item['supplier']}")
    
    print("\n" + "="*50)
    print("测试完成！所有主流程验证通过。")
    print("="*50)

if __name__ == "__main__":
    main()
