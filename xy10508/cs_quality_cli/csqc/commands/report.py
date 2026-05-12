import os
import json
import click
from typing import List, Dict, Any, Counter
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import box

from ..db import get_connection
from ..utils import is_project_initialized

console = Console()


def get_overview_stats(project_dir: str) -> Dict:
    with get_connection(project_dir) as conn:
        cursor = conn.cursor()

        stats = {}

        cursor.execute("SELECT COUNT(*) FROM sessions")
        stats['total_sessions'] = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM agents")
        stats['total_agents'] = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM rules WHERE is_active = 1")
        stats['active_rules'] = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM scans")
        stats['total_scans'] = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM hits")
        stats['total_hits'] = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(DISTINCT session_id) FROM hits")
        stats['flagged_sessions'] = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM reviews")
        stats['total_reviews'] = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM reviews WHERE decision = 'false_positive'")
        stats['false_positives'] = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM reviews WHERE decision = 'confirmed'")
        stats['confirmed_hits'] = cursor.fetchone()[0]

        return stats


def get_rule_stats(project_dir: str) -> List[Dict]:
    with get_connection(project_dir) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT r.rule_id, r.name, r.category, r.severity,
                   COUNT(h.id) as hit_count,
                   COUNT(DISTINCT h.session_id) as session_count
            FROM rules r
            LEFT JOIN hits h ON r.rule_id = h.rule_id
            WHERE r.is_active = 1
            GROUP BY r.rule_id
            ORDER BY hit_count DESC
        ''')
        return [dict(row) for row in cursor.fetchall()]


def get_agent_stats(project_dir: str) -> List[Dict]:
    with get_connection(project_dir) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT a.agent_id, a.name, a.team,
                   COUNT(h.id) as hit_count,
                   COUNT(DISTINCT h.session_id) as session_count
            FROM agents a
            LEFT JOIN hits h ON a.agent_id = h.agent_id
            GROUP BY a.agent_id
            ORDER BY hit_count DESC
        ''')
        return [dict(row) for row in cursor.fetchall()]


