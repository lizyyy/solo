import os
import json
import click
from typing import List, Dict, Any
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import box

from ..db import get_connection
from ..utils import is_project_initialized

console = Console()


def get_scan_history(project_dir: str, limit: int = 10):
    with get_connection(project_dir) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT * FROM scans ORDER BY id DESC LIMIT ?
        ''', (limit,))
        return [dict(row) for row in cursor.fetchall()]


def get_scan_hits(project_dir: str, scan_id: int = None, session_id: str = None, hit_id: int = None):
    with get_connection(project_dir) as conn:
        cursor = conn.cursor()

        if hit_id:
            cursor.execute('''
                SELECT h.*, r.name as rule_name, r.category, r.severity,
                       a.name as agent_name
                FROM hits h
                LEFT JOIN rules r ON h.rule_id = r.rule_id
                LEFT JOIN agents a ON h.agent_id = a.agent_id
                WHERE h.id = ?
            ''', (hit_id,))
        elif scan_id:
            cursor.execute('''
                SELECT h.*, r.name as rule_name, r.category, r.severity,
                       a.name as agent_name
                FROM hits h
                LEFT JOIN rules r ON h.rule_id = r.rule_id
                LEFT JOIN agents a ON h.agent_id = a.agent_id
                WHERE h.scan_id = ?
                ORDER BY h.session_id, h.id
            ''', (scan_id,))
        elif session_id:
            cursor.execute('''
                SELECT h.*, r.name as rule_name, r.category, r.severity,
                       a.name as agent_name
                FROM hits h
                LEFT JOIN rules r ON h.rule_id = r.rule_id
                LEFT JOIN agents a ON h.agent_id = a.agent_id
                WHERE h.session_id = ?
                ORDER BY h.scan_id, h.id
            ''', (session_id,))
        else:
            cursor.execute('''
                SELECT h.*, r.name as rule_name, r.category, r.severity,
                       a.name as agent_name
                FROM hits h
                LEFT JOIN rules r ON h.rule_id = r.rule_id
                LEFT JOIN agents a ON h.agent_id = a.agent_id
                ORDER BY h.scan_id, h.id
            ''')

        return [dict(row) for row in cursor.fetchall()]


def get_reviews(project_dir: str, hit_id: int = None):
    with get_connection(project_dir) as conn:
        cursor = conn.cursor()
        if hit_id:
            cursor.execute('''
                SELECT * FROM reviews WHERE hit_id = ? ORDER BY id DESC
            ''', (hit_id,))
        else:
            cursor.execute('''
                SELECT * FROM reviews ORDER BY id DESC LIMIT 20
            ''')
        return [dict(row) for row in cursor.fetchall()]


def get_session_messages(project_dir: str, session_id: str):
    with get_connection(project_dir) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT messages_json FROM sessions WHERE session_id = ?
        ''', (session_id,))
        row = cursor.fetchone()
        return json.loads(row[0]) if row else []


