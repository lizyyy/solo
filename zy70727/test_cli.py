#!/usr/bin/env python3
import subprocess
import json
import os
import sys


def run_test(name, args, should_pass=True):
    print(f"\n{'='*60}")
    print(f"测试: {name}")
    print(f"{'='*60}")
    cmd = [sys.executable, 'region_evacuation_cli.py'] + args
    print(f"命令: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    print(f"退出码: {result.returncode}")
    if result.stdout:
        print(f"标准输出:\n{result.stdout}")
    if result.stderr:
        print(f"标准错误:\n{result.stderr}")
    
    if should_pass and result.returncode != 0:
        print(f"❌ 测试失败: 预期成功但实际失败")
        return False
    if not should_pass and result.returncode == 0:
        print(f"❌ 测试失败: 预期失败但实际成功")
        return False
    print("✅ 测试通过")
    return True


def verify_output_consistency(json_path, report_path):
    print(f"\n验证机器可读输出和人可读输出一致性")
    with open(json_path, 'r', encoding='utf-8') as f:
        json_data = json.load(f)
    
    with open(report_path, 'r', encoding='utf-8') as f:
        report_content = f.read()
    
    checks = [
        (str(json_data['total_tenants']), f"租户总数: {json_data['total_tenants']}"),
        (str(json_data['blocked_count']), f"阻塞租户数: {json_data['blocked_count']}"),
        (str(json_data['cleared_count']), f"可撤离租户数: {json_data['cleared_count']}"),
        (json_data['region'], f"区域名称: {json_data['region']}"),
    ]
    
    all_passed = True
    for json_val, report_text in checks:
        if report_text in report_content:
            print(f"✅ 一致: {report_text}")
        else:
            print(f"❌ 不一致: JSON值={json_val}, 报告中未找到'{report_text}'")
            all_passed = False
    
    for bt in json_data['blocked_tenants']:
        tenant_name = bt['tenant_name']
        if tenant_name in report_content:
            print(f"✅ 租户 '{tenant_name}' 在报告中存在")
        else:
            print(f"❌ 租户 '{tenant_name}' 在报告中缺失")
            all_passed = False
    
    return all_passed


def verify_step_behavior():
    print(f"\n验证步骤执行行为")
    all_passed = True
    
    result = subprocess.run(
        [sys.executable, 'region_evacuation_cli.py', 
         '--region', 'test',
         '--tenants', 'test_data/normal_tenants.json',
         '--plan', 'test_data/normal_plan.json',
         '--json-out', 'output/step_test.json'],
        capture_output=True, text=True
    )
    
    with open('output/step_test.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if data['executed_steps'] == 1 and data['skipped_steps'] == 2:
        print(f"✅ 步骤计数正确: 执行1个, 跳过2个")
    else:
        print(f"❌ 步骤计数错误: 执行{data['executed_steps']}个, 跳过{data['skipped_steps']}个")
        all_passed = False
    
    step_statuses = [s['status'] for s in data['evacuation_plan']]
    if "已执行" in step_statuses and "跳过-租户阻塞" in step_statuses:
        print(f"✅ 步骤状态正确: 包含执行和跳过状态")
    else:
        print(f"❌ 步骤状态异常: {step_statuses}")
        all_passed = False
    
    return all_passed


def verify_check_only():
    print(f"\n验证 --check-only 模式行为")
    all_passed = True
    
    result = subprocess.run(
        [sys.executable, 'region_evacuation_cli.py', 
         '--region', 'test',
         '--tenants', 'test_data/normal_tenants.json',
         '--plan', 'test_data/normal_plan.json',
         '--check-only',
         '--json-out', 'output/check_only_test.json'],
        capture_output=True, text=True
    )
    
    with open('output/check_only_test.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if data['check_only'] == True:
        print(f"✅ check_only 标记正确")
    else:
        print(f"❌ check_only 标记错误")
        all_passed = False
    
    if data['executed_steps'] == 0:
        print(f"✅ 仅检查模式下无步骤执行")
    else:
        print(f"❌ 仅检查模式下仍有步骤执行")
        all_passed = False
    
    return all_passed


def main():
    os.makedirs('output', exist_ok=True)
    
    tests = [
        ("正常输入测试", [
            '--region', 'beijing',
            '--tenants', 'test_data/normal_tenants.json',
            '--plan', 'test_data/normal_plan.json',
            '--json-out', 'output/normal_result.json',
            '--report-out', 'output/normal_report.txt',
        ], True),
        ("空结果测试", [
            '--region', 'shanghai',
            '--tenants', 'test_data/empty_tenants.json',
            '--json-out', 'output/empty_result.json',
            '--report-out', 'output/empty_report.txt'
        ], True),
        ("边界冲突测试", [
            '--region', 'shenzhen',
            '--tenants', 'test_data/boundary_tenants.json',
            '--json-out', 'output/boundary_result.json',
            '--report-out', 'output/boundary_report.txt'
        ], True),
        ("CSV格式测试", [
            '--region', 'guangzhou',
            '--tenants', 'test_data/tenants.csv',
            '--json-out', 'output/csv_result.json',
            '--report-out', 'output/csv_report.txt'
        ], True),
        ("仅检查模式", [
            '--region', 'hangzhou',
            '--tenants', 'test_data/normal_tenants.json',
            '--check-only'
        ], True),
    ]
    
    results = []
    for name, args, should_pass in tests:
        results.append(run_test(name, args, should_pass))
    
    print(f"\n{'='*60}")
    print("功能验证")
    print(f"{'='*60}")
    consistency_passed = verify_output_consistency(
        'output/normal_result.json',
        'output/normal_report.txt'
    )
    step_behavior_passed = verify_step_behavior()
    check_only_passed = verify_check_only()
    
    print(f"\n{'='*60}")
    print("测试总结")
    print(f"{'='*60}")
    passed = sum(results)
    total = len(results)
    print(f"基础功能测试: {passed}/{total} 通过")
    print(f"输出一致性验证: {'通过' if consistency_passed else '失败'}")
    print(f"步骤行为验证: {'通过' if step_behavior_passed else '失败'}")
    print(f"仅检查模式验证: {'通过' if check_only_passed else '失败'}")
    
    all_passed = all(results) and consistency_passed and step_behavior_passed and check_only_passed
    print(f"总结果: {'✅ 全部通过' if all_passed else '❌ 有失败'}")
    
    return 0 if all_passed else 1


if __name__ == '__main__':
    sys.exit(main())
