import click
import json
import sys
import os
from datetime import datetime, timedelta
from typing import Optional, Any
from tabulate import tabulate
from functools import wraps

from .models import LeaseManager, Environment, EnvironmentStatus


DEFAULT_DATA_FILE = os.path.expanduser("~/.env_audit_data.json")


def json_serializer(obj: Any) -> Any:
    """正确序列化 datetime、Lease 和其他类型"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, timedelta):
        return obj.total_seconds()
    # 处理 Lease 对象
    if hasattr(obj, 'model_dump'):
        return obj.model_dump()
    if hasattr(obj, '__dict__'):
        # 尝试转换为字典
        result = {}
        for k, v in obj.__dict__.items():
            if not k.startswith('_'):
                try:
                    result[k] = json_serializer(v)
                except TypeError:
                    result[k] = str(v)
        return result
    raise TypeError(f"Type {type(obj)} not serializable")


def safe_json_dumps(data: Any, indent: int = 2) -> str:
    """安全的JSON序列化，正确处理datetime等类型"""
    return json.dumps(data, ensure_ascii=False, indent=indent, default=json_serializer)


def validate_not_empty(value: str, field_name: str) -> str:
    """验证字符串不为空或纯空白"""
    if not value or not value.strip():
        print_error(f"{field_name} 不能为空")
    return value.strip()


def validate_positive_duration(duration: int, field_name: str = "租期") -> int:
    """验证租期为正数"""
    if duration <= 0:
        print_error(f"{field_name} 必须大于0，当前值: {duration}")
    return duration


def load_manager(data_file: str = None) -> LeaseManager:
    file_path = data_file or DEFAULT_DATA_FILE
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return LeaseManager.from_dict(data)
        except Exception as e:
            click.echo(click.style(f"警告: 无法加载数据文件 {file_path}: {e}", fg='yellow'), err=True)
    manager = LeaseManager()
    for i in range(1, 11):
        manager.add_environment(Environment(env_id=f"env-{i:02d}", name=f"预览环境{i:02d}"))
    return manager


def save_manager(manager: LeaseManager, data_file: str = None):
    file_path = data_file or DEFAULT_DATA_FILE
    try:
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(manager.to_dict(), f, ensure_ascii=False, indent=2, default=json_serializer)
    except Exception as e:
        click.echo(click.style(f"警告: 无法保存数据文件 {file_path}: {e}", fg='yellow'), err=True)


def persist_data(f):
    @wraps(f)
    @pass_context
    def wrapper(ctx, *args, **kwargs):
        try:
            result = f(ctx, *args, **kwargs)
            save_manager(ctx.manager, ctx.data_file)
            return result
        except Exception as e:
            save_manager(ctx.manager, ctx.data_file)
            raise
    return wrapper


class Context:
    def __init__(self):
        self.manager: LeaseManager = None
        self.output_format = 'table'
        self.quiet = False
        self.data_file: Optional[str] = None


pass_context = click.make_pass_decorator(Context, ensure=True)


def output_result(ctx: Context, data: dict, human_table=None):
    if ctx.output_format == 'json' or (ctx.quiet and not human_table):
        click.echo(safe_json_dumps(data))
    elif human_table:
        if 'summary' in data and data['summary']:
            click.echo("\n=== 摘要 ===")
            for k, v in data['summary'].items():
                click.echo(f"  {k}: {v}")
            click.echo("")
        click.echo(tabulate(human_table, headers='keys', tablefmt='simple'))
    else:
        click.echo(safe_json_dumps(data))


def print_error(message: str, exit_code: int = 1):
    click.echo(click.style(f"错误: {message}", fg='red'), err=True)
    sys.exit(exit_code)


def print_success(ctx: Context, message: str):
    """在非 JSON 模式下打印成功消息，JSON 模式下静默"""
    if ctx.output_format != 'json' and not ctx.quiet:
        click.echo(click.style(f"✓ {message}", fg='green'))


def print_warning(ctx: Context, message: str):
    """在非 JSON 模式下打印警告消息，JSON 模式下静默"""
    if ctx.output_format != 'json' and not ctx.quiet:
        click.echo(click.style(f"! {message}", fg='yellow'))


@click.group()
@click.option('--format', '-f', 'output_format', type=click.Choice(['json', 'table']), default='table',
              help='输出格式: json 或 table')
@click.option('--quiet', '-q', is_flag=True, help='静默模式，仅输出JSON')
@click.option('--data-file', '-d', type=click.Path(), help='指定数据文件路径 (默认: ~/.env_audit_data.json)')
@pass_context
def cli(ctx: Context, output_format: str, quiet: bool, data_file: Optional[str]):
    """预览环境租约释放审计排查工具

    支持租约管理、续租冲突检测、强制释放、幂等操作和占用报表。
    数据会自动持久化到本地文件，跨命令调用保持一致。
    """
    ctx.output_format = output_format
    ctx.quiet = quiet
    ctx.data_file = data_file
    ctx.manager = load_manager(data_file)


@cli.command()
@click.argument('env_id')
@click.argument('branch_name')
@click.argument('assignee')
@click.option('--duration', '-t', type=int, default=8, help='租约时长（小时）')
@click.option('--reason', '-r', required=True, help='租用理由')
@click.option('--request-id', help='请求ID（用于幂等性）')
@persist_data
def lease(ctx: Context, env_id: str, branch_name: str, assignee: str, duration: int, reason: str, request_id: Optional[str]):
    """租用环境 ENV_ID BRANCH_NAME ASSIGNEE"""
    validate_not_empty(env_id, "环境ID")
    validate_not_empty(branch_name, "分支名称")
    validate_not_empty(assignee, "占用人")
    validate_positive_duration(duration)
    validate_not_empty(reason, "租用理由")
    result = ctx.manager.create_lease(env_id, branch_name, assignee, duration, reason, request_id)

    if result.get('idempotent'):
        print_warning(ctx, result['message'])
        output_result(ctx, result)
        return

    if not result['success']:
        if 'conflict' in result:
            output_result(ctx, result)
            print_error(f"租用冲突: {result['error']}")
        else:
            print_error(result['error'])
        return

    lease = result['lease']
    print_success(ctx, f"成功租用环境 {env_id}")
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
@persist_data
def renew(ctx: Context, env_id: str, assignee: str, duration: int, reason: str, request_id: Optional[str]):
    """续租环境 ENV_ID ASSIGNEE"""
    validate_not_empty(env_id, "环境ID")
    validate_not_empty(assignee, "占用人")
    validate_positive_duration(duration, "续租时长")
    validate_not_empty(reason, "续租理由")
    result = ctx.manager.renew_lease(env_id, assignee, duration, reason, request_id)

    if result.get('idempotent'):
        print_warning(ctx, result['message'])
        output_result(ctx, result)
        return

    if not result['success']:
        print_error(result['error'])
        return

    lease = result['lease']
    print_success(ctx, f"成功续租环境 {env_id}")
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
@persist_data
def release(ctx: Context, env_id: str, assignee: Optional[str], reason: str, force: bool):
    """释放环境 ENV_ID"""
    result = ctx.manager.release_lease(env_id, assignee, reason, force)

    if not result['success']:
        print_error(result['error'])

    if result.get('was_expired'):
        print_warning(ctx, f"环境 {env_id} 租约已过期")

    if result.get('force_released'):
        print_warning(ctx, f"环境 {env_id} 已被强制释放")

    print_success(ctx, f"成功释放环境 {env_id}")
    output_result(ctx, result)


@cli.command()
@persist_data
def check_expired(ctx: Context):
    """检查并释放过期租约"""
    expired = ctx.manager.check_expired_leases()

    if not expired:
        print_success(ctx, "没有发现过期租约")
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

    print_warning(ctx, f"发现 {len(expired)} 个过期租约，已自动释放")
    output_result(ctx, {
        'expired_count': len(expired),
        'leases': [l.model_dump() for l in expired]
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
        print_warning(ctx, "没有租约历史记录")
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
        'history': [l.model_dump() for l in history]
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
        print_warning(ctx, "没有可续租的环境")
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

    print_success(ctx, f"找到 {len(renewables)} 个可续租的环境")
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
        print_success(ctx, "没有需要释放的环境")
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

    print_warning(ctx, f"找到 {len(should_release)} 个应该释放的环境")
    output_result(ctx, {'count': len(should_release), 'should_release': should_release}, table_data)


@cli.command()
@persist_data
def reset(ctx: Context):
    """重置所有环境状态（清空租约数据）"""
    for env in ctx.manager.environments.values():
        env.status = EnvironmentStatus.AVAILABLE
        env.current_lease = None
        env.lease_history = []
    ctx.manager.leases = {}
    ctx.manager.request_ids = set()
    print_success(ctx, "所有环境状态已重置")
    output_result(ctx, {'reset': True, 'message': '所有环境状态已重置'})


@cli.command()
@pass_context
def available(ctx: Context):
    """列出所有可用环境"""
    report = ctx.manager.get_occupancy_report()
    available_envs = [e for e in report['environments'] if e['status'] == 'available']

    if not available_envs:
        print_warning(ctx, "没有可用环境！所有环境都被占用了")
        output_result(ctx, {'count': 0, 'available': []})
        return

    table_data = []
    for env in available_envs:
        table_data.append({
            '环境ID': env['env_id'],
            '状态': '可用'
        })

    print_success(ctx, f"找到 {len(available_envs)} 个可用环境")
    output_result(ctx, {'count': len(available_envs), 'available': available_envs}, table_data)
