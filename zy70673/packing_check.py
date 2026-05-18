#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path

from packing_checker import MaterialParser, RuleEngine, SourceTracker, ReportGenerator


def main():
    parser = argparse.ArgumentParser(
        description="活动装箱配件依赖缺失分级排查工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  python packing_check.py -i materials.csv
  python packing_check.py -i materials.csv -o my_reports -p 北京活动
  python packing_check.py -i materials.csv --deps dependencies.csv
        """,
    )

    parser.add_argument(
        "-i", "--input",
        required=True,
        help="物料清单CSV文件路径",
    )

    parser.add_argument(
        "-o", "--output-dir",
        default="reports",
        help="报告输出目录 (默认: reports)",
    )

    parser.add_argument(
        "-p", "--prefix",
        default="",
        help="报告文件名前缀",
    )

    parser.add_argument(
        "--encoding",
        default="utf-8",
        help="输入文件编码 (默认: utf-8)",
    )

    parser.add_argument(
        "--no-console",
        action="store_true",
        help="不打印控制台摘要",
    )

    parser.add_argument(
        "--deps",
        help="自定义依赖关系CSV文件 (主物料,配件,比例,严重程度)",
    )

    parser.add_argument(
        "--clear-default-deps",
        action="store_true",
        help="加载自定义依赖前清除默认依赖",
    )

    parser.add_argument(
        "--list-deps",
        action="store_true",
        help="列出当前配置的所有依赖规则",
    )

    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"错误: 文件不存在 - {args.input}", file=sys.stderr)
        sys.exit(1)

    try:
        material_parser = MaterialParser(encoding=args.encoding)
        materials, invalid_rows = material_parser.parse_file(args.input)

        tracker = SourceTracker()
        tracker.track_materials(materials, invalid_rows)

        rule_engine = RuleEngine()

        if args.deps:
            deps_path = Path(args.deps)
            if deps_path.exists():
                loaded_count = rule_engine.load_dependencies_from_csv(
                    args.deps,
                    clear_existing=args.clear_default_deps,
                    encoding=args.encoding,
                )
                print(f"已加载自定义依赖: {loaded_count} 条 (来自 {args.deps})")
                if args.clear_default_deps:
                    print("已清除默认依赖规则")
            else:
                print(f"警告: 依赖配置文件不存在 - {args.deps}", file=sys.stderr)

        if args.list_deps:
            print("\n当前配置的依赖规则:")
            print("-" * 60)
            deps = rule_engine.list_dependencies()
            for i, dep in enumerate(deps, 1):
                print(f"{i:2d}. {dep['main_item']} -> {dep['required_accessory']} "
                      f"(x{dep['ratio']}, {dep['severity']})")
            print("-" * 60)

        result = rule_engine.process(materials, invalid_rows)

        reporter = ReportGenerator(output_dir=args.output_dir)
        reports = reporter.generate_all_reports(result, prefix=args.prefix)

        if not args.no_console:
            reporter.print_console_summary(result)

        print("\n生成的报告文件:")
        for report_name, file_path in reports.items():
            print(f"  {report_name}: {file_path}")

        if result.missing_items:
            sys.exit(2)

    except Exception as e:
        print(f"处理出错: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
