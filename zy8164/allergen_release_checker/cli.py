import argparse
import sys
from pathlib import Path
from typing import Optional

from .html import TimelineHTMLGenerator
from .parser import load_all_data
from .report import ReportGenerator, analyze_timelines
from .rules import RulesEngine
from .timeline import build_timelines


def get_sample_data_dir() -> Path:
    """获取 sample 数据目录"""
    return Path(__file__).parent.parent / "sample_data"


def run_check(
    formulas_path: Path,
    batches_path: Path,
    cleaning_path: Path,
    rules_path: Path,
    output_dir: Path,
    verbose: bool = False,
) -> int:
    """执行过敏原清线放行复核检查"""
    if verbose:
        print("📁 加载数据文件...")
        print(f"   - 产品配方: {formulas_path}")
        print(f"   - 产线批次: {batches_path}")
        print(f"   - 清洁记录: {cleaning_path}")
        print(f"   - 规则配置: {rules_path}")

    try:
        data = load_all_data(
            formulas_path=formulas_path,
            batches_path=batches_path,
            cleaning_path=cleaning_path,
            rules_path=rules_path,
        )
    except Exception as e:
        print(f"❌ 数据加载失败: {e}", file=sys.stderr)
        return 1

    if verbose:
        print(f"✅ 数据加载完成:")
        print(f"   - 配方数量: {len(data['formulas'])}")
        print(f"   - 批次数量: {len(data['batches'])}")
        print(f"   - 清洁记录数量: {len(data['cleaning_records'])}")

    rules_engine = RulesEngine(data["rules"])
    
    if verbose:
        print("📅 构建产线时间线...")

    timelines = build_timelines(
        batches_data=data["batches"],
        cleaning_data=data["cleaning_records"],
        formulas_data=data["formulas"],
    )

    if verbose:
        print(f"✅ 时间线构建完成，共 {len(timelines)} 条产线")
        for line_name, timeline in timelines.items():
            print(f"   - {line_name}: {len(timeline.batches)} 批次, "
                  f"{len(timeline.cleaning_records)} 清洁记录")

    if verbose:
        print("🔍 执行规则分析...")

    analysis_results = analyze_timelines(timelines, rules_engine)

    if verbose:
        summary = analysis_results["summary"]
        print(f"✅ 分析完成:")
        print(f"   - 总换产次数: {summary['total_transitions']}")
        print(f"   - 通过: {summary['pass_count']}")
        print(f"   - 警告: {summary['warning_count']}")
        print(f"   - 未通过: {summary['fail_count']}")

    special_issues = analysis_results.get("special_issues", {})
    
    midnight_transitions = special_issues.get("midnight_transitions", [])
    if midnight_transitions:
        print(f"\n⚠️  检测到 {len(midnight_transitions)} 个跨午夜批次:")
        for mt in midnight_transitions:
            print(f"   - 产线 {mt['production_line']}: 批次 {mt['batch_id']} "
                  f"({mt['start_time']} 至 {mt['end_time']})")

    equipment_conflicts = special_issues.get("equipment_conflicts", [])
    if equipment_conflicts:
        print(f"\n❌ 检测到 {len(equipment_conflicts)} 个设备冲突:")
        for conflict in equipment_conflicts:
            print(f"   - {conflict['message']}")

    if verbose:
        print(f"\n📄 生成报告到 {output_dir}...")

    output_dir.mkdir(parents=True, exist_ok=True)

    report_generator = ReportGenerator(rules_engine, output_dir)
    report_generator.generate_release_report(timelines, analysis_results)
    report_generator.generate_risks_csv(analysis_results)

    if verbose:
        print("✅ release_report.md 和 risks.csv 已生成")

    html_generator = TimelineHTMLGenerator(output_dir)
    html_generator.generate(timelines, analysis_results, data["rules"])

    if verbose:
        print("✅ timeline.html 已生成")

    total_issues = (
        analysis_results["summary"]["fail_count"] + 
        analysis_results["summary"]["warning_count"] +
        len(special_issues.get("equipment_conflicts", []))
    )

    print("\n" + "=" * 50)
    if total_issues == 0:
        print("✅ 所有检查通过，建议放行")
        print("=" * 50)
        return 0
    else:
        print(f"⚠️  检测到 {total_issues} 个问题，请检查报告")
        print("=" * 50)
        return 1


def main():
    """主入口函数"""
    parser = argparse.ArgumentParser(
        description="食品厂 QA 过敏原清线放行复核 CLI 工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 使用 sample 数据运行
  allergen-check --sample

  # 使用自定义数据文件
  allergen-check --formulas formulas.csv --batches batches.jsonl 
                 --cleaning cleaning.csv --rules rules.yaml
                 
  # 指定输出目录
  allergen-check --sample -o ./output --verbose
        """,
    )

    data_group = parser.add_argument_group("数据文件参数")
    data_group.add_argument(
        "--formulas",
        type=Path,
        help="产品配方 CSV 文件路径",
    )
    data_group.add_argument(
        "--batches",
        type=Path,
        help="产线批次 JSONL 文件路径",
    )
    data_group.add_argument(
        "--cleaning",
        type=Path,
        help="清洁验证记录 CSV 文件路径",
    )
    data_group.add_argument(
        "--rules",
        type=Path,
        help="规则 YAML 文件路径",
    )

    parser.add_argument(
        "--sample",
        action="store_true",
        help="使用内置 sample 数据运行（用于演示）",
    )

    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path.cwd() / "output",
        help="输出目录 (默认: ./output)",
    )

    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="显示详细执行信息",
    )

    parser.add_argument(
        "--list-sample",
        action="store_true",
        help="列出内置 sample 数据文件",
    )

    args = parser.parse_args()

    if args.list_sample:
        sample_dir = get_sample_data_dir()
        if sample_dir.exists():
            print(f"📁 Sample 数据目录: {sample_dir}")
            for f in sample_dir.glob("*"):
                if f.is_file():
                    print(f"   - {f.name}")
        else:
            print("❌ Sample 数据目录不存在")
        return 0

    if args.sample:
        sample_dir = get_sample_data_dir()
        if not sample_dir.exists():
            print(f"❌ Sample 数据目录不存在: {sample_dir}", file=sys.stderr)
            return 1

        formulas_path = sample_dir / "product_formulas.csv"
        batches_path = sample_dir / "production_batches.jsonl"
        cleaning_path = sample_dir / "cleaning_records.csv"
        rules_path = sample_dir / "rules.yaml"

        for p in [formulas_path, batches_path, cleaning_path, rules_path]:
            if not p.exists():
                print(f"❌ Sample 数据文件不存在: {p}", file=sys.stderr)
                return 1
    else:
        if not all([args.formulas, args.batches, args.cleaning, args.rules]):
            parser.error(
                "必须提供所有数据文件参数 (--formulas, --batches, --cleaning, --rules) "
                "或使用 --sample 参数"
            )

        formulas_path = args.formulas
        batches_path = args.batches
        cleaning_path = args.cleaning
        rules_path = args.rules

        for p in [formulas_path, batches_path, cleaning_path, rules_path]:
            if not p.exists():
                print(f"❌ 文件不存在: {p}", file=sys.stderr)
                return 1

    return run_check(
        formulas_path=formulas_path,
        batches_path=batches_path,
        cleaning_path=cleaning_path,
        rules_path=rules_path,
        output_dir=args.output,
        verbose=args.verbose,
    )


if __name__ == "__main__":
    sys.exit(main())
