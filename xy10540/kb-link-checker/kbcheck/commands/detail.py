import os
import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from kbcheck.utils import Storage

console = Console()


@click.command()
@click.option("--path", default=".", help="知识库项目路径")
@click.option("--doc-id", help="按文档ID筛选")
@click.option("--check-id", help="查看特定检查结果详情")
@click.option("--status", type=click.Choice(['all', 'failed', 'warning', 'passed']), default='all', help="按状态筛选")
@click.option("--history", is_flag=True, help="查看操作历史")
@click.option("--limit", default=20, help="显示数量限制")
def detail(path: str, doc_id: str, check_id: str, status: str, history: bool, limit: int):
    """查看详细信息、历史记录和失败原因"""
    storage = Storage(os.path.abspath(path))

    if not storage.exists():
        console.print("[red]工作区未初始化[/red]")
        return

    if history:
        _show_history(storage, limit)
        return

    if check_id:
        _show_check_detail(storage, check_id)
        return

    if doc_id:
        _show_doc_detail(storage, doc_id)
        return

    _show_failed_links(storage, status, limit)


def _show_history(storage: Storage, limit: int):
    records = storage.get_history(limit=limit)

    if not records:
        console.print("[yellow]暂无历史记录[/yellow]")
        return

    console.print()
    table = Table(title=f"操作历史 (最近 {len(records)} 条)", show_header=True)
    table.add_column("时间", style="cyan", width=20)
    table.add_column("命令", style="green", width=12)
    table.add_column("动作", width=15)
    table.add_column("实体类型", width=12)
    table.add_column("状态", width=10)
    table.add_column("触发者", width=10)
    table.add_column("消息", overflow="fold")

    for record in reversed(records):
        status_style = "green" if record.status == "success" else ("red" if record.status == "failed" else "yellow")
        table.add_row(
            record.recorded_at.strftime("%Y-%m-%d %H:%M:%S"),
            record.command,
            record.action,
            record.entity_type,
            f"[{status_style}]{record.status}[/{status_style}]",
            record.triggered_by,
            record.message or "",
        )

    console.print(table)


def _show_check_detail(storage: Storage, check_id: str):
    result = storage.get_check_result(check_id)
    if not result:
        console.print(f"[red]未找到检查结果: {check_id}[/red]")
        return

    doc = storage.get_document(result.source_doc_id)
    link = storage.get_link(result.link_id)

    console.print()
    console.print(Panel(
        f"[bold cyan]检查结果详情[/bold cyan]\n\n"
        f"Check ID: [green]{result.check_id}[/green]\n"
        f"链接 ID: [green]{result.link_id}[/green]\n"
        f"状态: [{'green' if result.status == 'passed' else 'red'}]{result.status}[/]\n"
        f"检查时间: {result.checked_at.strftime('%Y-%m-%d %H:%M:%S') if result.checked_at else 'N/A'}",
        title="检查结果",
    ))

    console.print()
    console.print(Panel(
        f"目标 URL: [blue]{result.target_url}[/blue]\n"
        f"最终 URL: [blue]{result.final_url or 'N/A'}[/blue]\n"
        f"HTTP 状态: [cyan]{result.http_status_code or 'N/A'}[/cyan]\n\n"
        f"错误类型: [red]{result.error_type or 'N/A'}[/red]\n"
        f"错误信息: {result.error_message or 'N/A'}\n\n"
        f"重定向链: {len(result.redirect_chain)} 步\n" +
        ("  " + "\n  → ".join(result.redirect_chain) if result.redirect_chain else "  无") +
        (f"\n\n需要角色: {', '.join(result.required_roles)}" if result.required_roles else ""),
        title="链接详情",
    ))

    if doc or link:
        console.print()
        if doc:
            console.print(Panel(
                f"文档 ID: [green]{doc.doc_id}[/green]\n"
                f"标题: {doc.title}\n"
                f"路径: {doc.path}\n"
                f"类型: {doc.file_type}\n"
                f"负责人 ID: {doc.owner_id}\n"
                f"可见性: {doc.visibility}",
                title="源文档",
            ))
        if link:
            console.print(Panel(
                f"链接文本: {link.link_text}\n"
                f"类型: {link.link_type}\n"
                f"行号: {link.line_number}\n"
                f"出现位置: {len(link.occurrences)} 处",
                title="链接信息",
            ))


