#!/usr/bin/env python3
import argparse
import json
import sys
from .commands import (
    init_command,
    import_command,
    check_command,
    detail_command,
    report_command,
    correct_command,
)


def print_result(result: dict):
    status = "✓ 成功" if result["success"] else "✗ 失败"
    print(f"\n{status}: {result['message']}\n")

    if result["warnings"]:
        print("⚠ 警告:")
        for warning in result["warnings"]:
            print(f"  - {warning}")
        print()

    if result["errors"]:
        print("❌ 错误:")
        for error in result["errors"]:
            print(f"  - {error}")
        print()

    if result.get("data"):
        print("📊 数据:")
        print(json.dumps(result["data"], ensure_ascii=False, indent=2))
        print()


def main():
    parser = argparse.ArgumentParser(
        prog="food-sample",
        description="学校食堂食品留样台账管理 CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--data-dir",
        default="./data",
        help="数据目录路径 (默认: ./data)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="输出JSON格式",
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    init_parser = subparsers.add_parser("init", help="初始化留样仓库")
    init_parser.add_argument(
        "--with-samples",
        action="store_true",
        help="加载内置样例数据",
    )
    init_parser.add_argument(
        "--include-overdue",
        action="store_true",
        help="样例数据中包含超期留样",
    )

    import_parser = subparsers.add_parser("import", help="导入数据")
    import_parser.add_argument(
        "import_file",
        help="导入的JSON文件路径",
    )

    check_parser = subparsers.add_parser("check", help="检查所有留样状态和异常")
    check_parser.add_argument(
        "--details",
        action="store_true",
        help="显示详细异常信息",
    )

    detail_parser = subparsers.add_parser("detail", help="查看详细信息")
    detail_parser.add_argument(
        "target_type",
        choices=["sample", "dish", "batch", "fridge", "box", "inspection"],
        help="目标类型",
    )
    detail_parser.add_argument(
        "target_id",
        help="目标ID",
    )

    report_parser = subparsers.add_parser("report", help="生成报告")
    report_parser.add_argument(
        "--type",
        choices=["summary", "full"],
        default="summary",
        help="报告类型 (默认: summary)",
    )

    correct_parser = subparsers.add_parser("correct", help="人工修正数据")
    correct_parser.add_argument(
        "target_type",
        choices=["sample", "dish", "batch", "fridge", "box", "inspection"],
        help="目标类型",
    )
    correct_parser.add_argument(
        "target_id",
        help="目标ID",
    )
    correct_parser.add_argument(
        "updates",
        help='更新内容JSON (例如: \'{"notes": "备注信息"}\')',
    )
    correct_parser.add_argument(
        "--operator",
        required=True,
        help="操作者姓名",
    )
    correct_parser.add_argument(
        "--reason",
        required=True,
        help="修正原因",
    )

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    result = {}

    if args.command == "init":
        result = init_command(
            data_dir=args.data_dir,
            with_samples=args.with_samples,
            include_overdue=args.include_overdue,
        )
    elif args.command == "import":
        result = import_command(
            data_dir=args.data_dir,
            import_file=args.import_file,
        )
    elif args.command == "check":
        result = check_command(
            data_dir=args.data_dir,
            show_details=args.details,
        )
    elif args.command == "detail":
        result = detail_command(
            data_dir=args.data_dir,
            target_type=args.target_type,
            target_id=args.target_id,
        )
    elif args.command == "report":
        result = report_command(
            data_dir=args.data_dir,
            report_type=args.type,
        )
    elif args.command == "correct":
        result = correct_command(
            data_dir=args.data_dir,
            target_type=args.target_type,
            target_id=args.target_id,
            updates=args.updates,
            operator=args.operator,
            correction_reason=args.reason,
        )

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print_result(result)

    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
