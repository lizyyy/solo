import argparse
import os
import sys
import warnings
from pathlib import Path
from typing import List

from .exporters import IssuesExporter, ReportExporter
from .parsers import DataValidationWarning, load_dataset
from .rules import RuleEngine, analyze_evacuation_flow

try:
    from .visualizer import run_preview
    HAS_VISUALIZER = True
except ImportError:
    HAS_VISUALIZER = False


def print_warning(msg: str) -> None:
    print(f"\033[93m⚠️  警告: {msg}\033[0m", file=sys.stderr)


def print_error(msg: str) -> None:
    print(f"\033[91m❌ 错误: {msg}\033[0m", file=sys.stderr)


def print_success(msg: str) -> None:
    print(f"\033[92m✅ {msg}\033[0m")


def print_info(msg: str) -> None:
    print(f"\033[94mℹ️  {msg}\033[0m")


def capture_warnings() -> List[str]:
    captured = []
    original_showwarning = warnings.showwarning

    def capture_warning(message, category, filename, lineno, file=None, line=None):
        if issubclass(category, DataValidationWarning):
            captured.append(str(message))

    warnings.showwarning = capture_warning
    warnings.filterwarnings("always", category=DataValidationWarning)

    return captured


def run_analysis(
    floors_path: Path,
    badges_path: Path,
    events_path: Path,
    checkpoints_path: Path,
    output_dir: Path,
    report_title: str,
) -> int:
    captured_warnings = capture_warnings()

    try:
        print_info("正在读取并解析数据文件...")

        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            dataset = load_dataset(
                floors_path=floors_path,
                badges_path=badges_path,
                events_path=events_path,
                checkpoints_path=checkpoints_path,
            )
            for warning in w:
                if issubclass(warning.category, DataValidationWarning):
                    captured_warnings.append(str(warning.message))

        print_success(f"成功加载数据:")
        print(f"   - 楼层: {len(dataset.floors)} 层")
        print(f"   - 人员: {len(dataset.badges)} 人")
        print(f"   - 事件: {len(dataset.events)} 条")
        print(f"   - 检查点: {len(dataset.checkpoints)} 个")

        for warning in captured_warnings:
            print_warning(warning)

        print_info("正在运行规则引擎检测问题...")
        rule_engine = RuleEngine()
        issues = rule_engine.run_all(dataset)

        critical_count = sum(1 for i in issues if i.severity.value == "critical")
        warning_count = sum(1 for i in issues if i.severity.value == "warning")

        if issues:
            print_warning(f"检测到 {len(issues)} 个问题:")
            print(f"   - 🔴 严重: {critical_count}")
            print(f"   - 🟡 警告: {warning_count}")
            print(f"   - 🔵 信息: {len(issues) - critical_count - warning_count}")
        else:
            print_success("未检测到任何问题")

        flow_analysis = analyze_evacuation_flow(dataset)

        output_dir.mkdir(parents=True, exist_ok=True)

        issues_path = output_dir / "issues.csv"
        print_info(f"正在导出问题列表到 {issues_path}...")
        IssuesExporter.export_csv(issues, issues_path)
        print_success(f"问题列表已保存: {issues_path}")

        report_path = output_dir / "evacuation_report.md"
        print_info(f"正在生成复盘报告到 {report_path}...")
        ReportExporter.export_markdown(
            dataset=dataset,
            issues=issues,
            flow_analysis=flow_analysis,
            warnings=captured_warnings,
            output_path=report_path,
            report_title=report_title,
        )
        print_success(f"复盘报告已保存: {report_path}")

        print("")
        print("=" * 50)
        print("分析完成!")
        print("=" * 50)
        if flow_analysis.get("duration_minutes"):
            print(f"演练时长: {flow_analysis.get('duration_minutes')} 分钟")
        print(f"参与人员: {flow_analysis.get('total_people', 0)} 人")
        print(f"已到达集合点: {flow_analysis.get('arrived_at_meeting', 0)} 人")
        print(f"未到达集合点: {flow_analysis.get('missing_at_meeting', 0)} 人")
        print(f"检测问题数: {len(issues)} 个")

        return 0 if critical_count == 0 else 1

    except Exception as e:
        print_error(str(e))
        import traceback
        traceback.print_exc()
        return 1


