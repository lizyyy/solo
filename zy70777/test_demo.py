#!/usr/bin/env python3
from password_policy_cli import PasswordPolicy, PolicyParser, BoundaryGenerator, RuleEngine, Reporter

policy = PasswordPolicy(
    min_length=8,
    max_length=64,
    min_uppercase=1,
    min_lowercase=1,
    min_digits=1,
    min_special=1,
    forbid_consecutive=True
)

print("=== 策略配置 ===")
import json
print(json.dumps(policy.to_dict(), ensure_ascii=False, indent=2))

generator = BoundaryGenerator(policy)
samples = generator.generate_all_boundaries()

print(f"\n=== 生成了 {len(samples)} 个边界测试样本 ===")

engine = RuleEngine(policy)
results = engine.validate_batch(samples)

reporter = Reporter(results)
print("\n=== 测试报告摘要 ===")
reporter.print_summary()

print(f"\n退出码: {reporter.get_exit_code()}")
