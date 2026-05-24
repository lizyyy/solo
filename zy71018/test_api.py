import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:9000"


def test_health_check():
    print("1. 测试健康检查...")
    response = requests.get(f"{BASE_URL}/health")
    print(f"   状态码: {response.status_code}")
    print(f"   响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    return response.status_code == 200


def test_battery_types():
    print("\n2. 测试电池类型列表...")
    response = requests.get(f"{BASE_URL}/battery-types")
    print(f"   状态码: {response.status_code}")
    data = response.json()
    print(f"   电池类型数量: {len(data)}")
    if data:
        print(f"   第一个: {data[0]['code']} - {data[0]['name']}")
    return response.status_code == 200


def test_carriers():
    print("\n3. 测试承运商列表...")
    response = requests.get(f"{BASE_URL}/carriers")
    print(f"   状态码: {response.status_code}")
    data = response.json()
    print(f"   承运商数量: {len(data)}")
    if data:
        print(f"   第一个: {data[0]['code']} - {data[0]['name']}")
    return response.status_code == 200


def test_products():
    print("\n4. 测试商品列表...")
    response = requests.get(f"{BASE_URL}/products")
    print(f"   状态码: {response.status_code}")
    data = response.json()
    print(f"   商品数量: {len(data)}")
    if data:
        print(f"   第一个: {data[0]['sku']} - {data[0]['name']}")
    return response.status_code == 200


def test_declaration_workflow():
    print("\n5. 测试申报单完整工作流...")
    business_no = f"TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    # 获取有效的商品ID
    products_response = requests.get(f"{BASE_URL}/products")
    products = products_response.json()
    if len(products) < 2:
        print("       商品数据不足，跳过工作流测试")
        return True
    product_id_1 = products[0]["id"]
    product_id_2 = products[1]["id"]
    
    declaration_data = {
        "business_no": business_no,
        "warehouse_code": "WH001",
        "carrier_id": 1,
        "battery_type_id": 1,
        "destination_country": "US",
        "total_weight": "500g",
        "total_battery_count": 3,
        "applicant": "测试用户",
        "remarks": "测试申报单",
        "items": [
            {"product_id": product_id_1, "quantity": 2, "unit_price": "199.00"},
            {"product_id": product_id_2, "quantity": 1, "unit_price": "299.00"}
        ]
    }
    
    print(f"   5.1 创建申报单 (业务编号: {business_no})...")
    response = requests.post(
        f"{BASE_URL}/declarations/receive",
        json=declaration_data
    )
    print(f"       状态码: {response.status_code}")
    if response.status_code != 200:
        print(f"       错误: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
        return False
    declaration = response.json()
    declaration_id = declaration["id"]
    print(f"       申报单ID: {declaration_id}")
    print(f"       当前状态: {declaration['status']}")
    
    print(f"   5.2 提交申报单...")
    response = requests.post(
        f"{BASE_URL}/declarations/{declaration_id}/submit",
        params={"operator": "审核员A"}
    )
    print(f"       状态码: {response.status_code}")
    if response.status_code != 200:
        print(f"       响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    else:
        declaration = response.json()
        print(f"       新状态: {declaration['status']}")
    
    print(f"   5.3 进入审核...")
    response = requests.post(
        f"{BASE_URL}/declarations/{declaration_id}/review",
        json={"reviewer": "审核员A", "review_notes": "开始审核"}
    )
    print(f"       状态码: {response.status_code}")
    if response.status_code != 200:
        print(f"       响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    else:
        declaration = response.json()
        print(f"       新状态: {declaration['status']}")
    
    print(f"   5.4 进入处理...")
    response = requests.post(
        f"{BASE_URL}/declarations/{declaration_id}/process",
        json={"processor": "处理员B", "process_notes": "关务处理中"}
    )
    print(f"       状态码: {response.status_code}")
    if response.status_code != 200:
        print(f"       响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    else:
        declaration = response.json()
        print(f"       新状态: {declaration['status']}")
    
    print(f"   5.5 批准申报...")
    response = requests.post(
        f"{BASE_URL}/declarations/{declaration_id}/approve",
        params={"operator": "审批员C"}
    )
    print(f"       状态码: {response.status_code}")
    if response.status_code != 200:
        print(f"       响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    else:
        declaration = response.json()
        print(f"       新状态: {declaration['status']}")
        print(f"       申报编号: {declaration['declaration_no']}")
    
    print(f"   5.6 结案...")
    response = requests.post(
        f"{BASE_URL}/declarations/{declaration_id}/close",
        json={"closer": "结案员D", "close_notes": "流程完成，正常结案"}
    )
    print(f"       状态码: {response.status_code}")
    if response.status_code != 200:
        print(f"       响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    else:
        declaration = response.json()
        print(f"       最终状态: {declaration['status']}")
    
    print(f"   5.7 查看审计轨迹...")
    response = requests.get(f"{BASE_URL}/declarations/{declaration_id}/audit-trails")
    print(f"       状态码: {response.status_code}")
    trails = response.json()
    print(f"       轨迹数量: {len(trails)}")
    for trail in trails:
        print(f"         - {trail['created_at'][:19]}: {trail['action']} ({trail['from_status']} -> {trail['to_status']})")
    
    return True


def test_duplicate_check():
    print("\n6. 测试重复提交检测...")
    business_no = f"DUP-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    print(f"   6.1 第一次创建申报单...")
    declaration_data = {
        "business_no": business_no,
        "warehouse_code": "WH001",
        "carrier_id": 1,
        "battery_type_id": 1,
        "destination_country": "US",
        "total_weight": "500g",
        "total_battery_count": 3,
        "applicant": "测试用户",
        "items": []
    }
    response = requests.post(
        f"{BASE_URL}/declarations/receive",
        json=declaration_data
    )
    print(f"       状态码: {response.status_code}")
    
    print(f"   6.2 重复创建（业务编号相同）...")
    response = requests.post(
        f"{BASE_URL}/declarations/receive",
        json=declaration_data
    )
    print(f"       状态码: {response.status_code}")
    if response.status_code == 400:
        error = response.json()
        print(f"       错误类型: {error['error_type']}")
        print(f"       错误信息: {error['message']}")
    
    print(f"   6.3 检查重复接口...")
    response = requests.get(f"{BASE_URL}/declarations/{business_no}/check-duplicate")
    print(f"       状态码: {response.status_code}")
    data = response.json()
    print(f"       是否重复: {data['is_duplicate']}")
    print(f"       现有状态: {data.get('existing_status', 'N/A')}")
    
    return True


def test_validation():
    print("\n7. 测试验证接口...")
    
    print(f"   7.1 创建不完整的申报单...")
    business_no = f"VAL-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    declaration_data = {
        "business_no": business_no,
        "applicant": "测试用户",
        "items": []
    }
    response = requests.post(
        f"{BASE_URL}/declarations/receive",
        json=declaration_data
    )
    declaration_id = response.json()["id"]
    print(f"       申报单ID: {declaration_id}")
    
    print(f"   7.2 验证申报单...")
    response = requests.get(f"{BASE_URL}/declarations/{declaration_id}/validate")
    print(f"       状态码: {response.status_code}")
    data = response.json()
    print(f"       是否有效: {data['validation']['is_valid']}")
    print(f"       缺少材料: {data['validation']['missing_materials']}")
    print(f"       电池冲突: {data['validation']['battery_conflicts']}")
    print(f"       承运商违规: {data['validation']['carrier_violations']}")
    
    return True


def test_return_receipt():
    print("\n8. 测试退件回执...")
    
    print(f"   8.1 创建申报单...")
    business_no = f"RET-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    declaration_data = {
        "business_no": business_no,
        "warehouse_code": "WH001",
        "carrier_id": 1,
        "battery_type_id": 1,
        "destination_country": "US",
        "total_weight": "500g",
        "applicant": "测试用户",
        "items": []
    }
    response = requests.post(
        f"{BASE_URL}/declarations/receive",
        json=declaration_data
    )
    declaration_id = response.json()["id"]
    
    print(f"   8.2 创建退件回执...")
    receipt_data = {
        "declaration_id": declaration_id,
        "receipt_no": f"R{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "return_reason": "电池类型申报错误",
        "return_reason_code": "BATTERY_TYPE_ERROR",
        "detailed_reason": "实际为锂金属电池，申报为锂离子电池"
    }
    response = requests.post(
        f"{BASE_URL}/return-receipts",
        json=receipt_data
    )
    print(f"       状态码: {response.status_code}")
    receipt = response.json()
    print(f"       归因结果: {receipt['attributed_to']}")
    print(f"       归因备注: {receipt['attribution_notes']}")
    
    print(f"   8.3 手动调整归因...")
    response = requests.post(
        f"{BASE_URL}/return-receipts/{receipt['id']}/attribute",
        json={"attributed_to": "关务-人工复核确认", "attribution_notes": "需要补充MSDS报告"}
    )
    print(f"       状态码: {response.status_code}")
    print(f"       新归因: {response.json()['attributed_to']}")
    
    return True


def test_report_generation():
    print("\n9. 测试报告生成...")
    
    print(f"   9.1 创建申报单...")
    business_no = f"RPT-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    declaration_data = {
        "business_no": business_no,
        "warehouse_code": "WH001",
        "carrier_id": 1,
        "battery_type_id": 1,
        "destination_country": "US",
        "total_weight": "500g",
        "applicant": "测试用户",
        "items": []
    }
    response = requests.post(
        f"{BASE_URL}/declarations/receive",
        json=declaration_data
    )
    declaration_id = response.json()["id"]
    
    print(f"   9.2 生成报告...")
    response = requests.post(
        f"{BASE_URL}/declarations/{declaration_id}/reports/generate",
        params={"report_type": "FULL", "generated_by": "系统管理员"}
    )
    print(f"       状态码: {response.status_code}")
    if response.status_code == 200:
        report = response.json()
        print(f"       报告ID: {report['id']}")
        print(f"       报告类型: {report['report_type']}")
        print(f"       报告内容预览: {report['report_content'][:100]}...")
    
    return True


def test_status_transitions():
    print("\n10. 查看状态流转图...")
    response = requests.get(f"{BASE_URL}/status-transitions")
    data = response.json()
    print(f"    共 {len(data)} 个状态的流转规则:")
    for status, next_states in data.items():
        print(f"      {status} -> {', '.join(next_states) if next_states else '(终态)'}")
    return True


def main():
    print("=" * 60)
    print("跨境电池申报 API 测试套件")
    print("=" * 60)
    
    tests = [
        test_health_check,
        test_battery_types,
        test_carriers,
        test_products,
        test_declaration_workflow,
        test_duplicate_check,
        test_validation,
        test_return_receipt,
        test_report_generation,
        test_status_transitions,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"   测试异常: {e}")
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"测试完成: 通过 {passed}, 失败 {failed}")
    print("=" * 60)


if __name__ == "__main__":
    main()
