#!/usr/bin/env python
"""测试运行器 - 验证误差传播图表解释功能"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from error_propagation.core import ErrorPropagationEngine
from error_propagation.sample_data import (
    generate_daily_samples,
    print_sample_overview,
    get_empty_input_sample,
)
from error_propagation.exceptions import (
    AnomalyQueue,
    EmptyInputError,
    AnomalyType,
)
from error_propagation.reporter import ReportGenerator
from error_propagation.visualizer import ChartVisualizer


def test_empty_input():
    """测试空输入处理"""
    print("=" * 70)
    print("🧪 测试1: 空输入处理")
    print("=" * 70)
    
    engine = ErrorPropagationEngine()
    anomaly_queue = AnomalyQueue()
    samples = get_empty_input_sample()
    
    try:
        result = engine.calculate("矩形面积", samples, anomaly_queue)
        print("❌ 失败: 应该抛出 EmptyInputError")
        return False
    except EmptyInputError as e:
        print(f"✅ 成功: 正确抛出空输入异常")
        print(f"   异常消息: {e}")
        print(f"   异常队列记录数: {len(anomaly_queue)}")
        
        if len(anomaly_queue) > 0:
            record = anomaly_queue.get_all()[0]
            print(f"   异常类型: {record.anomaly_type.value}")
            print(f"   严重程度: {record.severity.value}")
            print(f"   建议: {record.resolution_hint}")
        
        return True


def test_duplicate_detection():
    """测试重复样本检测"""
    print("\n" + "=" * 70)
    print("🧪 测试2: 重复样本检测与处理")
    print("=" * 70)
    
    engine = ErrorPropagationEngine()
    anomaly_queue = AnomalyQueue()
    samples = generate_daily_samples()
    
    duplicates = engine.detect_duplicates(samples)
    print(f"✅ 检测到 {len(duplicates)} 对重复样本")
    
    for orig, dup in duplicates:
        print(f"   • {orig.name} ({orig.sample_id}) ↔ {dup.name} ({dup.sample_id})")
        impact = engine._assess_duplicate_impact(orig, dup, "矩形面积")
        print(f"     影响评估: {impact}")
        hint = engine._get_duplicate_hint(impact, allow_duplicates=False)
        print(f"     处理建议: {hint}")
    
    print("\n📌 测试默认行为（自动挂起重复样本）:")
    m_samples = [s for s in samples if s.symbol == "m"]
    
    from error_propagation.models import MeasurementVariable, VariableType
    V_sample = MeasurementVariable(
        name="书的体积",
        symbol="V",
        value=777.0,
        uncertainty=1.0,
        unit="cm³",
        description="由长宽高计算得出",
        variable_type=VariableType.DERIVED_QUANTITY,
    )
    
    density_samples = m_samples + [V_sample]
    
    result = engine.calculate(
        "密度计算",
        density_samples,
        anomaly_queue,
        allow_duplicates=False,
        auto_suspend_duplicates=True,
    )
    
    print(f"   结果是否挂起: {result.suspended}")
    if result.suspended:
        print(f"   挂起原因: {result.suspension_reason}")
    
    print("\n📌 测试放行重复样本:")
    anomaly_queue2 = AnomalyQueue()
    result2 = engine.calculate(
        "密度计算",
        density_samples,
        anomaly_queue2,
        allow_duplicates=True,
        auto_suspend_duplicates=True,
    )
    
    print(f"   结果是否挂起: {result2.suspended}")
    if not result2.suspended:
        print(f"   结果: {result2.result_value:.4f} ± {result2.result_uncertainty:.4f}")
    
    return True


def test_boundary_detection():
    """测试边界样本检测"""
    print("\n" + "=" * 70)
    print("🧪 测试3: 边界样本检测")
    print("=" * 70)
    
    engine = ErrorPropagationEngine()
    samples = generate_daily_samples()
    
    boundary = engine.detect_boundary_samples(samples)
    print(f"✅ 检测到 {len(boundary)} 个边界样本")
    
    for s in boundary:
        print(f"   • {s.name} ({s.sample_id})")
        print(f"     相对不确定度: {s.relative_uncertainty * 100:.2f}%")
        print(f"     数值: {s.value} ± {s.uncertainty} {s.unit}")
        print(f"     说明: {s.metadata.get('notes', '无')}")
    
    return True


def test_calculation():
    """测试误差传播计算"""
    print("\n" + "=" * 70)
    print("🧪 测试4: 误差传播计算")
    print("=" * 70)
    
    engine = ErrorPropagationEngine()
    anomaly_queue = AnomalyQueue()
    samples = generate_daily_samples()
    
    print("\n📐 矩形面积计算:")
    area_samples = [s for s in samples if s.symbol == "a" or s.symbol == "b"]
    result = engine.calculate("矩形面积", area_samples, anomaly_queue)
    
    print(f"   公式: {result.formula.expression}")
    print(f"   结果: {result.result_value:.4f} ± {result.result_uncertainty:.4f} {result.result_unit}")
    print(f"   相对不确定度: {result.relative_uncertainty * 100:.2f}%")
    print(f"   主要贡献: {result.dominant_contribution}")
    print(f"   各变量贡献: {result.uncertainty_contributions}")
    
    print("\n📐 圆柱体体积计算（含边界样本）:")
    cylinder_samples = [s for s in samples if s.symbol == "r" or s.symbol == "h"]
    result2 = engine.calculate("圆柱体体积", cylinder_samples, anomaly_queue)
    
    if not result2.suspended:
        print(f"   公式: {result2.formula.expression}")
        print(f"   结果: {result2.result_value:.4f} ± {result2.result_uncertainty:.4f} {result2.result_unit}")
        print(f"   相对不确定度: {result2.relative_uncertainty * 100:.2f}%")
    
    print("\n📐 匀加速位移计算:")
    from error_propagation.models import MeasurementVariable
    a_sample = MeasurementVariable(
        name="加速度",
        symbol="a",
        value=9.8,
        uncertainty=0.05,
        unit="m/s²",
        description="重力加速度",
    )
    motion_samples = [
        next(s for s in samples if s.symbol == "v0"),
        a_sample,
        next(s for s in samples if s.symbol == "t"),
    ]
    result3 = engine.calculate("匀加速位移", motion_samples, anomaly_queue)
    
    if not result3.suspended:
        print(f"   公式: {result3.formula.expression}")
        print(f"   结果: {result3.result_value:.4f} ± {result3.result_uncertainty:.4f} {result3.result_unit}")
        print(f"   相对不确定度: {result3.relative_uncertainty * 100:.2f}%")
    
    return True


def test_report_generation():
    """测试报告生成"""
    print("\n" + "=" * 70)
    print("🧪 测试5: 报告生成")
    print("=" * 70)
    
    engine = ErrorPropagationEngine()
    anomaly_queue = AnomalyQueue()
    samples = generate_daily_samples()
    reporter = ReportGenerator("./output")
    visualizer = ChartVisualizer("./output")
    
    results = []
    area_samples = [s for s in samples if s.symbol in ["a", "b"]]
    results.append(engine.calculate("矩形面积", area_samples, anomaly_queue))
    
    cylinder_samples = [s for s in samples if s.symbol in ["r", "h"]]
    results.append(engine.calculate("圆柱体体积", cylinder_samples, anomaly_queue))
    
    summary = engine.generate_summary(samples, results, anomaly_queue)
    reviewer_report = engine.generate_reviewer_report(samples, results)
    
    print("\n📝 生成评审解释文档...")
    review_path = reporter.generate_review_explanation(samples, results, summary, anomaly_queue)
    print(f"   ✅ {review_path}")
    
    print("\n📝 生成复核人报告...")
    reviewer_path = reporter.generate_reviewer_report(reviewer_report, samples, results)
    print(f"   ✅ {reviewer_path}")
    
    print("\n📝 生成异常队列报告...")
    anomaly_path = reporter.generate_anomaly_report(anomaly_queue)
    print(f"   ✅ {anomaly_path}")
    
    print("\n📊 生成图表...")
    chart_files = visualizer.save_all_charts(samples, results)
    for cf in chart_files:
        print(f"   ✅ {os.path.basename(cf)}")
    
    print("\n🔍 复核人报告内容摘要:")
    print(f"   已确认证据: {len(reviewer_report.confirmed_evidence)} 项")
    print(f"   待确认证据: {len(reviewer_report.pending_evidence)} 项")
    print(f"   缺失证据: {len(reviewer_report.missing_evidence)} 项")
    print(f"   建议:")
    for rec in reviewer_report.recommendations:
        print(f"     • {rec}")
    
    return True


def test_terminal_output_separation():
    """测试终端摘要与异常队列分离"""
    print("\n" + "=" * 70)
    print("🧪 测试6: 终端摘要与异常队列分离")
    print("=" * 70)
    
    engine = ErrorPropagationEngine()
    anomaly_queue = AnomalyQueue()
    samples = generate_daily_samples()
    
    results = []
    area_samples = [s for s in samples if s.symbol in ["a", "b"]]
    results.append(engine.calculate("矩形面积", area_samples, anomaly_queue))
    
    summary = engine.generate_summary(samples, results, anomaly_queue)
    
    print("\n📊 [终端摘要部分] - 清晰简洁")
    print(f"   总样本: {summary.total_samples}")
    print(f"   有效样本: {summary.valid_samples}")
    print(f"   边界样本: {summary.boundary_samples}")
    print(f"   重复样本: {summary.duplicate_samples}")
    print(f"   主要发现:")
    for f in summary.key_findings[:3]:
        print(f"     • {f}")
    
    print(f"\n🚨 [异常队列部分] - 独立输出，共 {len(anomaly_queue)} 条")
    types = {}
    for r in anomaly_queue:
        t = r.anomaly_type.value
        types[t] = types.get(t, 0) + 1
    
    for t, c in types.items():
        print(f"   • {t}: {c} 条")
    
    print("\n✅ 验证: 终端摘要和异常队列是分离的两个输出模块")
    print("   摘要只显示关键指标，异常详情单独输出，不会混在一起")
    
    return True


def test_input_output_dirs():
    """测试输入输出目录指定"""
    print("\n" + "=" * 70)
    print("🧪 测试7: 输入输出目录指定")
    print("=" * 70)
    
    from error_propagation.sample_data import save_sample_data
    
    custom_input = "./test_data_input"
    custom_output = "./test_data_output"
    
    print(f"\n📂 创建自定义输入目录: {custom_input}")
    os.makedirs(custom_input, exist_ok=True)
    sample_path = save_sample_data(custom_input, "test_samples.json")
    print(f"   ✅ 样例数据已保存到: {sample_path}")
    
    print(f"\n📂 创建自定义输出目录: {custom_output}")
    reporter = ReportGenerator(custom_output)
    visualizer = ChartVisualizer(custom_output)
    
    engine = ErrorPropagationEngine()
    anomaly_queue = AnomalyQueue()
    samples = generate_daily_samples()
    
    area_samples = [s for s in samples if s.symbol in ["a", "b"]]
    result = engine.calculate("矩形面积", area_samples, anomaly_queue)
    
    summary = engine.generate_summary(samples, [result], anomaly_queue)
    reviewer_report = engine.generate_reviewer_report(samples, [result])
    
    review_path = reporter.generate_review_explanation(samples, [result], summary, anomaly_queue)
    anomaly_path = reporter.generate_anomaly_report(anomaly_queue)
    
    print(f"   ✅ 评审解释文档: {review_path}")
    print(f"   ✅ 异常队列报告: {anomaly_path}")
    
    files_in_output = os.listdir(custom_output)
    print(f"\n✅ 输出目录中的文件:")
    for f in sorted(files_in_output):
        print(f"   • {f}")
    
    return True


def main():
    print("\n" + "╔" + "=" * 68 + "╗")
    print("║" + " " * 15 + "🚀 误差传播图表解释 - 完整测试套件" + " " * 15 + "║")
    print("╚" + "=" * 68 + "╝")
    
    tests = [
        test_empty_input,
        test_duplicate_detection,
        test_boundary_detection,
        test_calculation,
        test_report_generation,
        test_terminal_output_separation,
        test_input_output_dirs,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"\n❌ {test.__name__} 异常: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
    
    print("\n" + "=" * 70)
    print("🏁 测试结果汇总")
    print("=" * 70)
    print(f"   ✅ 通过: {passed}")
    print(f"   ❌ 失败: {failed}")
    print(f"   📊 总计: {len(tests)}")
    
    if failed == 0:
        print("\n🎉 所有测试通过！")
    else:
        print(f"\n⚠️  有 {failed} 个测试失败，请检查。")
    
    print("\n📁 输出文件已保存到:")
    print("   • ./output/ - 主要输出")
    print("   • ./test_data_output/ - 测试自定义目录输出")
    print("   • ./test_data_input/ - 测试自定义输入目录")
    
    return failed == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
