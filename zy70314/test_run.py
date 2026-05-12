#!/usr/bin/env python3
"""
验证脚本 - 测试多区域缓存失效 CLI 功能
"""
import os
import sys
import json
import shutil
from pathlib import Path
from datetime import datetime


def clean_reports():
    """清理报告目录"""
    reports_dir = Path('reports')
    if reports_dir.exists():
        shutil.rmtree(reports_dir)
    reports_dir.mkdir(exist_ok=True)
    print("✓ 已清理报告目录")


def restore_mock_cache():
    """恢复模拟缓存到初始状态"""
    initial_data = {
        "cn-north": {
            "product:P001:price": "{\"price\": 99.99, \"currency\": \"CNY\"}",
            "product:P002:price": "{\"price\": 299.99, \"currency\": \"CNY\"}",
            "inventory:P001:WH001": "{\"available\": 100, \"reserved\": 20}",
            "inventory:P002:WH002": "{\"available\": 50, \"reserved\": 10}",
            "member:M001:benefits:gold": "{\"discount\": 0.95, \"points_multiplier\": 1.5}"
        },
        "cn-south": {
            "product:P001:price": "{\"price\": 199.99, \"currency\": \"CNY\"}",
            "product:P002:price": "{\"price\": 299.99, \"currency\": \"CNY\"}",
            "inventory:P001:WH001": "{\"available\": 150, \"reserved\": 20}",
            "inventory:P002:WH002": "{\"available\": 50, \"reserved\": 10}",
            "member:M001:benefits:gold": "{\"discount\": 0.9, \"points_multiplier\": 2.0}"
        },
        "cn-east": {
            "product:P001:price": "{\"price\": 99.99, \"currency\": \"CNY\"}",
            "product:P002:price": "{\"price\": 299.99, \"currency\": \"CNY\"}",
            "inventory:P001:WH001": "{\"available\": 100, \"reserved\": 20}",
            "inventory:P002:WH002": "{\"available\": 30, \"reserved\": 10}",
            "member:M001:benefits:gold": "{\"discount\": 0.9, \"points_multiplier\": 2.0}"
        },
        "cn-west": {
            "product:P001:price": "{\"price\": 99.99, \"currency\": \"CNY\"}",
            "product:P002:price": "{\"price\": 299.99, \"currency\": \"CNY\"}",
            "inventory:P001:WH001": "{\"available\": 100, \"reserved\": 20}",
            "inventory:P002:WH002": "{\"available\": 50, \"reserved\": 10}",
            "member:M001:benefits:gold": "{\"discount\": 0.9, \"points_multiplier\": 2.0}"
        }
    }
    
    cache_file = Path('examples/mock_cache.json')
    with open(cache_file, 'w', encoding='utf-8') as f:
        json.dump(initial_data, f, ensure_ascii=False, indent=2)
    print("✓ 已恢复模拟缓存到初始状态")


def test_precheck():
    """测试预检功能"""
    print("\n" + "=" * 60)
    print("测试 1: 预检功能")
    print("=" * 60)
    
    from cache_invalidator import ConfigLoader, TemplateManager, MockCacheClient, InvalidationExecutor
    
    config_loader = ConfigLoader(
        'config/regions.yaml',
        'config/templates.yaml',
        'examples/tasks.yaml'
    )
    template_manager = TemplateManager('config/templates.yaml')
    cache_client = MockCacheClient('examples/mock_cache.json')
    executor = InvalidationExecutor(template_manager, cache_client)
    
    regions = config_loader.load_regions()
    tasks = config_loader.load_tasks()
    
    errors, warnings, info = executor.pre_check(regions, tasks)
    
    print(f"\n错误数: {len(errors)}")
    print(f"警告数: {len(warnings)}")
    print(f"信息数: {len(info)}")
    
    if errors:
        print("\n错误详情:")
        for e in errors:
            print(f"  ✗ {e}")
    
    if warnings:
        print("\n警告详情:")
        for w in warnings:
            print(f"  ⚠ {w}")
    
    print("\n✓ 预检测试完成")
    return len(errors) == 0


