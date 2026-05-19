#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path

from .engine import OverrideEngine
from .reporter import Reporter


def main():
    parser = argparse.ArgumentParser(
        description="环境变量覆盖链影子值定位排查CLI工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
优先级层级 (从低到高):
  10: default  - 默认值
  20: env      - .env.* 全局环境文件
  30: env      - .env.local 本地覆盖
  40: shell    - shell 脚本中的定义
  50: compose  - docker-compose 中的定义
  60: system   - 系统环境变量
        """
    )
    
    parser.add_argument(
        "scan_path",
        nargs="?",
        default=".",
        help="扫描路径 (目录或单个文件)"
    )
    
    parser.add_argument(
        "-v", "--variable",
        action="append",
        help="过滤特定变量名 (可多次使用)"
    )
    
    parser.add_argument(
        "-d", "--detailed",
        action="store_true",
        help="显示详细报告"
    )
    
    parser.add_argument(
        "-o", "--overrides-only",
        action="store_true",
        help="只显示有覆盖的变量"
    )
    
    parser.add_argument(
        "--json",
        metavar="FILE",
        help="导出 JSON 报告到文件"
    )
    
    parser.add_argument(
        "--md", "--markdown",
        metavar="FILE",
        help="导出 Markdown 报告到文件"
    )
    
    parser.add_argument(
        "--with-system",
        action="store_true",
        help="包含系统环境变量"
    )
    
    parser.add_argument(
        "--system-pattern",
        action="append",
        help="系统环境变量过滤模式 (如 'APP_', 'DB_')"
    )
    
    parser.add_argument(
        "--default",
        action="append",
        help="添加默认值 (格式: NAME=value)"
    )
    
    args = parser.parse_args()
    
    try:
        engine = OverrideEngine(args.scan_path)
        
        if args.default:
            defaults = {}
            for d in args.default:
                if '=' in d:
                    name, value = d.split('=', 1)
                    defaults[name.strip()] = value.strip()
            if defaults:
                engine.add_defaults(defaults)
        
        if args.with_system:
            engine.add_system_env(args.system_pattern)
        
        report = engine.scan(args.variable)
        
        reporter = Reporter(report)
        reporter.print_console(
            detailed=args.detailed,
            show_overrides_only=args.overrides_only
        )
        
        if args.json:
            reporter.export_json(args.json)
        
        if args.md:
            reporter.export_markdown(args.md)
        
        if report.variables_with_overrides > 0:
            sys.exit(2)
        elif report.missing_variables > 0:
            sys.exit(1)
        
    except KeyboardInterrupt:
        print("\n操作被用户中断")
        sys.exit(130)
    except Exception as e:
        print(f"错误: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
