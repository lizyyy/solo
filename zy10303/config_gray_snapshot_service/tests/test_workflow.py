import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import json
import time
from datetime import datetime

import requests

BASE_URL = "http://localhost:5000/api/v1"


def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


def test_successful_workflow():
    print_section("测试场景 1: 成功的灰度发布流程")
    
    print("1. 创建配置版本...")
    config_data = {
        "config_name": "payment-service",
        "config_content": {"timeout": 30, "retry": 3, "feature_flag": True},
        "version": "v2.1.0",
        "created_by": "engineer_zhang",
        "description": "支付服务灰度版本"
    }
    resp = requests.post(f"{BASE_URL}/configs", json=config_data)
    print(f"   状态码: {resp.status_code}")
    result = resp.json()
    print(f"   结果: {json.dumps(result, indent=2, ensure_ascii=False)}")
    version_key = result.get('version_key')
    assert version_key, "创建配置失败"
    
    print("\n2. 创建灰度条件 - VIP 用户...")
    condition1_data = {
        "condition_type": "user_attribute",
        "condition_expression": "$is_vip == True",
        "created_by": "engineer_zhang",
        "description": "VIP 用户优先体验",
        "priority": 100
    }
    resp = requests.post(f"{BASE_URL}/configs/{version_key}/conditions", json=condition1_data)
    print(f"   状态码: {resp.status_code}")
    result1 = resp.json()
    print(f"   结果: {json.dumps(result1, indent=2, ensure_ascii=False)}")
    
    print("\n3. 创建灰度条件 - 特定地区...")
    condition2_data = {
        "condition_type": "user_attribute",
        "condition_expression": "$region == 'beijing'",
        "created_by": "engineer_zhang",
        "description": "北京地区用户",
        "priority": 50
    }
    resp = requests.post(f"{BASE_URL}/configs/{version_key}/conditions", json=condition2_data)
    print(f"   状态码: {resp.status_code}")
    result2 = resp.json()
    print(f"   结果: {json.dumps(result2, indent=2, ensure_ascii=False)}")
    
    print("\n4. 创建发布批次...")
    batch_data = {
        "version_key": version_key,
        "batch_name": "payment-gray-batch-001",
        "target_percentage": 50,
        "created_by": "engineer_zhang"
    }
    resp = requests.post(f"{BASE_URL}/batches", json=batch_data)
    print(f"   状态码: {resp.status_code}")
    result = resp.json()
    print(f"   结果: {json.dumps(result, indent=2, ensure_ascii=False)}")
    batch_key = result.get('batch_key')
    assert batch_key, "创建批次失败"
    
    print("\n5. 创建回滚点...")
    rb_data = {
        "created_by": "engineer_zhang",
        "description": "发布前快照"
    }
    resp = requests.post(f"{BASE_URL}/batches/{batch_key}/rollback-points", json=rb_data)
    print(f"   状态码: {resp.status_code}")
    result = resp.json()
    print(f"   结果: {json.dumps(result, indent=2, ensure_ascii=False)}")
    rollback_key = result.get('rollback_key')
    
    print("\n6. 推进状态: DRAFT -> PENDING...")
    status_data = {
        "new_status": "pending",
        "updated_by": "release_manager"
    }
    resp = requests.put(f"{BASE_URL}/batches/{batch_key}/status", json=status_data)
    print(f"   状态码: {resp.status_code}")
    print(f"   结果: {json.dumps(resp.json(), indent=2, ensure_ascii=False)}")
    
    print("\n7. 推进状态: PENDING -> RUNNING, 设置灰度比例 30%...")
    status_data = {
        "new_status": "running",
        "updated_by": "release_manager",
        "current_percentage": 30
    }
    resp = requests.put(f"{BASE_URL}/batches/{batch_key}/status", json=status_data)
    print(f"   状态码: {resp.status_code}")
    print(f"   结果: {json.dumps(resp.json(), indent=2, ensure_ascii=False)}")
    
    print("\n8. 评估灰度命中 - VIP 用户(应该命中)...")
    eval_data = {
        "user_id": "user_1001",
        "user_attributes": {"is_vip": True, "region": "shanghai", "level": 5},
        "operator": "api_gateway"
    }
    resp = requests.post(f"{BASE_URL}/batches/{batch_key}/evaluate", json=eval_data)
    print(f"   状态码: {resp.status_code}")
    print(f"   结果: {json.dumps(resp.json(), indent=2, ensure_ascii=False)}")
    
    print("\n9. 评估灰度命中 - 北京用户(应该命中)...")
    eval_data = {
        "user_id": "user_1002",
        "user_attributes": {"is_vip": False, "region": "beijing", "level": 3},
        "operator": "api_gateway"
    }
    resp = requests.post(f"{BASE_URL}/batches/{batch_key}/evaluate", json=eval_data)
    print(f"   状态码: {resp.status_code}")
    print(f"   结果: {json.dumps(resp.json(), indent=2, ensure_ascii=False)}")
    
    print("\n10. 重复提交同一用户 - 测试幂等性...")
    eval_data = {
        "user_id": "user_1001",
        "user_attributes": {"is_vip": True, "region": "shanghai", "level": 5},
        "operator": "api_gateway"
    }
    resp = requests.post(f"{BASE_URL}/batches/{batch_key}/evaluate", json=eval_data)
    print(f"   状态码: {resp.status_code}")
    print(f"   结果: {json.dumps(resp.json(), indent=2, ensure_ascii=False)}")
    assert resp.json().get('already_hit') == True, "幂等性失败"
    
    print("\n11. 创建查询凭证...")
    token_data = {
        "created_by": "data_analyst",
        "permissions": ["read:batch_history", "read:hit_samples"],
        "expires_hours": 48
    }
    resp = requests.post(f"{BASE_URL}/tokens", json=token_data)
    print(f"   状态码: {resp.status_code}")
    result = resp.json()
    print(f"   结果: {json.dumps(result, indent=2, ensure_ascii=False)}")
    token_value = result.get('token_value')
    
    print("\n12. 查询批次历史(带token)...")
    headers = {"X-Query-Token": token_value}
    resp = requests.get(f"{BASE_URL}/batches/{batch_key}/history", headers=headers)
    print(f"   状态码: {resp.status_code}")
    history = resp.json()
    print(f"   批次状态: {history['batch']['status']}")
    print(f"   命中样本数: {len(history['hit_samples'])}")
    print(f"   审计日志数: {len(history['audit_logs'])}")
    
    print("\n13. 完成发布...")
    status_data = {
        "new_status": "completed",
        "updated_by": "release_manager",
        "conclusion": "灰度发布成功，无异常反馈，全量发布"
    }
    resp = requests.put(f"{BASE_URL}/batches/{batch_key}/status", json=status_data)
    print(f"   状态码: {resp.status_code}")
    print(f"   结果: {json.dumps(resp.json(), indent=2, ensure_ascii=False)}")
    
    print("\n✅ 成功场景测试完成!")
    return batch_key, token_value


