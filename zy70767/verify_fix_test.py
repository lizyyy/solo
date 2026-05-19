#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
验证Cron星期字段修复和脏数据报告修复的专门测试
"""

import json
import subprocess
import sys
from datetime import datetime


def test_weekday_fix():
    """测试星期字段修复"""
    print("=" * 80)
    print("测试1: Cron星期字段修复验证")
    print("=" * 80)
    
    test_tasks = [
        {
            "task_id": "sunday_task",
            "cron_expr": "0 12 * * SUN",
            "resource_tags": ["test:weekday"]
        },
        {
            "task_id": "sunday_task_0",
            "cron_expr": "0 12 * * 0",
            "resource_tags": ["test:weekday"]
        },
        {
            "task_id": "monday_task",
            "cron_expr": "0 12 * * MON",
            "resource_tags": ["test:weekday"]
        },
        {
            "task_id": "monday_task_1",
            "cron_expr": "0 12 * * 1",
            "resource_tags": ["test:weekday"]
        },
        {
            "task_id": "weekday_range",
            "cron_expr": "0 9 * * MON-FRI",
            "resource_tags": ["test:range"]
        },
        {
            "task_id": "weekday_range_num",
            "cron_expr": "0 9 * * 1-5",
            "resource_tags": ["test:range"]
        }
    ]
    
    with open('/tmp/test_weekday.json', 'w') as f:
        json.dump(test_tasks, f, indent=2)
    
    # 测试2024-01-07 周日的碰撞
    print("\n测试日期范围: 2024-01-07 00:00:00 (周日) 到 2024-01-07 23:59:59")
    cmd = [
        sys.executable, 'cron_collision_checker.py',
        '--tasks', '/tmp/test_weekday.json',
        '--start', '2024-01-07 00:00:00',
        '--end', '2024-01-07 23:59:59',
        '--json-out', '/tmp/report_sunday.json',
        '--no-text'
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    with open('/tmp/report_sunday.json', 'r') as f:
        report = json.load(f)
    
    sunday_12pm = "2024-01-07 12:00:00"
    sunday_collision = False
    for col in report['collisions']:
        if col['time_point'] == sunday_12pm and col['resource_tag'] == 'test:weekday':
            sunday_collision = True
            print(f"✅ 周日 12:00 检测到碰撞: {col['task_ids']}")
            print(f"   (应该包含 sunday_task 和 sunday_task_0)")
    
    if not sunday_collision:
        print("❌ 周日 12:00 应该有碰撞但未检测到")
        return False
    
    # 测试2024-01-08 周一的碰撞
    print("\n测试日期范围: 2024-01-08 00:00:00 (周一) 到 2024-01-08 23:59:59")
    cmd = [
        sys.executable, 'cron_collision_checker.py',
        '--tasks', '/tmp/test_weekday.json',
        '--start', '2024-01-08 00:00:00',
        '--end', '2024-01-08 23:59:59',
        '--json-out', '/tmp/report_monday.json',
        '--no-text'
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    with open('/tmp/report_monday.json', 'r') as f:
        report = json.load(f)
    
    monday_12pm = "2024-01-08 12:00:00"
    monday_9am = "2024-01-08 09:00:00"
    monday_12pm_collision = False
    monday_9am_collision = False
    
    for col in report['collisions']:
        if col['time_point'] == monday_12pm and col['resource_tag'] == 'test:weekday':
            monday_12pm_collision = True
            print(f"✅ 周一 12:00 检测到碰撞: {col['task_ids']}")
        if col['time_point'] == monday_9am and col['resource_tag'] == 'test:range':
            monday_9am_collision = True
            print(f"✅ 周一 09:00 检测到碰撞: {col['task_ids']}")
    
    if not monday_12pm_collision:
        print("❌ 周一 12:00 应该有碰撞但未检测到")
        return False
    if not monday_9am_collision:
        print("❌ 周一 09:00 应该有碰撞但未检测到")
        return False
    
    return True


def test_invalid_cron_error_report():
    """测试无效cron表达式被正确记录到errors"""
    print("\n" + "=" * 80)
    print("测试2: 无效Cron表达式错误报告验证")
    print("=" * 80)
    
    test_tasks = [
        {
            "task_id": "valid_task",
            "cron_expr": "0 12 * * *",
            "resource_tags": ["test:valid"]
        },
        {
            "task_id": "invalid_cron_task",
            "cron_expr": "invalid_cron",
            "resource_tags": ["test:invalid"]
        },
        {
            "task_id": "",
            "cron_expr": "0 0 * * *",
            "resource_tags": ["test:empty_id"]
        }
    ]
    
    with open('/tmp/test_invalid.json', 'w') as f:
        json.dump(test_tasks, f, indent=2)
    
    cmd = [
        sys.executable, 'cron_collision_checker.py',
        '--tasks', '/tmp/test_invalid.json',
        '--start', '2024-01-01 00:00:00',
        '--end', '2024-01-01 23:59:59',
        '--json-out', '/tmp/report_invalid.json',
        '--no-text'
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    with open('/tmp/report_invalid.json', 'r') as f:
        report = json.load(f)
    
    print(f"有效任务数: {report['summary']['valid_task_count']}")
    print(f"错误任务数: {report['summary']['error_count']}")
    
    if report['summary']['error_count'] != 2:
        print(f"❌ 错误任务数应该是2，实际是{report['summary']['error_count']}")
        return False
    
    found_invalid_cron = False
    found_empty_id = False
    
    for err in report['errors']:
        if 'Cron表达式格式无效' in err['error']:
            found_invalid_cron = True
            print(f"✅ 无效Cron表达式被正确记录: {err['error'][:50]}...")
        if '任务ID不能为空' in err['error']:
            found_empty_id = True
            print(f"✅ 空任务ID被正确记录")
    
    if not found_invalid_cron:
        print("❌ 无效Cron表达式未被记录到errors列表")
        return False
    if not found_empty_id:
        print("❌ 空任务ID未被记录到errors列表")
        return False
    
    # 验证有效任务不包含无效cron的任务
    valid_task_ids = [t['task_id'] for t in report['valid_tasks']]
    if 'invalid_cron_task' in valid_task_ids:
        print("❌ 无效Cron任务不应该出现在有效任务列表中")
        return False
    
    print("✅ 脏数据报告完整")
    return True


def main():
    all_passed = True
    
    # 测试1: 星期字段修复
    if not test_weekday_fix():
        all_passed = False
    
    # 测试2: 无效cron错误报告
    if not test_invalid_cron_error_report():
        all_passed = False
    
    print("\n" + "=" * 80)
    if all_passed:
        print("✅ 所有验证测试通过！")
    else:
        print("❌ 部分测试失败")
    print("=" * 80)
    
    return 0 if all_passed else 1


if __name__ == '__main__':
    exit(main())
