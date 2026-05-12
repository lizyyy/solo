import sys
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

from core.config import ensure_dirs
ensure_dirs()

from core.parser import load_task_definitions
from core.dependency_graph import DependencyGraph
from core.runtime import RuntimeManager
from core.printer import TerminalPrinter
from storage.json_store import JsonStore
import yaml


def cmd_graph(args):
    tasks = load_task_definitions(args.get('definitions'))
    if not tasks:
        print("错误: 未找到任务定义", file=sys.stderr)
        sys.exit(1)
    
    graph = DependencyGraph(tasks)
    analysis = graph.analyze_graph()
    printer = TerminalPrinter()
    printer.print_graph(graph, analysis)
    return 0


def cmd_import(args):
    tasks = load_task_definitions(args.get('definitions'))
    if not tasks:
        print("错误: 未找到任务定义", file=sys.stderr)
        sys.exit(1)
    
    graph = DependencyGraph(tasks)
    store = JsonStore()
    runtime = RuntimeManager(graph, store)
    
    file_path = Path(args['file'])
    with open(file_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f) or {}
    
    added_statuses, added_failures, import_hash = runtime.import_statuses(args['date'], data)
    printer = TerminalPrinter()
    printer.header("导入结果")
    
    if added_statuses == 0 and added_failures == 0:
        print(f"    {printer.color('无新增记录（可能已导入过，哈希: ' + import_hash[:12] + '...', 'yellow')}")
    else:
        print(f"    {printer.color(f'新增状态记录: {added_statuses}', 'green')}")
        print(f"    {printer.color(f'新增失败记录: {added_failures}', 'green')}")
        print(f"    导入哈希: {import_hash}")
    
    return 0


def cmd_impact(args):
    tasks = load_task_definitions(args.get('definitions'))
    if not tasks:
        print("错误: 未找到任务定义", file=sys.stderr)
        sys.exit(1)
    
    graph = DependencyGraph(tasks)
    store = JsonStore()
    runtime = RuntimeManager(graph, store)
    
    analysis = runtime.analyze_impact(args['date'], args.get('task'))
    failures = runtime.load_failures(args['date'])
    printer = TerminalPrinter()
    printer.print_impact(analysis, failures, tasks)
    return 0


def cmd_plan(args):
    tasks = load_task_definitions(args.get('definitions'))
    if not tasks:
        print("错误: 未找到任务定义", file=sys.stderr)
        sys.exit(1)
    
    graph = DependencyGraph(tasks)
    store = JsonStore()
    runtime = RuntimeManager(graph, store)
    
    plan = runtime.compute_rerun_plan(args['date'])
    skips = runtime.load_skips(args['date'])
    printer = TerminalPrinter()
    printer.print_plan(plan, tasks, skips)
    return 0


def cmd_mark_fixed(args):
    tasks = load_task_definitions(args.get('definitions'))
    if not tasks:
        print("错误: 未找到任务定义", file=sys.stderr)
        sys.exit(1)
    
    if args['task'] not in tasks:
        print(f"错误: 任务不存在: {args['task']}", file=sys.stderr)
        sys.exit(1)
    
    graph = DependencyGraph(tasks)
    store = JsonStore()
    runtime = RuntimeManager(graph, store)
    success = runtime.mark_fixed(args['date'], args['task'])
    
    printer = TerminalPrinter()
    printer.header("标记已修复")
    
    if success:
        runtime.update_statuses_on_fix(args['date'], args['task'])
        msg1 = f"任务 {args['task']} 已标记为已修复"
        print(f"    {printer.color(msg1, 'green', bold=True)}")
        print(f"    原因: {args.get('reason', '手动标记已修复')}")
        print(f"    下游任务状态已更新")
    else:
        msg2 = f"任务 {args['task']} 不是失败状态，无需标记"
        print(f"    {printer.color(msg2, 'yellow')}")
    
    return 0


def cmd_skip(args):
    tasks = load_task_definitions(args.get('definitions'))
    if not tasks:
        print("错误: 未找到任务定义", file=sys.stderr)
        sys.exit(1)
    
    if not args.get('reason') or not args['reason'].strip():
        print("错误: 必须提供跳过原因 (--reason)", file=sys.stderr)
        sys.exit(1)
    
    if args['task'] not in tasks:
        print(f"错误: 任务不存在: {args['task']}", file=sys.stderr)
        sys.exit(1)
    
    graph = DependencyGraph(tasks)
    store = JsonStore()
    runtime = RuntimeManager(graph, store)
    
    try:
        skip = runtime.add_skip(args['date'], args['task'], args['reason'])
    except ValueError as e:
        print(f"错误: {e}", file=sys.stderr)
        sys.exit(1)
    
    printer = TerminalPrinter()
    printer.header("手工跳过任务")
    msg_skip = f"任务 {args['task']} 已标记为手工跳过"
    print(f"    {printer.color(msg_skip, 'magenta', bold=True)}")
    print(f"    原因: {args['reason']}")
    print(f"    时间: {skip.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    print(f"    {printer.color('注意: 后续导入不会覆盖此跳过标记', 'gray')}")
    
    return 0


def cmd_report(args):
    tasks = load_task_definitions(args.get('definitions'))
    if not tasks:
        print("错误: 未找到任务定义", file=sys.stderr)
        sys.exit(1)
    
    graph = DependencyGraph(tasks)
    store = JsonStore()
    runtime = RuntimeManager(graph, store)
    
    statuses = runtime.load_statuses(args['date'])
    failures = runtime.load_failures(args['date'])
    skips = runtime.load_skips(args['date'])
    printer = TerminalPrinter()
    printer.print_report(args['date'], statuses, failures, skips, tasks)
    return 0


def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        prog="task-topology",
        description="任务依赖拓扑 CLI - 管理定时任务依赖和重跑计划"
    )
    parser.add_argument("-d", "--definitions", default=None, help="任务定义文件路径 (YAML)")
    parser.add_argument("--date", default="2026-05-12", help="运行日期 (默认: 2026-05-12)")
    
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    p_graph = subparsers.add_parser("graph", help="显示任务依赖拓扑图")
    
    p_import = subparsers.add_parser("import", help="导入运行状态")
    p_import.add_argument("-f", "--file", required=True, help="状态文件路径 (YAML)")
    
    p_impact = subparsers.add_parser("impact", help="分析失败影响")
    p_impact.add_argument("-t", "--task", default=None, help="指定失败任务ID")
    
    p_plan = subparsers.add_parser("plan", help="生成重跑计划")
    
    p_fixed = subparsers.add_parser("mark-fixed", help="标记任务已修复")
    p_fixed.add_argument("-t", "--task", required=True, help="任务ID")
    p_fixed.add_argument("-r", "--reason", default=None, help="修复原因")
    
    p_skip = subparsers.add_parser("skip", help="手工跳过任务")
    p_skip.add_argument("-t", "--task", required=True, help="任务ID")
    p_skip.add_argument("-r", "--reason", required=True, help="跳过原因 (必填)")
    
    p_report = subparsers.add_parser("report", help="生成运行状态报告")
    
    args = parser.parse_args()
    args_dict = vars(args)
    
    command_funcs = {
        'graph': cmd_graph,
        'import': cmd_import,
        'impact': cmd_impact,
        'plan': cmd_plan,
        'mark-fixed': cmd_mark_fixed,
        'skip': cmd_skip,
        'report': cmd_report,
    }
    
    func = command_funcs.get(args.command)
    if func:
        return func(args_dict)
    else:
        print(f"未知命令: {args.command}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