def test_rollback_workflow():
    print_section("测试场景 2: 发布异常回滚流程")
    
    print("1. 创建配置版本...")
    config_data = {
        "config_name": "user-service",
        "config_content": {"new_ui": True, "api_version": "v2"},
        "version": "v1.5.0-beta",
        "created_by": "engineer_li"
    }
    resp = requests.post(f"{BASE_URL}/configs", json=config_data)
    result = resp.json()
    version_key = result.get('version_key')
    print(f"   创建成功: {version_key}")
    
    print("\n2. 创建发布批次...")
    batch_data = {
        "version_key": version_key,
        "batch_name": "user-gray-batch-002",
        "target_percentage": 30,
        "created_by": "engineer_li"
    }
    resp = requests.post(f"{BASE_URL}/batches", json=batch_data)
    result = resp.json()
    batch_key = result.get('batch_key')
    print(f"   创建成功: {batch_key}")
    
    print("\n3. 创建回滚点...")
    rb_data = {
        "created_by": "engineer_li",
        "description": "回滚测试快照"
    }
    resp = requests.post(f"{BASE_URL}/batches/{batch_key}/rollback-points", json=rb_data)
    result = resp.json()
    rollback_key = result.get('rollback_key')
    print(f"   回滚点: {rollback_key}")
    
    print("\n4. 开始发布...")
    status_data = {"new_status": "pending", "updated_by": "release_manager"}
    requests.put(f"{BASE_URL}/batches/{batch_key}/status", json=status_data)
    status_data = {"new_status": "running", "updated_by": "release_manager", "current_percentage": 20}
    requests.put(f"{BASE_URL}/batches/{batch_key}/status", json=status_data)
    print("   已进入 RUNNING 状态, 灰度比例 20%")
    
    print("\n5. 模拟用户命中...")
    for i in range(5):
        eval_data = {
            "user_id": f"test_user_{i}",
            "user_attributes": {"region": "shenzhen", "level": i},
            "operator": "api_gateway"
        }
        requests.post(f"{BASE_URL}/batches/{batch_key}/evaluate", json=eval_data)
    print("   已添加 5 个测试用户")
    
    print("\n6. 发现问题 - 执行回滚!")
    rollback_data = {
        "rolled_by": "sre_engineer",
        "request_id": "incident-2024-001"
    }
    resp = requests.post(f"{BASE_URL}/rollbacks/{rollback_key}/execute", json=rollback_data)
    print(f"   状态码: {resp.status_code}")
    print(f"   结果: {json.dumps(resp.json(), indent=2, ensure_ascii=False)}")
    
    print("\n7. 验证回滚后状态...")
    resp = requests.get(f"{BASE_URL}/batches/{batch_key}/history")
    history = resp.json()
    print(f"   批次状态: {history['batch']['status']}")
    print(f"   样本有效性: {[s['is_valid'] for s in history['hit_samples']]}")
    print(f"   审计日志:")
    for log in history['audit_logs']:
        print(f"     - {log['operation_time']}: {log['details']}")
    
    print("\n8. 尝试重复使用回滚点...")
    resp = requests.post(f"{BASE_URL}/rollbacks/{rollback_key}/execute", json=rollback_data)
    print(f"   状态码: {resp.status_code} (预期 400)")
    print(f"   错误: {resp.json().get('error')}")
    
    print("\n✅ 回滚场景测试完成!")


