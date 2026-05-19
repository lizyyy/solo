#!/usr/bin/env python3
import argparse
import sys
import os
from typing import List

from nginx_parser import NginxParser, NginxConfig, ServerBlock
from matcher import NginxMatcher, MatchResult
from conflict_detector import ConflictDetector, Conflict
from reporter import Reporter


def print_banner():
    banner = """
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║      Nginx 路由命中顺序冲突解释排查 CLI 工具 v1.0          ║
║                                                           ║
║      功能: 配置解析 | 路径匹配模拟 | 规则排序 |            ║
║            冲突解释 | 报告导出                             ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    """
    print(banner)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Nginx 路由匹配冲突检测工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python main.py -c nginx.conf -t /api/test -o report.json
  python main.py --config examples/normal.conf --list-servers
  python main.py -c nginx.conf --server 0 --batch-test paths.txt
        """,
    )

    parser.add_argument(
        "-c",
        "--config",
        required=True,
        help="Nginx 配置文件路径",
    )

    parser.add_argument(
        "-s",
        "--server",
        type=int,
        default=0,
        help="指定要检测的 server 块索引 (从 0 开始)",
    )

    parser.add_argument(
        "--list-servers",
        action="store_true",
        help="列出所有 server 块信息",
    )

    parser.add_argument(
        "-t",
        "--test-path",
        action="append",
        help="测试单个路径匹配 (可多次使用)",
    )

    parser.add_argument(
        "-b",
        "--batch-test",
        help="从文件批量测试路径 (每行一个路径)",
    )

    parser.add_argument(
        "--no-conflict",
        action="store_true",
        help="不进行冲突检测",
    )

    parser.add_argument(
        "-o",
        "--output",
        help="输出报告文件路径 (支持 .json 和 .txt 格式)",
    )

    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="显示详细匹配过程",
    )

    return parser.parse_args()


def list_servers(config: NginxConfig):
    print(f"\n找到 {len(config.servers)} 个 server 块:")
    print("-" * 70)
    for idx, server in enumerate(config.servers):
        server_name = ", ".join(server.server_name) or "未命名"
        print(
            f"[{idx}] 名称: {server_name} | 监听: {server.listen or '未指定'} | "
            f"Location: {len(server.locations)} 条"
        )
    print("")


def get_test_paths(args) -> List[str]:
    paths = []

    if args.test_path:
        paths.extend(args.test_path)

    if args.batch_test:
        if os.path.exists(args.batch_test):
            with open(args.batch_test, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#"):
                        paths.append(line)
        else:
            print(f"警告: 批量测试文件不存在: {args.batch_test}")

    return paths


def main():
    print_banner()
    args = parse_args()

    parser = NginxParser()
    config = parser.parse_file(args.config)

    if config.parse_errors:
        print(f"配置解析错误 ({len(config.parse_errors)} 个):")
        for error in config.parse_errors:
            print(f"  - {error}")
        if not config.servers:
            print("无法继续检测，退出")
            sys.exit(1)

    if args.list_servers:
        list_servers(config)
        sys.exit(0)

    if args.server >= len(config.servers):
        print(
            f"错误: server 索引 {args.server} 超出范围，"
            f"共 {len(config.servers)} 个 server 块"
        )
        sys.exit(1)

    server = config.servers[args.server]
    print(f"当前检测 server: {', '.join(server.server_name) or '未命名'}")
    print(f"Location 规则数: {len(server.locations)}")

    matcher = NginxMatcher()
    conflict_detector = ConflictDetector()
    reporter = Reporter()

    test_paths = get_test_paths(args)

    if not test_paths:
        test_paths = ["/", "/index.html", "/api/test", "/static/image.jpg"]
        print(f"\n未指定测试路径，使用默认测试路径 ({len(test_paths)} 个)")

    print(f"\n开始测试路径匹配...")
    match_results: List[MatchResult] = []
    for path in test_paths:
        result = matcher.match_path(path, server.locations)
        match_results.append(result)

        if args.verbose:
            reporter.print_match_details(result)

    print("\n匹配结果摘要:")
    for result in match_results:
        status = "✓" if result.is_match else "✗"
        if result.matched_rule:
            rule_info = (
                f"[{result.matched_rule.modifier.value or '普通'}] "
                f"{result.matched_rule.pattern} (第 {result.matched_rule.line_number} 行)"
            )
        else:
            rule_info = "未命中"
        print(f"  {status} {result.request_path} -> {rule_info}")

    conflicts: List[Conflict] = []
    if not args.no_conflict:
        print("\n开始冲突检测...")
        conflicts = conflict_detector.detect_all_conflicts(server)

        if conflicts:
            print(f"发现 {len(conflicts)} 个潜在冲突:")
            for idx, conflict in enumerate(conflicts, 1):
                severity_display = {
                    "high": "高",
                    "medium": "中",
                    "low": "低",
                }.get(conflict.severity, conflict.severity)
                print(f"  [{idx}] [{severity_display}] {conflict.explanation[:60]}...")
        else:
            print("未发现明显冲突")

    if args.output:
        print(f"\n正在生成报告: {args.output}")
        _, ext = os.path.splitext(args.output)
        if ext.lower() == ".json":
            reporter.save_json_report(
                args.output, config, server, match_results, conflicts
            )
        else:
            reporter.save_text_report(
                args.output, config, server, match_results, conflicts
            )
        print("报告生成完成！")

    print("\n检测完成！")


if __name__ == "__main__":
    main()
