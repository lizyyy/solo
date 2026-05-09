import click

from ..database import get_db
from ..models import UserRole
from ..exceptions import EventManagerException
from ..utils import format_datetime

from .cli import print_table, pass_context, Context

@click.group()
def user_cli():
    """用户管理"""
    pass

@user_cli.command('create')
@click.option('--username', required=True, help='用户名')
@click.option('--password', required=True, help='密码')
@click.option('--email', default=None, help='邮箱')
@click.option('--full-name', default=None, help='姓名')
@click.option('--role', type=click.Choice(['admin', 'organizer', 'volunteer']), default='volunteer', help='角色')
@pass_context
def create_user(ctx: Context, username, password, email, full_name, role):
    """创建用户"""
    from ..services.user_service import UserService
    
    with get_db() as db:
        try:
            user_service = UserService(db, ctx.current_user)
            user = user_service.create_user(
                username=username,
                password=password,
                email=email,
                full_name=full_name,
                role=UserRole(role)
            )
            click.secho(f'用户创建成功: {user.username} (ID: {user.id})', fg='green')
        except EventManagerException as e:
            click.secho(f'创建失败: {e}', fg='red', err=True)
            raise click.Abort()

@user_cli.command('list')
@click.option('--role', type=click.Choice(['admin', 'organizer', 'volunteer']), default=None, help='按角色筛选')
@click.option('--all', 'show_all', is_flag=True, help='显示所有用户（包括已禁用）')
@pass_context
def list_users(ctx: Context, role, show_all):
    """列出用户"""
    from ..services.user_service import UserService
    
    with get_db() as db:
        user_service = UserService(db, ctx.current_user)
        users = user_service.list_users(
            role=UserRole(role) if role else None,
            active_only=not show_all
        )
        
        headers = ['ID', '用户名', '姓名', '邮箱', '角色', '状态', '创建时间']
        rows = [
            [u.id, u.username, u.full_name or '-', u.email or '-', u.role.value, 
             '活跃' if u.is_active else '禁用', format_datetime(u.created_at)]
            for u in users
        ]
        print_table(headers, rows)
        click.echo(f'\n共 {len(users)} 个用户')

@user_cli.command('deactivate')
@click.argument('user_id', type=int)
@pass_context
def deactivate_user(ctx: Context, user_id):
    """禁用用户"""
    from ..services.user_service import UserService
    
    with get_db() as db:
        try:
            user_service = UserService(db, ctx.current_user)
            user = user_service.deactivate_user(user_id)
            click.secho(f'用户已禁用: {user.username}', fg='green')
        except EventManagerException as e:
            click.secho(f'操作失败: {e}', fg='red', err=True)
            raise click.Abort()
