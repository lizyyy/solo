import click
import json
import sys
from datetime import datetime, timedelta
from typing import Optional
from tabulate import tabulate

from .models import LeaseManager, Environment, EnvironmentStatus


class Context:
    def __init__(self):
        self.manager = LeaseManager()
        self.output_format = 'table'
        self.quiet = False


pass_context = click.make_pass_decorator(Context, ensure=True)


def output_result(ctx: Context, data: dict, human_table=None):
    if ctx.output_format == 'json' or (ctx.quiet and not human_table):
        click.echo(json.dumps(data, ensure_ascii=False, indent=2, default=str))
    elif human_table:
        if 'summary' in data and data['summary']:
            click.echo("\n=== 摘要 ===")
            for k, v in data['summary'].items():
                click.echo(f"  {k}: {v}")
            click.echo("")
        click.echo(tabulate(human_table, headers='keys', tablefmt='simple'))
    else:
        click.echo(json.dumps(data, ensure_ascii=False, indent=2, default=str))


def print_error(message: str, exit_code: int = 1):
    click.echo(click.style(f"错误: {message}", fg='red'), err=True)
    sys.exit(exit_code)


def print_success(message: str):
    click.echo(click.style(f"✓ {message}", fg='green'))


def print_warning(message: str):
    click.echo(click.style(f"! {message}", fg='yellow'))


@click.group()
@click.option('--format', '-f', 'output_format', type=click.Choice(['json', 'table']), default='table',
              help='输出格式: json 或 table')
@click.option('--quiet', '-q', is_flag=True, help='静默模式，仅输出JSON')
@click.option('--data-file', '-d', type=click.Path(exists=True), help='从JSON文件加载数据')
@pass_context
def cli(ctx: Context, output_format: str, quiet: bool, data_file: Optional[str]):
    """预览环境租约释放审计排查工具"""
    ctx.output_format = output_format
    ctx.quiet = quiet

    if not data_file:
        for i in range(1, 11):
            env = Environment(env_id=f"env-{i:02d}", name=f"预览环境{i:02d}")
            ctx.manager.add_environment(env)


@cli.command()
@click.argument('env_id')
@click.argument('branch_name')
@click.argument('assignee')
@click.option('--duration', '-t', type=int, default=8, help='租约时长（小时）')
@click.option('--reason', '-r', required=True, help='租用理由')
@click.option('--request-id', help='请求ID（用于幂等性）')
@pass_context
def lease(ctx: Context, env_id: str, branch_name: str, assignee: str, duration: int, reason: str, request_id: Optional[str]):
    """租用环境 ENV_ID BRANCH_NAME ASSIGNEE"""
    result = ctx.manager.create_lease(env_id, branch_name, assignee, duration, reason, request_id)

    if result.get('idempotent'):
        print_warning(result['message'])
        output_result(ctx, result)
        return

    if not result['success']:
        if 'conflict' in result:
            print_error(f"租用冲突: {result['error']}")
        else:
            print_error(result['error'])

    lease = result['lease']
    print_success(f"成功租用环境 {env_id}")
    output_result(ctx, result, [{
        '环境ID': lease.env_id,
        '分支': lease.branch_name,
        '占用人': lease.assignee,
        '开始时间': lease.start_time.strftime('%Y-%m-%d %H:%M'),
        '到期时间': lease.end_time.strftime('%Y-%m-%d %H:%M'),
        '理由': lease.reason
    }])


@cli.command()
@click.argument('env_id')
@click.argument('assignee')
@click.option('--duration', '-t', type=int, default=8, help='续租时长（小时）')
@click.option('--reason', '-r', required=True, help='续租理由')
@click.option('--request-id', help='请求ID（用于幂等性）')
@pass_context
def renew(ctx: Context, env_id: str, assignee: str, duration: int, reason: str, request_id: Optional[str]):
    """续租环境 ENV_ID ASSIGNEE"""
    result = ctx.manager.renew_lease(env_id, assignee, duration, reason, request_id)

    if result.get('idempotent'):
        print_warning(result['message'])
        output_result(ctx, result)
        return

    if not result['success']:
        print_error(result['error'])

    lease = result['lease']
    print_success(f"成功续租环境 {env_id}")
    output_result(ctx, result, [{
        '环境ID': lease.env_id,
        '占用人': lease.assignee,
        '新到期时间': lease.end_time.strftime('%Y-%m-%d %H:%M'),
        '理由': lease.reason
    }])


