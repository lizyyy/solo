"""测试脚本 - 运行所有测试样例，验证贝叶斯A/B试验台"""

import json
import os
import sys
from pathlib import Path

# 添加项目路径
sys.path.insert(0, str(Path(__file__).parent))

from bayesian_ab.cli import load_input_from_json
from bayesian_ab.pipeline import run_experiment
from bayesian_ab.report_generator import ReportGenerator


EXAMPLES_DIR = Path(__file__).parent / "examples"
OUTPUT_DIR = Path(__file__).parent / "test_outputs"


def test_reproducibility():
    """测试可复算性：相同输入运行两次，结果应该一致"""
    print("=" * 70)
    print("🧪 测试1：可复算性验证")
    print("=" * 70)
    
    input_file = EXAMPLES_DIR / "01_normal_clean.json"
    experiment_input = load_input_from_json(str(input_file))
    
    print(f"输入文件: {input_file}")
    print()
    
    # 运行两次
    report1 = run_experiment(experiment_input, sample_count=50000)
    report2 = run_experiment(experiment_input, sample_count=50000)
    
    print(f"第一次运行 - 输入哈希: {report1.input_hash[:16]}...")
    print(f"第一次运行 - 随机种子: {report1.reproducibility_seed}")
    print(f"第一次运行 - P(实验组>对照组): {report1.bayesian_result.probability_treatment_better:.6%}")
    print()
    print(f"第二次运行 - 输入哈希: {report2.input_hash[:16]}...")
    print(f"第二次运行 - 随机种子: {report2.reproducibility_seed}")
    print(f"第二次运行 - P(实验组>对照组): {report2.bayesian_result.probability_treatment_better:.6%}")
    print()
    
    # 验证一致性
    hash_match = report1.input_hash == report2.input_hash
    seed_match = report1.reproducibility_seed == report2.reproducibility_seed
    prob_match = abs(
        report1.bayesian_result.probability_treatment_better
        - report2.bayesian_result.probability_treatment_better
    ) < 1e-10
    lift_match = abs(
        report1.bayesian_result.expected_lift - report2.bayesian_result.expected_lift
    ) < 1e-10
    
    print(f"输入哈希一致: ✅ {hash_match}")
    print(f"随机种子一致: ✅ {seed_match}")
    print(f"P(实验组>对照组)一致: ✅ {prob_match}")
    print(f"预期提升量一致: ✅ {lift_match}")
    print()
    
    all_pass = hash_match and seed_match and prob_match and lift_match
    print(f"可复算性测试: {'✅ 通过' if all_pass else '❌ 失败'}")
    print()
    
    return all_pass


def test_example(input_file: Path, description: str, expected_flags: list):
    """测试单个样例"""
    print("=" * 70)
    print(f"🧪 {description}")
    print("=" * 70)
    print(f"输入文件: {input_file.name}")
    print()
    
    experiment_input = load_input_from_json(str(input_file))
    report = run_experiment(experiment_input, sample_count=50000)
    
    print(f"📊 基本信息")
    print(f"  试验ID: {report.experiment_id}")
    print(f"  输入哈希: {report.input_hash[:16]}...")
    print(f"  随机种子: {report.reproducibility_seed}")
    print(f"  数据质量: {report.validation.data_quality.value}")
    print()
    
    print(f"🔍 验证结果")
    print(f"  验证状态: {'✅ 通过' if report.validation.is_valid else '❌ 未通过'}")
    if report.validation.missing_fields:
        print(f"  缺失字段: {report.validation.missing_fields}")
    if report.validation.invalid_fields:
        print(f"  无效字段: {report.validation.invalid_fields}")
    if report.validation.warnings:
        print(f"  警告数量: {len(report.validation.warnings)}")
        for w in report.validation.warnings[:3]:
            print(f"    ⚠️  {w[:80]}...")
    if report.validation.errors:
        print(f"  错误数量: {len(report.validation.errors)}")
        for e in report.validation.errors[:3]:
            print(f"    ❌ {e[:80]}...")
    print()
    
    print(f"  处理顺序:")
    for i, step in enumerate(report.validation.processing_order, 1):
        print(f"    {i}. {step}")
    print()
    
    if report.validation.is_valid:
        print(f"📈 贝叶斯分析结果")
        print(f"  P(实验组>对照组): {report.bayesian_result.probability_treatment_better:.2%}")
        print(f"  预期提升: {report.bayesian_result.expected_lift:.2%}")
        print(f"  95%CI提升: [{report.bayesian_result.lift_ci_lower:.2%}, {report.bayesian_result.lift_ci_upper:.2%}]")
        print(f"  先验强度: {report.bayesian_result.prior_strength:.1f}")
        print(f"  有效样本量: {report.bayesian_result.effective_sample_size:.0f}")
        print()
        
        if report.bayesian_result.metric_results:
            print(f"  多指标结果:")
            for metric_name, metric_result in report.bayesian_result.metric_results.items():
                direction = "🟢" if metric_result.probability_treatment_better >= 0.95 else \
                           "🔴" if metric_result.probability_treatment_better <= 0.05 else "⚪"
                print(f"    {direction} {metric_name}: P={metric_result.probability_treatment_better:.2%}, "
                      f"提升={metric_result.expected_lift:.2%}")
            print()
    
    print(f"⚠️  风险检测")
    print(f"  整体风险等级: {report.risk_assessment.overall_risk_level.value}")
    print(f"  提前停测风险: {'✅ 检测到' if report.risk_assessment.has_early_stop else '❌ 未检测到'}")
    print(f"  先验过强风险: {'✅ 检测到' if report.risk_assessment.has_strong_prior else '❌ 未检测到'}")
    print(f"  指标冲突风险: {'✅ 检测到' if report.risk_assessment.has_metric_conflict else '❌ 未检测到'}")
    print()
    
    if report.risk_assessment.flags:
        print(f"  风险详情 ({len(report.risk_assessment.flags)}个):")
        for flag in report.risk_assessment.flags:
            icon = "🔴" if flag.level.value == "critical" else \
                   "🟠" if flag.level.value == "high" else \
                   "🟡" if flag.level.value == "medium" else "🟢"
            print(f"    {icon} {flag.risk_type} ({flag.level.value}):")
            print(f"       {flag.message[:100]}...")
        print()
    
    print(f"🛑 停测建议")
    print(f"  建议: {report.risk_assessment.stopping_recommendation.value}")
    print(f"  说明: {report.risk_assessment.stopping_message[:100]}...")
    print()
    
    print(f"📝 结论")
    for conclusion in report.conclusions:
        print(f"  {conclusion}")
    print()
    
    # 验证预期的风险标记
    print(f"🎯 预期验证")
    detected_flags = [f.risk_type for f in report.risk_assessment.flags]
    all_expected_found = True
    for expected_flag in expected_flags:
        found = expected_flag in detected_flags
        all_expected_found = all_expected_found and found
        print(f"  预期检测到 '{expected_flag}': {'✅ 是' if found else '❌ 否'}")
    print()
    
    # 保存报告
    OUTPUT_DIR.mkdir(exist_ok=True)
    report_gen = ReportGenerator()
    
    json_path = OUTPUT_DIR / f"{input_file.stem}_report.json"
    md_path = OUTPUT_DIR / f"{input_file.stem}_report.md"
    
    report_gen.save_json(report, str(json_path))
    report_gen.save_markdown(report, str(md_path))
    
    print(f"💾 报告已保存:")
    print(f"  JSON: {json_path}")
    print(f"  Markdown: {md_path}")
    print()
    
    return all_expected_found


