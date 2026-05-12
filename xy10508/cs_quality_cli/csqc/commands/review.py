import os
import click
from typing import List, Dict, Any
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.prompt import Prompt

from ..db import get_connection
from ..utils import is_project_initialized

console = Console()

DECISIONS = ['confirmed', 'false_positive', 'corrected', 'needs_followup']


def get_hit(project_dir: str, hit_id: int):
    with get_connection(project_dir) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT h.*, r.name as rule_name, r.category, r.description,
                   a.name as agent_name
            FROM hits h
            LEFT JOIN rules r ON h.rule_id = r.rule_id
            LEFT JOIN agents a ON h.agent_id = a.agent_id
            WHERE h.id = ?
        ''', (hit_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def add_review(project_dir: str, hit_id: int, reviewer: str, decision: str,
               original_text: str, corrected_text: str = None, comment: str = None) -> int:
    with get_connection(project_dir) as conn:
        cursor = conn.cursor()

        cursor.execute('''
            SELECT id FROM reviews 
            WHERE hit_id = ? AND reviewer = ? AND decision = ? 
            AND original_hit_text = ?
            AND (corrected_hit_text = ? OR (corrected_hit_text IS NULL AND ? IS NULL))
        ''', (hit_id, reviewer, decision, original_text, corrected_text, corrected_text))

        if cursor.fetchone():
            return -1

        cursor.execute('''
            INSERT INTO reviews
            (hit_id, reviewer, decision, original_hit_text, corrected_hit_text, comment)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (hit_id, reviewer, decision, original_text, corrected_text, comment))

        return cursor.lastrowid


@click.command()
@click.option('--project-dir', '-p', default='.', help='项目目录')
@click.option('--hit-id', type=int, required=True, help='要复核的命中ID')
@click.option('--decision', '-d', type=click.Choice(DECISIONS), required=True,
              help='复核决策: confirmed|false_positive|corrected|needs_followup')
@click.option('--reviewer', '-r', help='复核人姓名（默认: 当前系统用户）')
@click.option('--corrected-text', '-c', help='修正后的文本（decision=corrected时使用）')
@click.option('--comment', '-m', help='复核备注')
@click.option('--yes', '-y', is_flag=True, help='跳过确认提示')
def review(project_dir: str, hit_id: int, decision: str, reviewer: str,
           corrected_text: str, comment: str, yes: bool) -> None:
    """复核命中记录，标记误报或确认违规"""
    abs_project_dir = os.path.abspath(project_dir)

    if not is_project_initialized(abs_project_dir):
        console.print(f"[bold red]错误:[/bold red] 项目未初始化")
        raise SystemExit(1)

    hit = get_hit(abs_project_dir, hit_id)
    if not hit:
        console.print(f"[bold red]错误:[/bold red] 未找到命中ID: {hit_id}")
        raise SystemExit(1)

    if not reviewer:
        import getpass
        reviewer = getpass.getuser()

    if decision == 'corrected' and not corrected_text:
        console.print("[bold red]错误:[/bold red] decision=corrected 时必须提供 --corrected-text")
        raise SystemExit(1)

    console.print(Panel(
        f"[bold]复核确认[/bold]\n\n"
        f"[cyan]命中ID:[/cyan] {hit_id}\n"
        f"[cyan]会话:[/cyan] {hit['session_id']}\n"
        f"[cyan]规则:[/cyan] {hit['rule_name']} ({hit['rule_id']})\n"
        f"[cyan]原始命中:[/cyan] [red]{hit['hit_text']}[/red]\n"
        f"[cyan]客服:[/cyan] {hit.get('agent_name', '未知')}\n"
        f"[cyan]复核人:[/cyan] {reviewer}\n"
        f"[cyan]决策:[/cyan] [yellow]{decision}[/yellow]\n"
        + (f"[cyan]修正后:[/cyan] [green]{corrected_text}[/green]\n" if corrected_text else "")
        + (f"[cyan]备注:[/cyan] {comment}\n" if comment else ""),
        title="复核确认"
    ))

    if not yes:
        confirm = click.confirm("确认提交复核？", default=False)
        if not confirm:
            console.print("[yellow]已取消复核[/yellow]")
            return

    result = add_review(
        abs_project_dir, hit_id, reviewer, decision,
        hit['hit_text'], corrected_text, comment
    )

    if result == -1:
        console.print("[yellow]幂等保护: 相同内容的复核记录已存在，跳过[/yellow]")
    else:
        console.print(f"[bold green]✓ 复核完成，复核记录ID: {result}[/bold green]")
        if decision == 'false_positive':
            console.print("[green]已标记为误报，将从统计中排除[/green]")
        elif decision == 'confirmed':
            console.print("[red]已确认违规，建议跟进处理[/red]")
        elif decision == 'corrected':
            console.print(f"[yellow]已记录修正: '{hit['hit_text']}' -> '{corrected_text}'[/yellow]")
            console.print("[yellow]注意: 已保存前后差异和操作者信息[/yellow]")

    console.print("\n查看复核历史: [cyan]csqc detail --review-history[/cyan]")
    console.print("生成报告: [cyan]csqc report[/cyan]")


