import os
import json
import click
from typing import List, Dict, Any, Set, Tuple
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn

from ..db import get_connection
from ..utils import (
    is_project_initialized,
    extract_context,
    find_user_quote,
    check_transfer_to_agent,
    is_duplicate_hit
)

console = Console()


def get_active_rules(project_dir: str) -> List[Dict]:
    with get_connection(project_dir) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM rules WHERE is_active = 1")
        rules = []
        for row in cursor.fetchall():
            rules.append({
                'id': row['id'],
                'rule_id': row['rule_id'],
                'name': row['name'],
                'category': row['category'],
                'keywords': json.loads(row['keywords_json']),
                'severity': row['severity'],
                'description': row['description']
            })
    return rules


def get_sessions(project_dir: str, session_id_filter: str = None,
                 exclude_reviewed: bool = False) -> List[Dict]:
    with get_connection(project_dir) as conn:
        cursor = conn.cursor()

        if session_id_filter:
            cursor.execute("SELECT * FROM sessions WHERE session_id = ?", (session_id_filter,))
        else:
            cursor.execute("SELECT * FROM sessions")

        sessions = []
        for row in cursor.fetchall():
            sessions.append({
                'id': row['id'],
                'session_id': row['session_id'],
                'customer_id': row['customer_id'],
                'messages': json.loads(row['messages_json']),
                'last_scan_id': row['last_scan_id']
            })
    return sessions


def scan_session(session: Dict, rules: List[Dict], existing_hits: List[Dict] = None) -> List[Dict]:
    hits = []
    existing_hits = existing_hits or []
    messages = session['messages']

    for rule in rules:
        keywords = rule['keywords']

        for idx, msg in enumerate(messages):
            if msg.get('sender') not in ['agent', 'system']:
                continue

            content = msg.get('content', '')
            lower_content = content.lower()

            for keyword in keywords:
                if keyword.lower() not in lower_content:
                    continue

                hit_info = {
                    'session_id': session['session_id'],
                    'rule_id': rule['rule_id'],
                    'agent_id': msg.get('agent_id'),
                    'hit_text': keyword,
                    'message_index': idx,
                    'message_sender': msg.get('sender'),
                    'message_time': msg.get('time'),
                    'context_before': None,
                    'context_after': None,
                    'user_quote': None,
                    'transfer_to_agent': None
                }

                if is_duplicate_hit(existing_hits + hits, hit_info):
                    hit_info['is_duplicate'] = 1

                context = extract_context(messages, idx)
                hit_info['context_before'] = context['before']
                hit_info['context_after'] = context['after']

                user_quote = find_user_quote(messages, idx, keywords)
                hit_info['user_quote'] = user_quote

                transfer_to = check_transfer_to_agent(messages, idx)
                hit_info['transfer_to_agent'] = transfer_to

                hits.append(hit_info)

    return hits


@click.command()
@click.option('--project-dir', '-p', default='.', help='项目目录')
@click.option('--session-id', '-s', help='仅扫描指定会话ID')
@click.option('--exclude-reviewed', '-e', is_flag=True, help='跳过已复核的会话')
@click.option('--rescan', '-r', is_flag=True, help='重新扫描已扫描过的会话（保持幂等）')
def check(project_dir: str, session_id: str, exclude_reviewed: bool, rescan: bool) -> None:
    """扫描会话中的敏感话术"""
    abs_project_dir = os.path.abspath(project_dir)

    if not is_project_initialized(abs_project_dir):
        console.print(f"[bold red]错误:[/bold red] 项目未初始化，请先运行 [cyan]csqc init[/cyan]")
        raise SystemExit(1)

    rules = get_active_rules(abs_project_dir)
    if not rules:
        console.print("[yellow]警告:[/yellow] 没有活跃的规则，请先导入规则")
        raise SystemExit(0)

    sessions = get_sessions(abs_project_dir, session_id, exclude_reviewed)
    if not sessions:
        console.print("[yellow]警告:[/yellow] 没有可扫描的会话")
        raise SystemExit(0)

    console.print(f"[bold blue]扫描配置:[/bold blue]")
    console.print(f"  规则数量: {len(rules)}")
    console.print(f"  会话数量: {len(sessions)}")
    console.print(f"  重新扫描: {'是' if rescan else '否'}")

    all_hits = []
    scanned_count = 0
    flagged_count = 0

    with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}")) as progress:
        task = progress.add_task("扫描会话中...", total=len(sessions))

        for session in sessions:
            if session['last_scan_id'] and not rescan and not session_id:
                progress.advance(task)
                continue

            existing_hits = []
            if not rescan and session['last_scan_id']:
                with get_connection(abs_project_dir) as conn:
                    cursor = conn.cursor()
                    cursor.execute('''
                        SELECT * FROM hits WHERE session_id = ? AND scan_id = ?
                    ''', (session['session_id'], session['last_scan_id']))
                    existing_hits = [dict(row) for row in cursor.fetchall()]

            hits = scan_session(session, rules, existing_hits)
            all_hits.extend(hits)
            scanned_count += 1
            if hits:
                flagged_count += 1

            progress.advance(task)

    with get_connection(abs_project_dir) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO scans (total_sessions, flagged_sessions, status)
            VALUES (?, ?, 'completed')
        ''', (scanned_count, flagged_count))
        scan_id = cursor.lastrowid

        for hit in all_hits:
            cursor.execute('''
                INSERT INTO hits
                (scan_id, session_id, rule_id, agent_id, hit_text, message_index,
                 message_sender, message_time, context_before, context_after,
                 user_quote, transfer_to_agent, is_duplicate)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                scan_id, hit['session_id'], hit['rule_id'], hit.get('agent_id'),
                hit['hit_text'], hit['message_index'], hit['message_sender'],
                hit['message_time'], hit['context_before'], hit['context_after'],
                hit['user_quote'], hit['transfer_to_agent'], hit.get('is_duplicate', 0)
            ))

            hit_id = cursor.lastrowid

            cursor.execute('''
                UPDATE sessions SET last_scan_id = ? WHERE session_id = ?
            ''', (scan_id, hit['session_id']))

    console.print(f"\n[bold green]✓ 扫描完成[/bold green]")
    console.print(f"  扫描ID: {scan_id}")
    console.print(f"  扫描会话数: {scanned_count}")
    console.print(f"  命中会话数: {flagged_count}")
    console.print(f"  总命中数: {len(all_hits)}")

    if all_hits:
        console.print("\n[bold]命中统计:[/bold]")

        rule_stats = {}
        for hit in all_hits:
            rule_stats[hit['rule_id']] = rule_stats.get(hit['rule_id'], 0) + 1

        table = Table(title="按规则统计")
        table.add_column("规则ID", style="cyan")
        table.add_column("命中数", style="red")
        for rule_id, count in sorted(rule_stats.items(), key=lambda x: -x[1]):
            table.add_row(rule_id, str(count))
        console.print(table)

        sample_hits = all_hits[:3]
        console.print("\n[bold]部分命中示例:[/bold]")
        for hit in sample_hits:
            console.print(Panel(
                f"[cyan]会话:[/cyan] {hit['session_id']}\n"
                f"[cyan]规则:[/cyan] {hit['rule_id']}\n"
                f"[cyan]命中:[/cyan] [red]{hit['hit_text']}[/red]\n"
                f"[cyan]上下文:[/cyan] {hit.get('context_before', '')[:100]}..."
            ))

    console.print("\n查看详情: [cyan]csqc detail --scan-id " + str(scan_id) + "[/cyan]")
    console.print("生成报告: [cyan]csqc report[/cyan]")