@cli.command()
@click.argument('env_id')
@click.option('--assignee', '-a', help='占用人（用于验证）')
@click.option('--reason', '-r', default='manual release', help='释放理由')
@click.option('--force', '-f', is_flag=True, help='强制释放')
@pass_context
def release(ctx: Context, env_id: str, assignee: Optional[str], reason: str, force: bool):
    """释放环境 ENV_ID"""
    result = ctx.manager.release_lease(env_id, assignee, reason, force)

    if not result['success']:
        print_error(result['error'])

    if result.get('was_expired'):
        print_warning(f"环境 {env_id} 租约已过期")

    if result.get('force_released'):
        print_warning(f"环境 {env_id} 已被强制释放")

    print_success(f"成功释放环境 {env_id}")
    output_result(ctx, result)


@cli.command()
@pass_context
def check_expired(ctx: Context):
    """检查并释放过期租约"""
    expired = ctx.manager.check_expired_leases()

    if not expired:
        print_success("没有发现过期租约")
        output_result(ctx, {'expired_count': 0, 'leases': []})
        return

    table_data = []
    for lease in expired:
        table_data.append({
            '环境ID': lease.env_id,
            '分支': lease.branch_name,
            '占用人': lease.assignee,
            '到期时间': lease.end_time.strftime('%Y-%m-%d %H:%M')
        })

    print_warning(f"发现 {len(expired)} 个过期租约，已自动释放")
    output_result(ctx, {
        'expired_count': len(expired),
        'leases': [l.dict() for l in expired]
    }, table_data)


@cli.command()
@click.option('--filter-status', type=click.Choice(['all', 'occupied', 'available', 'maintenance']), default='all')
@click.option('--filter-assignee', help='按占用人过滤')
@click.option('--filter-branch', help='按分支名过滤')
@pass_context
def status(ctx: Context, filter_status: str, filter_assignee: Optional[str], filter_branch: Optional[str]):
    """查看环境状态"""
    report = ctx.manager.get_occupancy_report()

    filtered = []
    for env in report['environments']:
        if filter_status != 'all' and env['status'] != filter_status:
            continue
        if filter_assignee and env['assignee'] != filter_assignee:
            continue
        if filter_branch and env['branch'] and filter_branch not in env['branch']:
            continue
        filtered.append(env)

    table_data = []
    for env in filtered:
        remaining = f"{env['remaining_hours']}h" if env['remaining_hours'] is not None else '-'
        status_display = env['status']
        if env.get('is_expired'):
            status_display = click.style(status_display, fg='red')
        elif env['remaining_hours'] and env['remaining_hours'] < 2:
            status_display = click.style(status_display, fg='yellow')

        table_data.append({
            '环境ID': env['env_id'],
            '状态': status_display,
            '占用人': env['assignee'] or '-',
            '分支': env['branch'] or '-',
            '剩余时间': remaining
        })

    output_result(ctx, {
        'summary': report['summary'],
        'environments': filtered
    }, table_data)


@cli.command()
@click.option('--env-id', help='按环境ID过滤')
@click.option('--limit', '-n', type=int, default=20, help='显示条数')
@pass_context
def history(ctx: Context, env_id: Optional[str], limit: int):
    """查看租约历史"""
    history = ctx.manager.get_lease_history(env_id, limit)

    if not history:
        print_warning("没有租约历史记录")
        output_result(ctx, {'count': 0, 'history': []})
        return

    table_data = []
    for lease in history:
        table_data.append({
            '环境ID': lease.env_id,
            '分支': lease.branch_name,
            '占用人': lease.assignee,
            '状态': lease.status,
            '开始时间': lease.start_time.strftime('%Y-%m-%d %H:%M'),
            '结束时间': lease.end_time.strftime('%Y-%m-%d %H:%M'),
            '理由': lease.reason[:40] + '...' if len(lease.reason) > 40 else lease.reason
        })

    output_result(ctx, {
        'count': len(history),
        'history': [l.dict() for l in history]
    }, table_data)


