import click
import json
from typing import Optional

from ..database import init_db, get_db
from ..config import config
from ..models import UserRole, EventStatus, RegistrationStatus
from ..exceptions import EventManagerException
from ..utils import parse_datetime, format_datetime

from .user_cli import user_cli
from .event_cli import event_cli
from .registration_cli import reg_cli
from .batch_cli import batch_cli
from .export_cli import export_cli
from .log_cli import log_cli

class Context:
    def __init__(self):
        self.current_user = None

pass_context = click.make_pass_decorator(Context, ensure=True)

@click.group()
@click.option('--username', '-u', help='用户名')
@click.option('--password', '-p', help='密码')
@click.version_option(version='1.0.0')
@pass_context
def cli(ctx: Context, username: Optional[str], password: Optional[str]):
    """活动报名表管理系统 - 完整的状态流转、日志记录和历史版本管理"""
    init_db()
    
    if username and password:
        from ..services.user_service import UserService
        with get_db() as db:
            user_service = UserService(db)
            user = user_service.authenticate(username, password)
            if not user:
                click.secho(f'登录失败: 用户名或密码错误', fg='red', err=True)
                raise click.Abort()
            ctx.current_user = user
            click.secho(f'已登录: {user.username} ({user.role.value})', fg='green')

cli.add_command(user_cli, name='user')
cli.add_command(event_cli, name='event')
cli.add_command(reg_cli, name='reg')
cli.add_command(batch_cli, name='batch')
cli.add_command(export_cli, name='export')
cli.add_command(log_cli, name='log')

@cli.command('init')
def init():
    """初始化数据库"""
    init_db()
    click.secho('数据库初始化完成', fg='green')

@cli.command('seed')
@pass_context
def seed(ctx: Context):
    """填充种子数据"""
    from ..seeders import seed_all
    with get_db() as db:
        try:
            stats = seed_all(db)
            click.secho('种子数据填充成功:', fg='green')
            for key, count in stats.items():
                click.echo(f'  {key}: {count} 条')
            click.secho('\n默认账号:', fg='cyan')
            click.echo(f'  admin / admin123 (管理员)')
            click.echo(f'  organizer / organizer123 (组织者)')
            click.echo(f'  volunteer / volunteer123 (志愿者)')
        except Exception as e:
            click.secho(f'填充失败: {e}', fg='red', err=True)
            raise click.Abort()

def print_table(headers, rows):
    if not rows:
        click.echo('没有数据')
        return
    
    widths = [len(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            widths[i] = max(widths[i], len(str(cell) if cell is not None else ''))
    
    header_line = '  '.join(f'{h:<{w}}' for h, w in zip(headers, widths))
    click.echo(header_line)
    click.echo('-' * len(header_line))
    
    for row in rows:
        line = '  '.join(f'{str(c) if c is not None else "":<{w}}' for c, w in zip(row, widths))
        click.echo(line)

def print_json(data):
    click.echo(json.dumps(data, ensure_ascii=False, indent=2, default=str))

__all__ = ['cli', 'print_table', 'print_json', 'pass_context', 'Context']
