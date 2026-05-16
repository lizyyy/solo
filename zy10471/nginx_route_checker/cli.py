#!/usr/bin/env python3
import argparse
import sys
import os
from pathlib import Path

from .config_parser import NginxConfigParser
from .matcher import RouteMatcher
from .conflict_detector import ConflictDetector
from .reporter import Reporter


def main():
    parser = argparse.ArgumentParser(
        description="Nginx 路由冲突检测工具 - 检测 location 规则冲突和路径覆盖问题",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  nginx-route-checker --config /etc/nginx/conf.d
  nginx-route-checker --config ./nginx.conf --output ./reports
  nginx-route-checker --config /etc/nginx --test-path /api/v1/users
  nginx-route-checker --config ./conf --format html,json,terminal
        """
    )

    parser.add_argument(
        "--config", "-c",
        required=True,
        help="Nginx 配置文件或目录路径（目录会递归扫描 .conf 文件）"
    )

    parser.add_argument(
        "--output", "-o",
        default="./nginx-route-reports",
        help="报告输出目录（默认: ./nginx-route-reports）"
    )

    parser.add_argument(
        "--test-path", "-t",
        action="append",
        help="测试特定路径的匹配情况（可多次使用）"
    )

    parser.add_argument(
        "--format", "-f",
        default="terminal,json,markdown",
        help="输出格式，用逗号分隔（可选: terminal, json, markdown, html）"
    )

    parser.add_argument(
        "--strict",
        action="store_true",
        help="严格模式：将潜在冲突标记为错误"
    )

    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="显示详细调试信息"
    )

    parser.add_argument(
        "--no-color",
        action="store_true",
        help="禁用彩色输出"
    )

    args = parser.parse_args()

    try:
        config_path = Path(args.config).resolve()
        if not config_path.exists():
            print(f"错误: 配置路径不存在 - {config_path}", file=sys.stderr)
            sys.exit(1)

        output_dir = Path(args.output).resolve()
        output_dir.mkdir(parents=True, exist_ok=True)

        formats = [f.strip().lower() for f in args.format.split(",")]
        valid_formats = {"terminal", "json", "markdown", "html"}
        invalid_formats = set(formats) - valid_formats
        if invalid_formats:
            print(f"错误: 不支持的输出格式 - {', '.join(invalid_formats)}", file=sys.stderr)
            print(f"支持的格式: {', '.join(valid_formats)}", file=sys.stderr)
            sys.exit(1)

    except Exception as e:
        print(f"参数校验错误: {str(e)}", file=sys.stderr)
        sys.exit(1)

    print("=" * 60)
    print("Nginx 路由冲突检测工具")
    print("=" * 60)
    print(f"配置路径: {config_path}")
    print(f"输出目录: {output_dir}")
    print()

    try:
        print("[1/4] 解析 Nginx 配置...")
        config_parser = NginxConfigParser(verbose=args.verbose)
        servers = config_parser.parse(config_path)

        if not servers:
            print("警告: 未找到任何有效的 server 配置块")
            sys.exit(0)

        print(f"  找到 {len(servers)} 个 server 块")
        total_locations = sum(len(s["locations"]) for s in servers)
        print(f"  找到 {total_locations} 个 location 规则")
        print()

        print("[2/4] 分析路由匹配规则...")
        matcher = RouteMatcher(verbose=args.verbose)
        for server in servers:
            matcher.analyze_server(server)

        print()

        print("[3/4] 检测路由冲突...")
        detector = ConflictDetector(strict=args.strict, verbose=args.verbose)
        conflicts = detector.detect_conflicts(servers)

        if args.test_path:
            print()
            print("[额外] 测试指定路径...")
            for path in args.test_path:
                print(f"\n  测试路径: {path}")
                for server in servers:
                    matches = matcher.test_path(server, path)
                    if matches:
                        print(f"    Server {server['name']}:")
                        for i, match in enumerate(matches, 1):
                            print(f"      {i}. {match['location']['raw']}")
                            print(f"         优先级: {match['priority']}, 匹配类型: {match['match_type']}")

        print()
        print("[4/4] 生成报告...")
        reporter = Reporter(output_dir, use_color=not args.no_color)

        if "terminal" in formats:
            reporter.print_terminal_summary(servers, conflicts)

        if "json" in formats:
            json_path = reporter.generate_json_report(servers, conflicts)
            print(f"  JSON 报告: {json_path}")

        if "markdown" in formats:
            md_path = reporter.generate_markdown_report(servers, conflicts)
            print(f"  Markdown 报告: {md_path}")

        if "html" in formats:
            html_path = reporter.generate_html_report(servers, conflicts)
            print(f"  HTML 报告: {html_path}")

        print()
        print("=" * 60)
        if conflicts:
            print(f"检测完成! 发现 {len(conflicts)} 个冲突")
            has_errors = any(c["severity"] == "error" for c in conflicts)
            if has_errors:
                sys.exit(2)
        else:
            print("检测完成! 未发现路由冲突 ✓")
        print("=" * 60)

    except Exception as e:
        print(f"\n错误: {str(e)}", file=sys.stderr)
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
