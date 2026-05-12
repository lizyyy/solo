import os
import json
import click
from typing import List, Dict, Any
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from ..db import get_connection
from ..utils import is_project_initialized, load_json_file

console = Console()


def log_import_history(project_dir: str, import_type: str, file_path: str, count: int,
                       status: str, error_message: str = None):
    with get_connection(project_dir) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO import_history (type, file_path, count, status, error_message)
            VALUES (?, ?, ?, ?, ?)
        ''', (import_type, file_path, count, status, error_message))


def import_agents(project_dir: str, file_path: str) -> int:
    data = load_json_file(file_path)
    agents = data.get('agents', data) if isinstance(data, dict) else data

    with get_connection(project_dir) as conn:
        cursor = conn.cursor()
        count = 0
        for agent in agents:
            cursor.execute('''
                INSERT OR REPLACE INTO agents (agent_id, name, team, role)
                VALUES (?, ?, ?, ?)
            ''', (agent.get('agent_id'), agent.get('name'), agent.get('team'), agent.get('role', '客服')))
            count += 1
    return count


def import_sessions(project_dir: str, file_path: str) -> int:
    data = load_json_file(file_path)
    sessions = data.get('sessions', data) if isinstance(data, dict) else data

    with get_connection(project_dir) as conn:
        cursor = conn.cursor()
        count = 0
        for session in sessions:
            messages_json = json.dumps(session.get('messages', []), ensure_ascii=False)
            cursor.execute('''
                INSERT OR REPLACE INTO sessions
                (session_id, customer_id, start_time, end_time, status, messages_json)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                session.get('session_id'),
                session.get('customer_id'),
                session.get('start_time'),
                session.get('end_time'),
                session.get('status', 'closed'),
                messages_json
            ))
            count += 1
    return count


def import_rules(project_dir: str, file_path: str) -> int:
    data = load_json_file(file_path)
    rules = data.get('rules', data) if isinstance(data, dict) else data

    with get_connection(project_dir) as conn:
        cursor = conn.cursor()
        count = 0
        for rule in rules:
            keywords_json = json.dumps(rule.get('keywords', []), ensure_ascii=False)
            cursor.execute('''
                INSERT OR REPLACE INTO rules
                (rule_id, name, category, keywords_json, severity, description, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                rule.get('rule_id'),
                rule.get('name'),
                rule.get('category'),
                keywords_json,
                rule.get('severity', 'medium'),
                rule.get('description'),
                1 if rule.get('is_active', True) else 0
            ))
            count += 1
    return count


def import_policies(project_dir: str, file_path: str) -> int:
    data = load_json_file(file_path)
    policies = data.get('policies', data) if isinstance(data, dict) else data

    with get_connection(project_dir) as conn:
        cursor = conn.cursor()
        count = 0
        for policy in policies:
            conditions_json = json.dumps(policy.get('conditions', []), ensure_ascii=False)
            cursor.execute('''
                INSERT OR REPLACE INTO refund_policies
                (policy_id, name, conditions_json, max_amount, is_active)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                policy.get('policy_id'),
                policy.get('name'),
                conditions_json,
                policy.get('max_amount'),
                1 if policy.get('is_active', True) else 0
            ))
            count += 1
    return count


IMPORT_TYPES = {
    'agents': import_agents,
    'sessions': import_sessions,
    'rules': import_rules,
    'policies': import_policies,
}


@click.command('import')
@click.argument('import_type', type=click.Choice(list(IMPORT_TYPES.keys()) + ['all']))
@click.argument('file_path', required=False)
@click.option('--project-dir', '-p', default='.', help='项目目录')
@click.option('--sample', '-s', is_flag=True, help='使用内置样例数据')
def import_cmd(import_type: str, file_path: str, project_dir: str, sample: bool) -> None:
    """导入数据到项目

    IMPORT_TYPE: agents | sessions | rules | policies | all
    """
    abs_project_dir = os.path.abspath(project_dir)

    if not is_project_initialized(abs_project_dir):
        console.print(f"[bold red]错误:[/bold red] 项目未初始化，请先运行 [cyan]csqc init[/cyan]")
        raise SystemExit(1)

    console.print(f"[bold blue]导入类型:[/bold blue] {import_type}")

    if sample:
        from ..samples import get_sample_path

        types_to_import = [import_type] if import_type != 'all' else ['agents', 'rules', 'policies', 'sessions']
        results = []

        for t in types_to_import:
            sample_path = get_sample_path(t)
            if not sample_path:
                console.print(f"[yellow]警告:[/yellow] {t} 类型没有样例数据，跳过")
                continue

            console.print(f"\n导入样例数据: {t}")
            try:
                func = IMPORT_TYPES[t]
                count = func(abs_project_dir, sample_path)
                log_import_history(abs_project_dir, t, sample_path, count, 'success')
                results.append((t, count, '成功'))
            except Exception as e:
                log_import_history(abs_project_dir, t, sample_path, 0, 'failed', str(e))
                results.append((t, 0, f'失败: {e}'))

        table = Table(title="导入结果")
        table.add_column("类型", style="cyan")
        table.add_column("数量", style="green")
        table.add_column("状态")
        for t, count, status in results:
            table.add_row(t, str(count), status)
        console.print(table)

    else:
        if not file_path:
            console.print("[bold red]错误:[/bold red] 请指定文件路径或使用 [cyan]--sample[/cyan]")
            raise SystemExit(1)

        if import_type == 'all':
            console.print("[bold red]错误:[/bold red] 'all' 类型仅支持 [cyan]--sample[/cyan] 模式")
            raise SystemExit(1)

        if not os.path.exists(file_path):
            console.print(f"[bold red]错误:[/bold red] 文件不存在: {file_path}")
            raise SystemExit(1)

        try:
            func = IMPORT_TYPES[import_type]
            count = func(abs_project_dir, file_path)
            log_import_history(abs_project_dir, import_type, file_path, count, 'success')
            console.print(f"[bold green]✓ 成功导入 {count} 条 {import_type} 记录[/bold green]")
        except Exception as e:
            log_import_history(abs_project_dir, import_type, file_path, 0, 'failed', str(e))
            console.print(f"[bold red]导入失败:[/bold red] {e}")
            raise SystemExit(1)

    console.print("\n查看导入历史: [cyan]csqc import --history[/cyan]")
