"""命令行接口 - 误差传播图表解释"""

import argparse
import sys
import os
import json
from typing import List, Dict, Any
from datetime import datetime

from .core import ErrorPropagationEngine
from .models import MeasurementVariable, PropagationResult, EvidenceStatus
from .exceptions import (
    AnomalyQueue,
    AnomalyRecord,
    AnomalyType,
    SeverityLevel,
    EmptyInputError,
)
from .sample_data import (
    generate_daily_samples,
    load_samples_from_file,
    save_sample_data,
    print_sample_overview,
    get_empty_input_sample,
)
from .reporter import ReportGenerator
from .visualizer import ChartVisualizer


def print_terminal_summary(summary, anomaly_queue, results, show_anomalies=False):
    """打印终端摘要（与异常队列分离）
    
    Args:
        show_anomalies: 如果为True，同时显示异常队列（默认不显示）
    """
    print("\n" + "=" * 70)
    print("📊 误差传播图表解释 - 终端摘要")
    print("=" * 70)
    print(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 70)
    
    print(f"\n📈 样本统计:")
    print(f"  总样本数:     {summary.total_samples}")
    print(f"  有效样本:     {summary.valid_samples}")
    print(f"  边界样本:     {summary.boundary_samples} ⚠️")
    print(f"  重复样本:     {summary.duplicate_samples} 🔄")
    print(f"  挂起样本:     {summary.suspended_samples} ⏸️")
    
    print(f"\n📐 分析的公式:")
    for formula in summary.formulas_analyzed:
        print(f"  • {formula}")
    
    print(f"\n💡 主要发现:")
    for i, finding in enumerate(summary.key_findings, 1):
        print(f"  {i}. {finding}")
    
    if show_anomalies and len(anomaly_queue) > 0:
        print(f"\n🚨 异常队列 (共 {len(anomaly_queue)} 条):")
        for i, record in enumerate(anomaly_queue, 1):
            severity_icon = "🔵" if record.severity.value == "info" else "🟡" if record.severity.value == "warning" else "🔴" if record.severity.value == "error" else "💔"
            print(f"  {severity_icon} [{i}] {record.message}")
    
    print("\n" + "=" * 70)
    print("📁 输出文件已保存到 output/ 目录")
    print("  • 评审解释文档*.txt - 面向非技术人员")
    print("  • 复核人报告*.txt - 面向复核人")
    print("  • 异常队列报告*.txt - 独立的异常详情")
    print("  • 图表*.txt - 各类可视化图表")
    print("=" * 70 + "\n")


def print_anomaly_queue_separately(anomaly_queue: AnomalyQueue) -> None:
    """独立打印异常队列（不与终端摘要混在一起）"""
    if len(anomaly_queue) == 0:
        return
    
    print("\n" + "=" * 70)
    print("🚨 异常队列详情（独立输出）")
    print("=" * 70)
    
    print(f"\n📋 异常分类统计:")
    type_counts = {}
    for record in anomaly_queue:
        atype = record.anomaly_type.value
        type_counts[atype] = type_counts.get(atype, 0) + 1
    
    for atype, count in sorted(type_counts.items()):
        print(f"  {atype}: {count} 条")
    
    print(f"\n📝 详细异常记录:")
    for i, record in enumerate(anomaly_queue, 1):
        severity_icon = "🔵" if record.severity.value == "info" else "🟡" if record.severity.value == "warning" else "🔴" if record.severity.value == "error" else "💔"
        
        print(f"\n[{i}] {severity_icon} {record.anomaly_type.value.upper()} - {record.severity.value.upper()}")
        print(f"    消息: {record.message}")
        if record.sample_id:
            print(f"    关联样本: {record.sample_id}")
        if record.details and "impact_assessment" in record.details:
            print(f"    影响评估: {record.details['impact_assessment']}")
        if record.resolution_hint:
            print(f"    处理建议: {record.resolution_hint}")
    
    suspended = anomaly_queue.get_suspended_samples()
    if suspended:
        print(f"\n⏸️ 已挂起的样本: {', '.join(suspended)}")
    
    print("\n" + "=" * 70 + "\n")


