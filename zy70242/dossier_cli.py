#!/usr/bin/env python3
"""法院卷宗移交流转 CLI 工具"""

import typer
from rich.console import Console
from rich.table import Table
from typing import Optional

app = typer.Typer(
    name="dossier-cli",
    help="法院卷宗移交流转管理工具",
    add_completion=False,
)

console = Console()

__version__ = "0.1.0"


@app.command()
def version():
    """显示版本信息"""
    console.print(f"[bold green]dossier-cli v{__version__}[/bold green]")


@app.command()
def init(
    path: Optional[str] = typer.Option(
        ".",
        "--path",
        "-p",
        help="初始化目录路径",
    ),
    force: bool = typer.Option(
        False,
        "--force",
        "-f",
        help="强制覆盖现有文件",
    ),
):
    """初始化样例数据和配置"""
    from services.initializer import Initializer
    from services.storage import Storage

    storage = Storage(path)
    initializer = Initializer(storage)
    result = initializer.init(force=force)
    
    if result.success:
        console.print("[bold green]✓ 初始化完成[/bold green]")
        for msg in result.messages:
            console.print(f"  {msg}")
    else:
        console.print(f"[bold red]✗ 初始化失败: {result.error}[/bold red]")
        raise typer.Exit(1)


@app.command()
def import_file(
    file_type: str = typer.Argument(
        ...,
        help="文件类型: catalog(卷宗目录)|batch(移交批次)|receipt(签收记录)",
    ),
    file_path: str = typer.Argument(
        ...,
        help="导入文件路径",
    ),
    project_path: Optional[str] = typer.Option(
        ".",
        "--project",
        "-P",
        help="项目目录路径",
    ),
):
    """导入数据文件"""
    from services.importer import Importer
    from services.storage import Storage

    storage = Storage(project_path)
    importer = Importer(storage)
    
    valid_types = ["catalog", "batch", "receipt"]
    if file_type not in valid_types:
        console.print(f"[bold red]✗ 无效的文件类型: {file_type}[/bold red]")
        console.print(f"  有效值: {', '.join(valid_types)}")
        raise typer.Exit(1)
    
    result = importer.import_file(file_type, file_path)
    
    if result.success:
        console.print(f"[bold green]✓ 导入完成[/bold green]")
        console.print(f"  成功: {result.success_count} 条")
        console.print(f"  问题: {result.problem_count} 条")
        if result.problems:
            console.print("\n[yellow]问题记录:[/yellow]")
            for prob in result.problems:
                console.print(f"  - {prob}")
    else:
        console.print(f"[bold red]✗ 导入失败: {result.error}[/bold red]")
        raise typer.Exit(1)


@app.command()
def check(
    batch_id: Optional[str] = typer.Option(
        None,
        "--batch",
        "-b",
        help="指定批次ID检查，不指定则检查所有批次",
    ),
    project_path: Optional[str] = typer.Option(
        ".",
        "--project",
        "-P",
        help="项目目录路径",
    ),
):
    """执行卷宗移交检查"""
    from services.checker import Checker
    from services.storage import Storage

    storage = Storage(project_path)
    checker = Checker(storage)
    
    result = checker.check(batch_id=batch_id)
    
    if result.success:
        console.print(f"[bold green]✓ 检查完成[/bold green]")
        console.print(f"  批次总数: {result.total_batches}")
        console.print(f"  通过: {result.passed_count}")
        console.print(f"  失败: {result.failed_count}")
        
        if result.failures:
            console.print("\n[red]检查失败详情:[/red]")
            for failure in result.failures:
                console.print(f"\n  [bold]批次: {failure.batch_id}[/bold]")
                for issue in failure.issues:
                    console.print(f"    - {issue.type}: {issue.message}")
                    if issue.details:
                        console.print(f"      详情: {issue.details}")
    else:
        console.print(f"[bold red]✗ 检查失败: {result.error}[/bold red]")
        raise typer.Exit(1)


@app.command()
def history(
    limit: int = typer.Option(
        20,
        "--limit",
        "-n",
        help="显示最近N条记录",
    ),
    operation: Optional[str] = typer.Option(
        None,
        "--operation",
        "-o",
        help="筛选操作类型: import|check|export",
    ),
    project_path: Optional[str] = typer.Option(
        ".",
        "--project",
        "-P",
        help="项目目录路径",
    ),
):
    """查看操作历史"""
    from services.history import History
    from services.storage import Storage

    storage = Storage(project_path)
    history = History(storage)
    
    records = history.get_records(limit=limit, operation=operation)
    
    if not records:
        console.print("[yellow]暂无历史记录[/yellow]")
        return
    
    table = Table(title="操作历史记录")
    table.add_column("时间", style="cyan")
    table.add_column("操作", style="green")
    table.add_column("状态", style="yellow")
    table.add_column("详情", style="white", overflow="fold")
    
    for rec in records:
        status = "✓ 成功" if rec.success else "✗ 失败"
        status_style = "green" if rec.success else "red"
        table.add_row(
            rec.timestamp,
            rec.operation,
            f"[{status_style}]{status}[/{status_style}]",
            rec.details,
        )
    
    console.print(table)


@app.command()
def export(
    export_type: str = typer.Argument(
        ...,
        help="导出类型: results(检查结果)|problems(问题记录)|all(全部)",
    ),
    output_path: str = typer.Argument(
        ...,
        help="输出文件路径",
    ),
    project_path: Optional[str] = typer.Option(
        ".",
        "--project",
        "-P",
        help="项目目录路径",
    ),
):
    """导出结果数据"""
    from services.exporter import Exporter
    from services.storage import Storage

    storage = Storage(project_path)
    exporter = Exporter(storage)
    
    valid_types = ["results", "problems", "all"]
    if export_type not in valid_types:
        console.print(f"[bold red]✗ 无效的导出类型: {export_type}[/bold red]")
        console.print(f"  有效值: {', '.join(valid_types)}")
        raise typer.Exit(1)
    
    result = exporter.export(export_type, output_path)
    
    if result.success:
        console.print(f"[bold green]✓ 导出完成[/bold green]")
        console.print(f"  输出文件: {output_path}")
        console.print(f"  记录数: {result.record_count}")
    else:
        console.print(f"[bold red]✗ 导出失败: {result.error}[/bold red]")
        raise typer.Exit(1)


if __name__ == "__main__":
    app()
