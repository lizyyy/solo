import argparse
import os
import sys
from pathlib import Path
from typing import Optional, Dict

from . import __version__
from .scanner import Scanner
from .detector import PortDetector
from .data_store import DataStore
from .report import ConsoleReporter, FileReporter


def cmd_scan(args) -> int:
    workspace = args.workspace or os.getcwd()
    store = DataStore(workspace)

    scanner = Scanner(workspace)
    projects = scanner.scan()

    if not projects:
        print(f"在 {workspace} 中未发现任何项目的端口配置。")
        print("确保工作区内有子目录，且包含 .env, package.json, docker-compose.yml 等配置文件。")
        return 1

    for project in projects:
        store.update_project(project)
        print(f"✓ 已扫描: {project.name} (发现 {len(project.ports)} 个端口配置)")

    print(f"\n共扫描 {len(projects)} 个项目。")
    return 0


def cmd_check(args) -> int:
    workspace = args.workspace or os.getcwd()
    store = DataStore(workspace)
    result = store.get_result()

    if not result.projects:
        print("未找到扫描结果。请先运行 'port-checker scan'。")
        return 1

    simulate_occupied: Dict[int, str] = {}
    if args.simulate:
        print("⚠️  运行在模拟模式下，不会真实检测端口占用。")
        if args.occupied:
            for item in args.occupied:
                if ':' in item:
                    port_str, proc_name = item.split(':', 1)
                    try:
                        port = int(port_str)
                        simulate_occupied[port] = proc_name
                    except ValueError:
                        print(f"警告: 忽略无效的模拟端口配置 '{item}'")
                else:
                    try:
                        port = int(item)
                        simulate_occupied[port] = "simulated_process"
                    except ValueError:
                        print(f"警告: 忽略无效的模拟端口 '{item}'")

    detector = PortDetector(simulate=args.simulate, simulate_occupied=simulate_occupied)
    detector.check(result)
    store.mark_checked()

    for project in result.projects.values():
        store.update_project(project)

    if args.no_detail:
        reporter = ConsoleReporter(use_color=not args.no_color)
        reporter.print_list(result)
    else:
        reporter = ConsoleReporter(use_color=not args.no_color)
        reporter.print_detail(result)

    return 0


def cmd_project(args) -> int:
    workspace = args.workspace or os.getcwd()
    store = DataStore(workspace)
    result = store.get_result()

    if not result.projects:
        print("未找到扫描结果。请先运行 'port-checker scan'。")
        return 1

    project_name = args.name
    if project_name not in result.projects:
        print(f"未找到项目 '{project_name}'。可用项目: {', '.join(result.projects.keys())}")
        return 1

    reporter = ConsoleReporter(use_color=not args.no_color)
    reporter.print_detail(result, project_name)
    return 0


def cmd_list(args) -> int:
    workspace = args.workspace or os.getcwd()
    store = DataStore(workspace)
    result = store.get_result()

    if not result.projects:
        print("未找到扫描结果。请先运行 'port-checker scan'。")
        return 1

    reporter = ConsoleReporter(use_color=not args.no_color)
    reporter.print_list(result)
    return 0


def cmd_report(args) -> int:
    workspace = args.workspace or os.getcwd()
    store = DataStore(workspace)
    result = store.get_result()

    if not result.projects:
        print("未找到扫描结果。请先运行 'port-checker scan' 和 'port-checker check'。")
        return 1

    output = args.output or "port-check-report.txt"
    reporter = FileReporter(output)
    report_path = reporter.generate(result)

    print(f"✓ 报告已生成: {report_path}")
    return 0


