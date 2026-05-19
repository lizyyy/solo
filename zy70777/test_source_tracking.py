#!/usr/bin/env python3
import os
from password_policy_cli import PasswordPolicy, BoundaryGenerator, RuleEngine, Reporter

with open('test_candidates.txt', 'w', encoding='utf-8') as f:
    f.write('# 测试候选密码文件\n')
    f.write('short123\tgroup1\t第1行的短密码\n')
    f.write('GoodPass456!\tgroup1\t第2行的有效密码\n')
    f.write('nouppercase123!\tgroup2\t第3行缺少大写\n')

policy = PasswordPolicy(
    min_length=8,
    min_uppercase=1,
    min_digits=1,
    min_special=1
)

samples = BoundaryGenerator.load_candidates_from_file('test_candidates.txt')

print(f"加载了 {len(samples)} 个候选密码\n")

for i, sample in enumerate(samples, 1):
    print(f"候选密码 #{i}: {sample.password}")
    print(f"  分组: {sample.test_group}")
    print(f"  描述: {sample.description}")
    print(f"  来源文件: {sample.metadata.get('source_file')}")
    print(f"  行号: {sample.metadata.get('line_number')}")
    print()

engine = RuleEngine(policy)
results = engine.validate_batch(samples)

print("\n" + "="*60)
print("验证结果 (带来源追踪):")
print("="*60)
for result in results:
    status = "✓ 有效" if result.is_valid else "✗ 无效"
    print(f"\n{status}: {result.password}")
    if result.source_file:
        print(f"  位置: {os.path.basename(result.source_file)}:{result.line_number}")
    print(f"  分组: {result.test_group}")
    if result.failure_reasons:
        print("  失败原因:")
        for fr in result.failure_reasons:
            print(f"    - {fr.message}")

os.unlink('test_candidates.txt')