@click.command()
@click.option('--project-dir', '-p', default='.', help='项目目录')
@click.option('--scan-id', type=int, help='查看指定扫描ID详情')
@click.option('--session-id', '-s', help='查看指定会话的所有命中')
@click.option('--hit-id', type=int, help='查看单个命中的详细信息')
@click.option('--history', '-H', is_flag=True, help='显示扫描历史记录')
@click.option('--review-history', '-R', is_flag=True, help='显示复核历史记录')
@click.option('--limit', '-n', type=int, default=10, help='显示历史记录数量')
def detail(project_dir: str, scan_id: int, session_id: str, hit_id: int,
            history: bool, review_history: bool, limit: int) -> None:
    """查看扫描详情、命中详情和历史记录"""
    abs_project_dir = os.path.abspath(project_dir)

    if not is_project_initialized(abs_project_dir):
        console.print(f"[bold red]错误:[/bold red] 项目未初始化，请先运行 [cyan]csqc init[/cyan]")
        raise SystemExit(1)

    if history:
        scans = get_scan_history(abs_project_dir, limit)
        if scans:
            table = Table(title=f"扫描历史（最近{len(scans)}条）", box=box.SIMPLE)
            table.add_column("扫描ID", style="cyan")
            table.add_column("扫描时间", style="green")
            table.add_column("扫描会话", style="blue")
            table.add_column("命中会话", style="red")
            table.add_column("状态")
            for s in scans:
                table.add_row(
                    str(s['id']), s['scan_time'], str(s['total_sessions']),
                    str(s['flagged_sessions']), s['status']
                )
            console.print(table)
        else:
            console.print("[yellow]暂无扫描记录[/yellow]")
        return

    if review_history:
        reviews = get_reviews(abs_project_dir)
        if reviews:
            table = Table(title="复核历史记录", box=box.SIMPLE)
            table.add_column("复核ID", style="cyan")
            table.add_column("命中ID", style="blue")
            table.add_column("复核人", style="green")
            table.add_column("决策")
            table.add_column("时间", style="yellow")
            for r in reviews:
                table.add_row(
                    str(r['id']), str(r['hit_id']), r['reviewer'],
                    r['decision'], r['created_at']
                )
            console.print(table)
        else:
            console.print("[yellow]暂无复核记录[/yellow]")
        return

    if hit_id:
        hits = get_scan_hits(abs_project_dir, hit_id=hit_id)
        if not hits:
            console.print(f"[bold red]错误:[/bold red] 未找到命中ID: {hit_id}")
            raise SystemExit(1)

        hit = hits[0]
        reviews = get_reviews(abs_project_dir, hit_id=hit_id)

        console.print(Panel(
            f"[bold cyan]命中详情 - ID: {hit['id']}[/bold cyan]\n\n"
            f"[yellow]会话ID:[/yellow] {hit['session_id']}\n"
            f"[yellow]扫描ID:[/yellow] {hit['scan_id']}\n"
            f"[yellow]规则:[/yellow] {hit['rule_name']} ({hit['rule_id']})\n"
            f"[yellow]类别:[/yellow] {hit['category']}\n"
            f"[yellow]严重程度:[/yellow] {hit['severity']}\n"
            f"[yellow]命中内容:[/yellow] [red]{hit['hit_text']}[/red]\n"
            f"[yellow]客服:[/yellow] {hit.get('agent_name', '未知')}\n"
            f"[yellow]消息时间:[/yellow] {hit.get('message_time', 'N/A')}\n"
            f"[yellow]是否重复:[/yellow] {'是' if hit['is_duplicate'] else '否'}\n",
            title="命中信息"
        ))

        if hit.get('context_before'):
            console.print(Panel(hit['context_before'], title="上下文（之前）", style="dim"))
        if hit.get('user_quote'):
            console.print(Panel(f"[green]用户原话:[/green] {hit['user_quote']}", title="用户引用", style="green"))

        messages = get_session_messages(abs_project_dir, hit['session_id'])
        if messages:
            console.print(Panel(
                f"[bold]消息位置:[/bold] 第 {hit['message_index'] + 1} / {len(messages)} 条消息",
                title="会话位置"
            ))

        if reviews:
            console.print("\n[bold]复核历史:[/bold]")
            for r in reviews:
                rev_panel = Panel(
                    f"[cyan]复核人:[/cyan] {r['reviewer']}\n"
                    f"[cyan]决策:[/cyan] {r['decision']}\n"
                    f"[cyan]时间:[/cyan] {r['created_at']}\n"
                    f"[cyan]原命中:[/cyan] {r['original_hit_text'] or 'N/A'}\n"
                    + (f"[cyan]修正后:[/cyan] {r['corrected_hit_text']}\n" if r['corrected_hit_text'] else "")
                    + (f"[cyan]备注:[/cyan] {r['comment']}" if r['comment'] else ""),
                    title=f"复核记录 #{r['id']}"
                )
                console.print(rev_panel)
        else:
            console.print("\n[yellow]此命中尚未复核[/yellow]")
            console.print("进行复核: [cyan]csqc review --hit-id " + str(hit_id) + " --decision false_positive[/cyan]")

        return

    if scan_id or session_id:
        hits = get_scan_hits(abs_project_dir, scan_id=scan_id, session_id=session_id)

        if not hits:
            console.print("[yellow]未找到命中记录[/yellow]")
            return

        title = f"扫描 #{scan_id} 详情" if scan_id else f"会话 #{session_id} 详情"
        table = Table(title=title, box=box.SIMPLE)
        table.add_column("命中ID", style="cyan")
        table.add_column("会话ID", style="blue")
        table.add_column("规则", style="green")
        table.add_column("命中内容", style="red")
        table.add_column("客服")
        table.add_column("重复", style="yellow")

        for hit in hits:
            table.add_row(
                str(hit['id']),
                hit['session_id'],
                hit['rule_name'] or hit['rule_id'],
                hit['hit_text'],
                hit.get('agent_name', '未知'),
                '是' if hit['is_duplicate'] else '否'
            )
        console.print(table)

        console.print(f"\n共 {len(hits)} 条命中记录")
        console.print("查看详情: [cyan]csqc detail --hit-id <ID>[/cyan]")
        return

    console.print("[yellow]请指定以下参数之一:[/yellow]")
    console.print("  --history : 查看扫描历史")
    console.print("  --review-history : 查看复核历史")
    console.print("  --scan-id <ID> : 查看指定扫描详情")
    console.print("  --session-id <ID> : 查看指定会话的所有命中")
    console.print("  --hit-id <ID> : 查看单个命中详情")
