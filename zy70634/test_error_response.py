#!/usr/bin/env python3
"""
错误响应格式验证测试
验证缺字段时返回统一的 MISSING_FIELDS 错误码格式
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_order_missing_items():
    """测试创建订单缺少 items 字段"""
    print("测试1: 创建订单缺少 items 字段")
    invalid_order = {
        "order_code": "TEST-ERROR-001",
        "customer_name": "测试客户"
        # 缺少 items 字段
    }
    
    response = client.post("/api/orders/", json=invalid_order)
    print(f"  状态码: {response.status_code}")
    print(f"  响应: {response.json()}")
    
    assert response.status_code == 400, f"期望状态码 400，实际 {response.status_code}"
    data = response.json()
    assert "error_code" in data, "响应中缺少 error_code 字段"
    assert data["error_code"] == "MISSING_FIELDS", f"期望 MISSING_FIELDS，实际 {data['error_code']}"
    assert "message" in data, "响应中缺少 message 字段"
    assert "details" in data, "响应中缺少 details 字段"
    print("  ✅ 错误响应格式正确")
    return True

def test_order_missing_order_code():
    """测试创建订单缺少 order_code 字段"""
    print("\n测试2: 创建订单缺少 order_code 字段")
    invalid_order = {
        "customer_name": "测试客户",
        "items": [{"sku_code": "SKU001", "sku_name": "测试商品", "ordered_quantity": 1}]
    }
    
    response = client.post("/api/orders/", json=invalid_order)
    print(f"  状态码: {response.status_code}")
    print(f"  响应: {response.json()}")
    
    assert response.status_code == 400
    data = response.json()
    assert data["error_code"] == "MISSING_FIELDS"
    print("  ✅ 错误响应格式正确")
    return True

def test_wave_missing_order_codes():
    """测试创建波次缺少 order_codes 字段"""
    print("\n测试3: 创建波次缺少 order_codes 字段")
    invalid_wave = {
        "priority": 1
        # 缺少 order_codes 字段
    }
    
    response = client.post("/api/waves/", json=invalid_wave)
    print(f"  状态码: {response.status_code}")
    print(f"  响应: {response.json()}")
    
    assert response.status_code == 400
    data = response.json()
    assert data["error_code"] == "MISSING_FIELDS"
    print("  ✅ 错误响应格式正确")
    return True

def test_pick_task_missing_actual_quantity():
    """测试处理拣货任务缺少 actual_quantity 字段"""
    print("\n测试4: 处理拣货任务缺少 actual_quantity 字段")
    invalid_process = {
        "picker": "测试拣货员"
        # 缺少 actual_quantity 字段
    }
    
    response = client.post("/api/pick-tasks/1/process/", json=invalid_process)
    print(f"  状态码: {response.status_code}")
    print(f"  响应: {response.json()}")
    
    assert response.status_code == 400
    data = response.json()
    assert data["error_code"] == "MISSING_FIELDS"
    print("  ✅ 错误响应格式正确")
    return True

def test_invalid_field_value():
    """测试字段值不合法（如负数数量）"""
    print("\n测试5: 字段值不合法（负数数量）")
    invalid_order = {
        "order_code": "TEST-ERROR-002",
        "items": [{"sku_code": "SKU001", "sku_name": "测试商品", "ordered_quantity": -1}]
    }
    
    response = client.post("/api/orders/", json=invalid_order)
    print(f"  状态码: {response.status_code}")
    print(f"  响应: {response.json()}")
    
    assert response.status_code == 400
    data = response.json()
    assert "error_code" in data
    assert data["error_code"] == "INVALID_FIELDS"
    print("  ✅ 非法值响应格式正确")
    return True

def test_response_structure():
    """测试响应结构一致性"""
    print("\n测试6: 响应结构一致性验证")
    invalid_order = {"customer_name": "测试"}
    response = client.post("/api/orders/", json=invalid_order)
    data = response.json()
    
    required_fields = ["error_code", "message", "details"]
    for field in required_fields:
        assert field in data, f"响应缺少必需字段: {field}"
    
    print(f"  error_code: {data['error_code']}")
    print(f"  message: {data['message']}")
    print(f"  details 包含: {list(data['details'].keys())}")
    print("  ✅ 响应结构完整")
    return True

def run_all_tests():
    print("=" * 60)
    print("错误响应格式统一化验证测试")
    print("=" * 60)
    
    tests = [
        test_order_missing_items,
        test_order_missing_order_code,
        test_wave_missing_order_codes,
        test_pick_task_missing_actual_quantity,
        test_invalid_field_value,
        test_response_structure,
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
            print(f"  ❌ 测试异常: {e}")
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"测试结果: 通过 {passed} / {len(tests)}")
    
    if failed == 0:
        print("✅ 所有错误响应格式验证通过！")
        print("   - 缺字段返回 MISSING_FIELDS")
        print("   - 非法值返回 INVALID_FIELDS")
        print("   - 状态码统一为 400")
        print("   - 响应结构统一: {error_code, message, details}")
        return True
    else:
        print(f"❌ {failed} 个测试失败")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)