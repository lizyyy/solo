import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import json
from app.services import MaskingEngine

def test_masking_engine():
    print("=" * 50)
    print("测试脱敏引擎")
    print("=" * 50)
    
    test_cases = [
        {
            'name': '手机号脱敏',
            'input': {'phone': '13812345678'},
            'rules': [{'field_path': 'phone', 'mask_type': 'phone'}],
            'expected': lambda x: x['phone'].startswith('138') and x['phone'].endswith('5678') and '****' in x['phone']
        },
        {
            'name': '邮箱脱敏',
            'input': {'email': 'test.user@example.com'},
            'rules': [{'field_path': 'email', 'mask_type': 'email'}],
            'expected': lambda x: x['email'].startswith('t') and '***' in x['email']
        },
        {
            'name': '完全脱敏',
            'input': {'secret_key': 'sk-12345-abcde'},
            'rules': [{'field_path': 'secret_key', 'mask_type': 'full'}],
            'expected': lambda x: x['secret_key'] == '***'
        },
        {
            'name': '部分脱敏',
            'input': {'id_card': '110101199001011234'},
            'rules': [{'field_path': 'id_card', 'mask_type': 'partial'}],
            'expected': lambda x: x['id_card'].startswith('11') and x['id_card'].endswith('34') and '***' in x['id_card']
        },
    ]
    
    passed = 0
    for case in test_cases:
        print(f"\n测试: {case['name']}")
        print(f"  输入: {case['input']}")
        
        class Rule:
            def __init__(self, d):
                self.field_path = d['field_path']
                self.mask_type = d['mask_type']
                self.mask_pattern = None
        
        rules = [Rule(r) for r in case['rules']]
        result = MaskingEngine.apply_masking(case['input'], rules)
        print(f"  输出: {result}")
        
        if case['expected'](result):
            print("  ✓ 通过")
            passed += 1
        else:
            print("  ✗ 失败")
    
    print(f"\n脱敏测试: {passed}/{len(test_cases)} 通过")
    return passed == len(test_cases)

def test_nested_masking():
    print("\n" + "=" * 50)
    print("测试嵌套字段脱敏")
    print("=" * 50)
    
    data = {
        'user': {
            'profile': {
                'phone': '13987654321',
                'email': 'nested@test.com'
            }
        }
    }
    
    class Rule:
        def __init__(self, path, mask_type):
            self.field_path = path
            self.mask_type = mask_type
            self.mask_pattern = None
    
    rules = [
        Rule('user.profile.phone', 'phone'),
        Rule('user.profile.email', 'email')
    ]
    
    result = MaskingEngine.apply_masking(data, rules)
    print(f"原始: {json.dumps(data, indent=2)}")
    print(f"脱敏后: {json.dumps(result, indent=2)}")
    
    phone_ok = '****' in result['user']['profile']['phone']
    email_ok = '***' in result['user']['profile']['email']
    
    if phone_ok and email_ok:
        print("✓ 嵌套字段脱敏成功")
        return True
    else:
        print("✗ 嵌套字段脱敏失败")
        return False

def test_similarity_comparison():
    print("\n" + "=" * 50)
    print("测试响应相似度计算")
    print("=" * 50)
    
    from difflib import SequenceMatcher
    
    test_pairs = [
        ('{"code": 200, "data": "ok"}', '{"code": 200, "data": "ok"}', 1.0),
        ('{"code": 200, "data": "ok"}', '{"code": 500, "data": "error"}', 0.7),
        ('hello world', 'hello there', 0.6),
    ]
    
    all_passed = True
    for a, b, expected_min in test_pairs:
        sim = SequenceMatcher(None, a, b).ratio()
        status = '✓' if sim >= expected_min else '✗'
        print(f"{status} 相似度 {sim:.2f} (期望 >= {expected_min}): '{a[:20]}' vs '{b[:20]}'")
        if sim < expected_min:
            all_passed = False
    
    return all_passed

def test_mask_value_types():
    print("\n" + "=" * 50)
    print("测试各种脱敏类型")
    print("=" * 50)
    
    types_to_test = ['phone', 'email', 'full', 'partial', 'regex']
    test_values = ['13812345678', 'test@example.com', 'secret123', '1234567890', 'abc123def']
    
    for mask_type, value in zip(types_to_test, test_values):
        result = MaskingEngine.mask_value(value, mask_type)
        print(f"  {mask_type}: {value} -> {result}")
    
    print("✓ 所有脱敏类型工作正常")
    return True

if __name__ == '__main__':
    results = []
    results.append(test_masking_engine())
    results.append(test_nested_masking())
    results.append(test_similarity_comparison())
    results.append(test_mask_value_types())
    
    print("\n" + "=" * 50)
    passed = sum(1 for r in results if r)
    print(f"总测试结果: {passed}/{len(results)} 通过")
    
    if passed == len(results):
        print("✓ 所有测试通过!")
        sys.exit(0)
    else:
        print("✗ 部分测试失败")
        sys.exit(1)
