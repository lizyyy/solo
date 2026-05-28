"""命令行入口 - 贝叶斯A/B试验台"""

import argparse
import json
import sys
from typing import Optional

from .data_models import (
    ExperimentInput,
    VariantData,
    PriorParams,
    VariantType,
)
from .pipeline import run_experiment
from .report_generator import ReportGenerator


def _parse_variant(data: dict, variant_type: VariantType) -> VariantData:
    """解析变体数据"""
    return VariantData(
        name=data.get("name", variant_type.value),
        variant_type=variant_type,
        sample_size=data.get("sample_size"),
        conversions=data.get("conversions"),
        metric_name=data.get("metric_name"),
        metric_value=data.get("metric_value"),
    )


def _parse_prior(data: Optional[dict]) -> Optional[PriorParams]:
    """解析先验参数"""
    if data is None:
        return None
    return PriorParams(
        alpha=data.get("alpha"),
        beta=data.get("beta"),
        description=data.get("description"),
    )


def _parse_metrics(data: Optional[list]) -> Optional[list]:
    """解析多指标数据"""
    if data is None:
        return None
    metrics = []
    for item in data:
        variant_type = VariantType.CONTROL if item.get("variant_type") == "control" else VariantType.TREATMENT
        metrics.append(
            VariantData(
                name=item.get("name", item.get("metric_name", "metric")),
                variant_type=variant_type,
                sample_size=item.get("sample_size"),
                conversions=item.get("conversions"),
                metric_name=item.get("metric_name"),
                metric_value=item.get("metric_value"),
            )
        )
    return metrics


def load_input_from_json(filepath: str) -> ExperimentInput:
    """从JSON文件加载试验输入"""
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    control_data = data.get("control")
    treatment_data = data.get("treatment")

    if control_data is None or treatment_data is None:
        raise ValueError("JSON文件缺少control或treatment字段")

    return ExperimentInput(
        experiment_id=data.get("experiment_id"),
        experiment_name=data.get("experiment_name"),
        control=_parse_variant(control_data, VariantType.CONTROL),
        treatment=_parse_variant(treatment_data, VariantType.TREATMENT),
        prior=_parse_prior(data.get("prior")),
        observation_window_days=data.get("observation_window_days"),
        planned_sample_size=data.get("planned_sample_size"),
        current_day=data.get("current_day"),
        stopping_threshold=data.get("stopping_threshold"),
        metrics=_parse_metrics(data.get("metrics")),
        notes=data.get("notes"),
    )


def main():
    """主入口函数"""
    parser = argparse.ArgumentParser(
        description="贝叶斯A/B试验台 - 可复算的A/B测试分析工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 从JSON文件运行分析
  python -m bayesian_ab.cli --input experiment.json
  
  # 指定输出文件
  python -m bayesian_ab.cli --input experiment.json --output report.md --format markdown
  
  # 同时输出JSON和Markdown
  python -m bayesian_ab.cli --input experiment.json --json-out report.json --md-out report.md
  
  # 调整可信区间和采样数
  python -m bayesian_ab.cli --input experiment.json --credible-level 0.99 --samples 200000
        """,
    )

    parser.add_argument(
        "--input", "-i",
        required=True,
        help="试验输入JSON文件路径",
    )
    parser.add_argument(
        "--output", "-o",
        help="输出文件路径（根据文件扩展名自动判断格式）",
    )
    parser.add_argument(
        "--format", "-f",
        choices=["json", "markdown", "md"],
        default="markdown",
        help="输出格式，默认markdown",
    )
    parser.add_argument(
        "--json-out",
        help="JSON格式输出文件路径",
    )
    parser.add_argument(
        "--md-out",
        help="Markdown格式输出文件路径",
    )
    parser.add_argument(
        "--credible-level",
        type=float,
        default=0.95,
        help="可信区间水平，默认0.95",
    )
    parser.add_argument(
        "--samples",
        type=int,
        default=100000,
        help="MCMC采样数量，默认100000",
    )
    parser.add_argument(
        "--print-json",
        action="store_true",
        help="在控制台打印JSON格式结果",
    )

    args = parser.parse_args()

    try:
        experiment_input = load_input_from_json(args.input)
    except Exception as e:
        print(f"❌ 加载输入文件失败: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"📊 开始分析试验: {experiment_input.experiment_id or '未命名'}")
    print(f"   输入文件: {args.input}")
    print(f"   可信区间: {args.credible_level:.0%}")
    print(f"   采样数量: {args.samples:,}")
    print()

    report = run_experiment(
        experiment_input,
        credible_level=args.credible_level,
        sample_count=args.samples,
    )

    report_gen = ReportGenerator()

    if args.print_json:
        print(report_gen.to_json(report))
        print()

    output_format = args.format
    if args.output:
        if args.output.endswith(".json"):
            output_format = "json"
        elif args.output.endswith(".md") or args.output.endswith(".markdown"):
            output_format = "markdown"

    if args.json_out or (output_format == "json" and args.output):
        filepath = args.json_out or args.output
        report_gen.save_json(report, filepath)
        print(f"💾 JSON报告已保存: {filepath}")

    if args.md_out or (output_format in ["markdown", "md"] and args.output):
        filepath = args.md_out or args.output
        report_gen.save_markdown(report, filepath)
        print(f"💾 Markdown报告已保存: {filepath}")

    print()
    print("=" * 60)
    print("📋 分析摘要")
    print("=" * 60)
    print(f"输入哈希: {report.input_hash[:16]}...")
    print(f"随机种子: {report.reproducibility_seed}")
    print(f"数据质量: {report.validation.data_quality.value}")
    print(f"P(实验组>对照组): {report.bayesian_result.probability_treatment_better:.2%}")
    print(f"预期提升: {report.bayesian_result.expected_lift:.2%}")
    print(f"风险等级: {report.risk_assessment.overall_risk_level.value}")
    print()

    if report.risk_assessment.has_early_stop:
        print("⚠️  检测到提前停测风险")
    if report.risk_assessment.has_strong_prior:
        print("⚠️  检测到先验过强风险")
    if report.risk_assessment.has_metric_conflict:
        print("⚠️  检测到多指标方向冲突")

    print()
    print("停测建议:")
    print(f"  {report.risk_assessment.stopping_message}")
    print()

    if report.conclusions:
        print("结论:")
        for conclusion in report.conclusions:
            print(f"  {conclusion}")
        print()

    if report.recommendations:
        print("建议:")
        for rec in report.recommendations:
            print(f"  • {rec}")
        print()

    if not report.validation.is_valid:
        print("⚠️  输入验证未通过，报告中包含详细的错误信息")
        if report.validation.errors:
            print("错误:")
            for error in report.validation.errors[:5]:
                print(f"  ❌ {error}")
            if len(report.validation.errors) > 5:
                print(f"  ... 还有 {len(report.validation.errors) - 5} 个错误")
        print()

    print("✅ 分析完成！")
    print()
    print("💡 可复算性验证: 使用相同输入再次运行，将得到完全一致的结果。")
    print(f"   输入哈希: {report.input_hash}")
    print(f"   随机种子: {report.reproducibility_seed}")


if __name__ == "__main__":
    main()
