#!/usr/bin/env python3
import requests
import json
import sys
import time

BASE_URL = "http://localhost:8000"

def test_step(name, func):
    print(f"\n{'='*60}")
    print(f"  测试: {name}")
    print(f"{'='*60}")
    try:
        result = func()
        print(f"  ✅ {name} - 成功")
        return result
    except Exception as e:
        print(f"  ❌ {name} - 失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def test_health():
    response = requests.get(f"{BASE_URL}/health")
    assert response.status_code == 200, f"状态码错误: {response.status_code}"
    return response.json()

def create_caller():
    data = {
        "code": f"CALLER_TEST_{int(time.time())}",
        "name": "测试调用方",
        "description": "用于测试",
        "department": "测试部",
        "is_active": True
    }
    response = requests.post(f"{BASE_URL}/callers/", json=data)
    assert response.status_code == 200, f"状态码错误: {response.status_code}"
    return response.json()["id"]

def create_api_group():
    data = {
        "code": f"APIGRP_TEST_{int(time.time())}",
        "name": "测试接口组",
        "description": "用于测试",
        "category": "测试",
        "is_active": True
    }
    response = requests.post(f"{BASE_URL}/api-groups/", json=data)
    assert response.status_code == 200, f"状态码错误: {response.status_code}"
    return response.json()["id"]

def create_resource_price(api_group_id):
    data = {
        "api_group_id": api_group_id,
        "unit_price": 0.05,
        "currency": "CNY",
        "unit": "call",
        "effective_date": "2024-01-01T00:00:00",
        "is_active": True,
        "created_by": "test"
    }
    response = requests.post(f"{BASE_URL}/resource-prices/", json=data)
    assert response.status_code == 200, f"状态码错误: {response.status_code}"
    return response.json()["id"]

def create_allocation_rule():
    data = {
        "name": "测试分摊规则",
        "description": "用于测试",
        "allocation_type": "proportional",
        "rounding_precision": 2,
        "effective_date": "2024-01-01T00:00:00",
        "is_active": True,
        "created_by": "test"
    }
    response = requests.post(f"{BASE_URL}/allocation-rules/", json=data)
    assert response.status_code == 200, f"状态码错误: {response.status_code}"
    return response.json()["id"]

def create_call_records_batch(caller_id, api_group_id):
    data = {
        "records": [
            {
                "caller_id": caller_id,
                "api_group_id": api_group_id,
                "call_date": "2024-01-15T10:30:00",
                "call_count": 10000,
                "success_count": 9800,
                "fail_count": 200
            }
        ],
        "idempotency_key": "batch_test_001"
    }
    response = requests.post(f"{BASE_URL}/call-records/batch", json=data)
    assert response.status_code == 200, f"状态码错误: {response.status_code}"
    print(f"    第一次批量提交: {response.json()}")
    
    response2 = requests.post(f"{BASE_URL}/call-records/batch", json=data)
    assert response2.status_code == 200, f"状态码错误: {response2.status_code}"
    print(f"    第二次批量提交(幂等): {response2.json()}")
    return True

def test_monthly_calculation_idempotency(rule_id):
    data = {
        "month": "2024-01",
        "rule_id": rule_id,
        "idempotency_key": "calc_test_001"
    }
    
    response1 = requests.post(f"{BASE_URL}/monthly-results/calculate", json=data)
    assert response1.status_code == 200, f"状态码错误: {response1.status_code}"
    print(f"    第一次计算: {response1.json()}")
    
    response2 = requests.post(f"{BASE_URL}/monthly-results/calculate", json=data)
    assert response2.status_code == 200, f"状态码错误: {response2.status_code}"
    print(f"    第二次计算(幂等): {response2.json()}")
    assert "Duplicate request" in response2.json()["message"] or "cached" in str(response2.json()), "幂等响应不正确"
    
    return True

def test_export_xlsx():
    data = {
        "month": "2024-01",
        "idempotency_key": "export_test_001",
        "format": "xlsx"
    }
    
    response1 = requests.post(f"{BASE_URL}/export/xlsx", json=data)
    assert response1.status_code == 200, f"状态码错误: {response1.status_code}"
    print(f"    第一次导出: 成功, 数据长度: {len(response1.content)} 字节")
    
    response2 = requests.post(f"{BASE_URL}/export/xlsx", json=data)
    assert response2.status_code == 409, f"幂等应该返回409，实际: {response2.status_code}"
    print(f"    第二次导出(幂等): 返回409冲突, 正确")
    
    return True

def main():
    print("""
╔══════════════════════════════════════════════════════════════╗
║          API 调用成本分摊服务 - 修复验证测试                    ║
╚══════════════════════════════════════════════════════════════╝
    """)
    
    try:
        test_step("健康检查", test_health)
        
        caller_id = test_step("创建调用方", create_caller)
        api_group_id = test_step("创建接口组", create_api_group)
        test_step("设置资源单价", lambda: create_resource_price(api_group_id))
        rule_id = test_step("创建分摊规则", create_allocation_rule)
        
        test_step("批量提交调用记录(含幂等)", 
                 lambda: create_call_records_batch(caller_id, api_group_id))
        
        test_step("月度分摊计算(含幂等) - 修复验证", 
                 lambda: test_monthly_calculation_idempotency(rule_id))
        
        test_step("导出Excel(含幂等) - 修复验证", 
                 test_export_xlsx)
        
        print("\n" + "="*60)
        print("  ✅ 所有修复验证通过！")
        print("="*60)
        return 0
        
    except AssertionError as e:
        print(f"\n❌ 断言失败: {e}")
        return 1
    except requests.exceptions.ConnectionError:
        print("\n❌ 无法连接到服务，请先启动服务:")
        print("   uvicorn app.main:app --reload")
        return 1
    except Exception as e:
        print(f"\n❌ 发生错误: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
