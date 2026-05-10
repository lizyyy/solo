import click

from ..database import get_db
from ..models import LogLevel, FailedOperation
from ..utils import format_datetime

from .utils import print_table, pass_context, Context

@click.group()
def log_cli():
    """日志和错误管理"""
    pass

@log_cli.command('audit')
@click.option('--action', default=None, help='按操作类型筛选')
@click.option('--resource-type', 'resource_type', default=None, help='按资源类型筛选')
@click.option('--level', type=click.Choice(['debug', 'info', 'warning', 'error']), default=None, help='按日志级别筛选')
@click.option('--limit', type=int, default=100, help='显示条数')
@pass_context
def show_audit_logs(ctx: Context, action, resource_type, level, limit):
    """查看审计日志"""
    from ..models import AuditLog
    
    with get_db() as db:
        query = db.query(AuditLog)
        
        if action:
            query = query.filter(AuditLog.action.like(f'%{action}%'))
        if resource_type:
            query = query.filter(AuditLog.resource_type == resource_type)
        if level:
            query = query.filter(AuditLog.level == LogLevel(level))
        
        logs = query.order_by(AuditLog.created_at.desc()).limit(limit).all()
        
        if not logs:
            click.echo('没有日志记录')
            return
        
        headers = ['时间', '级别', '操作', '资源', '资源ID', '用户ID']
        rows = [
            [format_datetime(log.created_at), log.level.value, log.action[:30], 
             log.resource_type or '-', log.resource_id or '-', log.user_id or '-']
            for log in logs
        ]
        print_table(headers, rows)
        click.echo(f'\n共显示 {len(logs)} 条日志')

@log_cli.command('details')
@click.argument('log_id', type=int)
@pass_context
def show_log_details(ctx: Context, log_id):
    """查看日志详情"""
    from ..models import AuditLog
    import json
    
    with get_db() as db:
        log = db.query(AuditLog).filter(AuditLog.id == log_id).first()
        
        if not log:
            click.secho(f'日志不存在: {log_id}', fg='red', err=True)
            raise click.Abort()
        
        click.echo(f'\n=== 日志详情 ===')
        click.echo(f'ID: {log.id}')
        click.echo(f'时间: {format_datetime(log.created_at)}')
        click.echo(f'级别: {log.level.value}')
        click.echo(f'操作: {log.action}')
        click.echo(f'资源类型: {log.resource_type or "-"}')
        click.echo(f'资源ID: {log.resource_id or "-"}')
        click.echo(f'用户ID: {log.user_id or "-"}')
        
        if log.details:
            click.echo(f'\n详细信息:')
            click.echo(json.dumps(log.details, ensure_ascii=False, indent=2))

@log_cli.group()
def failed():
    """失败操作管理"""
    pass

@failed.command('list')
@click.option('--type', 'op_type', default=None, help='按操作类型筛选')
@click.option('--all', 'show_all', is_flag=True, help='显示已解决的操作')
@click.option('--limit', type=int, default=50, help='显示条数')
@pass_context
def list_failed(ctx: Context, op_type, show_all, limit):
    """列出失败操作"""
    with get_db() as db:
        query = db.query(FailedOperation)
        
        if op_type:
            query = query.filter(FailedOperation.operation_type.like(f'%{op_type}%'))
        if not show_all:
            query = query.filter(FailedOperation.resolved == False)
        
        failed_ops = query.order_by(FailedOperation.created_at.desc()).limit(limit).all()
        
        if not failed_ops:
            click.echo('没有失败的操作')
            return
        
        headers = ['ID', '操作类型', '资源', '重试次数', '状态', '创建时间']
        rows = [
            [op.id, op.operation_type[:30], op.resource_type or '-', 
             op.retry_count, '已解决' if op.resolved else '未解决', format_datetime(op.created_at)]
            for op in failed_ops
        ]
        print_table(headers, rows)
        click.echo(f'\n共 {len(failed_ops)} 条失败操作')

@failed.command('show')
@click.argument('failed_id', type=int)
@pass_context
def show_failed(ctx: Context, failed_id):
    """查看失败操作详情"""
    import json
    
    with get_db() as db:
        failed_op = db.query(FailedOperation).filter(FailedOperation.id == failed_id).first()
        
        if not failed_op:
            click.secho(f'失败操作不存在: {failed_id}', fg='red', err=True)
            raise click.Abort()
        
        click.echo(f'\n=== 失败操作详情 ===')
        click.echo(f'ID: {failed_op.id}')
        click.echo(f'操作类型: {failed_op.operation_type}')
        click.echo(f'资源类型: {failed_op.resource_type or "-"}')
        click.echo(f'资源ID: {failed_op.resource_id or "-"}')
        click.echo(f'错误信息: {failed_op.error_message}')
        click.echo(f'重试次数: {failed_op.retry_count}')
        click.echo(f'状态: {"已解决" if failed_op.resolved else "未解决"}')
        click.echo(f'创建时间: {format_datetime(failed_op.created_at)}')
        
        if failed_op.input_data:
            click.echo(f'\n输入数据:')
            try:
                click.echo(json.dumps(failed_op.input_data, ensure_ascii=False, indent=2))
            except:
                click.echo(str(failed_op.input_data))

@failed.command('resolve')
@click.argument('failed_id', type=int)
@pass_context
def resolve_failed(ctx: Context, failed_id):
    """标记失败操作为已解决"""
    from ..services.retry_service import RetryService
    
    with get_db() as db:
        retry_service = RetryService(db, ctx.current_user)
        result = retry_service.mark_resolved(failed_id)
        
        if result:
            click.secho(f'失败操作已标记为已解决: {failed_id}', fg='green')
        else:
            click.secho(f'失败操作不存在: {failed_id}', fg='red', err=True)
            raise click.Abort()
