import os
import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from .file_indexer import FileIndexer
from .rule_engine import RuleEngine
from .review_store import ReviewStore
from .exporter import Exporter

console = Console()


@click.group()
@click.version_option()
def cli():
    """异常包裹证据包归档员 - 快递驿站包裹申诉工具"""
    pass


@cli.command()
@click.argument("scan_dir", type=click.Path(exists=True, file_okay=False, dir_okay=True))
@click.option("--output", "-o", type=click.Path(), help="输出索引文件路径")
def scan(scan_dir, output):
    """扫描目录并按运单号归集文件"""
    console.print(f"[bold blue]开始扫描目录:[/] {scan_dir}")
    
    indexer = FileIndexer()
    packages = indexer.scan_directory(scan_dir)
    
    if output:
        indexer.save_index(output)
        console.print(f"[green]索引已保存到:[/] {output}")
    
    # 显示统计
    table = Table(title="扫描结果统计")
    table.add_column("运单号", style="cyan")
    table.add_column("照片数", style="green")
    table.add_column("备注", style="yellow")
    table.add_column("赔付表", style="magenta")
    
    for tracking_no, pkg in packages.items():
        table.add_row(
            tracking_no,
            str(len(pkg.photos)),
            "有" if pkg.remarks else "无",
            "有" if pkg.claim_form else "无"
        )
    
    console.print(table)
    console.print(f"\n[bold green]共发现 {len(packages)} 个包裹[/]")


@cli.command()
@click.argument("index_file", type=click.Path(exists=True, file_okay=True))
def check(index_file):
    """校验异常包裹规则"""
    console.print(f"[bold blue]开始校验索引:[/] {index_file}")
    
    indexer = FileIndexer()
    indexer.load_index(index_file)
    
    engine = RuleEngine()
    issues = engine.check_all(indexer.packages)
    
    if not issues:
        console.print("[bold green]✓ 所有包裹规则校验通过[/]")
        return
    
    # 显示问题
    table = Table(title="校验发现的问题")
    table.add_column("运单号", style="cyan")
    table.add_column("问题类型", style="red")
    table.add_column("严重程度", style="yellow")
    table.add_column("描述", style="white")
    
    for issue in issues:
        table.add_row(
            issue.tracking_no,
            issue.issue_type,
            issue.severity,
            issue.description
        )
    
    console.print(table)
    console.print(f"\n[bold red]共发现 {len(issues)} 个问题[/]")


@cli.command()
@click.argument("tracking_no")
@click.argument("status")
@click.option("--comment", "-c", help="处理意见备注")
@click.option("--index", "-i", required=True, type=click.Path(exists=True), help="索引文件路径")
def review(tracking_no, status, comment, index):
    """保存人工处理意见"""
    console.print(f"[bold blue]处理包裹:[/] {tracking_no}")
    
    store = ReviewStore(index)
    result = store.add_review(tracking_no, status, comment or "")
    
    if result:
        console.print(f"[green]✓ 处理意见已保存[/]")
        console.print(f"  状态: {status}")
        if comment:
            console.print(f"  备注: {comment}")
    else:
        console.print(f"[red]✗ 包裹 {tracking_no} 不存在于索引中[/]")


@cli.command()
@click.argument("index_file", type=click.Path(exists=True, file_okay=True))
@click.option("--format", "-f", type=click.Choice(["md", "csv", "json", "all"]), default="all", help="导出格式")
@click.option("--output", "-o", type=click.Path(), help="输出目录")
def export(index_file, format, output):
    """导出申诉包、问题清单和审计记录"""
    console.print(f"[bold blue]开始导出:[/] {index_file}")
    
    indexer = FileIndexer()
    indexer.load_index(index_file)
    
    store = ReviewStore(index_file)
    
    output_dir = output or os.path.dirname(index_file)
    os.makedirs(output_dir, exist_ok=True)
    
    exporter = Exporter(indexer.packages, store.reviews)
    
    export_files = []
    
    if format in ["md", "all"]:
        md_path = exporter.export_markdown(output_dir)
        export_files.append(("Markdown申诉包", md_path))
    
    if format in ["csv", "all"]:
        csv_path = exporter.export_issues_csv(output_dir)
        export_files.append(("CSV问题清单", csv_path))
    
    if format in ["json", "all"]:
        json_path = exporter.export_audit_json(output_dir)
        export_files.append(("JSON审计记录", json_path))
    
    # 显示导出结果
    table = Table(title="导出结果")
    table.add_column("文件类型", style="cyan")
    table.add_column("路径", style="green")
    
    for name, path in export_files:
        table.add_row(name, path)
    
    console.print(table)
    console.print(f"\n[bold green]导出完成[/]")


if __name__ == "__main__":
    cli()
