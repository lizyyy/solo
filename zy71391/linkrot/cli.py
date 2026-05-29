from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from .scanner_engine import LinkRotScanner

__all__ = ["main"]


def _configure_logging(verbose: bool) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="linkrot",
        description="Markdown 文档链接腐烂扫描工具 — 检查外链、锚点、版本目录的有效性",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  linkrot scan ./docs                      # 扫描 docs 目录
  linkrot scan ./docs --skip-external      # 跳过外链检查，只检查内部锚点
  linkrot scan ./docs --timeout 30         # 设置请求超时 30 秒
  linkrot scan ./docs --format markdown    # 只导出 Markdown 报告
  linkrot scan ./docs --include-ok         # 报告中包含正常的链接
  linkrot scan ./docs -o ./reports         # 指定报告输出目录
""",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    scan_parser = subparsers.add_parser(
        "scan",
        help="执行链接扫描",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    scan_parser.add_argument(
        "root_dir",
        type=Path,
        help="文档根目录",
    )
    scan_parser.add_argument(
        "-p", "--pattern",
        default="**/*.md",
        help="文件匹配模式（默认: **/*.md）",
    )
    scan_parser.add_argument(
        "--skip-external",
        action="store_true",
        help="跳过外链 HTTP 检查，只检查内部链接和锚点",
    )
    scan_parser.add_argument(
        "-t", "--timeout",
        type=int,
        default=15,
        help="HTTP 请求超时秒数（默认: 15）",
    )
    scan_parser.add_argument(
        "-r", "--max-redirects",
        type=int,
        default=10,
        help="最大重定向次数（默认: 10）",
    )
    scan_parser.add_argument(
        "-f", "--format",
        action="append",
        choices=["markdown", "json"],
        help="输出格式（可指定多次，默认两种都输出）",
    )
    scan_parser.add_argument(
        "-o", "--output-dir",
        type=Path,
        default=None,
        help="报告输出目录（默认: <root_dir>/scan_reports）",
    )
    scan_parser.add_argument(
        "--include-ok",
        action="store_true",
        help="在报告中包含状态正常的链接",
    )
    scan_parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="显示详细调试日志",
    )

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    if args.command == "scan":
        return _run_scan(args)

    parser.print_help()
    return 1


def _run_scan(args) -> int:
    _configure_logging(args.verbose)

    root_dir: Path = args.root_dir.resolve()
    if not root_dir.is_dir():
        print(f"错误: 目录不存在: {root_dir}", file=sys.stderr)
        return 2

    formats = tuple(args.format) if args.format else ("markdown", "json")

    print(f"📁 扫描根目录: {root_dir}")
    print(f"🔍 文件模式: {args.pattern}")
    if args.skip_external:
        print("⏭️  跳过外链检查")
    print(f"⏱️  超时: {args.timeout}s | 重定向上限: {args.max_redirects}")
    print(f"📤 输出格式: {', '.join(formats)}")
    print("-" * 60)

    scanner = LinkRotScanner(
        root_dir=root_dir,
        timeout=args.timeout,
        max_redirects=args.max_redirects,
        skip_external=args.skip_external,
    )

    try:
        report = scanner.scan(file_pattern=args.pattern)
    except KeyboardInterrupt:
        print("\n⏹️  扫描被中断", file=sys.stderr)
        return 130
    except Exception as e:
        print(f"\n❌ 扫描失败: {e}", file=sys.stderr)
        if args.verbose:
            import traceback
            traceback.print_exc()
        return 1

    print("-" * 60)
    scanner.print_summary(report)
    print("-" * 60)

    output_paths = scanner.export_report(
        report=report,
        output_dir=args.output_dir,
        formats=formats,
        include_ok=args.include_ok,
    )

    print("")
    print("📄 报告已生成:")
    for fmt, path in output_paths.items():
        print(f"  - {fmt}: {path}")

    if report.broken_count > 0:
        print("")
        print(f"⚠️  检测到 {report.broken_count} 个严重问题，建议尽快修复。")
        return 3

    if report.warning_count > 0:
        print("")
        print(f"⚡ 检测到 {report.warning_count} 个警告，建议择机修复。")
        return 0

    print("")
    print("✅ 没有发现需要修复的链接问题！")
    return 0


if __name__ == "__main__":
    sys.exit(main())
