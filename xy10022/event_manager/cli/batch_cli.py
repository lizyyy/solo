import click

from ..database import get_db
from ..models import RegistrationStatus
from ..exceptions import EventManagerException, BatchOperationError
from ..utils import format_datetime

from .utils import print_table, pass_context, Context

@click.group()
def batch_cli():
    """批量操作"""
    pass

@batch_cli.command('confirm')
@click.argument('registration_ids', type=int, nargs=-1, required=True)
@click.option('--reason', default=None, help='确认原因')
@pass_context
def batch_confirm(ctx: Context, registration_ids, reason):
    """批量确认报名"""
    from ..services.batch_service import BatchService
    
    with get_db() as db:
        try:
            batch_service = BatchService(db, ctx.current_user)
            result = batch_service.batch_confirm_registrations(list(registration_ids), reason)
            
            click.secho(f'批量确认完成:', fg='green')
            click.echo(f'  成功: {result["successful_count"]} 条')
            click.echo(f'  失败: {result["failed_count"]} 条')
            
            if result['failed']:
                click.echo('\n失败详情:')
                for item in result['failed']:
                    click.echo(f'  ID {item["id"]}: {item["error"]}')
        except BatchOperationError as e:
            click.secho(f'批量操作部分失败:', fg='yellow')
            click.echo(f'  成功: {len(e.successful)} 条')
            click.echo(f'  失败: {len(e.failed)} 条')
        except EventManagerException as e:
            click.secho(f'批量操作失败: {e}', fg='red', err=True)
            raise click.Abort()

@batch_cli.command('cancel')
@click.argument('registration_ids', type=int, nargs=-1, required=True)
@click.option('--reason', default=None, help='取消原因')
@pass_context
def batch_cancel(ctx: Context, registration_ids, reason):
    """批量取消报名"""
    from ..services.batch_service import BatchService
    
    with get_db() as db:
        try:
            batch_service = BatchService(db, ctx.current_user)
            result = batch_service.batch_cancel_registrations(list(registration_ids), reason)
            
            click.secho(f'批量取消完成:', fg='green')
            click.echo(f'  成功: {result["successful_count"]} 条')
            click.echo(f'  失败: {result["failed_count"]} 条')
            
            if result['failed']:
                click.echo('\n失败详情:')
                for item in result['failed']:
                    click.echo(f'  ID {item["id"]}: {item["error"]}')
        except BatchOperationError as e:
            click.secho(f'批量操作部分失败:', fg='yellow')
        except EventManagerException as e:
            click.secho(f'批量操作失败: {e}', fg='red', err=True)
            raise click.Abort()

@batch_cli.command('import')
@click.option('--event-id', 'event_id', type=int, required=True, help='活动ID')
@click.option('--file', 'file_path', required=True, help='导入文件路径 (CSV或JSON)')
@pass_context
def batch_import(ctx: Context, event_id, file_path):
    """批量导入报名"""
    from ..services.batch_service import BatchService
    from ..services.import_export_service import ImportExportService
    from ..exceptions import ImportExportError
    
    try:
        content = ImportExportService.read_from_file(file_path)
    except ImportExportError as e:
        click.secho(f'读取文件失败: {e}', fg='red', err=True)
        raise click.Abort()
    
    try:
        if file_path.lower().endswith('.json'):
            registrations = ImportExportService.import_registrations_from_json(content)
        else:
            registrations = ImportExportService.import_registrations_from_csv(content)
    except ImportExportError as e:
        click.secho(f'解析文件失败: {e}', fg='red', err=True)
        raise click.Abort()
    
    click.echo(f'准备导入 {len(registrations)} 条报名...')
    
    with get_db() as db:
        try:
            batch_service = BatchService(db, ctx.current_user)
            result = batch_service.batch_import_registrations(event_id, registrations)
            
            click.secho(f'批量导入完成:', fg='green')
            click.echo(f'  成功: {result["successful_count"]} 条')
            click.echo(f'  失败: {result["failed_count"]} 条')
            
            if result['successful']:
                click.echo('\n成功导入的报名:')
                for item in result['successful'][:10]:
                    click.echo(f'  ID {item["id"]}: {item["participant_name"]}')
                if len(result['successful']) > 10:
                    click.echo(f'  ... 还有 {len(result["successful"]) - 10} 条')
            
            if result['failed']:
                click.echo('\n失败详情:')
                for item in result['failed'][:10]:
                    click.echo(f'  第 {item["index"] + 1} 行: {item["error"]}')
                if len(result['failed']) > 10:
                    click.echo(f'  ... 还有 {len(result["failed"]) - 10} 条')
        except EventManagerException as e:
            click.secho(f'批量导入失败: {e}', fg='red', err=True)
            raise click.Abort()

@batch_cli.command('status')
@click.argument('registration_ids', type=int, nargs=-1, required=True)
@click.option('--to', 'new_status', type=click.Choice(['pending', 'confirmed', 'cancelled', 'completed', 'no_show']), required=True, help='新状态')
@click.option('--reason', default=None, help='变更原因')
@pass_context
def batch_status(ctx: Context, registration_ids, new_status, reason):
    """批量更新报名状态"""
    from ..services.batch_service import BatchService
    
    with get_db() as db:
        try:
            batch_service = BatchService(db, ctx.current_user)
            result = batch_service.batch_update_registration_status(
                list(registration_ids), 
                RegistrationStatus(new_status), 
                reason
            )
            
            click.secho(f'批量更新状态完成:', fg='green')
            click.echo(f'  成功: {result["successful_count"]} 条')
            click.echo(f'  失败: {result["failed_count"]} 条')
            
            if result['failed']:
                click.echo('\n失败详情:')
                for item in result['failed']:
                    click.echo(f'  ID {item["id"]}: {item["error"]}')
        except BatchOperationError as e:
            click.secho(f'批量操作部分失败:', fg='yellow')
        except EventManagerException as e:
            click.secho(f'批量操作失败: {e}', fg='red', err=True)
            raise click.Abort()
