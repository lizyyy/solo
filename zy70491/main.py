#!/usr/bin/env python3
import argparse
import sys

from circuit_breaker_cli import CircuitBreakerCLI


def main():
    parser = argparse.ArgumentParser(
        description="熔断演练 - 仓库交接单管理工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python main.py init-data              # 初始化测试数据
  python main.py list                   # 列出所有记录
  python main.py list --abnormal        # 只列出异常记录
  python main.py show <record_id>       # 显示单条记录详情
  python main.py remark <record_id> "备注内容" --operator 张三 --reason "补充说明"
  python main.py history "会员续费流水"   # 查看指定资源的修正历史
  python main.py export --format markdown --output report.md
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    init_parser = subparsers.add_parser("init-data", help="初始化测试数据")

    list_parser = subparsers.add_parser("list", help="列出所有记录")
    list_parser.add_argument("--status", choices=["normal", "abnormal", "pending"], help="按状态筛选")
    list_parser.add_argument("--abnormal", action="store_true", help="只显示异常记录")
    list_parser.add_argument("--normal", action="store_true", help="只显示正常记录")
    list_parser.add_argument("--format", choices=["json", "markdown"], default="json", help="输出格式")

    show_parser = subparsers.add_parser("show", help="显示单条记录详情")
    show_parser.add_argument("record_id", help="记录ID")
    show_parser.add_argument("--format", choices=["json", "markdown"], default="json", help="输出格式")

    remark_parser = subparsers.add_parser("remark", help="添加人工备注")
    remark_parser.add_argument("record_id", help="记录ID")
    remark_parser.add_argument("content", help="备注内容")
    remark_parser.add_argument("--operator", required=True, help="操作人")
    remark_parser.add_argument("--reason", help="备注原因")

    correct_parser = subparsers.add_parser("correct", help="添加人工修正记录")
    correct_parser.add_argument("record_id", help="记录ID")
    correct_parser.add_argument("--operator", required=True, help="操作人")
    correct_parser.add_argument("--type", required=True, help="修正类型")
    correct_parser.add_argument("--old", required=True, help="原值")
    correct_parser.add_argument("--new", required=True, help="新值")
    correct_parser.add_argument("--reason", required=True, help="修正理由")
    correct_parser.add_argument("--resource", required=True, help="资源范围")

    history_parser = subparsers.add_parser("history", help="查看资源修正历史")
    history_parser.add_argument("resource_scope", help="资源范围")

    export_parser = subparsers.add_parser("export", help="导出数据")
    export_parser.add_argument("--record-id", help="指定记录ID（不指定则导出所有）")
    export_parser.add_argument("--format", choices=["json", "markdown"], default="json", help="输出格式")
    export_parser.add_argument("--output", "-o", help="输出文件路径（不指定则打印到控制台）")

    detect_parser = subparsers.add_parser("detect", help="运行异常检测")

    args = parser.parse_args()

    cli = CircuitBreakerCLI()

    if args.command == "init-data":
        cli.init_test_data()
    elif args.command == "list":
        cli.list_records(
            status=args.status,
            abnormal_only=args.abnormal,
            normal_only=args.normal,
            output_format=args.format
        )
    elif args.command == "show":
        cli.show_record(args.record_id, output_format=args.format)
    elif args.command == "remark":
        cli.add_remark(args.record_id, args.content, args.operator, args.reason)
    elif args.command == "correct":
        cli.add_manual_correction(
            args.record_id,
            args.operator,
            args.type,
            args.old,
            args.new,
            args.reason,
            args.resource
        )
    elif args.command == "history":
        cli.show_correction_history(args.resource_scope)
    elif args.command == "export":
        cli.export(args.record_id, args.format, args.output)
    elif args.command == "detect":
        cli.run_detection()
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()