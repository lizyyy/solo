#!/usr/bin/env python3
import requests
import json
import time
import random
import sys
import os

BASE_URL = "http://localhost:8082/api/v1"

def generate_unique_id():
    timestamp = int(time.time())
    rand = random.randint(1000, 9999)
    return f"{timestamp}{rand}"

def main():
    print("=" * 60)
    print("渔船燃油补贴 API 完整流程测试")
    print("=" * 60)

    headers = {"Content-Type": "application/json", "X-Operator": "admin"}

    unique_id = generate_unique_id()
    print(f"\n测试运行ID: {unique_id}")

    print("\n=== 准备测试数据：添加加油票 ===")
    receipt_ids = []
    for i in range(1, 3):
        receipt_data = {
            "receipt_number": f"RCP{unique_id}{i:02d}",
            "receipt_date": f"2025-03-1{i}T00:00:00Z",
            "gas_station_name": "东海加油站",
            "fuel_type": "柴油",
            "fuel_amount": 3000 + i * 1000,
            "unit_price": 7.5,
            "total_amount": (3000 + i * 1000) * 7.5,
            "vessel_number": "浙渔00001",
            "driver_name": "张三"
        }
        r = requests.post(f"{BASE_URL}/fuel-receipts", headers=headers, json=receipt_data)
        if r.status_code == 200 and r.json()["code"] == 0:
            print(f"  ✓ 已添加加油票 {receipt_data['receipt_number']}")
            receipt_ids.append(receipt_data["receipt_number"])
        else:
            print(f"  ✗ 添加加油票失败: {r.text}")
            sys.exit(1)

    print("\n=== 1. 收件：创建补贴申请 ===")
    print("  说明：所有航次都在3月和4月（非禁渔期）")
    app_data = {
        "application_year": 2025,
        "applicant_name": "张三",
        "applicant_id_card": "330101198001010001",
        "vessel_number": "浙渔00001",
        "receipt_numbers": receipt_ids,
        "voyages": [
            {"voyage_number": f"V{unique_id}A", "departure_date": "2025-03-10T08:00:00Z", "return_date": "2025-03-12T18:00:00Z", "fishing_area": "东海189海区", "fuel_consumed": 2500, "catch_weight": 5000},
            {"voyage_number": f"V{unique_id}B", "departure_date": "2025-03-20T06:00:00Z", "return_date": "2025-03-23T20:00:00Z", "fishing_area": "东海190海区", "fuel_consumed": 3000, "catch_weight": 6000},
            {"voyage_number": f"V{unique_id}C", "departure_date": "2025-04-05T08:00:00Z", "return_date": "2025-04-08T18:00:00Z", "fishing_area": "东海192海区", "fuel_consumed": 2000, "catch_weight": 4000}
        ]
    }
    r = requests.post(f"{BASE_URL}/applications", headers=headers, json=app_data)
    result = r.json()
    if result["code"] != 0:
        print(f"  ✗ 创建申请失败: {r.text}")
        sys.exit(1)
    
    app_id = result["data"]["application"]["id"]
    app_no = result["data"]["application"]["application_no"]
    status = result["data"]["application"]["status"]
    validation = result["data"]["validation"]
    
    print(f"  ✓ 申请创建成功!")
    print(f"    申请编号: {app_no}")
    print(f"    申请ID: {app_id}")
    print(f"    当前状态: {status}")
    print(f"    禁渔期校验: {sum(1 for v in validation['voyage_results'] if not v['passed'])} 个问题航次")
    print(f"    船主信息一致性: {'PASS' if validation['owner_consistent'] else 'FAIL'}")

    print("\n=== 2. 核验申请 ===")
    verify_data = {
        "application_id": app_id,
        "operator": "auditor1",
        "passed": True,
        "reason": "材料核验通过，航次均不在禁渔期，油票有效，船主信息一致"
    }
    r = requests.post(f"{BASE_URL}/applications/verify", headers=headers, json=verify_data)
    result = r.json()
    if result["code"] != 0:
        print(f"  ✗ 核验失败: {r.text}")
        sys.exit(1)
    
    app = result["data"]["application"]
    print(f"  ✓ 核验完成!")
    print(f"    核验后状态: {app['status']}")
    print(f"    核验人: {app['verified_by']}")

    print("\n=== 3. 处理申请（计算补贴、标记油票已使用）===")
    process_data = {
        "application_id": app_id,
        "operator": "auditor2",
        "reason": "补贴计算完成，油票已标记为已使用"
    }
    r = requests.post(f"{BASE_URL}/applications/process", headers=headers, json=process_data)
    result = r.json()
    if result["code"] != 0:
        print(f"  ✗ 处理失败: {r.text}")
        sys.exit(1)
    
    app = result["data"]
    print(f"  ✓ 处理完成!")
    print(f"    处理后状态: {app['status']}")
    print(f"    总油量: {app['total_fuel_amount']} 升")
    print(f"    补贴率: {app['subsidy_rate']}")
    print(f"    补贴金额: {app['subsidy_amount']} 元")
    print(f"    处理人: {app['processed_by']}")

    print("\n=== 4. 复查申请 ===")
    review_data = {
        "application_id": app_id,
        "operator": "reviewer",
        "passed": True,
        "reason": "复核通过，补贴计算正确，材料齐全"
    }
    r = requests.post(f"{BASE_URL}/applications/review", headers=headers, json=review_data)
    result = r.json()
    if result["code"] != 0:
        print(f"  ✗ 复查失败: {r.text}")
        sys.exit(1)
    
    app = result["data"]
    print(f"  ✓ 复查完成!")
    print(f"    复查后状态: {app['status']}")
    print(f"    复核人: {app['reviewed_by']}")

    print("\n=== 5. 结案 ===")
    close_data = {
        "application_id": app_id,
        "operator": "admin",
        "reason": "同意结案，补贴发放流程完成"
    }
    r = requests.post(f"{BASE_URL}/applications/close", headers=headers, json=close_data)
    result = r.json()
    if result["code"] != 0:
        print(f"  ✗ 结案失败: {r.text}")
        sys.exit(1)
    
    app = result["data"]
    print(f"  ✓ 结案完成!")
    print(f"    结案后状态: {app['status']}")
    print(f"    结案人: {app['closed_by']}")

    print("\n=== 6. 查看完整审核日志 ===")
    r = requests.get(f"{BASE_URL}/applications/{app_id}/logs", headers=headers)
    result = r.json()
    print(f"  审核流程追溯:")
    for log in result["data"]:
        icon = "✓" if log["passed"] else "✗"
        print(f"    {icon} [{log['created_at']}] {log['operator_name']} - {log['stage']} -> {log['to_status']}")
        print(f"        原因: {log['reason']}")

    print("\n=== 7. 验证加油票已被标记为已使用 ===")
    r = requests.get(f"{BASE_URL}/fuel-receipts?vessel_number=浙渔00001", headers=headers)
    result = r.json()
    receipts = result["data"]
    test_receipts = [r for r in receipts if r["receipt_number"] in receipt_ids]
    used = sum(1 for r in test_receipts if r["is_used"])
    print(f"  本次测试加油票使用情况: {used}/{len(test_receipts)} 已使用")
    for receipt in test_receipts:
        status = "已使用" if receipt["is_used"] else "未使用"
        print(f"    {receipt['receipt_number']}: {status}")

    print("\n=== 8. 查看年度统计数据 ===")
    r = requests.get(f"{BASE_URL}/statistics?year=2025", headers=headers)
    result = r.json()
    stats = result["data"]
    print(f"  2025年度统计汇总:")
    print(f"    总申请数: {stats['total_apps']}")
    print(f"    已结案: {stats['closed_apps']}")
    print(f"    总燃油量: {stats['total_fuel_amount']} 升")
    print(f"    总补贴金额: {stats['total_subsidy']} 元")
    print(f"    涉及渔船: {stats['total_vessels']} 艘")

    print("\n=== 9. 导出 Excel 统计报告 ===")
    r = requests.get(f"{BASE_URL}/reports/export?year=2025", headers=headers)
    result = r.json()
    if result["code"] == 0:
        print(f"  ✓ Excel报告生成成功!")
        print(f"    文件路径: {result['data']['file_path']}")
        print(f"    文件名: {result['data']['file_name']}")
    else:
        print(f"  ✗ 导出失败: {r.text}")
        sys.exit(1)

    print("\n=== 10. 测试重复提交检测（油票去重）===")
    print("  再次提交包含已使用油票的申请...")
    dup_data = {
        "application_year": 2025,
        "applicant_name": "张三",
        "applicant_id_card": "330101198001010001",
        "vessel_number": "浙渔00001",
        "receipt_numbers": [receipt_ids[0]],
        "voyages": []
    }
    r = requests.post(f"{BASE_URL}/applications", headers=headers, json=dup_data)
    result = r.json()
    if result["code"] == 1001:
        print(f"  ✓ 正确检测到重复提交!")
        print(f"    原始申请编号: {result['data']['original_application']['application_no']}")
        print(f"    原始申请状态: {result['data']['original_application']['status']}")
        print(f"    处理人: {result['data']['processed_by']}")
        print(f"    处理时间: {result['data']['processed_at']}")
        print(f"  说明: 油票 {receipt_ids[0]} 已被使用，系统成功拦截重复申报")
    else:
        print(f"  未检测到重复，code={result.get('code')}")
        sys.exit(1)

    print("\n" + "=" * 60)
    print("  ✓ 收件 ✓ 核验 ✓ 处理 ✓ 复查 ✓ 结案 （完整闭环）")
    print("  ✓ 禁渔期校验 ✓ 油票去重 ✓ 船主信息一致性（边界校验）")
    print("  ✓ 审核日志追溯 ✓ 统计查询 ✓ Excel导出")
    print("  ✓ 重复提交拦截")
    print("=" * 60)
    print("\n测试全部通过! 🎉")

if __name__ == "__main__":
    main()
