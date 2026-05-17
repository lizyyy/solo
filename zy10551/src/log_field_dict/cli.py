import os
import sys
import traceback
import click
from rich.console import Console
from .analyzer import LogAnalyzer
from .reporter import Reporter
from . import __version__

console = Console()


def handle_exception(e: Exception, debug: bool = False):
    console.print(f"[bold red]错误:[/bold red] {str(e)}")
    if debug:
        console.print("\n[yellow]调试信息:[/yellow]")
        traceback.print_exc()
    else:
        console.print("[dim]使用 --debug 参数查看详细错误信息[/dim]")
    sys.exit(1)


@click.group()
@click.version_option(version=__version__, prog_name="logdict")
def main():
    """日志字段字典CLI - 分析日志字段冲突，生成统一字典报告"""
    pass


@main.command()
@click.argument('path', type=click.Path(exists=True))
@click.option('--service', '-s', help='指定固定服务名（如日志中不含服务名）')
@click.option('--output', '-o', default='output', help='输出目录，默认: output')
@click.option('--quiet', '-q', is_flag=True, help='静默模式，不打印终端摘要')
@click.option('--debug', '-d', is_flag=True, help='显示调试错误信息')
def analyze(path: str, service: str, output: str, quiet: bool, debug: bool):
    """分析日志文件或目录，生成字段字典报告"""
    try:
        analyzer = LogAnalyzer(fixed_service_name=service)
        
        if os.path.isfile(path):
            console.print(f"[blue]分析文件:[/blue] {path}")
            result = analyzer.analyze_file(path)
        elif os.path.isdir(path):
            console.print(f"[blue]分析目录:[/blue] {path}")
            result = analyzer.analyze_directory(path)
        else:
            console.print(f"[red]错误:[/red] 路径不存在或无法访问: {path}")
            sys.exit(1)
        
        reporter = Reporter(result, output_dir=output)
        
        if not quiet:
            reporter.print_summary()
        
        json_path = reporter.export_json()
        md_path = reporter.export_markdown()
        bad_path = reporter.export_bad_records()
        
        console.print(f"\n[green]报告已生成:[/green]")
        console.print(f"  - 机器可读JSON: {json_path}")
        console.print(f"  - 友好Markdown: {md_path}")
        console.print(f"  - 坏记录: {bad_path}")
        
        if result.conflicting_fields:
            console.print(f"\n[yellow]提示:[/yellow] 发现 {len(result.conflicting_fields)} 个冲突字段，请重点关注！")
        
    except Exception as e:
        handle_exception(e, debug)


@main.command()
@click.argument('path', type=click.Path(exists=True))
@click.option('--service', '-s', help='指定固定服务名')
def fields(path: str, service: str):
    """快速列出日志中的所有字段"""
    try:
        analyzer = LogAnalyzer(fixed_service_name=service)
        if os.path.isfile(path):
            result = analyzer.analyze_file(path)
        else:
            result = analyzer.analyze_directory(path)
        
        console.print(f"\n[bold]发现 {result.total_fields} 个字段:[/bold]\n")
        for field_name in sorted(result.fields.keys()):
            field_info = result.fields[field_name]
            status = "[red]⚠[/red]" if field_info.has_conflict else "[green]✓[/green]"
            types = ", ".join(field_info.type_summary.keys())
            services = ", ".join(field_info.services)
            console.print(f"{status} {field_name:40s} [dim]类型:[/dim] {types:15s} [dim]服务:[/dim] {services}")
        
    except Exception as e:
        handle_exception(e)


@main.command()
@click.argument('path', type=click.Path(exists=True))
@click.option('--service', '-s', help='指定固定服务名')
def conflicts(path: str, service: str):
    """仅查看冲突字段"""
    try:
        analyzer = LogAnalyzer(fixed_service_name=service)
        if os.path.isfile(path):
            result = analyzer.analyze_file(path)
        else:
            result = analyzer.analyze_directory(path)
        
        if not result.conflicting_fields:
            console.print("[green]太棒了！没有发现冲突字段。[/green]")
            return
        
        console.print(f"\n[bold red]发现 {len(result.conflicting_fields)} 个冲突字段:[/bold red]\n")
        
        for field_name in sorted(result.conflicting_fields):
            field_info = result.fields[field_name]
            console.print(f"[bold]{field_name}[/bold]")
            for type_name, services in sorted(field_info.type_summary.items()):
                console.print(f"  [cyan]{type_name:12s}[/cyan] → {', '.join(sorted(services))}")
            console.print("")
        
    except Exception as e:
        handle_exception(e)


@main.command()
def sample():
    """生成示例日志文件，方便测试"""
    sample_content = '''{"service": "user-service", "timestamp": "2024-01-15T10:30:00", "user_id": 12345, "level": "info", "message": "login success"}
{"service": "user-service", "timestamp": "2024-01-15T10:30:01", "user_id": "67890", "level": "warn", "message": "invalid token"}
{"service": "order-service", "timestamp": "2024-01-15T10:30:02", "order_id": 99999, "user_id": 12345, "amount": 99.99}
{"service": "order-service", "timestamp": "2024-01-15T10:30:03", "order_id": "ORD-10000", "user_id": 67890, "amount": "199.99"}
{"service": "payment-service", "timestamp": "2024-01-15T10:30:04", "payment_id": "PAY-abc", "success": true, "user_id": 12345}
service=payment-service timestamp=2024-01-15T10:30:05 payment_id=PAY-def success=false user_id=67890
这是一条坏日志，无法解析
'''
    
    with open('sample.log', 'w', encoding='utf-8') as f:
        f.write(sample_content)
    
    console.print("[green]示例日志已生成: sample.log[/green]")
    console.print("[dim]运行 'logdict analyze sample.log' 开始测试[/dim]")


if __name__ == '__main__':
    main()
