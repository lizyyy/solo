#!/usr/bin/env python3
import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from api_key_inspector.inspector import APIKeyRotationInspector


def main():
    parser = argparse.ArgumentParser(
        description="API密钥轮换巡检工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python cli.py run                    # 执行一次巡检
  python cli.py run --run-id first_run # 指定运行ID执行巡检
  python cli.py list                   # 列出所有运行记录
  python cli.py diff run1 run2         # 对比两次运行结果
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    run_parser = subparsers.add_parser("run", help="执行API密钥巡检")
    run_parser.add_argument("--run-id", help="指定运行ID（可选）")
    run_parser.add_argument("--config", help="配置文件路径（可选）")

    list_parser = subparsers.add_parser("list", help="列出所有运行记录")

    diff_parser = subparsers.add_parser("diff", help="对比两次运行结果")
    diff_parser.add_argument("run_id1", help="第一次运行的ID")
    diff_parser.add_argument("run_id2", help="第二次运行的ID")

    args = parser.parse_args()

    if args.command == "run":
        inspector = APIKeyRotationInspector(getattr(args, "config", None))
        inspector.run_inspection(getattr(args, "run_id", None))
    elif args.command == "list":
        inspector = APIKeyRotationInspector()
        inspector.list_runs()
    elif args.command == "diff":
        inspector = APIKeyRotationInspector()
        inspector.compare_runs(args.run_id1, args.run_id2)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
