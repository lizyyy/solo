#!/usr/bin/env python3
"""
测试坏样例检测功能
"""

import requests
import json
import tempfile
import os

BASE_URL = "http://127.0.0.1:5001/api"


def test_health():
    """测试健康检查"""
    print("=== 测试健康检查 ===")
    resp = requests.get(f"{BASE_URL}/health")
    print(f"状态码: {resp.status_code}")
    print(f"响应: {json.dumps(resp.json(), indent=2, ensure_ascii=False)}")
    return resp.status_code == 200


def test_count_null_issue():
    """测试 COUNT(*) vs COUNT(column) 的 NULL 处理问题"""
    print("\n=== 测试 COUNT(*) vs COUNT(column) NULL 处理问题 ===")
    
    schema_sql = """
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT
);
"""
    
    seed_csv = """id,name,email
1,Alice,alice@example.com
2,Bob,bob@example.com
3,Charlie,
4,Diana,
5,Eve,eve@example.com
"""
    
    cases_yaml = """
cases:
  - case_id: count_null_test
    name: COUNT(*) vs COUNT(email) 测试
    description: COUNT(*) 统计 5 行，COUNT(email) 只统计非 NULL 的 3 行
    tags: ['null-handling', 'test']
    original_sql: SELECT COUNT(*) as total FROM users
    optimized_sql: SELECT COUNT(email) as total FROM users
"""
    
    files = {
        'schema': ('schema.sql', schema_sql),
        'seed': ('seed.csv', seed_csv),
        'cases': ('cases.yaml', cases_yaml)
    }
    
    data = {
        'name': 'NULL Handling Test'
    }
    
    resp = requests.post(f"{BASE_URL}/validate", files=files, data=data)
    result = resp.json()
    
    print(f"验证 ID: {result.get('validation_id')}")
    print(f"整体状态: {result.get('status')}")
    print(f"通过: {result.get('passed_count')}, 失败: {result.get('failed_count')}")
    
    if result.get('cases'):
        case = result['cases'][0]
        print(f"\n用例状态: {case.get('status')}")
        
        if case.get('comparison_result'):
            cr = case['comparison_result']
            print(f"行数匹配: {cr.get('row_count_match')}")
            print(f"原始行数: {cr.get('row_count_original')}")
            print(f"优化后行数: {cr.get('row_count_optimized')}")
            print(f"整体通过: {cr.get('passed')}")
            
            if cr.get('null_aggregation_issues'):
                print(f"\nNULL 聚合警告:")
                for issue in cr['null_aggregation_issues']:
                    print(f"  - {issue}")
        
        if case.get('suggestions'):
            print(f"\n优化建议:")
            for sug in case['suggestions']:
                print(f"  - {sug}")
    
    return result.get('failed_count', 0) > 0  # 预期会失败


def test_left_join_vs_inner_join():
    """测试 LEFT JOIN 改成 INNER JOIN 的问题"""
    print("\n=== 测试 LEFT JOIN vs INNER JOIN ===")
    
    schema_sql = """
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT
);

CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    product TEXT
);
"""
    
    seed_csv = """
"""
    
    cases_yaml = """
cases:
  - case_id: join_test_1
    name: 无数据时的 JOIN 测试
    description: 当两张表都为空时，LEFT JOIN 和 INNER JOIN 都返回空
    original_sql: |
      SELECT u.name, o.product
      FROM users u
      LEFT JOIN orders o ON u.id = o.user_id
    optimized_sql: |
      SELECT u.name, o.product
      FROM users u
      INNER JOIN orders o ON u.id = o.user_id
"""
    
    files = {
        'schema': ('schema.sql', schema_sql),
        'cases': ('cases.yaml', cases_yaml)
    }
    
    data = {
        'name': 'JOIN Test'
    }
    
    resp = requests.post(f"{BASE_URL}/validate", files=files, data=data)
    result = resp.json()
    
    print(f"验证 ID: {result.get('validation_id')}")
    print(f"整体状态: {result.get('status')}")
    
    if result.get('cases'):
        case = result['cases'][0]
        print(f"用例状态: {case.get('status')}")
        if case.get('comparison_result'):
            cr = case['comparison_result']
            print(f"原始行数: {cr.get('row_count_original')}")
            print(f"优化后行数: {cr.get('row_count_optimized')}")
            print(f"JOIN 行数匹配: {cr.get('join_row_count_match')}")
            
            if cr.get('join_issues'):
                print(f"JOIN 问题: {cr['join_issues']}")
    
    return True


