import click

from ..database import get_db
from ..models import RegistrationStatus, EventStatus
from ..exceptions import EventManagerException
from ..utils import format_datetime

from .cli import print_table, pass_context, Context

@click.group()
def export_cli():
    """导入导出"""
    pass

@export_cli.command('registrations')
@click.option('--event-id', 'event_id', type=int, default=None, help='按活动筛选')
@click.option('--status', type=click.Choice(['pending', 'confirmed', 'cancelled', 'completed', 'no_show']), default=None, help='按状态筛选')
@click.option('--format', 'fmt', type=click.Choice(['csv', 'json']), default='csv', help='导出格式')
@click.option('--output', '-o', default=None, help='输出文件路径')
@pass_context
def export_registrations(ctx: Context, event_id, status, fmt, output):
    """导出报名数据"""
    from ..services.registration_service import RegistrationService
    from ..services.import_export_service import ImportExportService
    
    with get_db() as db:
        reg_service = RegistrationService(db, ctx.current_user)
        registrations = reg_service.list_registrations(
            event_id=event_id,
            status=RegistrationStatus(status) if status else None
        )
        
        if not registrations:
            click.echo('没有可导出的数据')
            return
        
        if fmt == 'json':
            content = ImportExportService.export_registrations_to_json(registrations)
        else:
            content = ImportExportService.export_registrations_to_csv(registrations)
        
        if output:
            try:
                ImportExportService.save_to_file(content, output)
                click.secho(f'已导出到: {output} ({len(registrations)} 条)', fg='green')
            except EventManagerException as e:
                click.secho(f'保存文件失败: {e}', fg='red', err=True)
                raise click.Abort()
        else:
            click.echo(content)
            click.echo(f'\n共 {len(registrations)} 条记录')

@export_cli.command('events')
@click.option('--status', type=click.Choice(['draft', 'published', 'ongoing', 'completed', 'cancelled']), default=None, help='按状态筛选')
@click.option('--format', 'fmt', type=click.Choice(['csv', 'json']), default='csv', help='导出格式')
@click.option('--output', '-o', default=None, help='输出文件路径')
@pass_context
def export_events(ctx: Context, status, fmt, output):
    """导出活动数据"""
    from ..services.event_service import EventService
    from ..services.import_export_service import ImportExportService
    import json
    
    with get_db() as db:
        event_service = EventService(db, ctx.current_user)
        events = event_service.list_events(
            status=EventStatus(status) if status else None,
            include_draft=True
        )
        
        if not events:
            click.echo('没有可导出的数据')
            return
        
        if fmt == 'json':
            data = []
            for event in events:
                data.append({
                    'id': event.id,
                    'title': event.title,
                    'description': event.description,
                    'location': event.location,
                    'start_time': format_datetime(event.start_time),
                    'end_time': format_datetime(event.end_time),
                    'max_participants': event.max_participants,
                    'status': event.status.value,
                    'created_by': event.created_by,
                    'created_at': format_datetime(event.created_at)
                })
            content = json.dumps(data, ensure_ascii=False, indent=2)
        else:
            content = ImportExportService.export_events_to_csv(events)
        
        if output:
            try:
                ImportExportService.save_to_file(content, output)
                click.secho(f'已导出到: {output} ({len(events)} 条)', fg='green')
            except EventManagerException as e:
                click.secho(f'保存文件失败: {e}', fg='red', err=True)
                raise click.Abort()
        else:
            click.echo(content)
            click.echo(f'\n共 {len(events)} 条记录')
