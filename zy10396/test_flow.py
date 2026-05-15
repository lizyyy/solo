#!/usr/bin/env python3
import requests
import json
import time
from datetime import datetime

BASE_URL = "http://localhost:8000"


def print_section(title):
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)


def test_health_check():
    print_section("1. 健康检查")
    response = requests.get(f"{BASE_URL}/health")
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    return response.status_code == 200


def test_create_caller():
    print_section("2. 创建调用方")
    data = {
        "code": f"CALLER{int(time.time())}",
        "name": "电商平台",
        "description": "主站电商业务系统",
        "department": "技术部",
        "is_active": True
    }
    response = requests.post(f"{BASE_URL}/callers/", json=data)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"响应: {json.dumps(result, ensure_ascii=False, indent=2)}")
    return result.get("id")


def test_create_api_group():
    print_section("3. 创建接口组")
    data = {
        "code": f"APIGRP{int(time.time())}",
        "name": "用户接口组",
        "description": "用户相关的 API 接口",
        "category": "基础服务",
        "is_active": True
    }
    response = requests.post(f"{BASE_URL}/api-groups/", json=data)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"响应: {json.dumps(result, ensure_ascii=False, indent=2)}")
    return result.get("id")


def test_create_resource_price(api_group_id):
    print_section("4. 设置资源单价")
    data = {
        "api_group_id": api_group_id,
        "unit_price": 0.05,
        "currency": "CNY",
        "unit": "call",
        "effective_date": "2024-01-01T00:00:00",
        "is_active": True,
        "created_by": "admin"
    }
    response = requests.post(f"{BASE_URL}/resource-prices/", json=data)
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    return response.status_code == 200


def test_create_allocation_rule():
    print_section("5. 创建分摊规则")
    data = {
        "name": "默认分摊规则",
        "description": "按实际调用量比例分摊",
        "allocation_type": "proportional",
        "rounding_precision": 2,
        "effective_date": "2024-01-01T00:00:00",
        "is_active": True,
        "created_by": "admin"
    }
    response = requests.post(f"{BASE_URL}/allocation-rules/", json=data)
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"响应: {json.dumps(result, ensure_ascii=False, indent=2)}")
    return result.get("id")


def test_batch_call_records(caller_id, api_group_id, idempotency_key):
    print_section("6. 批量提交调用记录 (幂等测试)")
    data = {
        "records": [
            {
                "caller_id": caller_id,
                "api_group_id": api_group_id,
                "call_date": "2024-01-15T10:30:00",
                "call_count": 10000,
                "success_count": 9800,
                "fail_count": 200
            },
            {
                "caller_id": caller_id,
                "api_group_id": api_group_id,
                "call_date": "2024-01-16T14:20:00",
                "call_count": 5000,
                "success_count": 4950,
                "fail_count": 50
            }
        ],
        "idempotency_key": idempotency_key
    }
    headers = {"X-Idempotency-Key": idempotency_key}
    
    print("  第一次提交:")
    response1 = requests.post(f"{BASE_URL}/call-records/batch", json=data, headers=headers)
    print(f"  状态码: {response1.status_code}")
    print(f"  响应: {json.dumps(response1.json(), ensure_ascii=False, indent=2)}")
    
    print("\n  第二次提交 (测试幂等性，应该返回已处理):")
    response2 = requests.post(f"{BASE_URL}/call-records/batch", json=data, headers=headers)
    print(f"  状态码: {response2.status_code}")
    print(f"  响应: {json.dumps(response2.json(), ensure_ascii=False, indent=2)}")
    
    return True


def test_cost_trial(rule_id):
    print_section("7. 成本试算")
    data = {
        "month": "2024-01",
        "rule_id": rule_id
    }
    response = requests.post(f"{BASE_URL}/cost-trial", json=data)
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    return response.status_code == 200


def test_calculate_monthly(rule_id, idempotency_key):
    print_section("8. 计算月度分摊 (幂等测试)")
    data = {
        "month": "2024-01",
        "rule_id": rule_id,
        "idempotency_key": idempotency_key
    }
    
    print("  第一次计算:")
    response1 = requests.post(f"{BASE_URL}/monthly-results/calculate", json=data)
    print(f"  状态码: {response1.status_code}")
    print(f"  响应: {json.dumps(response1.json(), ensure_ascii=False, indent=2)}")
    
    print("\n  第二次计算 (测试幂等性):")
    response2 = requests.post(f"{BASE_URL}/monthly-results/calculate", json=data)
    print(f"  状态码: {response2.status_code}")
    print(f"  响应: {json.dumps(response2.json(), ensure_ascii=False, indent=2)}")
    
    return True