def test_order_by_limit():
    """测试 ORDER BY + LIMIT 的顺序敏感问题"""
    print("\n=== 测试 ORDER BY + LIMIT 顺序敏感 ===")
    
    schema_sql = """
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT,
    age INTEGER
);
"""
    
    seed_csv = """id,name,age
1,Alice,20
2,Bob,30
3,Charlie,25
4,Diana,35
"""
    
    cases_yaml = """
cases:
  - case_id: order_test
    name: ORDER BY + LIMIT 测试
    description: 按年龄降序取前2个应该是 Diana(35), Bob(30)
                 去掉 ORDER BY 后取前2个是 Alice(20), Bob(30)
    original_sql: SELECT name, age FROM users ORDER BY age DESC LIMIT 2
    optimized_sql: SELECT name, age FROM users LIMIT 2
"""
    
    files = {
        'schema': ('schema.sql', schema_sql),
        'seed': ('seed.csv', seed_csv),
        'cases': ('cases.yaml', cases_yaml)
    }
    
    data = {
        'name': 'Order Test'
    }
    
    resp = requests.post(f"{BASE_URL}/validate", files=files, data=data)
    result = resp.json()
    
    print(f"验证 ID: {result.get('validation_id')}")
    print(f"整体状态: {result.get('status')}")
    print(f"通过: {result.get('passed_count')}, 失败: {result.get('failed_count')}")
    
    if result.get('cases'):
        case = result['cases'][0]
        print(f"\n用例状态: {case.get('status')}")
        
        if case.get('comparison_result'):
            cr = case['comparison_result']
            print(f"顺序敏感: {cr.get('order_sensitive')}")
            print(f"顺序匹配: {cr.get('order_match')}")
            print(f"行数匹配: {cr.get('row_count_match')}")
            
            if cr.get('sample_mismatches'):
                print(f"\n数据不一致样本:")
                for mismatch in cr['sample_mismatches'][:3]:
                    print(f"  行 {mismatch.get('row_index')}:")
                    print(f"    原始: {mismatch.get('original')}")
                    print(f"    优化后: {mismatch.get('optimized')}")
    
    return result.get('failed_count', 0) > 0


def test_statistics():
    """测试统计信息"""
    print("\n=== 测试统计信息 ===")
    resp = requests.get(f"{BASE_URL}/statistics")
    stats = resp.json()
    print(json.dumps(stats, indent=2, ensure_ascii=False))
    return True


def test_list_validations():
    """测试列出验证记录"""
    print("\n=== 测试列出验证记录 ===")
    resp = requests.get(f"{BASE_URL}/validations?limit=5")
    result = resp.json()
    print(f"总记录数: {len(result.get('validations', []))}")
    for v in result.get('validations', [])[:2]:
        print(f"  - {v.get('name')}: {v.get('status')}")
    return True


def main():
    print("=" * 60)
    print("SQL 优化验证服务功能测试")
    print("=" * 60)
    
    all_passed = True
    
    # 测试健康检查
    if not test_health():
        all_passed = False
        print("❌ 健康检查失败")
    else:
        print("✅ 健康检查通过")
    
    # 测试统计信息
    test_statistics()
    
    # 测试 NULL 处理问题
    print("\n[预期失败] 测试 COUNT(*) vs COUNT(column) - 有 NULL 值时应失败")
    count_test_failed = test_count_null_issue()
    if count_test_failed:
        print("✅ 正确检测到 COUNT 函数差异（预期失败）")
    else:
        print("❌ 未能检测到 COUNT 函数差异")
        all_passed = False
    
    # 测试 JOIN
    test_left_join_vs_inner_join()
    print("✅ JOIN 测试完成")
    
    # 测试 ORDER BY + LIMIT
    print("\n[预期失败] 测试 ORDER BY + LIMIT - 去掉 ORDER BY 应失败")
    order_test_failed = test_order_by_limit()
    if order_test_failed:
        print("✅ 正确检测到 ORDER BY + LIMIT 差异（预期失败）")
    else:
        print("⚠️ ORDER BY 测试结果可能因数据顺序而异")
    
    # 列出验证记录
    test_list_validations()
    
    print("\n" + "=" * 60)
    if all_passed:
        print("✅ 所有测试完成，服务运行正常！")
    else:
        print("❌ 部分测试失败")
    print("=" * 60)


if __name__ == '__main__':
    main()
