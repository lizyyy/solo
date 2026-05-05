#!/usr/bin/env python3
"""生成器和迭代器坑点分析 CLI 工具。

帮助团队复盘 __iter__/__next__、yield/yield from、send/throw/close、
StopIteration、惰性求值、一次性迭代器被重复消费、tee 缓存膨胀等问题。
"""

import argparse
import sys
from pathlib import Path
from typing import Optional

from .version import __version__
from .commands.init import init_command
from .commands.analyze import analyze_command
from .commands.compare import compare_command
from .commands.export import export_command


def create_parser() -> argparse.ArgumentParser:
    """创建命令行参数解析器。"""
    parser = argparse.ArgumentParser(
        prog="pitfall",
        description="生成器和迭代器坑点分析工具 - 帮助团队定位和复盘迭代器相关问题",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  pitfall init                    # 初始化示例数据
  pitfall analyze --name "v1.0"  # 分析当前数据并命名为 v1.0
  pitfall compare 1 2             # 对比第1次和第2次分析结果
  pitfall export --format markdown  # 导出 Markdown 报告

支持的坑点检测:
  - __iter__/__next__ 协议实现问题
  - yield/yield from 正确使用
  - send/throw/close 高级方法
  - StopIteration 异常处理
  - 惰性求值相关陷阱
  - 一次性迭代器被重复消费
  - itertools.tee 缓存膨胀风险
        """,
    )

    parser.add_argument(
        "-v", "--version",
        action="version",
        version=f"%(prog)s {__version__}",
    )

    parser.add_argument(
        "--db",
        type=Path,
        default=Path(".pitfall.db"),
        help="SQLite 数据库文件路径 (默认: .pitfall.db)",
    )

    parser.add_argument(
        "--verbose",
        action="store_true",
        help="启用详细输出模式",
    )

    subparsers = parser.add_subparsers(
        dest="command",
        help="可用命令",
        required=True,
    )

    # init 命令
    init_parser = subparsers.add_parser(
        "init",
        help="初始化示例数据目录",
        description="创建包含示例 pipelines.yaml、events.jsonl 和 snippets/*.py 的示例项目",
    )
    init_parser.add_argument(
        "-f", "--force",
        action="store_true",
        help="强制覆盖已存在的文件",
    )
    init_parser.add_argument(
        "-d", "--directory",
        type=Path,
        default=Path("."),
        help="目标目录 (默认: 当前目录)",
    )

    # analyze 命令
    analyze_parser = subparsers.add_parser(
        "analyze",
        help="分析当前项目中的迭代器坑点",
        description="读取 pipelines.yaml、events.jsonl 和 snippets/*.py，分析迭代器和生成器相关问题",
    )
    analyze_parser.add_argument(
        "-n", "--name",
        type=str,
        help="本次分析的名称标签 (如 'v1.0' 或 '修复前')",
    )
    analyze_parser.add_argument(
        "--pipelines",
        type=Path,
        default=Path("pipelines.yaml"),
        help="pipelines.yaml 文件路径",
    )
    analyze_parser.add_argument(
        "--events",
        type=Path,
        default=Path("events.jsonl"),
        help="events.jsonl 文件路径",
    )
    analyze_parser.add_argument(
        "--snippets",
        type=Path,
        default=Path("snippets"),
        help="snippets 目录路径",
    )

    # compare 命令
    compare_parser = subparsers.add_parser(
        "compare",
        help="对比两次分析结果",
        description="对比改造前后的两次分析，显示改进和恶化情况",
    )
    compare_parser.add_argument(
        "analysis_id_1",
        type=int,
        help="第一次分析的 ID",
    )
    compare_parser.add_argument(
        "analysis_id_2",
        type=int,
        help="第二次分析的 ID",
    )
    compare_parser.add_argument(
        "--format",
        choices=["console", "json", "markdown"],
        default="console",
        help="输出格式 (默认: console)",
    )

    # export 命令
    export_parser = subparsers.add_parser(
        "export",
        help="导出分析报告",
        description="将分析结果导出为 Markdown 或 JSON 格式报告",
    )
    export_parser.add_argument(
        "-a", "--analysis-id",
        type=int,
        help="指定分析 ID (默认: 最新分析)",
    )
    export_parser.add_argument(
        "-f", "--format",
        choices=["markdown", "json"],
        default="markdown",
        help="导出格式 (默认: markdown)",
    )
    export_parser.add_argument(
        "-o", "--output",
        type=Path,
        help="输出文件路径 (默认: 标准输出)",
    )

    return parser


def main() -> int:
    """主入口函数。"""
    parser = create_parser()
    args = parser.parse_args()

    try:
        if args.command == "init":
            return init_command(args)
        elif args.command == "analyze":
            return analyze_command(args)
        elif args.command == "compare":
            return compare_command(args)
        elif args.command == "export":
            return export_command(args)
        else:
            parser.print_help()
            return 1
    except KeyboardInterrupt:
        print("\n操作已取消", file=sys.stderr)
        return 130
    except Exception as e:
        if args.verbose:
            import traceback
            traceback.print_exc()
        else:
            print(f"错误: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