def get_sample_dir() -> Path:
    package_dir = Path(__file__).resolve().parent
    sample_dir = package_dir.parent / "samples"
    return sample_dir


def main() -> int:
    sample_dir = get_sample_dir()

    parser = argparse.ArgumentParser(
        description="消防演练疏散复盘工具 - Evacuation Review Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 使用内置样本数据
  python -m evacreview --sample

  # 分析后直接预览报告
  python -m evacreview --sample --preview

  # 仅预览已生成的报告
  python -m evacreview --preview

  # 使用自定义数据
  python -m evacreview 
    --floors ./data/floors.yaml 
    --badges ./data/badges.csv 
    --events ./data/events.jsonl 
    --checkpoints ./data/checkpoints.csv
    --output ./report
    --preview

  # 自定义报告标题
  python -m evacreview --sample --title "2026年5月季度消防演练复盘"
        """,
    )

    parser.add_argument(
        "--sample",
        action="store_true",
        help="使用内置样本数据进行演示分析",
    )

    parser.add_argument(
        "--floors",
        type=Path,
        help="楼层配置文件路径 (floors.yaml)",
    )

    parser.add_argument(
        "--badges",
        type=Path,
        help="人员工牌台账路径 (badges.csv)",
    )

    parser.add_argument(
        "--events",
        type=Path,
        help="事件日志路径 (events.jsonl)",
    )

    parser.add_argument(
        "--checkpoints",
        type=Path,
        help="检查点配置路径 (checkpoints.csv)",
    )

    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        default=Path("./output"),
        help="输出目录 (默认: ./output)",
    )

    parser.add_argument(
        "--title",
        "-t",
        type=str,
        default="消防演练疏散复盘报告",
        help="报告标题 (默认: 消防演练疏散复盘报告)",
    )

    parser.add_argument(
        "--list-sample",
        action="store_true",
        help="列出内置样本文件路径",
    )

    args = parser.parse_args()

    if args.list_sample:
        print(f"样本数据目录: {sample_dir}")
        if sample_dir.exists():
            for f in sorted(sample_dir.glob("*")):
                if f.is_file():
                    print(f"  - {f.name}")
        else:
            print_warning("样本目录不存在")
        return 0

    if args.sample:
        if not sample_dir.exists():
            print_error(f"样本数据目录不存在: {sample_dir}")
            return 1

        floors_path = sample_dir / "floors.yaml"
        badges_path = sample_dir / "badges.csv"
        events_path = sample_dir / "events.jsonl"
        checkpoints_path = sample_dir / "checkpoints.csv"

        for path in [floors_path, badges_path, events_path, checkpoints_path]:
            if not path.exists():
                print_error(f"样本文件不存在: {path}")
                return 1

        print_info("使用内置样本数据进行分析...")
        return run_analysis(
            floors_path=floors_path,
            badges_path=badges_path,
            events_path=events_path,
            checkpoints_path=checkpoints_path,
            output_dir=args.output,
            report_title=args.title,
        )

    else:
        required_files = {
            "floors": args.floors,
            "badges": args.badges,
            "events": args.events,
            "checkpoints": args.checkpoints,
        }

        missing = [name for name, path in required_files.items() if path is None]
        if missing:
            print_error(f"缺少必需参数: {', '.join(f'--{name}' for name in missing)}")
            print("")
            print("使用方法:")
            print("  1. 使用 --sample 运行内置样本演示")
            print("  2. 或提供 --floors, --badges, --events, --checkpoints 参数")
            print("")
            parser.print_help()
            return 2

        for name, path in required_files.items():
            if path and not path.exists():
                print_error(f"{name} 文件不存在: {path}")
                return 1

        return run_analysis(
            floors_path=args.floors,
            badges_path=args.badges,
            events_path=args.events,
            checkpoints_path=args.checkpoints,
            output_dir=args.output,
            report_title=args.title,
        )


if __name__ == "__main__":
    sys.exit(main())
