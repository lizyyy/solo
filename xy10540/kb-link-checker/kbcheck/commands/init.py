import os
import click
from rich.console import Console
from rich.table import Table

from kbcheck.utils import Storage, HistoryManager

console = Console()


@click.command()
@click.option("--path", default=".", help="知识库项目路径")
@click.option("--force", is_flag=True, help="强制重新初始化")
def init(path: str, force: bool):
    """初始化知识库检查工作区"""
    storage = Storage(os.path.abspath(path))

    if storage.exists() and not force:
        console.print("[yellow]工作区已存在，使用 --force 可重新初始化[/yellow]")
        return

    if force:
        import shutil
        if storage.data_dir.exists():
            shutil.rmtree(storage.data_dir)

    success = storage.initialize()
    if success:
        history = HistoryManager(storage)
        history.record(
            command="init",
            action="initialize",
            entity_type="workspace",
            entity_id=os.path.abspath(path),
            status="success",
            message="工作区初始化完成",
        )

    console.print()
    table = Table(title="初始化结果", show_header=True)
    table.add_column("项目", style="cyan")
    table.add_column("状态", style="green")
    table.add_column("路径")
    table.add_row(
        "工作区",
        "[green]已创建[/green]" if success else "[yellow]已存在[/yellow]",
        str(storage.data_dir),
    )
    console.print(table)
    console.print()
    console.print("[green]✓ 知识库检查工作区初始化成功[/green]")
    console.print()
    console.print("下一步:")
    console.print("  1. 运行 [cyan]kbcheck import[/cyan] 导入文档")
    console.print("  2. 运行 [cyan]kbcheck check[/cyan] 检查链接")
    console.print("  3. 运行 [cyan]kbcheck report[/cyan] 生成报告")