def test_template_validation():
    """测试模板验证功能"""
    print("\n" + "=" * 60)
    print("测试 2: 模板和变量验证")
    print("=" * 60)
    
    from cache_invalidator.templates import TemplateManager
    
    manager = TemplateManager('config/templates.yaml')
    
    # 测试 2.1: 检查模板是否存在
    print("\n2.1 检查模板存在性")
    valid, errors = manager.validate_template('product_price')
    assert valid, f"product_price 模板应该存在: {errors}"
    print("  ✓ product_price 模板存在")
    
    valid, errors = manager.validate_template('non_existent')
    assert not valid, "不存在的模板应该验证失败"
    print("  ✓ non_existent 模板验证失败（预期行为）")
    
    # 测试 2.2: 验证变量
    print("\n2.2 验证变量完整性")
    valid, errors = manager.validate_variables(
        'product_price',
        {'product_id': 'P001'}
    )
    assert valid, f"变量应该有效: {errors}"
    print("  ✓ product_price 变量验证通过")
    
    valid, errors = manager.validate_variables(
        'product_price',
        {}
    )
    assert not valid, "缺少必要变量应该验证失败"
    print("  ✓ 缺少 product_id 变量时验证失败（预期行为）")
    
    # 测试 2.3: 构建缓存键
    print("\n2.3 构建缓存键")
    key, errors = manager.build_cache_key(
        'product_price',
        {'product_id': 'P001'}
    )
    assert key == 'product:P001:price', f"缓存键构建错误: {key}"
    print(f"  ✓ 构建缓存键: {key}")
    
    key, errors = manager.build_cache_key(
        'inventory-task',
        {'product_id': 'P001', 'warehouse_id': 'WH001'}
    )
    assert key is None, "无效模板应该构建失败"
    print("  ✓ 无效模板构建缓存键失败（预期行为）")
    
    print("\n✓ 模板验证测试完成")
    return True


def test_cache_client():
    """测试缓存客户端"""
    print("\n" + "=" * 60)
    print("测试 3: 缓存客户端功能")
    print("=" * 60)
    
    from cache_invalidator.cache_client import MockCacheClient
    
    client = MockCacheClient('examples/mock_cache.json')
    
    # 测试 3.1: ping
    print("\n3.1 区域连通性测试")
    result = client.ping('cn-north')
    assert result.success, "cn-north 应该可达"
    print("  ✓ cn-north 区域可达")
    
    result = client.ping('non-existent')
    assert not result.success, "不存在的区域应该不可达"
    print("  ✓ non-existent 区域不可达（预期行为）")
    
    # 测试 3.2: get
    print("\n3.2 缓存读取测试")
    result = client.get('cn-north', 'product:P001:price')
    assert result.success, "应该能读取缓存"
    assert result.value is not None, "应该有值"
    print(f"  ✓ 读取到缓存值: {result.value[:50]}...")
    
    result = client.get('cn-north', 'non-existent-key')
    assert result.success, "不存在的键也应该成功返回"
    assert result.value is None, "不存在的键值应该为 None"
    print("  ✓ 不存在的键返回 None")
    
    # 测试 3.3: delete
    print("\n3.3 缓存删除测试")
    test_key = 'test:delete:key'
    client.set('cn-north', test_key, 'test_value')
    result = client.delete('cn-north', test_key)
    assert result.success, "删除应该成功"
    print("  ✓ 缓存删除成功")
    
    result = client.get('cn-north', test_key)
    assert result.value is None, "删除后应该不存在"
    print("  ✓ 删除后确认不存在")
    
    print("\n✓ 缓存客户端测试完成")
    return True


