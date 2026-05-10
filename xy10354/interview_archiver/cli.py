from pathlib import Path
from typing import List, Optional

import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from .exporter import Exporter
from .models import ActionItem, SecurityLevel
from .parser import NoteParser
from .storage import Storage


app = typer.Typer(
    help="企业访谈纪要归档 CLI 工具",
    add_completion=False,
)
console = Console()
storage = Storage()
parser = NoteParser()


@app.command("scan")
def scan_directory(
    directory: str = typer.Argument(..., help="要扫描的目录路径"),
    recursive: bool = typer.Option(False, "--recursive", "-r", help="递归扫描子目录"),
):
    """扫描目录并归档访谈纪要"""

    dir_path = Path(directory)
    if not dir_path.exists():
        rprint(f"[red]错误:[/red] 目录不存在: {directory}")
        raise typer.Exit(code=1)

    if not dir_path.is_dir():
        rprint(f"[red]错误:[/red] 不是目录: {directory}")
        raise typer.Exit(code=1)

    patterns = ["*.md", "*.markdown", "*.txt"]
    files: List[Path] = []

    if recursive:
        for pattern in patterns:
            files.extend(dir_path.rglob(pattern))
    else:
        for pattern in patterns:
            files.extend(dir_path.glob(pattern))

    if not files:
        rprint(f"[yellow]警告:[/yellow] 未找到 Markdown 或 TXT 文件")
        raise typer.Exit(code=0)

    stats = {"scanned": 0, "added": 0, "updated": 0, "skipped": 0, "action_items": 0}

    for file_path in sorted(files):
        try:
            note = parser.parse_file(str(file_path))
            existing = storage.get_interview_by_path(note.file_path)

            if existing and existing.file_hash == note.file_hash:
                stats["scanned"] += 1
                stats["skipped"] += 1
                continue

            saved_note = storage.save_interview(note)

            if existing:
                stats["updated"] += 1
                rprint(f"[blue]更新:[/blue] {file_path.name}")
            else:
                stats["added"] += 1
                rprint(f"[green]新增:[/green] {file_path.name}")

            stats["scanned"] += 1
            stats["action_items"] += len(saved_note.action_items)

        except Exception as e:
            rprint(f"[red]错误:[/red] 处理文件 {file_path.name} 时出错: {e}")

    table = Table(title="扫描结果", show_header=True, header_style="bold magenta")
    table.add_column("统计项")
    table.add_column("数量", justify="right")
    table.add_row("扫描文件", str(stats["scanned"]))
    table.add_row("新增档案", str(stats["added"]))
    table.add_row("更新档案", str(stats["updated"]))
    table.add_row("跳过(未变更)", str(stats["skipped"]))
    table.add_row("提取行动项", str(stats["action_items"]))

    console.print(table)


@app.command("todos")
def list_todos(
    include_invalid: bool = typer.Option(False, "--include-invalid", "-i", help="包含无效行动项（缺负责人或截止日期）"),
    owner: Optional[str] = typer.Option(None, "--owner", "-o", help="按负责人过滤"),
):
    """查看待办行动项"""

    if include_invalid:
        items = storage.get_pending_action_items(include_invalid=True)
    else:
        items = storage.get_pending_action_items(include_invalid=False)

    if owner:
        items = [item for item in items if item.owner and owner.lower() in item.owner.lower()]

    if not items:
        rprint("[green]恭喜！没有待办行动项。[/green]")
        return

    table = Table(title="待办行动项", show_header=True, header_style="bold magenta")
    table.add_column("ID", style="cyan", no_wrap=True)
    table.add_column("行动项", style="white")
    table.add_column("负责人", style="yellow")
    table.add_column("截止日期", style="green")
    table.add_column("状态", style="blue")

    for item in items:
        status = "待处理"
        status_style = "green"
        if not item.is_valid():
            if not item.owner and not item.due_date:
                status = "缺负责人+截止日期"
            elif not item.owner:
                status = "缺负责人"
            else:
                status = "缺截止日期"
            status_style = "red"

        table.add_row(
            str(item.id),
            item.description,
            item.owner or "-",
            item.due_date.isoformat() if item.due_date else "-",
            f"[{status_style}]{status}[/{status_style}]",
        )

    console.print(table)

    invalid_items = [item for item in items if not item.is_valid()]
    if invalid_items and not include_invalid:
        rprint(f"\n[yellow]提示:[/yellow] 有 {len(invalid_items)} 个行动项缺少负责人或截止日期，使用 --include-invalid 查看")


@app.command("issues")
def list_issues():
    """查看问题清单（缺少负责人或截止日期的行动项）"""

    items = storage.get_invalid_action_items()

    if not items:
        rprint("[green]很好！没有问题清单中的行动项。[/green]")
        return

    table = Table(title="问题清单（缺少负责人或截止日期）", show_header=True, header_style="bold red")
    table.add_column("ID", style="cyan", no_wrap=True)
    table.add_column("行动项", style="white")
    table.add_column("负责人", style="yellow")
    table.add_column("截止日期", style="green")
    table.add_column("问题", style="red")

    for item in items:
        issues = []
        if not item.owner:
            issues.append("缺负责人")
        if not item.due_date:
            issues.append("缺截止日期")

        table.add_row(
            str(item.id),
            item.description,
            item.owner or "-",
            item.due_date.isoformat() if item.due_date else "-",
            ", ".join(issues),
        )

    console.print(table)


