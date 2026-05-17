"""CLI命令行接口"""

import click
from pathlib import Path
from datetime import datetime
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from .analyzer import ArchiveAnalyzer
from .report_generator import ReportGenerator
from .models import PurificationRules, ExitCode

console = Console()


@click.group()
@click.version_option(version='1.0.0')
def cli():
    """归档包路径净化CLI - 处理压缩包中的绝对路径、中文空格和重复文件名问题"""
    pass


@cli.command()
@click.argument('archive_path', type=click.Path(exists=True, dir_okay=False))
@click.option('-o', '--output-dir', type=click.Path(file_okay=False), help='解包输出目录')
@click.option('--json-report', type=click.Path(dir_okay=False), help='生成JSON报告的路径')
@click.option('--md-report', type=click.Path(dir_okay=False), help='生成Markdown报告的路径')
@click.option('--dry-run/--no-dry-run', default=True, help='仅分析不实际解包（默认开启）')
@click.option('--overwrite/--no-overwrite', default=False, help='覆盖已存在的报告文件')
@click.option('--no-absolute', is_flag=True, help='不移除绝对路径')
@click.option('--no-spaces', is_flag=True, help='不替换空格')
@click.option('--no-dedup', is_flag=True, help='不处理重复文件名')
def analyze(
    archive_path: str,
    output_dir: str = None,
    json_report: str = None,
    md_report: str = None,
    dry_run: bool = True,
    overwrite: bool = False,
    no_absolute: bool = False,
    no_spaces: bool = False,
    no_dedup: bool = False,
):
    """分析归档包并生成净化报告"""
    
    rules = PurificationRules(
        remove_absolute=not no_absolute,
        replace_spaces=not no_spaces,
        replace_chinese_spaces=not no_spaces,
        deduplicate=not no_dedup,
    )
    
    output_path = Path(output_dir) if output_dir else None
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    archive_stem = Path(archive_path).stem
    
    if output_dir:
        output_path = Path(output_dir) / f"clean_{archive_stem}_{timestamp}"
    
    with console.status(f"正在分析归档包: {archive_path}..."):
        analyzer = ArchiveAnalyzer(archive_path, rules)
        result = analyzer.analyze(dry_run=dry_run, output_dir=output_path)
    
    _print_summary(result, dry_run)
    
    if json_report:
        json_path = Path(json_report)
        if not overwrite and json_path.exists():
            json_path = json_path.parent / f"{json_path.stem}_{timestamp}{json_path.suffix}"
        generator = ReportGenerator(result)
        generator.generate_json(json_path)
        console.print(f"[green]✓[/green] JSON报告已生成: [link=file://{json_path}]{json_path}[/link]")
    
    if md_report:
        md_path = Path(md_report)
        if not overwrite and md_path.exists():
            md_path = md_path.parent / f"{md_path.stem}_{timestamp}{md_path.suffix}"
        generator = ReportGenerator(result)
        generator.generate_markdown(md_path)
        console.print(f"[green]✓[/green] Markdown报告已生成: [link=file://{md_path}]{md_path}[/link]")
    
    if not dry_run and output_path:
        console.print(f"[green]✓[/green] 文件已净化并提取到: [link=file://{output_path}]{output_path}[/link]")
    
    raise SystemExit(result.exit_code.value)


@cli.command()
@click.argument('archive_path', type=click.Path(exists=True, dir_okay=False))
@click.argument('output_dir', type=click.Path(file_okay=False))
@click.option('--preview/--no-preview', default=True, help='显示预演列表')
@click.option('--json-report', type=click.Path(dir_okay=False), help='生成JSON报告')
@click.option('--md-report', type=click.Path(dir_okay=False), help='生成Markdown报告')
def extract(archive_path: str, output_dir: str, preview: bool = True, json_report: str = None, md_report: str = None):
    """净化并解包归档文件"""
    
    rules = PurificationRules()
    output_path = Path(output_dir)
    
    with console.status(f"正在分析归档包: {archive_path}..."):
        analyzer = ArchiveAnalyzer(archive_path, rules)
        
        if preview:
            previews = analyzer.preview_extraction(output_path)
            _print_preview(previews)
            
            if not click.confirm("\n是否继续执行实际解包？"):
                console.print("[yellow]已取消操作[/yellow]")
                raise SystemExit(ExitCode.SUCCESS.value)
        
        result = analyzer.analyze(dry_run=False, output_dir=output_path)
    
    _print_summary(result, dry_run=False)
    
    if json_report:
        generator = ReportGenerator(result)
        generator.generate_json(Path(json_report))
        console.print(f"[green]✓[/green] JSON报告已生成")
    
    if md_report:
        generator = ReportGenerator(result)
        generator.generate_markdown(Path(md_report))
        console.print(f"[green]✓[/green] Markdown报告已生成")
    
    raise SystemExit(result.exit_code.value)


def _print_summary(result, dry_run: bool):
    """打印终端摘要"""
    
    status_color = "green" if result.success else "yellow"
    status_text = "通过" if result.exit_code == ExitCode.SUCCESS else "有警告" if result.exit_code == ExitCode.WARNINGS else "有错误"
    
    console.print(Panel(
        f"[{status_color}]净化结果: {status_text}[/{status_color}]\n"
        f"退出码: {result.exit_code.value}",
        title="归档包路径净化",
        expand=False
    ))
    
    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("指标", style="dim")
    table.add_column("数值", justify="right")
    
    table.add_row("文件总数", str(result.total_files))
    table.add_row("存在问题的文件", str(result.files_with_issues))
    table.add_row("已净化文件", str(result.files_cleaned))
    table.add_row("重复文件组数", str(result.duplicate_groups))
    
    console.print(table)
    
    if result.issues_count:
        console.print("\n问题类型统计:")
        for issue_type, count in result.issues_count.items():
            if count > 0:
                console.print(f"  • {issue_type}: {count} 个")
    
    if dry_run:
        console.print("\n[yellow]当前为预演模式，未实际提取文件[/yellow]")


def _print_preview(previews):
    """打印预演列表"""
    
    console.print(f"\n预演将提取 {len(previews)} 个文件:")
    
    table = Table(show_header=True, header_style="bold blue")
    table.add_column("#", style="dim", width=4)
    table.add_column("原始路径", style="dim")
    table.add_column("净化后路径")
    table.add_column("状态", justify="center")
    
    for idx, item in enumerate(previews[:20], 1):
        status = "[red]覆盖[/red]" if item['will_overwrite'] else "[green]新建[/green]"
        original = item['original'][:40] + "..." if len(item['original']) > 40 else item['original']
        target = Path(item['target']).name
        table.add_row(str(idx), original, target, status)
    
    if len(previews) > 20:
        console.print(f"  ... 还有 {len(previews) - 20} 个文件\n")
    
    console.print(table)


def main():
    cli()