def _show_doc_detail(storage: Storage, doc_id: str):
    doc = storage.get_document(doc_id)
    if not doc:
        console.print(f"[red]未找到文档: {doc_id}[/red]")
        return

    results = storage.get_check_results_by_doc(doc_id)
    owner = storage.get_owner(doc.owner_id)

    console.print()
    console.print(Panel(
        f"文档 ID: [green]{doc.doc_id}[/green]\n"
        f"标题: {doc.title}\n"
        f"路径: {doc.path}\n"
        f"类型: {doc.file_type}\n"
        f"可见性: {doc.visibility}\n"
        f"内容哈希: {doc.content_hash[:16]}...",
        title="文档信息",
    ))

    if owner:
        console.print()
        owner_status = "[green]在职[/green]" if owner.is_active else "[red]离职[/red]"
        console.print(Panel(
            f"负责人 ID: [green]{owner.owner_id}[/green]\n"
            f"姓名: {owner.name}\n"
            f"邮箱: {owner.email}\n"
            f"部门: {owner.department}\n"
            f"角色: {', '.join(owner.roles)}\n"
            f"状态: {owner_status}",
            title="负责人",
        ))

    if results:
        console.print()
        table = Table(title=f"文档链接检查结果 ({len(results)} 条)", show_header=True)
        table.add_column("链接文本", style="cyan", overflow="fold")
        table.add_column("目标 URL", overflow="fold")
        table.add_column("状态", width=10)
        table.add_column("错误类型", width=18)

        for r in results:
            link = storage.get_link(r.link_id)
            link_text = link.link_text if link else "N/A"
            status_style = "green" if r.status == "passed" else ("red" if r.status == "failed" else "yellow")
            table.add_row(
                link_text[:40] + "..." if len(link_text) > 40 else link_text,
                r.target_url[:50] + "..." if len(r.target_url) > 50 else r.target_url,
                f"[{status_style}]{r.status}[/{status_style}]",
                r.error_type or "N/A",
            )

        console.print(table)


def _show_failed_links(storage: Storage, status: str, limit: int):
    results = storage.get_check_results()

    if status != 'all':
        results = [r for r in results if r.status == status]

    if not results:
        console.print("[yellow]没有符合条件的检查结果[/yellow]")
        return

    results = results[:limit]

    docs = {d.doc_id: d for d in storage.get_documents()}
    owners = {o.owner_id: o for o in storage.get_owners()}

    console.print()
    table = Table(title=f"{'失败' if status == 'failed' else '警告' if status == 'warning' else '全部'}链接检查结果", show_header=True)
    table.add_column("#", justify="right", width=3)
    table.add_column("源文档", style="cyan", overflow="fold")
    table.add_column("负责人", width=10)
    table.add_column("目标 URL", overflow="fold")
    table.add_column("状态", width=10)
    table.add_column("错误类型", width=15)
    table.add_column("错误信息", overflow="fold")

    for idx, r in enumerate(results, 1):
        doc = docs.get(r.source_doc_id)
        owner = owners.get(doc.owner_id) if doc else None

        status_style = "green" if r.status == "passed" else ("red" if r.status == "failed" else "yellow")
        owner_name = owner.name if owner else doc.owner_id if doc else "N/A"
        doc_title = doc.title if doc else r.source_doc_id[:8] + "..."

        table.add_row(
            str(idx),
            doc_title[:25] + "..." if len(doc_title) > 25 else doc_title,
            owner_name[:8],
            r.target_url[:40] + "..." if len(r.target_url) > 40 else r.target_url,
            f"[{status_style}]{r.status}[/{status_style}]",
            r.error_type or "N/A",
            (r.error_message or "N/A")[:30] + ("..." if r.error_message and len(r.error_message) > 30 else ""),
        )

    console.print(table)
    console.print()
    console.print("[dim]提示: 使用 --check-id <ID> 查看详情，使用 --history 查看历史[/dim]")