def get_unclosed_issues(project_dir: str) -> List[Dict]:
    with get_connection(project_dir) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT h.id, h.session_id, h.rule_id, h.hit_text,
                   a.name as agent_name, r.name as rule_name,
                   r.category, r.severity
            FROM hits h
            LEFT JOIN agents a ON h.agent_id = a.agent_id
            LEFT JOIN rules r ON h.rule_id = r.rule_id
            WHERE h.id NOT IN (SELECT DISTINCT hit_id FROM reviews)
              AND h.is_duplicate = 0
            ORDER BY h.id DESC
            LIMIT 20
        ''')
        return [dict(row) for row in cursor.fetchall()]


def get_recommendations(project_dir: str) -> List[str]:
    recs = []

    with get_connection(project_dir) as conn:
        cursor = conn.cursor()

        cursor.execute('''
            SELECT r.name, COUNT(h.id) as cnt
            FROM rules r
            LEFT JOIN hits h ON r.rule_id = h.rule_id
            GROUP BY r.rule_id
            ORDER BY cnt DESC
            LIMIT 3
        ''')
        top_rules = cursor.fetchall()
        if top_rules and top_rules[0][1] > 0:
            names = ', '.join([r[0] for r in top_rules if r[1] > 0])
            recs.append(f"高频问题集中在: {names}，建议重点培训")

        cursor.execute('''
            SELECT COUNT(*) FROM reviews 
            WHERE decision = 'false_positive' 
            AND created_at >= datetime('now', '-7 days')
        ''')
        fp_week = cursor.fetchone()[0]
        if fp_week > 5:
            recs.append(f"近一周误报 {fp_week} 条，建议优化规则关键词")

        cursor.execute('''
            SELECT h.agent_id, a.name, COUNT(*) as cnt
            FROM hits h
            LEFT JOIN agents a ON h.agent_id = a.agent_id
            GROUP BY h.agent_id
            ORDER BY cnt DESC
            LIMIT 3
        ''')
        top_agents = cursor.fetchall()
        if top_agents and top_agents[0][2] > 0:
            names = ', '.join([a[1] or a[0] for a in top_agents if a[2] > 0])
            recs.append(f"高频命中客服: {names}，建议一对一辅导")

        cursor.execute('''
            SELECT COUNT(*) FROM hits
            WHERE id NOT IN (SELECT DISTINCT hit_id FROM reviews)
        ''')
        unreviewed = cursor.fetchone()[0]
        if unreviewed > 10:
            recs.append(f"尚有 {unreviewed} 条未复核，建议优先处理")

    if not recs:
        recs.append("当前数据健康，继续保持监控")

    return recs


@click.command()
@click.option('--project-dir', '-p', default='.', help='项目目录')
@click.option('--output', '-o', help='输出文件路径（JSON格式）')
@click.option('--full', '-f', is_flag=True, help='显示完整报告')
def report(project_dir: str, output: str, full: bool) -> None:
    """生成质检统计报告"""
    abs_project_dir = os.path.abspath(project_dir)

    if not is_project_initialized(abs_project_dir):
        console.print(f"[bold red]错误:[/bold red] 项目未初始化")
        raise SystemExit(1)

    stats = get_overview_stats(abs_project_dir)
    rule_stats = get_rule_stats(abs_project_dir)
    agent_stats = get_agent_stats(abs_project_dir)
    unclosed = get_unclosed_issues(abs_project_dir)
    recommendations = get_recommendations(abs_project_dir)

    console.print(Panel(
        f"[bold cyan]客服敏感话术抽检报告[/bold cyan]\n\n"
        f"[white]总览统计[/white]\n"
        f"  会话总数: {stats['total_sessions']}\n"
        f"  客服数量: {stats['total_agents']}\n"
        f"  活跃规则: {stats['active_rules']}\n\n"
        f"[white]扫描情况[/white]\n"
        f"  扫描次数: {stats['total_scans']}\n"
        f"  命中会话: {stats['flagged_sessions']}\n"
        f"  总命中数: {stats['total_hits']}\n\n"
        f"[white]复核情况[/white]\n"
        f"  已复核: {stats['total_reviews']}\n"
        f"  确认违规: [red]{stats['confirmed_hits']}[/red]\n"
        f"  误报标记: [green]{stats['false_positives']}[/green]\n"
        + (f"  误报率: {stats['false_positives']/stats['total_reviews']*100:.1f}%\n"
           if stats['total_reviews'] > 0 else ""),
        title="报告总览"
    ))

    if rule_stats:
        table = Table(title="按规则统计", box=box.SIMPLE)
        table.add_column("规则ID", style="cyan")
        table.add_column("规则名称")
        table.add_column("类别", style="blue")
        table.add_column("严重程度", style="yellow")
        table.add_column("命中数", style="red")
        table.add_column("会话数")
        for r in rule_stats:
            table.add_row(
                r['rule_id'], r['name'], r['category'], r['severity'],
                str(r['hit_count']), str(r['session_count'])
            )
        console.print(table)

    if full and agent_stats:
        table = Table(title="按客服统计", box=box.SIMPLE)
        table.add_column("客服ID", style="cyan")
        table.add_column("姓名")
        table.add_column("团队")
        table.add_column("命中数", style="red")
        table.add_column("会话数")
        for a in agent_stats:
            table.add_row(
                a['agent_id'], a['name'], a['team'] or '-',
                str(a['hit_count']), str(a['session_count'])
            )
        console.print(table)

    if unclosed:
        console.print("\n[bold]未闭环问题（最近20条）:[/bold]")
        table = Table(box=box.SIMPLE)
        table.add_column("命中ID", style="cyan")
        table.add_column("会话ID", style="blue")
        table.add_column("规则")
        table.add_column("命中内容", style="red")
        table.add_column("客服")
        for u in unclosed[:10]:
            table.add_row(
                str(u['id']), u['session_id'], u['rule_name'] or u['rule_id'],
                u['hit_text'], u['agent_name'] or '未知'
            )
        console.print(table)
        console.print(f"[yellow]共 {len(unclosed)} 条未复核记录[/yellow]")

    console.print("\n[bold]处理建议:[/bold]")
    for i, rec in enumerate(recommendations, 1):
        console.print(f"  [cyan]{i}.[/cyan] {rec}")

    if output:
        full_report = {
            'overview': stats,
            'rules': rule_stats,
            'agents': agent_stats,
            'unclosed': unclosed,
            'recommendations': recommendations,
            'generated_at': 'now'
        }
        with open(output, 'w', encoding='utf-8') as f:
            json.dump(full_report, f, ensure_ascii=False, indent=2)
        console.print(f"\n[green]✓ 报告已保存至: {output}[/green]")

    console.print("\n复核命中: [cyan]csqc review --hit-id <ID>[/cyan]")
    console.print("查看详情: [cyan]csqc detail --scan-id <ID>[/cyan]")
