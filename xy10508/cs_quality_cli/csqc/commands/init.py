import os
import click
from rich.console import Console
from rich.table import Table

from ..db import init_db, get_connection
from ..utils import ensure_project_dir, is_project_initialized

console = Console()


@click.command()
@click.option('--project-dir', '-p', default='.', help='项目目录 (默认: 当前目录)')
@click.option('--force', '-f', is_flag=True, help='强制重新初始化（警告：会清除现有数据）')
def init(project_dir: str, force: bool) -> None:
    """初始化客服敏感话术抽检项目"""
    abs_project_dir = os.path.abspath(project_dir)
    ensure_project_dir(abs_project_dir)

    console.print(f"[bold blue]初始化项目目录:[/bold blue] {abs_project_dir}")

    if force and is_project_initialized(abs_project_dir):
        from ..db import DB_FILENAME
        db_path = os.path.join(abs_project_dir, DB_FILENAME)
        os.remove(db_path)
        console.print("[yellow]警告: 已删除现有数据库[/yellow]")

    try:
        init_db(abs_project_dir)
        console.print("[bold green]✓ 数据库初始化成功[/bold green]")

        with get_connection(abs_project_dir) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = cursor.fetchall()

        table = Table(title="已创建的数据表")
        table.add_column("表名", style="cyan")
        for t in tables:
            table.add_row(t[0])
        console.print(table)

        console.print("\n[bold]项目初始化完成！[/bold]")
        console.print(f"  项目路径: {abs_project_dir}")
        console.print("  下一步: 使用 [cyan]csqc import[/cyan] 导入数据")

    except FileExistsError as e:
        console.print(f"[bold red]错误:[/bold red] {e}")
        console.print("使用 [cyan]--force[/cyan] 强制重新初始化")
        raise SystemExit(1)
    except Exception as e:
        console.print(f"[bold red]初始化失败:[/bold red] {e}")
        raise SystemExit(1)