def test_query_monthly_results():
    print_section("9. 查询月度分摊结果")
    params = {
        "month": "2024-01",
        "page": 1,
        "page_size": 50
    }
    response = requests.get(f"{BASE_URL}/monthly-results/", params=params)
    print(f"状态码: {response.status_code}")
    results = response.json()
    print(f"找到 {len(results)} 条记录")
    if results:
        print(f"第一条: {json.dumps(results[0], ensure_ascii=False, indent=2)}")
        return results[0].get("id")
    return None


def test_validate_result(result_id):
    print_section("10. 校验分摊结果")
    response = requests.post(f"{BASE_URL}/monthly-results/{result_id}/validate")
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    return response.status_code == 200


def test_adjust_result(result_id):
    print_section("11. 调整分摊结果")
    data = {
        "adjustment_amount": -50.0,
        "adjustment_type": "discount",
        "reason": "月度优惠折扣",
        "created_by": "finance"
    }
    response = requests.post(f"{BASE_URL}/monthly-results/{result_id}/adjust", json=data)
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    return response.status_code == 200


def test_query_history():
    print_section("12. 历史查询")
    params = {
        "month": "2024-01",
        "status": "adjusted",
        "page": 1,
        "page_size": 10
    }
    response = requests.get(f"{BASE_URL}/history/monthly-results", params=params)
    print(f"状态码: {response.status_code}")
    results = response.json()
    print(f"找到 {len(results)} 条历史记录")
    return response.status_code == 200


def test_export(export_idempotency_key):
    print_section("13. 导出数据 (幂等测试)")
    data = {
        "month": "2024-01",
        "idempotency_key": export_idempotency_key,
        "format": "xlsx"
    }
    
    print("  第一次导出:")
    response1 = requests.post(f"{BASE_URL}/export/xlsx", json=data)
    print(f"  状态码: {response1.status_code}")
    if response1.status_code == 200:
        filename = f"cost_allocation_test_{int(time.time())}.xlsx"
        with open(filename, "wb") as f:
            f.write(response1.content)
        print(f"  文件已保存为: {filename}")
    else:
        print(f"  响应: {json.dumps(response1.json(), ensure_ascii=False, indent=2)}")
    
    print("\n  第二次导出 (测试幂等性，应该返回冲突):")
    response2 = requests.post(f"{BASE_URL}/export/xlsx", json=data)
    print(f"  状态码: {response2.status_code}")
    if response2.status_code != 200:
        print(f"  响应: {json.dumps(response2.json(), ensure_ascii=False, indent=2)}")
    
    return True


def main():
    print("""
╔══════════════════════════════════════════════════════════════╗
║           API 调用成本分摊服务 - 完整流程测试                  ║
╚══════════════════════════════════════════════════════════════╝
    """)
    
    timestamp = int(time.time())
    batch_idempotency = f"batch_test_{timestamp}"
    calc_idempotency = f"calc_test_{timestamp}"
    export_idempotency = f"export_test_{timestamp}"
    
    try:
        if not test_health_check():
            print("\n❌ 服务未启动，请先运行: uvicorn app.main:app --reload")
            return
        
        caller_id = test_create_caller()
        api_group_id = test_create_api_group()
        
        test_create_resource_price(api_group_id)
        rule_id = test_create_allocation_rule()
        
        test_batch_call_records(caller_id, api_group_id, batch_idempotency)
        test_cost_trial(rule_id)
        
        test_calculate_monthly(rule_id, calc_idempotency)
        
        result_id = test_query_monthly_results()
        
        if result_id:
            test_validate_result(result_id)
            test_adjust_result(result_id)
        
        test_query_history()
        test_export(export_idempotency)
        
        print("\n" + "="*60)
        print("  ✅ 所有测试完成！")
        print(f"  🌐 管理面板: {BASE_URL}/admin")
        print(f"  📚 API 文档: {BASE_URL}/docs")
        print("="*60)
        
    except requests.exceptions.ConnectionError:
        print("\n❌ 无法连接到服务，请先启动服务:")
        print("   uvicorn app.main:app --reload")
    except Exception as e:
        print(f"\n❌ 测试过程中发生错误: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
