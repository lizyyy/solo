#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
验证越界Cron表达式被正确检测的测试
"""

import json
import subprocess
import sys


def test_out_of_bounds_cron():
    """测试5种越界Cron表达式"""
    print("=" * 80)
    print("测试: 越界Cron表达式验证")
    print("=" * 80)
    
    test_tasks = [
        {
            "task_id": "minute_60",
            "cron_expr": "60 * * * *",
            "resource_tags": ["test:oob"]
        },
        {
            "task_id": "hour_24",
            "cron_expr": "0 24 * * *",
            "resource_tags": ["test:oob"]
        },
        {
            "task_id": "day_32",
            "cron_expr": "0 0 32 * *",
            "resource_tags": ["test:oob"]
        },
        {
            "task_id": "month_13",
            "cron_expr": "0 0 * 13 *",
            "resource_tags": ["test:oob"]
        },
        {
            "task_id": "weekday_7",
            "cron_expr": "0 0 * * 7",
            "resource_tags": ["test:oob"]
        }
    ]
    
    with open('/tmp/test_oob.json', 'w') as f:
        json.dump(test_tasks, f, indent=2)
    
    cmd = [
        sys.executable, 'cron_collision_checker.py',
        '--tasks', '/tmp/test_oob.json',
        '--start', '2024-01-01 00:00:00',
        '--end', '2024-01-01 23:59:59',
        '--json-out', '/tmp/report_oob.json',
        '--no-text'
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    with open('/tmp/report_oob.json', 'r') as f:
        report = json.load(f)
    
    print(f"\n📊 有效任务数: {report['summary']['valid_task_count']}")
    print(f"📊 错误任务数: {report['summary']['error_count']}")
    print()
    
    # 验证: 所有5个任务都应该报错
    if report['summary']['error_count'] != 5:
        print(f"❌ 错误任务数应该是5，实际是{report['summary']['error_count']}")
        return False
    
    if report['summary']['valid_task_count'] != 0:
        print(f"❌ 有效任务数应该是0，实际是{report['summary']['valid_task_count']}")
        return False
    
    # 检查每个错误的具体信息
    expected_errors = {
        'minute_60': 'minute',
        'hour_24': 'hour',
        'day_32': 'day',
        'month_13': 'month',
        'weekday_7': 'weekday'
    }
    
    found_errors = set()
    for err in report['errors']:
        task_id = err['data']['task_id']
        error_msg = err['error']
        print(f"✅ {task_id}: {error_msg[:60]}...")
        found_errors.add(task_id)
        
        # 验证错误信息包含字段名
        field_name = expected_errors.get(task_id)
        if field_name and field_name not in error_msg:
            print(f"  ⚠️  警告: 错误信息中未包含字段名 '{field_name}'")
    
    # 验证所有预期的错误都被检测到
    for expected_task_id in expected_errors:
        if expected_task_id not in found_errors:
            print(f"❌ 未检测到预期的错误: {expected_task_id}")
            return False
    
    print()
    print("✅ 所有5种越界Cron表达式都被正确检测并记入errors列表")
    print("✅ 无效任务未被计入valid_tasks")
    
    return True


def main():
    success = test_out_of_bounds_cron()
    
    print("\n" + "=" * 80)
    if success:
        print("✅ 越界Cron表达式测试通过！")
    else:
        print("❌ 越界Cron表达式测试失败")
    print("=" * 80)
    
    return 0 if success else 1


if __name__ == '__main__':
    exit(main())
