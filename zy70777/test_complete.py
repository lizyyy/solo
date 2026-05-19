#!/usr/bin/env python3
import json
import os
from password_policy_cli import PasswordPolicy, BoundaryGenerator, RuleEngine, Reporter

policy = PasswordPolicy(
    min_length=8,
    max_length=64,
    min_uppercase=1,
    min_lowercase=1,
    min_digits=1,
    min_special=1,
    forbid_consecutive=False
)

generator = BoundaryGenerator(policy)
samples = generator.generate_all_boundaries()

print(f"生成了 {len(samples)} 个边界测试样本\n")

engine = RuleEngine(policy)
results = engine.validate_batch(samples)

print("第一次运行结果:")
reporter1 = Reporter(results)
stats1 = reporter1.get_statistics()
print(f"  总测试数: {stats1['total']}")
print(f"  通过数: {stats1['valid']}")
print(f"  失败数: {stats1['invalid']}")

results2 = engine.validate_batch(samples)
reporter2 = Reporter(results2)
stats2 = reporter2.get_statistics()

print("\n第二次运行结果 (验证稳定性):")
print(f"  总测试数: {stats2['total']}")
print(f"  通过数: {stats2['valid']}")
print(f"  失败数: {stats2['invalid']}")

if stats1 == stats2:
    print("\n✓ 重复运行结果稳定!")
else:
    print("\n✗ 重复运行结果不一致!")

os.makedirs('test_output', exist_ok=True)

reporter1.generate_json_report('test_output/report.json')
reporter1.generate_csv_report('test_output/report.csv')
reporter1.generate_group_reports('test_output/groups')

print("\n✓ 报告已生成到 test_output/ 目录")

with open('test_output/report.json', 'r', encoding='utf-8') as f:
    report_data = json.load(f)
    print(f"\nJSON报告验证: 包含 {len(report_data['results'])} 个结果")
    print(f"  统计: {report_data['statistics']['valid']}/{report_data['statistics']['total']} 通过")

print("\n" + "="*60)
reporter1.print_summary()