def cmd_demo(args) -> int:
    print("=" * 80)
    print("  port-checker 演示")
    print("=" * 80)
    print()
    print("工作流程示例:")
    print()
    print("  1. 扫描工作区所有项目的端口配置:")
    print("     $ port-checker scan")
    print()
    print("  2. 检测端口占用情况:")
    print("     $ port-checker check")
    print()
    print("  3. 使用模拟模式（安全测试，不真实检测）:")
    print("     $ port-checker check --simulate --occupied 3000:node 5432:postgres 8080")
    print()
    print("  4. 查看特定项目详情:")
    print("     $ port-checker project my-web-app")
    print()
    print("  5. 生成文本报告:")
    print("     $ port-checker report -o port-report.txt")
    print()
    print("=" * 80)
    print()
    print("样例项目配置文件说明:")
    print()
    print("  .env 文件示例:")
    print("    PORT=3000")
    print("    API_PORT=8080")
    print("    DB_PORT=5432")
    print()
    print("  docker-compose.yml 中的端口配置会被自动识别")
    print("  package.json 中 scripts 里的 --port 参数也会被识别")
    print()
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="port-checker",
        description="研发环境端口占用巡检 CLI - 扫描项目配置、检测端口冲突、提供处理建议",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  port-checker scan                扫描当前目录下所有项目
  port-checker scan --workspace /path/to/workspace  指定工作区
  port-checker check               检测已扫描项目的端口占用
  port-checker check --simulate --occupied 3000:node 5432  模拟模式
  port-checker list                列出所有项目状态
  port-checker project my-app      查看指定项目详情
  port-checker report              生成巡检报告
        """,
    )

    parser.add_argument("-v", "--version", action="version", version=f"port-checker {__version__}")

    subparsers = parser.add_subparsers(title="命令", dest="command")

    scan_parser = subparsers.add_parser("scan", help="扫描工作区，读取各项目的端口配置")
    scan_parser.add_argument(
        "--workspace", "-w",
        help="工作区目录路径（默认当前目录）",
    )
    scan_parser.set_defaults(func=cmd_scan)

    check_parser = subparsers.add_parser("check", help="检测本机端口占用情况")
    check_parser.add_argument(
        "--workspace", "-w",
        help="工作区目录路径（默认当前目录）",
    )
    check_parser.add_argument(
        "--no-detail",
        action="store_true",
        help="只显示汇总，不显示详情",
    )
    check_parser.add_argument(
        "--no-color",
        action="store_true",
        help="禁用彩色输出",
    )
    check_parser.add_argument(
        "--simulate",
        action="store_true",
        help="模拟模式，不真实检测端口（用于演示和测试）",
    )
    check_parser.add_argument(
        "--occupied",
        nargs="+",
        metavar="PORT[:PROCESS]",
        help="模拟被占用的端口列表，格式如 3000:node 8080 5432:postgres",
    )
    check_parser.set_defaults(func=cmd_check)

    list_parser = subparsers.add_parser("list", help="列出所有项目的端口状态")
    list_parser.add_argument(
        "--workspace", "-w",
        help="工作区目录路径（默认当前目录）",
    )
    list_parser.add_argument(
        "--no-color",
        action="store_true",
        help="禁用彩色输出",
    )
    list_parser.set_defaults(func=cmd_list)

    project_parser = subparsers.add_parser("project", help="按项目查看端口详情")
    project_parser.add_argument(
        "name",
        help="项目名称",
    )
    project_parser.add_argument(
        "--workspace", "-w",
        help="工作区目录路径（默认当前目录）",
    )
    project_parser.add_argument(
        "--no-color",
        action="store_true",
        help="禁用彩色输出",
    )
    project_parser.set_defaults(func=cmd_project)

    report_parser = subparsers.add_parser("report", help="生成巡检报告")
    report_parser.add_argument(
        "--workspace", "-w",
        help="工作区目录路径（默认当前目录）",
    )
    report_parser.add_argument(
        "--output", "-o",
        help="输出文件路径（默认 port-check-report.txt）",
    )
    report_parser.set_defaults(func=cmd_report)

    demo_parser = subparsers.add_parser("demo", help="查看使用演示和示例")
    demo_parser.set_defaults(func=cmd_demo)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 0

    try:
        return args.func(args)
    except KeyboardInterrupt:
        print("\n操作已取消。")
        return 130
    except Exception as e:
        print(f"错误: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
