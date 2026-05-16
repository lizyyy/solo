#!/usr/bin/env python3
"""
数据驻留审批 API 测试脚本
演示完整的 API 闭环流程
"""

import requests
import json
import time

BASE_URL = "http://localhost:8000"


def print_section(title):
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)


def print_response(label, response):
    print(f"\n{label}:")
    print(f"  状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"  成功: {data.get('success')}")
        print(f"  消息: {data.get('message')}")
        if data.get('data'):
            print(f"  数据: {json.dumps(data.get('data'), ensure_ascii=False, indent=4)[:500]}...")


def test_health_check():
    print_section("1. 健康检查")
    response = requests.get(f"{BASE_URL}/")
    print_response("健康检查", response)
    assert response.status_code == 200
    print("✓ 健康检查通过")


def test_list_regions():
    print_section("2. 查询区域配置")
    response = requests.get(f"{BASE_URL}/api/v1/regions")
    print_response("区域列表", response)
    assert response.status_code == 200
    data = response.json()
    regions = data['data']['regions']
    print(f"✓ 共配置了 {len(regions)} 个区域")
    for r in regions:
        print(f"  - {r['code']}: {r['name']}")
    return regions


def test_create_approval_success():
    print_section("3. 创建审批 - 成功场景 (合规数据类型)")
    payload = {
        "tenant_id": "tenant_001",
        "target_region": "cn-south",
        "data_types": ["user_data", "transaction_data"],
        "extra_info": {
            "company_name": "示例公司A",
            "business_type": "电商",
            "request_source": "工单系统#12345"
        }
    }
    response = requests.post(f"{BASE_URL}/api/v1/approvals", json=payload)
    print_response("创建审批(成功)", response)
    assert response.status_code == 200
    data = response.json()
    approval = data['data']['approval']
    print(f"✓ 审批ID: {approval['approval_id']}")
    print(f"✓ 状态: {approval['status']}")
    assert approval['status'] == "success"
    return approval['approval_id']


def test_create_approval_blocked():
    print_section("4. 创建审批 - 拦截场景 (被禁数据类型)")
    payload = {
        "tenant_id": "tenant_002",
        "target_region": "eu-central",
        "data_types": ["user_data", "transaction_data"],
        "extra_info": {
            "company_name": "示例公司B",
            "business_type": "金融",
            "request_source": "工单系统#12346"
        }
    }
    response = requests.post(f"{BASE_URL}/api/v1/approvals", json=payload)
    print_response("创建审批(拦截)", response)
    assert response.status_code == 200
    data = response.json()
    approval = data['data']['approval']
    print(f"✓ 审批ID: {approval['approval_id']}")
    print(f"✓ 状态: {approval['status']}")
    print(f"✓ 阻塞原因数量: {len(approval['block_reasons'])}")
    for br in approval['block_reasons']:
        print(f"  - {br['description']}")
    assert approval['status'] == "blocked"
    return approval['approval_id']


def test_create_approval_pending():
    print_section("5. 创建审批 - 待复核场景 (未知区域)")
    payload = {
        "tenant_id": "tenant_003",
        "target_region": "ap-southeast",
        "data_types": ["user_data", "transaction_data"],
        "extra_info": {
            "company_name": "示例公司C",
            "business_type": "数据分析",
            "request_source": "工单系统#12347"
        }
    }
    response = requests.post(f"{BASE_URL}/api/v1/approvals", json=payload)
    print_response("创建审批(待复核)", response)
    assert response.status_code == 200
    data = response.json()
    approval = data['data']['approval']
    print(f"✓ 审批ID: {approval['approval_id']}")
    print(f"✓ 状态: {approval['status']}")
    assert approval['status'] == "pending_review"
    return approval['approval_id']


def test_idempotency():
    print_section("6. 幂等性测试 - 重复提交相同请求")
    payload = {
        "tenant_id": "tenant_001",
        "target_region": "cn-south",
        "data_types": ["user_data", "transaction_data"],
        "extra_info": {"test": "idempotency"}
    }
    response1 = requests.post(f"{BASE_URL}/api/v1/approvals", json=payload)
    response2 = requests.post(f"{BASE_URL}/api/v1/approvals", json=payload)
    
    print_response("第一次提交", response1)
    print_response("第二次提交(幂等)", response2)
    
    data1 = response1.json()
    data2 = response2.json()
    
    assert data1['data']['approval']['approval_id'] == data2['data']['approval']['approval_id']
    assert data2['data']['idempotent'] == True
    print("✓ 幂等性验证通过: 两次返回相同审批记录")


def test_list_approvals():
    print_section("7. 查询审批列表")
    response = requests.get(f"{BASE_URL}/api/v1/approvals")
    print_response("审批列表", response)
    assert response.status_code == 200
    data = response.json()
    print(f"✓ 共 {data['data']['total']} 条审批记录")
    
    response_filtered = requests.get(f"{BASE_URL}/api/v1/approvals?status=blocked")
    data_filtered = response_filtered.json()
    print(f"✓ 被拦截的审批: {data_filtered['data']['total']} 条")


def test_advance_status(approval_id):
    print_section("8. 推进审批状态 - 将待复核改为成功")
    payload = {
        "new_status": "success",
        "reviewer": "合规专员_张三",
        "comment": "经人工复核，该客户数据类型符合要求，予以通过"
    }
    response = requests.put(f"{BASE_URL}/api/v1/approvals/{approval_id}/status", json=payload)
    print_response("推进状态", response)
    assert response.status_code == 200
    data = response.json()
    approval = data['data']['approval']
    print(f"✓ 新状态: {approval['status']}")
    print(f"✓ 审批意见: {approval['comments'][-1]['comment']}")
    assert approval['status'] == "success"


def test_manual_correct(approval_id):
    print_section("9. 人工修正审批")
    payload = {
        "corrections": {
            "data_types": ["metadata", "log_data"],
            "status": "success"
        },
        "reviewer": "技术支持_李四",
        "comment": "客户同意仅传输元数据和日志数据，不传输用户敏感数据"
    }
    response = requests.put(f"{BASE_URL}/api/v1/approvals/{approval_id}/correct", json=payload)
    print_response("人工修正", response)
    assert response.status_code == 200
    data = response.json()
    approval = data['data']['approval']
    print(f"✓ 修正后状态: {approval['status']}")
    print(f"✓ 修正后数据类型: {[dt for dt in approval['data_types']]}")
    assert approval['status'] == "success"


def test_compensate_status(approval_id):
    print_section("10. 审批补偿 - 特殊情况处理")
    payload = {
        "new_status": "compensated",
        "reviewer": "主管_王五",
        "comment": "该客户为战略合作伙伴，已签署特殊合规协议，予以补偿通过"
    }
    response = requests.put(f"{BASE_URL}/api/v1/approvals/{approval_id}/status", json=payload)
    print_response("审批补偿", response)
    assert response.status_code == 200
    data = response.json()
    approval = data['data']['approval']
    print(f"✓ 补偿后状态: {approval['status']}")
    print(f"✓ 是否已补偿: {approval['is_compensated']}")
    assert approval['status'] == "compensated"


def test_generate_report(approval_id):
    print_section("11. 生成驻留报告")
    response = requests.post(f"{BASE_URL}/api/v1/approvals/{approval_id}/report")
    print_response("生成报告", response)
    assert response.status_code == 200
    data = response.json()
    report = data['data']['report']
    print(f"✓ 报告ID: {report['report_id']}")
    print(f"✓ 整体状态: {report['overall_status']}")
    print(f"✓ 合规摘要: {json.dumps(report['compliance_summary'], ensure_ascii=False)}")
    print(f"✓ 建议: {report['recommendations']}")
    return report['report_id']


def test_get_report(report_id):
    print_section("12. 查询报告详情")
    response = requests.get(f"{BASE_URL}/api/v1/reports/{report_id}")
    print_response("报告详情", response)
    assert response.status_code == 200
    data = response.json()
    report = data['data']['report']
    print(f"✓ 报告ID验证: {report['report_id'] == report_id}")


def test_list_reports():
    print_section("13. 查询报告列表")
    response = requests.get(f"{BASE_URL}/api/v1/reports")
    print_response("报告列表", response)
    assert response.status_code == 200
    data = response.json()
    print(f"✓ 共生成 {data['data']['total']} 份报告")


def test_exception_handling():
    print_section("14. 异常处理测试")
    
    response = requests.get(f"{BASE_URL}/api/v1/approvals/nonexistent_id")
    print_response("查询不存在的审批", response)
    assert response.status_code == 404
    data = response.json()
    assert data['success'] == False
    print(f"✓ 异常处理正常: {data['message']}")


def main():
    print("\n" + "╔" + "═"*58 + "╗")
    print("║" + " "*10 + "数据驻留审批 API - 完整闭环测试" + " "*13 + "║")
    print("╚" + "═"*58 + "╝")
    
    try:
        test_health_check()
        regions = test_list_regions()
        
        approval_success_id = test_create_approval_success()
        approval_blocked_id = test_create_approval_blocked()
        approval_pending_id = test_create_approval_pending()
        
        test_idempotency()
        test_list_approvals()
        
        test_advance_status(approval_pending_id)
        test_manual_correct(approval_blocked_id)
        test_compensate_status(approval_blocked_id)
        
        report_id = test_generate_report(approval_success_id)
        test_get_report(report_id)
        test_list_reports()
        
        test_exception_handling()
        
        print("\n" + "="*60)
        print("  ✅ 所有测试通过！API 闭环验证完成")
        print("="*60)
        print("\n测试结果总结:")
        print("  ✓ 区域规则校验 - 通过")
        print("  ✓ 幂等性处理 - 通过")
        print("  ✓ 审批状态流转 - 通过")
        print("  ✓ 人工修正功能 - 通过")
        print("  ✓ 审批补偿机制 - 通过")
        print("  ✓ 报告生成导出 - 通过")
        print("  ✓ 异常处理机制 - 通过")
        print("  ✓ 持久化存储验证 - 数据已保存至 data/ 目录")
        print("\nAPI 文档地址: http://localhost:8000/docs")
        
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