def test_edge_cases():
    print_section("测试场景 3: 异常情况与边界测试")
    
    print("1. 重复创建相同配置版本...")
    config_data = {
        "config_name": "order-service",
        "config_content": {"test": True},
        "version": "v1.0.0",
        "created_by": "tester"
    }
    resp = requests.post(f"{BASE_URL}/configs", json=config_data)
    print(f"   第一次: {resp.status_code}")
    resp = requests.post(f"{BASE_URL}/configs", json=config_data)
    print(f"   第二次: {resp.status_code} (预期 409)")
    print(f"   错误: {resp.json().get('error')}")
    
    print("\n2. 无效的状态流转...")
    config_data = {
        "config_name": "test-config",
        "config_content": {},
        "version": "v0.0.1",
        "created_by": "tester"
    }
    resp = requests.post(f"{BASE_URL}/configs", json=config_data)
    version_key = resp.json()['version_key']
    
    batch_data = {
        "version_key": version_key,
        "batch_name": "test-batch",
        "target_percentage": 10,
        "created_by": "tester"
    }
    resp = requests.post(f"{BASE_URL}/batches", json=batch_data)
    batch_key = resp.json()['batch_key']
    
    status_data = {"new_status": "running", "updated_by": "tester"}
    resp = requests.put(f"{BASE_URL}/batches/{batch_key}/status", json=status_data)
    print(f"   状态码: {resp.status_code} (预期 400)")
    print(f"   错误: {resp.json().get('error')}")
    
    print("\n3. 查询不存在的批次...")
    resp = requests.get(f"{BASE_URL}/batches/nonexistent_key/history")
    print(f"   状态码: {resp.status_code} (预期 404)")
    
    print("\n4. 灰度比例超出范围...")
    status_data = {"new_status": "pending", "updated_by": "tester"}
    requests.put(f"{BASE_URL}/batches/{batch_key}/status", json=status_data)
    status_data = {"new_status": "running", "updated_by": "tester", "current_percentage": 150}
    resp = requests.put(f"{BASE_URL}/batches/{batch_key}/status", json=status_data)
    print(f"   状态码: {resp.status_code} (预期 400)")
    
    print("\n5. 使用无效的查询凭证...")
    headers = {"X-Query-Token": "invalid_token_123"}
    resp = requests.get(f"{BASE_URL}/batches/{batch_key}/history", headers=headers)
    print(f"   状态码: {resp.status_code} (预期 401)")
    
    print("\n✅ 边界测试完成!")


def test_data_persistence():
    print_section("测试场景 4: 数据持久化验证")
    
    print("查询之前创建的批次历史...")
    print("(重启服务后运行此测试验证数据未丢失)")
    
    print("\n✅ 持久化验证提示:")
    print("   - 数据库文件位于 data/gray_snapshot.db")
    print("   - 重启 Flask 服务后重新运行查询接口验证")


if __name__ == "__main__":
    print("\n" + "="*60)
    print("  配置灰度快照服务 - 完整集成测试")
    print("="*60)
    
    try:
        print("\n⏳ 等待服务启动...")
        for i in range(5):
            try:
                resp = requests.get(f"{BASE_URL}/health", timeout=2)
                if resp.status_code == 200:
                    print("✅ 服务已就绪!")
                    break
            except:
                time.sleep(1)
        else:
            print("⚠️  警告: 可能无法连接服务，请确保 Flask 已启动")
        
        test_successful_workflow()
        test_rollback_workflow()
        test_edge_cases()
        test_data_persistence()
        
        print("\n" + "="*60)
        print("  🎉 所有测试场景完成!")
        print("="*60 + "\n")
        
    except Exception as e:
        print(f"\n❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()