@click.command('review-batch')
@click.option('--project-dir', '-p', default='.', help='项目目录')
@click.option('--decision', '-d', type=click.Choice(DECISIONS), required=True)
@click.option('--reviewer', '-r', help='复核人姓名')
@click.option('--limit', '-n', type=int, default=10, help='批量处理数量')
@click.option('--category', help='仅处理指定规则类别')
def review_batch(project_dir: str, decision: str, reviewer: str, limit: int, category: str):
    """批量复核未处理的命中"""
    abs_project_dir = os.path.abspath(project_dir)

    if not is_project_initialized(abs_project_dir):
        console.print(f"[bold red]错误:[/bold red] 项目未初始化")
        raise SystemExit(1)

    if not reviewer:
        import getpass
        reviewer = getpass.getuser()

    with get_connection(abs_project_dir) as conn:
        cursor = conn.cursor()

        if category:
            cursor.execute('''
                SELECT h.id, h.session_id, h.rule_id, h.hit_text,
                       r.name as rule_name, r.category
                FROM hits h
                LEFT JOIN rules r ON h.rule_id = r.rule_id
                WHERE h.id NOT IN (SELECT DISTINCT hit_id FROM reviews)
                  AND h.is_duplicate = 0
                  AND r.category = ?
                ORDER BY h.id
                LIMIT ?
            ''', (category, limit))
        else:
            cursor.execute('''
                SELECT h.id, h.session_id, h.rule_id, h.hit_text,
                       r.name as rule_name, r.category
                FROM hits h
                LEFT JOIN rules r ON h.rule_id = r.rule_id
                WHERE h.id NOT IN (SELECT DISTINCT hit_id FROM reviews)
                  AND h.is_duplicate = 0
                ORDER BY h.id
                LIMIT ?
            ''', (limit,))

        hits = [dict(row) for row in cursor.fetchall()]

    if not hits:
        console.print("[yellow]没有需要复核的命中记录[/yellow]")
        return

    console.print(f"找到 {len(hits)} 条待复核记录，决策: {decision}")

    table = Table(title="待复核命中", box=Table.SIMPLE if hasattr(Table, 'SIMPLE') else None)
    table.add_column("ID", style="cyan")
    table.add_column("会话")
    table.add_column("规则")
    table.add_column("命中内容", style="red")
    for h in hits:
        table.add_row(str(h['id']), h['session_id'], h['rule_name'], h['hit_text'])
    console.print(table)

    confirm = click.confirm(f"确认批量标记这 {len(hits)} 条记录为 '{decision}'？", default=False)
    if not confirm:
        console.print("[yellow]已取消[/yellow]")
        return

    count = 0
    skipped = 0
    for h in hits:
        result = add_review(abs_project_dir, h['id'], reviewer, decision, h['hit_text'])
        if result == -1:
            skipped += 1
        else:
            count += 1

    console.print(f"[green]✓ 完成: 复核 {count} 条[/green]")
    if skipped:
        console.print(f"[yellow]跳过: {skipped} 条（已存在相同复核）[/yellow]")
