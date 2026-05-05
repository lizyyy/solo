"""命令行入口"""

import argparse
import sys
from pathlib import Path
from typing import List

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .config import ConfigParser
from .database import Database
from .examples import get_builtin_examples
from .exporter import ReportExporter
from .models import SimulationResult, BottleneckType
from .simulator import TransferSimulator


console = Console()
db = Database()
simulator = TransferSimulator()
parser = ConfigParser()
exporter = ReportExporter()


def main():
    """主入口"""
    arg_parser = argparse.ArgumentParser(
        prog="filecopy",
        description="文件传输拷贝链路模拟工具 - 帮助后端新人理解大文件传输中的拷贝路径",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  filecopy init                    # 初始化，生成配置模板
  filecopy init --examples         # 初始化，包含内置样例
  filecopy simulate cases.yaml      # 模拟配置文件中的用例
  filecopy simulate --builtin       # 运行内置样例
  filecopy analyze                  # 分析最近的模拟结果
  filecopy analyze --id 1           # 分析指定 ID 的结果
  filecopy export --md report.md    # 导出 Markdown 报告
  filecopy export --json report.json # 导出 JSON 报告
        """
    )
    
    subparsers = arg_parser.add_subparsers(dest="command", help="可用命令")
    
    init_parser = subparsers.add_parser("init", help="初始化项目，生成配置模板")
    init_parser.add_argument("--examples", action="store_true", help="包含内置样例用例")
    init_parser.add_argument("-o", "--output", default="cases.yaml", help="输出文件名 (默认: cases.yaml)")
    
    simulate_parser = subparsers.add_parser("simulate", help="执行模拟")
    simulate_parser.add_argument("config_file", nargs="?", help="YAML 配置文件路径")
    simulate_parser.add_argument("--builtin", action="store_true", help="运行内置样例")
    simulate_parser.add_argument("--no-save", action="store_true", help="不保存到数据库")
    
    analyze_parser = subparsers.add_parser("analyze", help="分析模拟结果")
    analyze_parser.add_argument("--id", type=int, help="指定结果 ID 进行分析")
    analyze_parser.add_argument("--all", action="store_true", help="显示所有结果")
    analyze_parser.add_argument("--limit", type=int, default=10, help="显示最近 N 条结果 (默认: 10)")
    analyze_parser.add_argument("--case", help="按用例名称筛选")
    
    export_parser = subparsers.add_parser("export", help="导出报告")
    export_parser.add_argument("--md", help="导出 Markdown 报告的路径")
    export_parser.add_argument("--json", help="导出 JSON 报告的路径")
    export_parser.add_argument("--id", type=int, action="append", help="指定要导出的结果 ID (可多次使用)")
    export_parser.add_argument("--all", action="store_true", help="导出所有结果")
    export_parser.add_argument("--detailed", action="store_true", default=True, help="包含详细拷贝链路 (默认开启)")
    
    args = arg_parser.parse_args()
    
    if args.command is None:
        arg_parser.print_help()
        sys.exit(0)
    
    if args.command == "init":
        cmd_init(args)
    elif args.command == "simulate":
        cmd_simulate(args)
    elif args.command == "analyze":
        cmd_analyze(args)
    elif args.command == "export":
        cmd_export(args)


def cmd_init(args):
    """init 命令：生成配置模板"""
    output_path = Path(args.output)
    
    if output_path.exists() and not args.examples:
        console.print(f"[yellow]⚠️ 文件已存在: {output_path}[/yellow]")
        response = console.input("是否覆盖? (y/N): ")
        if response.lower() != 'y':
            console.print("已取消。")
            return
    
    if args.examples:
        from .models import HardwareConfig, TransferMethod
        import yaml
        
        cases_data = []
        for case_def in get_builtin_examples():
            case_data = {
                'name': case_def.name,
                'description': case_def.description,
                'category': case_def.category,
                'tags': case_def.tags,
                'config': {
                    'file_size_mb': case_def.config.file_size_mb,
                    'method': case_def.config.method.value,
                    'page_cache_hit': case_def.config.page_cache_hit,
                    'use_mmap': case_def.config.use_mmap,
                    'use_sendfile': case_def.config.use_sendfile,
                    'use_dma_sg': case_def.config.use_dma_sg,
                    'use_tls': case_def.config.use_tls,
                    'use_compression': case_def.config.use_compression,
                    'compression_ratio': case_def.config.compression_ratio,
                    'chunk_size_kb': case_def.config.chunk_size_kb
                }
            }
            cases_data.append(case_data)
        
        template = {
            'hardware': {
                'disk_bandwidth_mbps': 100.0,
                'network_bandwidth_mbps': 100.0,
                'cpu_cores': 4,
                'memory_gb': 16,
                'page_cache_size_mb': 1024
            },
            'cases': cases_data
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            yaml.dump(template, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
    else:
        parser.generate_template(output_path)
    
    console.print(f"[green]✅ 已生成配置文件: {output_path}[/green]")
    if args.examples:
        console.print("[green]✅ 已包含内置样例用例[/green]")
    console.print(f"\n使用方法: filecopy simulate {output_path}")


def cmd_simulate(args):
    """simulate 命令：执行模拟"""
    cases = []
    
    if args.builtin:
        console.print("[blue]📋 加载内置样例...[/blue]")
        cases = get_builtin_examples()
    elif args.config_file:
        config_path = Path(args.config_file)
        if not config_path.exists():
            console.print(f"[red]❌ 配置文件不存在: {config_path}[/red]")
            sys.exit(1)
        console.print(f"[blue]📋 加载配置: {config_path}[/blue]")
        cases = parser.parse_file(config_path)
    else:
        console.print("[red]❌ 请指定配置文件或使用 --builtin 参数[/red]")
        sys.exit(1)
    
    if not cases:
        console.print("[yellow]⚠️ 没有找到可用的用例[/yellow]")
        return
    
    console.print(f"[blue]🔍 共发现 {len(cases)} 个用例，开始模拟...[/blue]\n")
    
    results = []
    for i, case in enumerate(cases, 1):
        console.print(Panel.fit(
            f"[bold]用例 {i}/{len(cases)}: {case.name}[/bold]\n"
            f"描述: {case.description}\n"
            f"方式: {case.config.method.value}",
            title="模拟进行中"
        ))
        
        result = simulator.simulate(case.config, case.name)
        results.append(result)
        
        if not args.no_save:
            result_id = db.save_result(result)
            console.print(f"[green]✅ 已保存结果 (ID: {result_id})[/green]")
        
        print_result_summary(result)
        console.print()
    
    console.print(f"[green]✅ 模拟完成，共 {len(results)} 个结果[/green]")
    
    if results:
        console.print("\n[blue]📊 摘要对比:[/blue]")
        print_comparison_table(results)


def cmd_analyze(args):
    """analyze 命令：分析结果"""
    results = []
    
    if args.id is not None:
        result = db.get_result(args.id)
        if result is None:
            console.print(f"[red]❌ 未找到结果 ID: {args.id}[/red]")
            sys.exit(1)
        results = [result]
    elif args.case:
        results = db.get_results_by_case(args.case)
        if not results:
            console.print(f"[yellow]⚠️ 未找到用例: {args.case}[/yellow]")
            return
    elif args.all:
        results = db.get_all_results(limit=1000)
    else:
        results = db.get_all_results(limit=args.limit)
    
    if not results:
        console.print("[yellow]⚠️ 没有找到模拟结果[/yellow]")
        console.print("请先运行: filecopy simulate")
        return
    
    if len(results) == 1:
        print_detailed_analysis(results[0])
    else:
        console.print(f"[blue]📊 共 {len(results)} 个结果:[/blue]\n")
        print_comparison_table(results)


def cmd_export(args):
    """export 命令：导出报告"""
    results = []
    
    if args.id:
        for rid in args.id:
            result = db.get_result(rid)
            if result:
                results.append(result)
            else:
                console.print(f"[yellow]⚠️ 未找到结果 ID: {rid}[/yellow]")
    elif args.all:
        results = db.get_all_results(limit=1000)
    else:
        results = db.get_all_results(limit=100)
    
    if not results:
        console.print("[yellow]⚠️ 没有找到可导出的结果[/yellow]")
        return
    
    if args.md:
        md_path = Path(args.md)
        exporter.export_markdown(results, md_path, detailed=args.detailed)
        console.print(f"[green]✅ Markdown 报告已导出: {md_path}[/green]")
    
    if args.json:
        json_path = Path(args.json)
        exporter.export_json(results, json_path)
        console.print(f"[green]✅ JSON 报告已导出: {json_path}[/green]")
    
    if not args.md and not args.json:
        console.print("[yellow]⚠️ 请指定 --md 或 --json 参数[/yellow]")


def print_result_summary(result: SimulationResult):
    """打印结果摘要"""
    table = Table(show_header=False, box=None)
    table.add_column("指标", style="cyan")
    table.add_column("值")
    
    table.add_row("用户态拷贝", f"[bold]{result.user_space_copies} 次[/bold]")
    table.add_row("内核态拷贝", f"[bold]{result.kernel_space_copies} 次[/bold]")
    table.add_row("总拷贝次数", f"[bold red]{result.total_copies} 次[/bold red]")
    table.add_row("上下文切换", f"{result.context_switches} 次")
    table.add_row("系统调用", f"{result.system_calls} 次")
    table.add_row("预估 CPU", f"{result.estimated_cpu_usage_pct:.1f}%")
    table.add_row("预估耗时", f"[bold]{result.estimated_time_ms:.1f} ms[/bold]")
    table.add_row("预估吞吐量", f"[bold green]{result.estimated_throughput_mbps:.2f} MB/s[/bold green]")
    
    console.print(table)
    
    bottleneck_color = {
        BottleneckType.NONE: "green",
        BottleneckType.CPU: "yellow",
        BottleneckType.IO: "yellow",
        BottleneckType.NETWORK: "yellow",
        BottleneckType.MEMORY: "yellow"
    }.get(result.bottleneck, "white")
    
    bottleneck_display = {
        BottleneckType.NONE: "✅ 无明显瓶颈",
        BottleneckType.CPU: "⚠️ CPU 瓶颈",
        BottleneckType.IO: "⚠️ 磁盘 I/O 瓶颈",
        BottleneckType.NETWORK: "⚠️ 网络瓶颈",
        BottleneckType.MEMORY: "⚠️ 内存拷贝瓶颈"
    }.get(result.bottleneck, "未知")
    
    console.print(f"[{bottleneck_color}]{bottleneck_display}[/{bottleneck_color}]")
    console.print(f"   {result.bottleneck_reason}")


def print_comparison_table(results: List[SimulationResult]):
    """打印对比表格"""
    table = Table(show_header=True, header_style="bold magenta")
    
    table.add_column("#", style="dim", width=3)
    table.add_column("用例")
    table.add_column("方式")
    table.add_column("总拷贝")
    table.add_column("上下文切换")
    table.add_column("CPU")
    table.add_column("耗时")
    table.add_column("吞吐量")
    table.add_column("瓶颈")
    
    for i, result in enumerate(results, 1):
        method_short = {
            'read_write': 'read+write',
            'mmap_write': 'mmap+write',
            'sendfile': 'sendfile'
        }.get(result.method.value, result.method.value)
        
        bottleneck_short = {
            BottleneckType.NONE: "✅",
            BottleneckType.CPU: "⚠️CPU",
            BottleneckType.IO: "⚠️I/O",
            BottleneckType.NETWORK: "⚠️NET",
            BottleneckType.MEMORY: "⚠️MEM"
        }.get(result.bottleneck, "?")
        
        table.add_row(
            str(i),
            result.case_name[:20] + "..." if len(result.case_name) > 20 else result.case_name,
            method_short,
            f"[bold]{result.total_copies}[/bold]",
            str(result.context_switches),
            f"{result.estimated_cpu_usage_pct:.0f}%",
            f"{result.estimated_time_ms:.0f}ms",
            f"[green]{result.estimated_throughput_mbps:.1f}[/green]",
            bottleneck_short
        )
    
    console.print(table)


def print_detailed_analysis(result: SimulationResult):
    """打印详细分析"""
    console.print(Panel.fit(
        f"[bold]{result.case_name}[/bold]\n"
        f"ID: {result.id} | 时间: {result.created_at.strftime('%Y-%m-%d %H:%M:%S')}",
        title="模拟结果详情"
    ))
    
    console.print("\n[bold magenta]📊 性能指标[/bold magenta]")
    print_result_summary(result)
    
    if result.copy_details:
        details = result.copy_details
        console.print(f"\n[bold magenta]🔗 拷贝链路: {details.get('method', 'N/A')}[/bold magenta]")
        console.print(f"> {details.get('description', 'N/A')}\n")
        
        steps = details.get('steps', [])
        if steps:
            console.print("[bold]传输步骤:[/bold]")
            for step in steps:
                step_num = step.get('step', '?')
                desc = step.get('description', 'N/A')
                from_loc = step.get('from', 'N/A')
                to_loc = step.get('to', 'N/A')
                copy_type = step.get('type', 'N/A')
                opt = step.get('optimization')
                
                style = "green" if opt else "white"
                console.print(f"  [cyan]{step_num}.[/cyan] [{style}]{desc}[/{style}]")
                console.print(f"     流向: {from_loc} → {to_loc}")
                console.print(f"     类型: {copy_type}")
                if opt:
                    console.print(f"     [green]优化: {opt}[/green]")
                console.print()
        
        key_points = details.get('key_points', [])
        if key_points:
            console.print("[bold]💡 关键要点:[/bold]")
            for kp in key_points:
                console.print(f"  • {kp}")


if __name__ == "__main__":
    main()