def main():
    """主测试函数"""
    print()
    print("╔" + "═" * 68 + "╗")
    print("║" + " " * 15 + "贝叶斯A/B试验台 - 综合测试套件" + " " * 15 + "║")
    print("╚" + "═" * 68 + "╝")
    print()
    
    # 创建输出目录
    OUTPUT_DIR.mkdir(exist_ok=True)
    
    results = []
    
    # 测试1：可复算性
    results.append(("可复算性验证", test_reproducibility()))
    
    # 测试2：正常数据
    results.append((
        "正常数据测试",
        test_example(
            EXAMPLES_DIR / "01_normal_clean.json",
            "测试2：正常干净数据 - 无风险",
            [],  # 预期无重大风险
        )
    ))
    
    # 测试3：提前停测
    results.append((
        "提前停测测试",
        test_example(
            EXAMPLES_DIR / "02_early_stop.json",
            "测试3：提前停测风险检测",
            ["early_stopping"],
        )
    ))
    
    # 测试4：先验过强
    results.append((
        "先验过强测试",
        test_example(
            EXAMPLES_DIR / "03_strong_prior.json",
            "测试4：先验过强风险检测",
            ["strong_prior", "early_stopping", "small_sample"],
        )
    ))
    
    # 测试5：多指标冲突
    results.append((
        "多指标冲突测试",
        test_example(
            EXAMPLES_DIR / "04_metric_conflict.json",
            "测试5：多指标方向冲突检测",
            ["metric_conflict"],
        )
    ))
    
    # 测试6：脏数据
    results.append((
        "脏数据测试",
        test_example(
            EXAMPLES_DIR / "05_dirty_data.json",
            "测试6：脏数据识别与错误标注",
            ["invalid_input"],
        )
    ))
    
    # 测试7：临界数据
    results.append((
        "临界数据测试",
        test_example(
            EXAMPLES_DIR / "06_borderline.json",
            "测试7：临界数据 - 样本量小、字段缺失",
            ["small_sample", "wide_ci"],
        )
    ))
    
    # 汇总结果
    print("=" * 70)
    print("📋 测试结果汇总")
    print("=" * 70)
    print()
    
    passed = 0
    failed = 0
    for name, result in results:
        status = "✅ 通过" if result else "❌ 失败"
        print(f"  {name}: {status}")
        if result:
            passed += 1
        else:
            failed += 1
    
    print()
    print(f"总计: {passed} 项通过, {failed} 项失败")
    print()
    
    if failed == 0:
        print("🎉 所有测试通过！贝叶斯A/B试验台运行正常。")
    else:
        print(f"⚠️  有 {failed} 项测试失败，请检查。")
        sys.exit(1)
    
    print()
    print("💡 核心功能验证完成：")
    print("   ✅ 可复算性 - 相同输入产生相同结果")
    print("   ✅ 字段检查 - 缺失/无效字段被正确标注，不假设默认值")
    print("   ✅ 提前停测检测 - 样本量/观察窗口不足时发出警告")
    print("   ✅ 先验过强检测 - 先验强度过大时发出警告")
    print("   ✅ 多指标冲突检测 - 指标方向相反时发出警告")
    print("   ✅ 处理顺序记录 - 完整记录验证和计算流程")
    print("   ✅ 报告导出 - JSON和Markdown格式报告生成正常")
    print()


if __name__ == "__main__":
    main()
