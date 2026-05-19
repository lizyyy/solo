#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
验证测试脚本：测试所有场景并验证机器可读输出和人看的报告是否一致
"""

import json
import subprocess
import sys
import os
from datetime import datetime, timedelta


def run_cli_test(test_name: str, tasks_file: str, start_time: str, end_time: str, 
                description: str, expected_collisions: bool = True) -> bool:
    """运行CLI测试"""
    print(f"\n{'='*80}")
    print(f"测试: {test_name}")
    print(f"描述: {description}")
    print(f"{'='*80}")
    
    json_out = f"report_{test_name}.json"
    text_out = f"report_{test_name}.txt"
    
    cmd = [
        sys.executable, 'cron_collision_checker.py',
        '--tasks', tasks_file,
        '--start', start_time,
        '--end', end_time,
        '--json-out', json_out,
        '--text-out', text_out,
        '--no-text'
    ]
    
    print(f"执行命令: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode != 0:
            print(f"❌ 命令执行失败，返回码: {result.returncode}")
            print(f"stderr: {result.stderr}")
            return False
        
        print(f"✅ 命令执行成功")
        
        with open(json_out, 'r', encoding='utf-8') as f:
            json_data = json.load(f)
        
        with open(text_out, 'r', encoding='utf-8') as f:
            text_content = f.read()
        
        summary = json_data['summary']
        print(f"📊 执行状态: {summary['status']}")
        print(f"📊 有效任务数: {summary['valid_task_count']}")
        print(f"📊 错误任务数: {summary['error_count']}")
        print(f"📊 碰撞记录数: {summary['collision_count']}")
        
        if expected_collisions and summary['collision_count'] == 0:
            print("⚠️  警告: 预期有碰撞但实际未检测到")
        elif not expected_collisions and summary['collision_count'] > 0:
            print("⚠️  警告: 预期无碰撞但实际检测到")
        
        collision_match = verify_consistency(json_data, text_content)
        if collision_match:
            print("✅ JSON报告和文本报告数据一致")
        else:
            print("❌ JSON报告和文本报告数据不一致")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()
        return False


def verify_consistency(json_data: dict, text_content: str) -> bool:
    """验证JSON报告和文本报告的数据一致性"""
    
    summary = json_data['summary']
    
    if str(summary['valid_task_count']) not in text_content:
        print(f"  - 错误: 有效任务数 {summary['valid_task_count']} 未在文本报告中找到")
        return False
    
    if str(summary['error_count']) not in text_content:
        print(f"  - 错误: 错误任务数 {summary['error_count']} 未在文本报告中找到")
        return False
    
    if str(summary['collision_count']) not in text_content:
        print(f"  - 错误: 碰撞记录数 {summary['collision_count']} 未在文本报告中找到")
        return False
    
    for collision in json_data['collisions']:
        time_point = collision['time_point']
        resource_tag = collision['resource_tag']
        task_count = collision['task_count']
        
        if time_point not in text_content:
            print(f"  - 错误: 时间点 {time_point} 未在文本报告中找到")
            return False
        if resource_tag not in text_content:
            print(f"  - 错误: 资源标签 {resource_tag} 未在文本报告中找到")
            return False
        if str(task_count) not in text_content:
            print(f"  - 警告: 任务数 {task_count} 可能未在文本报告中正确显示")
    
    for error in json_data['errors']:
        error_msg = error['error']
        if error_msg not in text_content:
            print(f"  - 警告: 错误信息可能未在文本报告中正确显示: {error_msg}")
    
    return True


def main():
    print("=" * 80)
    print("           Cron排期碰撞资源标签排查CLI - 验证测试套件")
    print("=" * 80)
    
    base_time = datetime(2024, 1, 1, 0, 0, 0)
    
    tests = [
        {
            'name': 'normal_case',
            'tasks_file': 'test_samples.json',
            'start': (base_time + timedelta(hours=2)).strftime('%Y-%m-%d %H:%M:%S'),
            'end': (base_time + timedelta(hours=4)).strftime('%Y-%m-%d %H:%M:%S'),
            'description': '正常输入测试：包含有效任务、脏数据、边界任务',
            'expected_collisions': True
        },
        {
            'name': 'boundary_case',
            'tasks_file': 'boundary_test.json',
            'start': '2024-01-01 00:00:00',
            'end': '2024-12-31 23:59:59',
            'description': '边界冲突测试：元旦、年末、周日边界',
            'expected_collisions': True
        },
        {
            'name': 'no_collision_case',
            'tasks_file': 'no_collision.json',
            'start': '2024-01-01 00:00:00',
            'end': '2024-01-02 00:00:00',
            'description': '空结果测试：无资源冲突',
            'expected_collisions': False
        }
    ]
    
    results = []
    for test in tests:
        success = run_cli_test(
            test['name'],
            test['tasks_file'],
            test['start'],
            test['end'],
            test['description'],
            test['expected_collisions']
        )
        results.append((test['name'], success))
    
    print("\n" + "=" * 80)
    print("测试结果汇总")
    print("=" * 80)
    
    passed = sum(1 for _, s in results if s)
    total = len(results)
    
    for name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"  {status}: {name}")
    
    print(f"\n总计: {passed}/{total} 测试通过")
    
    if passed == total:
        print("\n🎉 所有测试通过！")
        return 0
    else:
        print("\n⚠️  部分测试失败，请检查")
        return 1


if __name__ == '__main__':
    exit(main())
