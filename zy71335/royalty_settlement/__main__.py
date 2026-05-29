#!/usr/bin/env python3
"""版权分账演出单 - 命令行入口"""

import argparse
import json
import os
import sys
from datetime import datetime

from .models import PerformanceSheet
from .core import SettlementEngine
from .output import OutputFormatter, ConsolePrinter


def load_performance_sheet(filepath: str) -> PerformanceSheet:
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"输入文件不存在: {filepath}")

    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    return PerformanceSheet.from_dict(data)


def cmd_settle(args):
    try:
        sheet = load_performance_sheet(args.input)
    except Exception as e:
        print(f"✗ 加载输入文件失败: {e}", file=sys.stderr)
        sys.exit(1)

    base_dir = os.path.dirname(os.path.abspath(args.input)) if args.base_dir is None else args.base_dir
    data_dir = os.path.join(base_dir, "data")

    engine = SettlementEngine(
        history_dir=os.path.join(data_dir, "history"),
        output_dir=os.path.join(data_dir, "output"),
        errors_dir=os.path.join(data_dir, "errors"),
    )

    try:
        result, issues, warnings = engine.process(sheet)
    except ValueError as e:
        print(f"✗ 数据验证失败: {e}", file=sys.stderr)
        print(f"  错误详情已保存到 {engine.errors_dir}/ 目录", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"✗ 处理失败: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

    formatter = OutputFormatter(engine.output_dir)
    output_paths = formatter.save_all(result)

    printer = ConsolePrinter(use_colors=not args.no_color)

    if not args.quiet:
        summary = formatter.format_summary(result)
        printer.print_summary(summary)
        printer.print_issues(result.issues)

    printer.print_result(result, output_paths)

    return 0


def cmd_history(args):
    base_dir = os.getcwd() if args.base_dir is None else args.base_dir
    data_dir = os.path.join(base_dir, "data")

    engine = SettlementEngine(
        history_dir=os.path.join(data_dir, "history"),
        output_dir=os.path.join(data_dir, "output"),
        errors_dir=os.path.join(data_dir, "errors"),
    )

    history = engine.list_history()

    if not history:
        print("暂无历史记录")
        return 0

    print("=" * 80)
    print(" 历 史 记 录 ")
    print("=" * 80)
    print(f"{'时间':<18} {'类型':<8} {'演出ID':<38} {'文件名'}")
    print("-" * 80)

    for item in history:
        ts = item["timestamp"]
        formatted_ts = f"{ts[0:4]}-{ts[4:6]}-{ts[6:8]} {ts[9:11]}:{ts[11:13]}:{ts[13:15]}"
        type_label = "输入" if item["type"] == "input" else "输出"
        print(f"{formatted_ts:<18} {type_label:<8} {item['performance_id']:<38} {item['filename']}")

    print("=" * 80)
    return 0


def cmd_template(args):
    template = create_sample_template()
    output_path = args.output or "performance_template.json"

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(template, f, ensure_ascii=False, indent=2)

    print(f"✓ 模板已生成: {output_path}")
    print(f"  请编辑该文件填入实际演出数据，然后运行：")
    print(f"  python -m royalty_settlement settle {output_path}")
    return 0


def create_sample_template() -> dict:
    return {
        "performance_name": "请输入演出名称",
        "performance_date": "2026-05-29",
        "venue": "请输入演出场地",
        "total_box_office": 100000.00,
        "operator": "请输入操作员姓名",
        "notes": "",
        "tracks": [
            {
                "name": "曲目1名称",
                "isrc": "",
                "duration_seconds": 240,
                "is_medley": False,
                "medley_tracks": [],
                "authors": [
                    {
                        "author_id": "A001",
                        "author_name": "作者姓名",
                        "role": "composer",
                        "ratio": 0.5,
                        "notes": ""
                    },
                    {
                        "author_id": "A002",
                        "author_name": "作者姓名2",
                        "role": "lyricist",
                        "ratio": 0.5,
                        "notes": ""
                    }
                ],
                "notes": ""
            },
            {
                "name": "串烧曲目示例",
                "isrc": "",
                "duration_seconds": 360,
                "is_medley": True,
                "medley_tracks": [
                    {
                        "track_name": "串烧子曲目1",
                        "duration_seconds": 180,
                        "notes": ""
                    },
                    {
                        "track_name": "串烧子曲目2",
                        "duration_seconds": 180,
                        "notes": ""
                    }
                ],
                "authors": [
                    {
                        "author_id": "A003",
                        "author_name": "串烧作者",
                        "role": "composer",
                        "ratio": 1.0,
                        "notes": ""
                    }
                ],
                "notes": ""
            }
        ],
        "platform_fees": [
            {
                "fee_type": "平台服务费",
                "amount": 10000.00,
                "period": "current",
                "notes": ""
            },
            {
                "fee_type": "宣传推广费",
                "amount": 5000.00,
                "period": "current",
                "notes": ""
            }
        ]
    }


def main():
    parser = argparse.ArgumentParser(
        prog="royalty_settlement",
        description="版权分账演出单 - 小型厂牌现场演出版权费结算工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 生成输入模板
  python -m royalty_settlement template -o my_show.json

  # 编辑 my_show.json 填入实际数据后，执行结算
  python -m royalty_settlement settle my_show.json

  # 查看历史记录
  python -m royalty_settlement history
        """
    )
    parser.add_argument("--base-dir", help="数据根目录，默认当前目录", default=None)
    parser.add_argument("--no-color", action="store_true", help="禁用彩色输出")

    subparsers = parser.add_subparsers(dest="command", required=True)

    settle_parser = subparsers.add_parser("settle", help="执行版权分账结算")
    settle_parser.add_argument("input", help="演出单JSON文件路径")
    settle_parser.add_argument("-q", "--quiet", action="store_true", help="静默模式，只输出结果文件")

    history_parser = subparsers.add_parser("history", help="查看历史结算记录")

    template_parser = subparsers.add_parser("template", help="生成演出单输入模板")
    template_parser.add_argument("-o", "--output", help="输出文件路径", default="performance_template.json")

    args = parser.parse_args()

    if args.command == "settle":
        return cmd_settle(args)
    elif args.command == "history":
        return cmd_history(args)
    elif args.command == "template":
        return cmd_template(args)
    else:
        parser.print_help()
        return 1


if __name__ == "__main__":
    sys.exit(main())