@cli.command()
@pass_context
def report(ctx: Context):
    """生成占用报表"""
    report_data = ctx.manager.get_occupancy_report()
    summary = report_data['summary']

    click.echo(click.style("\n" + "=" * 60, fg='cyan'))
    click.echo(click.style("           预览环境占用报表", fg='cyan', bold=True))
    click.echo(click.style("=" * 60, fg='cyan'))
    click.echo(f"\n生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    table_data = []
    for env in report_data['environments']:
        remaining = f"{env['remaining_hours']}h" if env['remaining_hours'] is not None else '-'
        status_symbol = '✓' if env['status'] == 'available' else ('⚠' if env.get('is_expired') else '●')
        status_color = 'green' if env['status'] == 'available' else ('red' if env.get('is_expired') else 'yellow')

        table_data.append({
            '': click.style(status_symbol, fg=status_color),
            '环境ID': env['env_id'],
            '状态': env['status'],
            '占用人': env['assignee'] or '-',
            '分支': env['branch'] or '-',
            '剩余': remaining
        })

    click.echo(tabulate(table_data, headers='keys', tablefmt='simple'))
    click.echo("\n" + "-" * 60)

    summary_lines = [
        f"总环境数: {summary['total']}",
        f"已占用: {summary['occupied']}",
        f"可用: {summary['available']}",
        f"维护中: {summary['maintenance']}",
        f"利用率: {summary['utilization_rate']}%",
        f"即将到期(<2h): {summary['expiring_soon']}"
    ]
    click.echo(" | ".join(summary_lines))
    click.echo("")

    if ctx.output_format == 'json':
        click.echo(json.dumps(report_data, ensure_ascii=False, indent=2, default=str))


@cli.command()
@pass_context
def who_can_renew(ctx: Context):
    """列出所有可续租的环境"""
    report = ctx.manager.get_occupancy_report()
    renewables = [e for e in report['environments'] if e['status'] == 'occupied' and not e.get('is_expired')]

    if not renewables:
        print_warning("没有可续租的环境")
        output_result(ctx, {'count': 0, 'renewable': []})
        return

    table_data = []
    for env in renewables:
        table_data.append({
            '环境ID': env['env_id'],
            '占用人': env['assignee'],
            '分支': env['branch'],
            '剩余小时': env['remaining_hours'],
            '状态': '即将到期' if env['remaining_hours'] < 2 else '正常'
        })

    print_success(f"找到 {len(renewables)} 个可续租的环境")
    output_result(ctx, {'count': len(renewables), 'renewable': renewables}, table_data)


@cli.command()
@pass_context
def who_should_release(ctx: Context):
    """列出应该释放的环境（过期或即将过期）"""
    report = ctx.manager.get_occupancy_report()
    should_release = [
        e for e in report['environments']
        if e['status'] == 'occupied' and (e.get('is_expired') or e['remaining_hours'] < 4)
    ]

    if not should_release:
        print_success("没有需要释放的环境")
        output_result(ctx, {'count': 0, 'should_release': []})
        return

    table_data = []
    for env in should_release:
        reason = '已过期' if env.get('is_expired') else f"剩余{env['remaining_hours']}h"
        table_data.append({
            '环境ID': env['env_id'],
            '占用人': env['assignee'],
            '分支': env['branch'],
            '原因': reason
        })

    print_warning(f"找到 {len(should_release)} 个应该释放的环境")
    output_result(ctx, {'count': len(should_release), 'should_release': should_release}, table_data)


@cli.command()
@pass_context
def available(ctx: Context):
    """列出所有可用环境"""
    report = ctx.manager.get_occupancy_report()
    available_envs = [e for e in report['environments'] if e['status'] == 'available']

    if not available_envs:
        print_warning("没有可用环境！所有环境都被占用了")
        output_result(ctx, {'count': 0, 'available': []})
        return

    table_data = []
    for env in available_envs:
        table_data.append({
            '环境ID': env['env_id'],
            '状态': '可用'
        })

    print_success(f"找到 {len(available_envs)} 个可用环境")
    output_result(ctx, {'count': len(available_envs), 'available': available_envs}, table_data)