def run_analysis(
    input_dir: str,
    output_dir: str,
    formula_name: str = None,
    allow_duplicates: bool = False,
    auto_suspend_duplicates: bool = True,
    use_demo_data: bool = False,
    test_empty_input: bool = False,
    show_anomalies_in_summary: bool = False,
) -> int:
    """执行误差传播分析
    
    Args:
        input_dir: 输入目录
        output_dir: 输出目录
        formula_name: 要分析的公式名称（None表示分析所有可用公式）
        allow_duplicates: 是否允许重复样本
        auto_suspend_duplicates: 是否自动挂起重复样本
        use_demo_data: 是否使用演示数据
        test_empty_input: 是否测试空输入
        show_anomalies_in_summary: 是否在摘要中显示异常
    """
    os.makedirs(output_dir, exist_ok=True)
    
    engine = ErrorPropagationEngine()
    anomaly_queue = AnomalyQueue()
    reporter = ReportGenerator(output_dir)
    visualizer = ChartVisualizer(output_dir)
    
    if test_empty_input:
        print("🧪 测试空输入处理...")
        samples = get_empty_input_sample()
    elif use_demo_data:
        print("📦 使用内置演示数据（包含边界和重复样本）...")
        samples = generate_daily_samples()
        save_sample_data(input_dir, "demo_samples.json")
    else:
        print(f"📂 从 {input_dir} 加载数据...")
        sample_file = os.path.join(input_dir, "demo_samples.json")
        if os.path.exists(sample_file):
            samples = load_samples_from_file(sample_file)
        else:
            print(f"⚠️ 未找到数据文件，使用内置演示数据")
            samples = generate_daily_samples()
    
    print_sample_overview(samples)
    
    if not samples and not test_empty_input:
        print("❌ 错误: 没有有效的输入样本")
        return 1
    
    if test_empty_input:
        try:
            result = engine.calculate(
                "矩形面积",
                samples,
                anomaly_queue,
                allow_duplicates=allow_duplicates,
                auto_suspend_duplicates=auto_suspend_duplicates,
            )
        except EmptyInputError as e:
            print(f"\n✅ 空输入测试通过: {e}")
            print(f"   异常队列已记录 {len(anomaly_queue)} 条异常")
            return 0
        return 1
    
    available_formulas = engine.get_available_formulas()
    
    if formula_name:
        if formula_name not in available_formulas:
            print(f"❌ 未知公式: {formula_name}")
            print(f"可用公式: {', '.join(available_formulas)}")
            return 1
        formulas_to_run = [formula_name]
    else:
        formulas_to_run = available_formulas
    
    results: List[PropagationResult] = []
    
    for fname in formulas_to_run:
        formula = engine.get_formula(fname)
        var_map = {v.symbol: v for v in samples}
        
        required_vars = formula.variables
        available_vars = set(var_map.keys())
        missing_vars = set(required_vars) - available_vars
        
        if missing_vars:
            continue
        
        formula_samples = [var_map[v] for v in required_vars]
        
        print(f"\n⚙️  正在计算: {fname}...")
        try:
            result = engine.calculate(
                fname,
                formula_samples,
                anomaly_queue,
                allow_duplicates=allow_duplicates,
                auto_suspend_duplicates=auto_suspend_duplicates,
            )
            results.append(result)
            
            if result.suspended:
                print(f"  ⏸️ {fname}: 已挂起 - {result.suspension_reason}")
            else:
                print(f"  ✅ {fname}: 完成")
                print(f"     结果: {result.result_value:.4f} ± {result.result_uncertainty:.4f} {result.result_unit}")
                print(f"     相对不确定度: {result.relative_uncertainty * 100:.2f}%")
        except Exception as e:
            print(f"  ❌ {fname}: 错误 - {e}")
            continue
    
    summary = engine.generate_summary(samples, results, anomaly_queue)
    reviewer_report = engine.generate_reviewer_report(samples, results)
    
    print("\n📝 生成报告...")
    review_path = reporter.generate_review_explanation(samples, results, summary, anomaly_queue)
    print(f"  ✅ 评审解释文档: {review_path}")
    
    reviewer_path = reporter.generate_reviewer_report(reviewer_report, samples, results)
    print(f"  ✅ 复核人报告: {reviewer_path}")
    
    anomaly_path = reporter.generate_anomaly_report(anomaly_queue)
    print(f"  ✅ 异常队列报告: {anomaly_path}")
    
    print("\n📊 生成图表...")
    chart_files = visualizer.save_all_charts(samples, results)
    for cf in chart_files:
        print(f"  ✅ {os.path.basename(cf)}")
    
    json_data = {
        "summary": summary.to_dict(),
        "reviewer_report": reviewer_report.to_dict(),
        "results": [r.to_dict() for r in results],
        "anomalies": [
            {
                "type": r.anomaly_type.value,
                "severity": r.severity.value,
                "message": r.message,
                "sample_id": r.sample_id,
                "details": r.details,
                "resolution_hint": r.resolution_hint,
            }
            for r in anomaly_queue
        ],
    }
    json_path = reporter.save_json_report(json_data, "analysis_results.json")
    print(f"  ✅ JSON结果: {json_path}")
    
    print_terminal_summary(summary, anomaly_queue, results, show_anomalies_in_summary)
    
    print_anomaly_queue_separately(anomaly_queue)
    
    if results:
        print("\n📊 可视化图表（终端预览）:")
        for result in results[:2]:
            print(visualizer.generate_uncertainty_budget_chart(result))
        
        print(visualizer.generate_samples_quality_chart(samples))
    
    return 0


