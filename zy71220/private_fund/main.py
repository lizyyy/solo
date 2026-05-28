"""
私募销售认购系统 - 命令行入口
快速使用: python -m private_fund.main process 文件.xlsx 操作员
"""
import sys
import json
import argparse
from .service import PrivateFundService


def main():
    parser = argparse.ArgumentParser(description="私募销售认购系统")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    process_parser = subparsers.add_parser("process", help="批量处理认购文件")
    process_parser.add_argument("file", help="认购数据文件路径(xlsx/csv/json)")
    process_parser.add_argument("operator", nargs="?", default="system", help="操作员")

    test_parser = subparsers.add_parser("test", help="运行压力测试")

    clue_parser = subparsers.add_parser("clue", help="线索串联查询")
    clue_parser.add_argument("file", help="认购数据文件")
    clue_parser.add_argument("--keyword", required=True,
                            choices=["认购单", "投资者材料", "冷静期", "回访录音", "打款流水", "确认报告"],
                            help="线索类型")
    clue_parser.add_argument("--value", required=True, help="线索值")

    args = parser.parse_args()

    if args.command == "process":
        service = PrivateFundService()
        result = service.process_subscription_file(args.file, args.operator)
        if "error" in result:
            print(f"错误: {result['error']}")
            sys.exit(1)

    elif args.command == "test":
        from tests.test_subscription import run_all_tests
        run_all_tests()

    elif args.command == "clue":
        service = PrivateFundService()
        result = service.batch_processor.process_file(args.file)
        if "error" in result:
            print(f"错误: {result['error']}")
            sys.exit(1)
        all_orders = result["clean"] + result["dirty"]
        clues = service.find_clues(all_orders, args.keyword, args.value)
        print(json.dumps(clues, ensure_ascii=False, indent=2))

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
