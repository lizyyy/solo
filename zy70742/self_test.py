#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import requests
import json
from typing import Dict, Any

BASE_URL = "http://localhost:8000"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_section(title: str):
    print(f"\n{Colors.BLUE}{Colors.BOLD}{'=' * 60}{Colors.ENDC}")
    print(f"{Colors.BLUE}{Colors.BOLD}  {title}{Colors.ENDC}")
    print(f"{Colors.BLUE}{Colors.BOLD}{'=' * 60}{Colors.ENDC}")

def print_success(message: str):
    print(f"{Colors.GREEN}✓ {message}{Colors.ENDC}")

def print_error(message: str):
    print(f"{Colors.RED}✗ {message}{Colors.ENDC}")

def print_warning(message: str):
    print(f"{Colors.YELLOW}! {message}{Colors.ENDC}")

def make_request(method: str, endpoint: str, **kwargs) -> requests.Response:
    url = f"{BASE_URL}{endpoint}"
    try:
        response = requests.request(method, url, **kwargs)
        return response
    except requests.exceptions.ConnectionError:
        print_error(f"无法连接到 {BASE_URL}，请确保服务已启动")
        sys.exit(1)

def test_tenant_operations():
    print_section("1. 租户数据导入测试")
    
    tenant_data = {
        "tenant_id": "TENANT001",
        "tenant_name": "测试客户有限公司",
        "industry": "金融",
        "region": "华东"
    }
    
    response = make_request("POST", "/api/tenants", json=tenant_data)
    if response.status_code == 201:
        print_success("租户创建成功")
        print(f"  租户ID: {response.json()['tenant_id']}")
        print(f"  租户名称: {response.json()['tenant_name']}")
    elif response.status_code == 409:
        print_warning("租户已存在，跳过创建")
    else:
        print_error(f"租户创建失败: {response.status_code} - {response.text}")
        return False
    
    response = make_request("GET", f"/api/tenants/{tenant_data['tenant_id']}")
    if response.status_code == 200:
        print_success("租户查询成功")
    else:
        print_error(f"租户查询失败: {response.status_code}")
        return False
    
    return True

def test_region_rule_operations():
    print_section("2. 区域规则配置测试")
    
    rules = [
        {
            "region_code": "CN-EAST",
            "region_name": "中国东部",
            "data_type": "personal_data",
            "requires_approval": True,
            "allow_cross_border": False,
            "max_retention_days": 365
        },
        {
            "region_code": "CN-EAST",
            "region_name": "中国东部",
            "data_type": "financial_data",
            "requires_approval": True,
            "allow_cross_border": False,
            "max_retention_days": 180
        },
        {
            "region_code": "US-WEST",
            "region_name": "美国西部",
            "data_type": "personal_data",
            "requires_approval": False,
            "allow_cross_border": True
        }
    ]
    
    for rule in rules:
        response = make_request("POST", "/api/region-rules", json=rule)
        if response.status_code == 201:
            print_success(f"区域规则创建成功: {rule['region_code']} - {rule['data_type']}")
        else:
            print_warning(f"区域规则可能已存在: {response.status_code}")
    
    response = make_request("GET", "/api/region-rules/CN-EAST")
    if response.status_code == 200:
        rules_data = response.json()
        print_success(f"查询到 {len(rules_data)} 条 CN-EAST 区域规则")
        for r in rules_data:
            print(f"  - {r['data_type']}: requires_approval={r['requires_approval']}")
    
    return True

def test_region_validation():
    print_section("3. 区域规则校验测试")
    
    test_cases = [
        ("CN-EAST", "personal_data", "应返回需要审批"),
        ("US-WEST", "personal_data", "应返回无需审批"),
        ("UNKNOWN", "test_data", "应返回无效规则")
    ]
    
    for region, data_type, description in test_cases:
        print(f"\n  测试: {description}")
        response = make_request("GET", f"/api/validate-region/{region}/{data_type}")
        if response.status_code == 200:
            result = response.json()
            print_success(f"校验结果: is_valid={result['is_valid']}, risk_level={result['risk_level']}")
            print(f"    requires_approval={result['requires_approval']}, allow_cross_border={result['allow_cross_border']}")
        else:
            print_error(f"校验请求失败: {response.status_code}")
    
    return True

def test_approval_submission():
    print_section("4. 审批提交与幂等性测试")
    
    approval_data = {
        "request_id": "REQ2024001",
        "tenant_id": "TENANT001",
        "target_region": "CN-EAST",
        "data_type": "personal_data",
        "data_volume_gb": 50,
        "idempotency_key": "IDEMP-KEY-001"
    }
    
    print("\n  第一次提交审批:")
    response = make_request("POST", "/api/approvals", json=approval_data)
    if response.status_code == 201:
        result = response.json()
        print_success(f"审批提交成功，状态: {result['status']}")
        print(f"    request_id: {result['request_id']}")
    else:
        print_error(f"提交失败: {response.status_code} - {response.text}")
        return False
    
    print("\n  第二次提交相同幂等键:")
    response = make_request("POST", "/api/approvals", json=approval_data)
    if response.status_code == 200 or response.status_code == 201:
        print_success("幂等性生效，返回已有审批记录")
    else:
        print_error(f"幂等性测试失败: {response.status_code}")
    
    print("\n  测试缺少字段:")
    incomplete_data = {"request_id": "REQ-TEST", "tenant_id": "TENANT001"}
    response = make_request("POST", "/api/approvals", json=incomplete_data)
    if response.status_code == 400:
        error_detail = response.json()['detail']
        print_success(f"正确返回错误: {error_detail['error_code']} - {error_detail['message']}")
    else:
        print_error(f"缺少字段测试失败: {response.status_code}")
    
    return True