def test_execution():
    """测试执行功能"""
    print("\n" + "=" * 60)
    print("测试 4: 任务执行功能")
    print("=" * 60)
    
    from cache_invalidator import (
        ConfigLoader, TemplateManager, MockCacheClient, 
        InvalidationExecutor, ReportGenerator
    )
    from cache_invalidator.executor import TaskStatus, RegionTaskStatus
    
    config_loader = ConfigLoader(
        'config/regions.yaml',
        'config/templates.yaml',
        'examples/tasks.yaml'
    )
    template_manager = TemplateManager('config/templates.yaml')
    cache_client = MockCacheClient('examples/mock_cache.json')
    executor = InvalidationExecutor(
        template_manager, 
        cache_client,
        max_retries=1,
        retry_delay=0
    )
    reporter = ReportGenerator(output_dir='reports')
    
    regions = config_loader.load_regions()
    tasks = config_loader.load_tasks()
    
    # 执行前先重置历史
    executor.reset_execution_history()
    
    # 测试 4.1: 执行第一个任务
    print("\n4.1 执行第一个任务")
    task1 = tasks[0]
    result1 = executor.execute_task(task1, regions)
    
    print(f"  任务 ID: {result1.task_id}")
    print(f"  状态: {result1.status.value}")
    print(f"  缓存键: {result1.cache_key}")
    
    # 检查华西区域被跳过
    cn_west_result = result1.region_results.get('cn-west')
    assert cn_west_result, "应该有 cn-west 结果"
    assert cn_west_result.status == RegionTaskStatus.SKIPPED, "cn-west 应该被跳过"
    print(f"  ✓ cn-west 被跳过，原因: {cn_west_result.skip_reason}")
    
    # 测试 4.2: 重复执行检测
    print("\n4.2 测试重复执行检测")
    result1_duplicate = executor.execute_task(task1, regions)
    print(f"  重复执行状态: {result1_duplicate.status.value}")
    
    has_duplicate = any(
        r.status == RegionTaskStatus.DUPLICATE 
        for r in result1_duplicate.region_results.values()
    )
    assert has_duplicate, "应该检测到重复执行"
    print("  ✓ 检测到重复执行")
    
    # 测试 4.3: 执行所有任务
    print("\n4.3 执行所有任务")
    executor.reset_execution_history()
    results = executor.execute_all(regions, tasks)
    
    print(f"  执行任务数: {len(results)}")
    success_count = sum(1 for r in results if r.status == TaskStatus.SUCCESS)
    print(f"  全部成功数: {success_count}")
    
    # 生成报告
    print("\n4.4 生成报告")
    report_path = reporter.generate_report(
        results,
        report_name='test_report'
    )
    print(f"  ✓ 报告已生成: {report_path}")
    
    # 验证报告文件存在
    assert Path(report_path).exists(), "报告文件应该存在"
    print("  ✓ 报告文件存在")
    
    print("\n✓ 执行功能测试完成")
    return True


def test_verification():
    """测试验证功能"""
    print("\n" + "=" * 60)
    print("测试 5: 一致性验证")
    print("=" * 60)
    
    from cache_invalidator import (
        ConfigLoader, TemplateManager, MockCacheClient
    )
    
    config_loader = ConfigLoader(
        'config/regions.yaml',
        'config/templates.yaml',
        'examples/tasks.yaml'
    )
    template_manager = TemplateManager('config/templates.yaml')
    cache_client = MockCacheClient('examples/mock_cache.json')
    
    regions = config_loader.load_regions()
    tasks = config_loader.load_tasks()
    
    print("\n5.1 检查缓存状态")
    inconsistent_count = 0
    
    for task in tasks[:3]:  # 只检查前3个任务
        cache_key, errors = template_manager.build_cache_key(
            task.template, task.variables
        )
        if not cache_key:
            continue
        
        print(f"\n  任务: {task.id}, 缓存键: {cache_key}")
        
        for region_id, region in regions.items():
            result = cache_client.get(region_id, cache_key)
            if result.success and result.value is not None:
                inconsistent_count += 1
                print(f"    ✗ {region.name}: 存在旧值")
            else:
                print(f"    ✓ {region.name}: 已清理或不存在")
    
    print(f"\n  发现旧值区域数: {inconsistent_count}")
    print("\n✓ 一致性验证测试完成")
    return True


def main():
    """主测试函数"""
    print("=" * 60)
    print("多区域缓存失效 CLI 功能验证")
    print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # 准备测试环境
    clean_reports()
    restore_mock_cache()
    
    # 运行所有测试
    tests = [
        ("预检功能", test_precheck),
        ("模板验证", test_template_validation),
        ("缓存客户端", test_cache_client),
        ("任务执行", test_execution),
        ("一致性验证", test_verification),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            success = test_func()
            results.append((name, success, None))
        except Exception as e:
            results.append((name, False, str(e)))
            print(f"\n✗ 测试失败: {name}")
            print(f"  错误: {e}")
            import traceback
            traceback.print_exc()
    
    # 汇总结果
    print("\n" + "=" * 60)
    print("测试汇总")
    print("=" * 60)
    
    passed = 0
    failed = 0
    
    for name, success, error in results:
        if success:
            print(f"✓ {name}")
            passed += 1
        else:
            print(f"✗ {name}: {error or '失败'}")
            failed += 1
    
    print(f"\n通过: {passed}/{len(tests)}")
    print(f"失败: {failed}/{len(tests)}")
    
    return failed == 0


if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
