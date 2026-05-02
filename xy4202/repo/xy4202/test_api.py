#!/usr/bin/env python3
"""
辅具借还风险管家 API 测试脚本
"""

import requests
import json
from datetime import datetime, timedelta

BASE_URL = 'http://localhost:5001/api'

def test_health_check():
    """测试健康检查"""
    print("1. 测试健康检查...")
    response = requests.get(f'{BASE_URL}/health')
    assert response.status_code == 200, f"健康检查失败: {response.status_code}"
    data = response.json()
    assert data['status'] == 'healthy'
    print("✓ 健康检查通过")
    return True

def test_sites():
    """测试站点API"""
    print("\n2. 测试站点API...")
    
    # 创建站点
    site_data = {
        'name': '测试站点',
        'address': '测试地址123号',
        'contact_person': '测试人',
        'phone': '1234567890'
    }
    
    print("  - 创建站点...")
    response = requests.post(f'{BASE_URL}/sites', json=site_data)
    assert response.status_code == 201, f"创建站点失败: {response.status_code}"
    created_site = response.json()
    site_id = created_site['id']
    print(f"    ✓ 站点创建成功，ID: {site_id}")
    
    # 获取所有站点
    print("  - 获取所有站点...")
    response = requests.get(f'{BASE_URL}/sites')
    assert response.status_code == 200, f"获取站点失败: {response.status_code}"
    sites = response.json()
    print(f"    ✓ 获取到 {len(sites)} 个站点")
    
    # 获取单个站点
    print("  - 获取单个站点...")
    response = requests.get(f'{BASE_URL}/sites/{site_id}')
    assert response.status_code == 200, f"获取站点失败: {response.status_code}"
    site = response.json()
    assert site['name'] == '测试站点'
    print("    ✓ 单个站点获取正确")
    
    # 更新站点
    print("  - 更新站点...")
    update_data = {'name': '更新后的测试站点'}
    response = requests.put(f'{BASE_URL}/sites/{site_id}', json=update_data)
    assert response.status_code == 200, f"更新站点失败: {response.status_code}"
    updated_site = response.json()
    assert updated_site['name'] == '更新后的测试站点'
    print("    ✓ 站点更新成功")
    
    # 删除站点
    print("  - 删除站点...")
    response = requests.delete(f'{BASE_URL}/sites/{site_id}')
    assert response.status_code == 200, f"删除站点失败: {response.status_code}"
    print("    ✓ 站点删除成功")
    
    return True

def test_equipment_types():
    """测试设备类型API"""
    print("\n3. 测试设备类型API...")
    
    # 创建设备类型
    eq_type_data = {
        'name': '测试设备类型',
        'description': '这是一个测试设备类型',
        'deposit_amount': 100.0,
        'daily_rental_fee': 10.0,
        'late_fee_per_day': 20.0
    }
    
    print("  - 创建设备类型...")
    response = requests.post(f'{BASE_URL}/equipment/types', json=eq_type_data)
    assert response.status_code == 201, f"创建设备类型失败: {response.status_code}"
    created_type = response.json()
    type_id = created_type['id']
    print(f"    ✓ 设备类型创建成功，ID: {type_id}")
    
    # 获取所有设备类型
    print("  - 获取所有设备类型...")
    response = requests.get(f'{BASE_URL}/equipment/types')
    assert response.status_code == 200, f"获取设备类型失败: {response.status_code}"
    types = response.json()
    print(f"    ✓ 获取到 {len(types)} 种设备类型")
    
    return True

def test_members():
    """测试会员API"""
    print("\n4. 测试会员API...")
    
    # 创建会员
    member_data = {
        'name': '测试会员',
        'phone': '13800138000',
        'gender': '男',
        'is_blacklisted': False
    }
    
    print("  - 创建会员...")
    response = requests.post(f'{BASE_URL}/members', json=member_data)
    assert response.status_code == 201, f"创建会员失败: {response.status_code}"
    created_member = response.json()
    member_id = created_member['id']
    print(f"    ✓ 会员创建成功，ID: {member_id}")
    
    # 获取所有会员
    print("  - 获取所有会员...")
    response = requests.get(f'{BASE_URL}/members')
    assert response.status_code == 200, f"获取会员失败: {response.status_code}"
    members = response.json()
    print(f"    ✓ 获取到 {len(members)} 名会员")
    
    # 获取黑名单会员
    print("  - 获取黑名单会员...")
    response = requests.get(f'{BASE_URL}/members/blacklist')
    assert response.status_code == 200, f"获取黑名单失败: {response.status_code}"
    blacklisted = response.json()
    print(f"    ✓ 黑名单中有 {len(blacklisted)} 名会员")
    
    return True

def test_audit_logs():
    """测试审计日志API"""
    print("\n5. 测试审计日志API...")
    
    print("  - 获取审计日志...")
    response = requests.get(f'{BASE_URL}/audit/logs')
    assert response.status_code == 200, f"获取审计日志失败: {response.status_code}"
    logs_data = response.json()
    print(f"    ✓ 获取到 {logs_data['total']} 条审计日志")
    
    return True

def run_all_tests():
    """运行所有测试"""
    print("=" * 60)
    print("辅具借还风险管家 API 测试")
    print("=" * 60)
    
    tests = [
        test_health_check,
        test_sites,
        test_equipment_types,
        test_members,
        test_audit_logs
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
        except AssertionError as e:
            print(f"✗ 测试失败: {e}")
            failed += 1
        except Exception as e:
            print(f"✗ 测试出错: {e}")
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"测试结果: 通过 {passed} 项, 失败 {failed} 项")
    print("=" * 60)
    
    return failed == 0

if __name__ == '__main__':
    run_all_tests()