def main():
    """主入口函数"""
    parser = argparse.ArgumentParser(
        description="误差传播图表解释 - 分析测量误差如何传播到计算结果",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  # 使用内置演示数据（包含边界和重复样本）
  python -m error_propagation.cli --demo
  
  # 指定输入输出目录
  python -m error_propagation.cli --input ./data --output ./result
  
  # 只分析特定公式
  python -m error_propagation.cli --demo --formula "矩形面积"
  
  # 允许重复样本（不放行，只挂起）
  python -m error_propagation.cli --demo --allow-duplicates
  
  # 不自动挂起重复样本（放行）
  python -m error_propagation.cli --demo --no-auto-suspend
  
  # 测试空输入处理
  python -m error_propagation.cli --test-empty
  
  # 在终端摘要中同时显示异常
  python -m error_propagation.cli --demo --show-anomalies
        """,
    )
    
    parser.add_argument(
        "--input", "-i",
        default="./data",
        help="输入目录（默认: ./data）",
    )
    
    parser.add_argument(
        "--output", "-o",
        default="./output",
        help="输出目录（默认: ./output）",
    )
    
    parser.add_argument(
        "--formula", "-f",
        default=None,
        help="要分析的公式名称（默认: 分析所有可用公式）",
    )
    
    parser.add_argument(
        "--demo",
        action="store_true",
        help="使用内置演示数据（包含边界样本和重复样本）",
    )
    
    parser.add_argument(
        "--allow-duplicates",
        action="store_true",
        help="允许重复样本参与计算（默认: 不允许，会自动挂起）",
    )
    
    parser.add_argument(
        "--no-auto-suspend",
        action="store_true",
        help="不自动挂起重复样本（即放行重复样本）",
    )
    
    parser.add_argument(
        "--test-empty",
        action="store_true",
        help="测试空输入处理",
    )
    
    parser.add_argument(
        "--show-anomalies",
        action="store_true",
        help="在终端摘要中同时显示异常（默认: 异常独立输出）",
    )
    
    parser.add_argument(
        "--list-formulas",
        action="store_true",
        help="列出所有可用公式",
    )
    
    args = parser.parse_args()
    
    if args.list_formulas:
        engine = ErrorPropagationEngine()
        formulas = engine.get_available_formulas()
        print("📐 可用公式:")
        for fname in formulas:
            formula = engine.get_formula(fname)
            print(f"  • {fname}: {formula.expression}")
            print(f"    {formula.description}")
            print(f"    变量: {', '.join(formula.variables)}")
            print()
        return 0
    
    return run_analysis(
        input_dir=args.input,
        output_dir=args.output,
        formula_name=args.formula,
        allow_duplicates=args.allow_duplicates,
        auto_suspend_duplicates=not args.no_auto_suspend,
        use_demo_data=args.demo,
        test_empty_input=args.test_empty,
        show_anomalies_in_summary=args.show_anomalies,
    )


if __name__ == "__main__":
    sys.exit(main())