@app.command("complete")
def mark_complete(
    action_item_id: int = typer.Argument(..., help="行动项 ID"),
):
    """标记行动项为完成"""

    item = storage.get_action_item_by_id(action_item_id)

    if not item:
        rprint(f"[red]错误:[/red] 行动项 ID {action_item_id} 不存在")
        raise typer.Exit(code=1)

    if item.is_completed:
        rprint(f"[yellow]提示:[/yellow] 行动项 {action_item_id} 已处于完成状态")
        return

    success = storage.mark_action_item_completed(action_item_id)

    if success:
        rprint(f"[green]成功:[/green] 行动项 {action_item_id} 已标记为完成")
        rprint(f"       内容: {item.description}")
    else:
        rprint(f"[red]错误:[/red] 标记失败")


@app.command("duplicates")
def find_duplicates():
    """发现重复纪要"""

    exact_duplicates = storage.find_duplicate_interviews()
    similar = storage.find_similar_interviews()

    if not exact_duplicates and not similar:
        rprint("[green]未发现重复或相似的纪要。[/green]")
        return

    if exact_duplicates:
        console.print(Panel("[bold red]完全重复的纪要[/bold red]（内容哈希相同）"))

        for file_hash, notes in exact_duplicates.items():
            table = Table(title=f"哈希: {file_hash[:16]}...", show_header=True, header_style="bold magenta")
            table.add_column("#", style="cyan")
            table.add_column("ID")
            table.add_column("客户名称")
            table.add_column("访谈对象")
            table.add_column("文件路径")

            for idx, note in enumerate(notes, 1):
                table.add_row(
                    str(idx),
                    str(note.id),
                    note.customer_name or "-",
                    note.interviewee or "-",
                    note.file_path,
                )

            console.print(table)

    if similar:
        console.print(Panel("[bold yellow]可能重复的纪要[/bold yellow]（同一客户+同一访谈对象）"))

        for group in similar:
            customer = group[0].customer_name or "未知"
            interviewee = group[0].interviewee or "未知"
            table = Table(title=f"客户: {customer}, 访谈对象: {interviewee}", show_header=True, header_style="bold magenta")
            table.add_column("#", style="cyan")
            table.add_column("ID")
            table.add_column("访谈日期")
            table.add_column("保密级别")
            table.add_column("文件路径")

            for idx, note in enumerate(group, 1):
                table.add_row(
                    str(idx),
                    str(note.id),
                    note.interview_date.isoformat() if note.interview_date else "-",
                    note.security_level.value,
                    note.file_path,
                )

            console.print(table)


@app.command("export")
def export_archive(
    output: str = typer.Option("archive.csv", "--output", "-o", help="输出文件路径"),
    force: bool = typer.Option(False, "--force", "-f", help="忽略高保密级别警告直接导出"),
):
    """导出项目归档表"""

    exporter = Exporter(storage)

    try:
        count, has_high_security = exporter.export_to_csv(output)

        if has_high_security and not force:
            rprint(f"\n[yellow]警告:[/yellow] 归档中包含[bold red]机密/绝密[/bold red]级别的纪要！")
            confirm = typer.confirm("是否确认导出？")
            if not confirm:
                Path(output).unlink(missing_ok=True)
                rprint("[yellow]已取消导出[/yellow]")
                raise typer.Exit(code=0)

        rprint(f"[green]成功:[/green] 已导出 {count} 条记录到 {output}")

        if has_high_security:
            rprint(f"[yellow]注意:[/yellow] 请妥善保管包含高保密级别的归档文件")

    except Exception as e:
        rprint(f"[red]错误:[/red] 导出失败: {e}")
        raise typer.Exit(code=1)


@app.command("list")
def list_interviews():
    """列出所有归档的访谈纪要"""

    notes = storage.get_all_interviews()

    if not notes:
        rprint("[yellow]当前没有归档的访谈纪要[/yellow]")
        return

    table = Table(title="访谈纪要列表", show_header=True, header_style="bold magenta")
    table.add_column("ID", style="cyan", no_wrap=True)
    table.add_column("客户名称", style="green")
    table.add_column("访谈对象", style="yellow")
    table.add_column("访谈日期")
    table.add_column("保密级别")
    table.add_column("行动项", justify="right")

    for note in notes:
        security_style = "white"
        if note.security_level == SecurityLevel.CONFIDENTIAL:
            security_style = "yellow"
        elif note.security_level == SecurityLevel.TOP_SECRET:
            security_style = "red"

        table.add_row(
            str(note.id),
            note.customer_name or "-",
            note.interviewee or "-",
            note.interview_date.isoformat() if note.interview_date else "-",
            f"[{security_style}]{note.security_level.value}[/{security_style}]",
            str(len(note.action_items)),
        )

    console.print(table)


@app.command("clear")
def clear_database(
    force: bool = typer.Option(False, "--force", "-f", help="不提示直接清空"),
):
    """清空数据库（谨慎使用）"""

    if not force:
        confirm = typer.confirm("确定要清空所有归档数据吗？此操作不可恢复！")
        if not confirm:
            rprint("[yellow]已取消[/yellow]")
            raise typer.Exit(code=0)

    storage.clear_database()
    rprint("[green]数据库已清空[/green]")


def main():
    app()


if __name__ == "__main__":
    main()
