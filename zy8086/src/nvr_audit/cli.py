"""
NVR Audit CLI - 监控录像交付审计工具
"""
import argparse
import sys
from pathlib import Path

from .parser import parse_all
from .validator import build_timelines, validate
from .rules import load_rules_from_dict
from .exporter import export_all


def main():
    parser = argparse.ArgumentParser(
        description="NVR 监控录像交付审计工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--clips", required=True, help="clips_manifest.csv 路径")
    parser.add_argument("--clock", required=True, help="device_clock_events.jsonl 路径")
    parser.add_argument("--ffprobe", required=True, help="ffprobe_summaries.json 路径")
    parser.add_argument("--rules", required=True, help="rules.yaml 路径")
    parser.add_argument("-o", "--output-dir", default="output", help="输出目录 (default: output)")
    parser.add_argument("--version", action="version", version="%(prog)s 0.1.0")
    args = parser.parse_args()

    clips_path = Path(args.clips)
    clock_path = Path(args.clock)
    ffprobe_path = Path(args.ffprobe)
    rules_path = Path(args.rules)
    output_dir = Path(args.output_dir)

    if not clips_path.exists():
        sys.exit(f"错误: 文件不存在: {clips_path}")
    if not clock_path.exists():
        sys.exit(f"错误: 文件不存在: {clock_path}")
    if not ffprobe_path.exists():
        sys.exit(f"错误: 文件不存在: {ffprobe_path}")
    if not rules_path.exists():
        sys.exit(f"错误: 文件不存在: {rules_path}")

    data = parse_all(clips_path, clock_path, ffprobe_path, rules_path)
    timelines = build_timelines(data)
    rules = load_rules_from_dict(data.rules)
    result = validate(timelines, data, data.rules)

    output_paths = export_all(result, data, data.rules, output_dir)

    print("审计完成。输出文件:")
    for name, path in output_paths.items():
        print(f"  {name}: {path.absolute()}")

    issue_count = len(result.all_issues)
    error_count = sum(1 for i in result.all_issues if i.severity == "error")
    print(f"\n共发现问题 {issue_count} 条 (错误 {error_count} 条, 警告 {issue_count - error_count} 条)")
    if error_count > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
