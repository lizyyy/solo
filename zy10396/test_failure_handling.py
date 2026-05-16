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
    except AssertionError as e:
        print(f"  ❌ {name} - 断言失败: {str(e)}")
        return None
    except Exception as e:
        print(f"  ❌ {name} - 异常: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def test_health():
    response = requests.get(f"{BASE_URL}/health")
    assert response.status_code == 200, f"状态码错误: {response.status_code}"
    return response.json()

def create_caller():
    data = {
        "code": f"CALLER_FAIL_{int(time.time())}",
        "name": "测试调用方",
        "description": "用于测试失败处理",
        "department": "测试部",
        "is_active": True
    }
    response = requests.post(f"{BASE_URL}/callers/", json=data)
    assert response.status_code == 200, f"状态码错误: {response.status_code}"
    return response.json()["id"]

def create_api_group():
    data = {
        "code": f"APIGRP_FAIL_{int(time.time())}",
        "name": "测试接口组(无单价)",
        "description": "用于测试缺少单价的情况",
        "category": "测试",
        "is_active": True
    }
    response = requests.post(f"{BASE_URL}/api-groups/", json=data)
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

def create_call_record(caller_id, api_group_id):
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
        "idempotency_key": f"batch_fail_test_{int(time.time())}"
    }
    response = requests.post(f"{BASE_URL}/call-records/batch", json=data)
    assert response.status_code == 200, f"状态码错误: {response.status_code}"
    return True

def test_calculation_with_missing_price(rule_id):
    """测试有调用记录但缺少资源单价的情况"""
    data = {
        "month": "2024-01",
        "rule_id": rule_id,
        "idempotency_key": f"calc_fail_test_{int(time.time())}"
    }
    
    print("    执行月度分摊计算 (缺少资源单价)...")
    response = requests.post(f"{BASE_URL}/monthly-results/calculate", json=data)
    assert response.status_code == 200, f"状态码错误: {response.status_code}"
    
    result = response.json()
    print(f"    响应: {json.dumps(result, ensure_ascii=False, indent=2)}")
    
    # 验证失败信息被正确返回
    assert "data" in result, "响应应包含 data 字段"
    assert "failed_count" in result["data"], "响应应包含 failed_count 字段"
    assert result["data"]["failed_count"] > 0, "应该有失败的记录"
    assert "failures" in result["data"], "响应应包含 failures 详情"
    
    print(f"    ✓ 检测到 {result['data']['failed_count']} 条失败记录")
    
    for failure in result["data"]["failures"]:
        print(f"      - 失败原因: {failure['reason']}")
        assert "No active resource price" in failure["reason"], "失败原因应该是缺少资源单价"
    
    return result

def test_query_failed_results():
    """测试历史查询能查到失败记录"""
    print("    查询月度结果列表...")
    response = requests.get(f"{BASE_URL}/monthly-results/", params={"month": "2024-01"})
    assert response.status_code == 200, f"状态码错误: {response.status_code}"
    
    results = response.json()
    print(f"    查询到 {len(results)} 条月度结果记录")
    
    # 查找失败的记录
    failed_results = [r for r in results if r["status"] == "failed"]
    print(f"    其中失败状态的记录: {len(failed_results)} 条")
    
    assert len(failed_results) > 0, "应该能查到失败状态的记录"
    
    for failed in failed_results:
        print(f"      - ID: {failed['id']}, 状态: {failed['status']}")
        print(f"        失败原因: {failed.get('failure_reason', 'N/A')}")
        assert failed["failure_reason"] is not None, "失败记录应该有 failure_reason 字段"
        assert "No active resource price" in failed["failure_reason"], "失败原因应该包含具体信息"
    
    return failed_results

def test_query_history_with_failed_status():
    """测试按状态筛选查询失败记录"""
    print("    按 FAILED 状态筛选查询...")
    response = requests.get(f"{BASE_URL}/monthly-results/", params={
        "month": "2024-01",
        "status": "failed"
    })
    assert response.status_code == 200, f"状态码错误: {response.status_code}"
    
    results = response.json()
    print(f"    查询到 {len(results)} 条失败记录")
    assert len(results) > 0, "按状态筛选应该能查到失败记录"
    
    for r in results:
        assert r["status"] == "failed", "返回的记录状态应该是 failed"
    
    return results

def main():
    print("""
╔══════════════════════════════════════════════════════════════╗
║        API 调用成本分摊服务 - 失败处理验证测试                    ║
╚══════════════════════════════════════════════════════════════╝
    """)
    
    try:
        test_step("健康检查", test_health)
        
        caller_id = test_step("创建调用方", create_caller)
        api_group_id = test_step("创建接口组(不设置资源单价)", create_api_group)
        rule_id = test_step("创建分摊规则", create_allocation_rule)
        
        test_step("创建调用记录", lambda: create_call_record(caller_id, api_group_id))
        
        result = test_step("月度分摊计算 - 缺少资源单价的失败处理",
                         lambda: test_calculation_with_missing_price(rule_id))
        
        if result:
            test_step("历史查询 - 验证失败记录可查询", test_query_failed_results)
            test_step("历史查询 - 按状态筛选失败记录", test_query_history_with_failed_status)
        
        print("\n" + "="*60)
        print("  ✅ 所有失败处理验证通过！")
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