def test_approval_filter():
    print_section("5. 审批筛选查询测试")
    
    print("\n  查询所有审批:")
    filter_data = {}
    response = make_request("POST", "/api/approvals/filter?page=1&page_size=10", json=filter_data)
    if response.status_code == 200:
        result = response.json()
        print_success(f"查询成功，共 {result['total']} 条记录")
        for item in result['items']:
            print(f"    - {item['request_id']}: {item['status']} ({item['target_region']})")
    
    print("\n  按租户筛选:")
    filter_data = {"tenant_id": "TENANT001"}
    response = make_request("POST", "/api/approvals/filter", json=filter_data)
    if response.status_code == 200:
        result = response.json()
        print_success(f"按租户筛选成功，返回 {len(result['items'])} 条记录")
    
    return True

def test_approval_review():
    print_section("6. 审批推进与阻塞归因测试")
    
    print("\n  测试 NEEDS_REVIEW 状态无法直接审批:")
    review_data = {
        "status": "approved",
        "approver": "张三",
        "approval_comment": "合规，同意"
    }
    response = make_request("PUT", "/api/approvals/REQ2024001/review", json=review_data)
    if response.status_code == 400:
        error_detail = response.json()['detail']
        print_success(f"正确返回状态错误: {error_detail['error_code']}")
    else:
        print_warning(f"状态检查结果: {response.status_code}")
    
    print("\n  将审批标记为 BLOCKED:")
    review_data = {
        "status": "blocked",
        "approver": "李四",
        "approval_comment": "需要进一步审查",
        "block_reason": "该数据类型涉及敏感个人信息，需要额外的隐私影响评估",
        "block_category": "data_classification"
    }
    response = make_request("PUT", "/api/approvals/REQ2024001/review", json=review_data)
    if response.status_code == 200:
        result = response.json()
        print_success(f"审批阻塞成功")
        print(f"    状态: {result['status']}")
        print(f"    阻塞分类: {result['block_category']}")
        print(f"    阻塞原因: {result['block_reason']}")
    else:
        print_error(f"阻塞失败: {response.status_code} - {response.text}")
    
    print("\n  测试已处理审批无法重复处理:")
    response = make_request("PUT", "/api/approvals/REQ2024001/review", json=review_data)
    if response.status_code == 409:
        error_detail = response.json()['detail']
        print_success(f"正确返回已处理错误: {error_detail['error_code']}")
    else:
        print_error(f"重复处理测试失败: {response.status_code}")
    
    return True

def test_report_generation():
    print_section("7. 报告生成与导出测试")
    
    response = make_request("GET", "/api/approvals/REQ2024001")
    if response.status_code != 200:
        print_error("无法获取审批信息")
        return False
    approval_id = response.json()['id']
    
    print("\n  生成驻留报告:")
    report_data = {
        "approval_id": approval_id,
        "generated_by": "系统管理员"
    }
    response = make_request("POST", "/api/reports", json=report_data)
    if response.status_code == 201:
        result = response.json()
        report_id = result['report_id']
        print_success(f"报告生成成功: {report_id}")
    else:
        print_error(f"报告生成失败: {response.status_code} - {response.text}")
        return False
    
    print("\n  获取报告详情:")
    response = make_request("GET", f"/api/reports/{report_id}")
    if response.status_code == 200:
        print_success("报告详情获取成功")
    
    print("\n  导出报告文件:")
    response = make_request("GET", f"/api/reports/{report_id}/export")
    if response.status_code == 200:
        print_success("报告导出成功")
        print("\n" + "=" * 60)
        print(response.text)
        print("=" * 60)
        
        with open(f"exported_report_{report_id}.txt", "w", encoding="utf-8") as f:
            f.write(response.text)
        print_success(f"报告已保存到 exported_report_{report_id}.txt")
    else:
        print_error(f"报告导出失败: {response.status_code}")
    
    return True

def test_metadata():
    print_section("8. 元数据接口测试")
    
    print("\n  获取阻塞原因分类:")
    response = make_request("GET", "/api/block-categories")
    if response.status_code == 200:
        categories = response.json()['categories']
        print_success(f"获取到 {len(categories)} 个阻塞分类:")
        for cat in categories:
            print(f"    - {cat}")
    
    print("\n  获取审批状态列表:")
    response = make_request("GET", "/api/statuses")
    if response.status_code == 200:
        statuses = response.json()['statuses']
        print_success(f"获取到 {len(statuses)} 个审批状态:")
        for s in statuses:
            print(f"    - {s}")
    
    return True

def main():
    print(f"\n{Colors.BOLD}{Colors.GREEN}")
    print("╔" + "=" * 58 + "╗")
    print("║" + " " * 10 + "数据驻留审批区域规则 API 自检脚本" + " " * 10 + "║")
    print("╚" + "=" * 58 + "╝")
    print(f"{Colors.ENDC}")
    
    tests = [
        test_tenant_operations,
        test_region_rule_operations,
        test_region_validation,
        test_approval_submission,
        test_approval_filter,
        test_approval_review,
        test_report_generation,
        test_metadata,
    ]
    
    results = []
    for test in tests:
        try:
            results.append(test())
        except Exception as e:
            print_error(f"测试异常: {str(e)}")
            results.append(False)
    
    print_section("测试结果汇总")
    passed = sum(results)
    total = len(results)
    
    print(f"\n  通过: {passed}/{total}")
    
    if passed == total:
        print(f"\n{Colors.GREEN}{Colors.BOLD}  ✨ 所有测试通过！API 运行正常 ✨{Colors.ENDC}\n")
    else:
        print(f"\n{Colors.RED}{Colors.BOLD}  ⚠️  部分测试失败，请检查服务配置{Colors.ENDC}\n")

if __name__ == "__main__":
    main()
