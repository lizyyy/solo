import click

from ..database import get_db
from ..models import EventStatus
from ..exceptions import EventManagerException
from ..utils import parse_datetime, format_datetime

from .cli import print_table, print_json, pass_context, Context

@click.group()
def event_cli():
    """活动管理"""
    pass

@event_cli.command('create')
@click.option('--title', required=True, help='活动标题')
@click.option('--start-time', 'start_time', required=True, help='开始时间 (YYYY-MM-DD HH:MM:SS)')
@click.option('--end-time', 'end_time', default=None, help='结束时间 (YYYY-MM-DD HH:MM:SS)')
@click.option('--location', default=None, help='活动地点')
@click.option('--description', default=None, help='活动描述')
@click.option('--max-participants', 'max_participants', type=int, default=None, help='最大参与人数')
@pass_context
def create_event(ctx: Context, title, start_time, end_time, location, description, max_participants):
    """创建活动"""
    from ..services.event_service import EventService
    
    with get_db() as db:
        try:
            event_service = EventService(db, ctx.current_user)
            event = event_service.create_event(
                title=title,
                start_time=parse_datetime(start_time),
                end_time=parse_datetime(end_time) if end_time else None,
                location=location,
                description=description,
                max_participants=max_participants
            )
            click.secho(f'活动创建成功: {event.title} (ID: {event.id})', fg='green')
        except EventManagerException as e:
            click.secho(f'创建失败: {e}', fg='red', err=True)
            raise click.Abort()

@event_cli.command('list')
@click.option('--status', type=click.Choice(['draft', 'published', 'ongoing', 'completed', 'cancelled']), default=None, help='按状态筛选')
@click.option('--include-draft', 'include_draft', is_flag=True, help='包含草稿活动')
@pass_context
def list_events(ctx: Context, status, include_draft):
    """列出活动"""
    from ..services.event_service import EventService
    
    with get_db() as db:
        event_service = EventService(db, ctx.current_user)
        events = event_service.list_events(
            status=EventStatus(status) if status else None,
            include_draft=include_draft
        )
        
        headers = ['ID', '标题', '地点', '开始时间', '最大人数', '状态']
        rows = [
            [e.id, e.title[:30], e.location or '-', format_datetime(e.start_time), 
             e.max_participants or '-', e.status.value]
            for e in events
        ]
        print_table(headers, rows)
        click.echo(f'\n共 {len(events)} 个活动')

@event_cli.command('show')
@click.argument('event_id', type=int)
@pass_context
def show_event(ctx: Context, event_id):
    """显示活动详情"""
    from ..services.event_service import EventService
    
    with get_db() as db:
        event_service = EventService(db, ctx.current_user)
        event = event_service.get_event_by_id(event_id)
        
        if not event:
            click.secho(f'活动不存在: {event_id}', fg='red', err=True)
            raise click.Abort()
        
        stats = event_service.get_registration_stats(event_id)
        
        click.echo(f'\n=== 活动详情 ===')
        click.echo(f'ID: {event.id}')
        click.echo(f'标题: {event.title}')
        click.echo(f'描述: {event.description or "-"}')
        click.echo(f'地点: {event.location or "-"}')
        click.echo(f'开始时间: {format_datetime(event.start_time)}')
        click.echo(f'结束时间: {format_datetime(event.end_time) if event.end_time else "-"}')
        click.echo(f'最大人数: {event.max_participants or "无限制"}')
        click.echo(f'状态: {event.status.value}')
        click.echo(f'创建者ID: {event.created_by}')
        click.echo(f'创建时间: {format_datetime(event.created_at)}')
        
        click.echo(f'\n=== 报名统计 ===')
        click.echo(f'总报名: {stats["total"]}')
        for status in ['pending', 'confirmed', 'cancelled', 'completed', 'no_show']:
            if stats.get(status):
                click.echo(f'  {status}: {stats[status]}')

@event_cli.command('update')
@click.argument('event_id', type=int)
@click.option('--title', default=None, help='活动标题')
@click.option('--start-time', 'start_time', default=None, help='开始时间')
@click.option('--end-time', 'end_time', default=None, help='结束时间')
@click.option('--location', default=None, help='活动地点')
@click.option('--description', default=None, help='活动描述')
@click.option('--max-participants', 'max_participants', type=int, default=None, help='最大参与人数')
@click.option('--reason', default='更新活动信息', help='变更原因')
@pass_context
def update_event(ctx: Context, event_id, title, start_time, end_time, location, description, max_participants, reason):
    """更新活动"""
    from ..services.event_service import EventService
    
    kwargs = {}
    if title is not None: kwargs['title'] = title
    if start_time is not None: kwargs['start_time'] = parse_datetime(start_time)
    if end_time is not None: kwargs['end_time'] = parse_datetime(end_time) if end_time else None
    if location is not None: kwargs['location'] = location
    if description is not None: kwargs['description'] = description
    if max_participants is not None: kwargs['max_participants'] = max_participants
    
    if not kwargs:
        click.secho('未指定任何更新字段', fg='yellow')
        return
    
    with get_db() as db:
        try:
            event_service = EventService(db, ctx.current_user)
            event = event_service.update_event(event_id, change_reason=reason, **kwargs)
            click.secho(f'活动已更新: {event.title}', fg='green')
        except EventManagerException as e:
            click.secho(f'更新失败: {e}', fg='red', err=True)
            raise click.Abort()

@event_cli.command('status')
@click.argument('event_id', type=int)
@click.option('--to', 'new_status', type=click.Choice(['draft', 'published', 'ongoing', 'completed', 'cancelled']), required=True, help='新状态')
@click.option('--reason', default=None, help='变更原因')
@pass_context
def change_status(ctx: Context, event_id, new_status, reason):
    """更改活动状态"""
    from ..services.event_service import EventService
    
    with get_db() as db:
        try:
            event_service = EventService(db, ctx.current_user)
            event = event_service.change_status(event_id, EventStatus(new_status), reason)
            click.secho(f'活动状态已更新: {event.status.value}', fg='green')
        except EventManagerException as e:
            click.secho(f'状态变更失败: {e}', fg='red', err=True)
            raise click.Abort()

@event_cli.command('versions')
@click.argument('event_id', type=int)
@pass_context
def list_versions(ctx: Context, event_id):
    """查看活动历史版本"""
    from ..services.event_service import EventService
    
    with get_db() as db:
        event_service = EventService(db, ctx.current_user)
        versions = event_service.get_versions(event_id)
        
        if not versions:
            click.echo('没有历史版本')
            return
        
        headers = ['版本', '标题', '状态', '变更原因', '变更时间']
        rows = [
            [v.version_number, v.title[:30], v.status.value, 
             v.change_reason or '-', format_datetime(v.created_at)]
            for v in versions
        ]
        print_table(headers, rows)
        click.echo(f'\n共 {len(versions)} 个历史版本')

@event_cli.command('delete')
@click.argument('event_id', type=int)
@click.option('--force', is_flag=True, help='强制删除（不确认）')
@pass_context
def delete_event(ctx: Context, event_id, force):
    """删除活动（只能删除草稿或已取消的活动）"""
    from ..services.event_service import EventService
    
    if not force:
        if not click.confirm(f'确定要删除活动 {event_id} 吗？此操作不可恢复'):
            return
    
    with get_db() as db:
        try:
            event_service = EventService(db, ctx.current_user)
            event_service.delete_event(event_id)
            click.secho(f'活动已删除: {event_id}', fg='green')
        except EventManagerException as e:
            click.secho(f'删除失败: {e}', fg='red', err=True)
            raise click.Abort()
