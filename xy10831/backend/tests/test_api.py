import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import json
import time
import subprocess
import requests

BASE_URL = 'http://localhost:5000/api'

def test_health_check():
    print("=" * 50)
    print("测试健康检查接口")
    print("=" * 50)
    try:
        r = requests.get(f'{BASE_URL}/health', timeout=5)
        r.raise_for_status()
        data = r.json()
        print(f"✓ 健康检查通过: {data}")
        return True
    except Exception as e:
        print(f"✗ 健康检查失败: {e}")
        return False

def test_mask_preview():
    print("\n" + "=" * 50)
    print("测试脱敏预览接口")
    print("=" * 50)
    
    test_data = {
        'phone': '13812345678',
        'email': 'test@example.com',
        'secret_key': 'sk-test-123'
    }
    
    try:
        r = requests.post(f'{BASE_URL}/mask/preview', json={'data': test_data}, timeout=5)
        r.raise_for_status()
        result = r.json()
        
        print(f"原始: {json.dumps(result['original'], indent=2)}")
        print(f"脱敏后: {json.dumps(result['masked'], indent=2)}")
        
        checks = [
            '****' in result['masked']['phone'],
            '***' in result['masked']['email'],
            result['masked']['secret_key'] == '***'
        ]
        
        if all(checks):
            print("✓ 脱敏预览接口工作正常")
            return True
        else:
            print("✗ 脱敏结果不符合预期")
            return False
    except Exception as e:
        print(f"✗ 脱敏预览失败: {e}")
        return False

def test_init_demo():
    print("\n" + "=" * 50)
    print("测试初始化演示数据接口")
    print("=" * 50)
    try:
        r = requests.post(f'{BASE_URL}/init-demo', timeout=10)
        r.raise_for_status()
        result = r.json()
        print(f"✓ 初始化演示数据: {result}")
        return True
    except Exception as e:
        print(f"✗ 初始化演示数据失败: {e}")
        return False

def test_requests_crud():
    print("\n" + "=" * 50)
    print("测试请求管理接口")
    print("=" * 50)
    
    try:
        new_req = {
            'request_id': 'test_req_' + str(int(time.time())),
            'method': 'POST',
            'url': '/api/test',
            'headers': {'Content-Type': 'application/json'},
            'body': {'phone': '13999999999', 'amount': 100},
            'source': 'test_script'
        }
        
        r = requests.post(f'{BASE_URL}/requests', json=new_req, timeout=5)
        r.raise_for_status()
        created = r.json()
        print(f"✓ 创建请求成功: {created['request_id']}")
        
        r = requests.get(f'{BASE_URL}/requests', timeout=5)
        r.raise_for_status()
        result = r.json()
        print(f"✓ 查询请求列表: {len(result.get('items', []))} 条")
        
        r = requests.get(f'{BASE_URL}/requests/{created["request_id"]}', timeout=5)
        r.raise_for_status()
        detail = r.json()
        print(f"✓ 查询请求详情成功")
        
        return True
    except Exception as e:
        print(f"✗ 请求管理测试失败: {e}")
        return False

def test_rules_crud():
    print("\n" + "=" * 50)
    print("测试脱敏规则接口")
    print("=" * 50)
    
    try:
        r = requests.get(f'{BASE_URL}/rules', timeout=5)
        r.raise_for_status()
        rules = r.json()
        print(f"✓ 查询规则列表: {len(rules)} 条")
        
        new_rule = {
            'name': '测试规则-金额脱敏',
            'description': '测试',
            'field_path': 'amount',
            'mask_type': 'partial',
            'is_active': True
        }
        r = requests.post(f'{BASE_URL}/rules', json=new_rule, timeout=5)
        r.raise_for_status()
        created = r.json()
        print(f"✓ 创建规则成功: {created['id']}")
        
        return True
    except Exception as e:
        print(f"✗ 规则管理测试失败: {e}")
        return False

def test_environments():
    print("\n" + "=" * 50)
    print("测试环境配置接口")
    print("=" * 50)
    
    try:
        r = requests.get(f'{BASE_URL}/environments', timeout=5)
        r.raise_for_status()
        envs = r.json()
        print(f"✓ 查询环境列表: {len(envs)} 条")
        
        if len(envs) > 0:
            for env in envs:
                approval_text = '需要审批' if env['requires_approval'] else '无需审批'
                prod_text = '生产环境' if env['is_production'] else '测试环境'
                print(f"  - {env['name']}: {env['base_url']} ({prod_text}, {approval_text})")
        
        return True
    except Exception as e:
        print(f"✗ 环境配置测试失败: {e}")
        return False

def test_audit_logs():
    print("\n" + "=" * 50)
    print("测试审计日志接口")
    print("=" * 50)
    
    try:
        r = requests.get(f'{BASE_URL}/audit', timeout=5)
        r.raise_for_status()
        result = r.json()
        logs = result.get('items', [])
        print(f"✓ 查询审计日志: {len(logs)} 条")
        
        if len(logs) > 0:
            print(f"  最新操作: {logs[0]['action']} by {logs[0]['user']}")
        
        return True
    except Exception as e:
        print(f"✗ 审计日志测试失败: {e}")
        return False

def test_replay_execution():
    print("\n" + "=" * 50)
    print("测试重放执行")
    print("=" * 50)
    
    try:
        r = requests.get(f'{BASE_URL}/requests', timeout=5)
        reqs = r.json().get('items', [])
        if not reqs:
            print("  跳过: 没有请求可重放")
            return True
        
        r = requests.get(f'{BASE_URL}/environments', timeout=5)
        envs = [e for e in r.json() if not e['requires_approval']]
        if not envs:
            print("  跳过: 没有无需审批的环境")
            return True
        
        replay_data = {
            'request_id': reqs[0]['request_id'],
            'environment_id': envs[0]['id'],
            'executed_by': 'test_script'
        }
        
        print(f"  执行重放: 请求={replay_data['request_id']}, 环境={envs[0]['name']}")
        
        r = requests.post(f'{BASE_URL}/replays', json=replay_data, timeout=30)
        r.raise_for_status()
        result = r.json()
        
        print(f"  状态: {result['status']}, 响应码: {result.get('response_status')}")
        if result.get('masked_body'):
            print(f"  脱敏后body: {json.dumps(result['masked_body'])}")
        
        print(f"✓ 重放执行成功")
        return True
    except Exception as e:
        print(f"✗ 重放执行测试失败: {e}")
        return False

def run_all_tests():
    print("\n" + "=" * 50)
    print("API集成测试套件")
    print("=" * 50)
    
    tests = [
        test_health_check,
        test_init_demo,
        test_requests_crud,
        test_rules_crud,
        test_environments,
        test_mask_preview,
        test_replay_execution,
        test_audit_logs,
    ]
    
    results = []
    for test in tests:
        try:
            results.append(test())
        except KeyboardInterrupt:
            print("\n测试被中断")
            sys.exit(1)
        except Exception as e:
            print(f"✗ 测试异常: {e}")
            results.append(False)
    
    print("\n" + "=" * 50)
    passed = sum(1 for r in results if r)
    print(f"总测试结果: {passed}/{len(results)} 通过")
    
    if passed == len(results):
        print("✓ 所有API测试通过!")
        return True
    else:
        print("✗ 部分API测试失败")
        return False

if __name__ == '__main__':
    success = run_all_tests()
    sys.exit(0 if success else 1)
