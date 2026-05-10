import click

from ..database import get_db
from ..models import RegistrationStatus
from ..exceptions import EventManagerException
from ..utils import format_datetime

from .utils import print_table, print_json, pass_context, Context

@click.group()
def reg_cli():
    """报名管理"""
    pass

@reg_cli.command('create')
@click.option('--event-id', 'event_id', type=int, required=True, help='活动ID')
@click.option('--name', 'participant_name', required=True, help='参与者姓名')
@click.option('--email', 'participant_email', default=None, help='参与者邮箱')
@click.option('--phone', 'participant_phone', default=None, help='参与者电话')
@click.option('--notes', default=None, help='备注')
@pass_context
def create_registration(ctx: Context, event_id, participant_name, participant_email, participant_phone, notes):
    """创建报名"""
    from ..services.registration_service import RegistrationService
    
    with get_db() as db:
        try:
            reg_service = RegistrationService(db, ctx.current_user)
            reg = reg_service.create_registration(
                event_id=event_id,
                participant_name=participant_name,
                participant_email=participant_email,
                participant_phone=participant_phone,
                notes=notes
            )
            click.secho(f'报名创建成功: {reg.participant_name} (ID: {reg.id})', fg='green')
        except EventManagerException as e:
            click.secho(f'创建失败: {e}', fg='red', err=True)
            raise click.Abort()

@reg_cli.command('list')
@click.option('--event-id', 'event_id', type=int, default=None, help='按活动筛选')
@click.option('--status', type=click.Choice(['pending', 'confirmed', 'cancelled', 'completed', 'no_show']), default=None, help='按状态筛选')
@click.option('--name', default=None, help='按姓名搜索')
@pass_context
def list_registrations(ctx: Context, event_id, status, name):
    """列出报名"""
    from ..services.registration_service import RegistrationService
    
    with get_db() as db:
        reg_service = RegistrationService(db, ctx.current_user)
        registrations = reg_service.list_registrations(
            event_id=event_id,
            status=RegistrationStatus(status) if status else None,
            participant_name=name
        )
        
        headers = ['ID', '活动ID', '姓名', '邮箱', '电话', '状态', '创建时间']
        rows = [
            [r.id, r.event_id, r.participant_name[:20], r.participant_email or '-', 
             r.participant_phone or '-', r.status.value, format_datetime(r.created_at)]
            for r in registrations
        ]
        print_table(headers, rows)
        click.echo(f'\n共 {len(registrations)} 条报名')

@reg_cli.command('show')
@click.argument('registration_id', type=int)
@pass_context
def show_registration(ctx: Context, registration_id):
    """显示报名详情"""
    from ..services.registration_service import RegistrationService
    
    with get_db() as db:
        reg_service = RegistrationService(db, ctx.current_user)
        reg = reg_service.get_registration_by_id(registration_id)
        
        if not reg:
            click.secho(f'报名不存在: {registration_id}', fg='red', err=True)
            raise click.Abort()
        
        click.echo(f'\n=== 报名详情 ===')
        click.echo(f'ID: {reg.id}')
        click.echo(f'活动ID: {reg.event_id}')
        click.echo(f'用户ID: {reg.user_id}')
        click.echo(f'姓名: {reg.participant_name}')
        click.echo(f'邮箱: {reg.participant_email or "-"}')
        click.echo(f'电话: {reg.participant_phone or "-"}')
        click.echo(f'状态: {reg.status.value}')
        click.echo(f'备注: {reg.notes or "-"}')
        click.echo(f'创建时间: {format_datetime(reg.created_at)}')
        click.echo(f'更新时间: {format_datetime(reg.updated_at)}')
        
        if reg.extra_data:
            click.echo(f'\n额外数据:')
            print_json(reg.extra_data)

@reg_cli.command('update')
@click.argument('registration_id', type=int)
@click.option('--name', 'participant_name', default=None, help='参与者姓名')
@click.option('--email', 'participant_email', default=None, help='参与者邮箱')
@click.option('--phone', 'participant_phone', default=None, help='参与者电话')
@click.option('--notes', default=None, help='备注')
@click.option('--reason', default='更新报名信息', help='变更原因')
@pass_context
def update_registration(ctx: Context, registration_id, participant_name, participant_email, participant_phone, notes, reason):
    """更新报名"""
    from ..services.registration_service import RegistrationService
    
    kwargs = {}
    if participant_name is not None: kwargs['participant_name'] = participant_name
    if participant_email is not None: kwargs['participant_email'] = participant_email
    if participant_phone is not None: kwargs['participant_phone'] = participant_phone
    if notes is not None: kwargs['notes'] = notes
    
    if not kwargs:
        click.secho('未指定任何更新字段', fg='yellow')
        return
    
    with get_db() as db:
        try:
            reg_service = RegistrationService(db, ctx.current_user)
            reg = reg_service.update_registration(registration_id, change_reason=reason, **kwargs)
            click.secho(f'报名已更新: {reg.participant_name}', fg='green')
        except EventManagerException as e:
            click.secho(f'更新失败: {e}', fg='red', err=True)
            raise click.Abort()

@reg_cli.command('status')
@click.argument('registration_id', type=int)
@click.option('--to', 'new_status', type=click.Choice(['pending', 'confirmed', 'cancelled', 'completed', 'no_show']), required=True, help='新状态')
@click.option('--reason', default=None, help='变更原因')
@pass_context
def change_status(ctx: Context, registration_id, new_status, reason):
    """更改报名状态"""
    from ..services.registration_service import RegistrationService
    
    with get_db() as db:
        try:
            reg_service = RegistrationService(db, ctx.current_user)
            reg = reg_service.change_status(registration_id, RegistrationStatus(new_status), reason)
            click.secho(f'报名状态已更新: {reg.status.value}', fg='green')
        except EventManagerException as e:
            click.secho(f'状态变更失败: {e}', fg='red', err=True)
            raise click.Abort()

@reg_cli.command('cancel')
@click.argument('registration_id', type=int)
@click.option('--reason', default=None, help='取消原因')
@pass_context
def cancel_registration(ctx: Context, registration_id, reason):
    """取消报名"""
    from ..services.registration_service import RegistrationService
    
    with get_db() as db:
        try:
            reg_service = RegistrationService(db, ctx.current_user)
            reg = reg_service.cancel_registration(registration_id, reason)
            click.secho(f'报名已取消: {reg.id}', fg='green')
        except EventManagerException as e:
            click.secho(f'取消失败: {e}', fg='red', err=True)
            raise click.Abort()

@reg_cli.command('versions')
@click.argument('registration_id', type=int)
@pass_context
def list_versions(ctx: Context, registration_id):
    """查看报名历史版本"""
    from ..services.registration_service import RegistrationService
    
    with get_db() as db:
        reg_service = RegistrationService(db, ctx.current_user)
        versions = reg_service.get_versions(registration_id)
        
        if not versions:
            click.echo('没有历史版本')
            return
        
        headers = ['版本', '姓名', '状态', '变更原因', '变更时间']
        rows = [
            [v.version_number, v.participant_name[:20], v.status.value, 
             v.change_reason or '-', format_datetime(v.created_at)]
            for v in versions
        ]
        print_table(headers, rows)
        click.echo(f'\n共 {len(versions)} 个历史版本')
