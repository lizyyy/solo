import click
import time
from datetime import datetime, date
from ..database import get_session
from ..models import Batch, MedicineRecord, InspectionTask, AuditLog, TaskStatus, OperationType, RecordStatus
from ..utils import safe_str

def validate_record(record, today=None):
    errors = []
    today = today or date.today()
    
    if not safe_str(record.medicine_code):
        errors.append('药品编码为空')
    
    if not safe_str(record.medicine_name):
        errors.append('药品名称为空')
    
    if not safe_str(record.batch_number):
        errors.append('批号为空')
    
    if record.expiry_date is None:
        errors.append('有效期为空')
    else:
        days_to_expiry = (record.expiry_date - today).days
        if days_to_expiry <= 0:
            errors.append(f'已过期(过期{abs(days_to_expiry)}天)')
        elif days_to_expiry <= 30:
            errors.append(f'近效期预警({days_to_expiry}天后过期)')
    
    if record.quantity <= 0:
        errors.append('数量为0或负数')
    
    if record.production_date and record.expiry_date:
        if record.production_date > record.expiry_date:
            errors.append('生产日期晚于有效期')
    
    return errors

@click.command()
@click.option('--batch-no', help='批次号，不指定则校验所有未校验数据')
@click.option('--operator', required=True, help='操作人')
@click.option('--async/--sync', 'run_async', default=False, help='异步执行(后台任务)')
@click.option('--retry-failed', is_flag=True, help='重试之前失败的任务')
def check(batch_no, operator, run_async, retry_failed):
    """校验数据完整性和有效性"""
    session = get_session()
    
    try:
        query = session.query(MedicineRecord)
        if batch_no:
            batch = session.query(Batch).filter_by(batch_no=batch_no).first()
            if not batch:
                raise click.ClickException(f'批次不存在: {batch_no}')
            query = query.filter_by(batch_id=batch.id)
        
        if retry_failed:
            query = query.filter(MedicineRecord.status == RecordStatus.INVALID)
        else:
            query = query.filter(MedicineRecord.status == RecordStatus.RAW)
        
        records = query.all()
        
        if not records:
            click.echo('没有需要校验的数据')
            return
        
        task = InspectionTask(
            task_type='data_validation',
            status=TaskStatus.PENDING,
            total=len(records),
            operator=operator
        )
        if batch_no:
            task.batch_id = batch.id
        session.add(task)
        session.commit()
        
        if run_async:
            click.echo(f'任务已创建，ID: {task.id}')
            click.echo('使用 pharmacy-inspect tasks 查看任务状态')
            session.close()
            return
        
        task.status = TaskStatus.PROCESSING
        task.started_at = datetime.now()
        session.commit()
        
        valid_count = 0
        invalid_count = 0
        errors_summary = {}
        
        with click.progressbar(records, label='校验中') as bar:
            for record in bar:
                try:
                    errors = validate_record(record)
                    
                    if errors:
                        record.status = RecordStatus.INVALID
                        record.check_errors = '; '.join(errors)
                        invalid_count += 1
                        
                        for err in errors:
                            errors_summary[err] = errors_summary.get(err, 0) + 1
                    else:
                        record.status = RecordStatus.VALID
                        record.check_errors = None
                        valid_count += 1
                    
                    task.progress = valid_count + invalid_count
                    if (valid_count + invalid_count) % 10 == 0:
                        session.commit()
                        
                except Exception as e:
                    task.retry_count += 1
                    if task.retry_count >= task.max_retries:
                        task.status = TaskStatus.PERMANENT_FAILED
                        task.error_message = str(e)
                        session.commit()
                        raise click.ClickException(f'校验失败: {e}')
                    else:
                        task.status = TaskStatus.WAITING_RETRY
                        session.commit()
                        click.echo(f'\n遇到错误，{task.retry_count}/{task.max_retries} 秒后重试...')
                        time.sleep(task.retry_count)
                        task.status = TaskStatus.PROCESSING
                        session.commit()
        
        task.status = TaskStatus.COMPLETED
        task.completed_at = datetime.now()
        task.result_summary = f'校验完成: 有效{valid_count}条, 无效{invalid_count}条'
        
        audit = AuditLog(
            operation_type=OperationType.CHECK,
            operator=operator,
            change_reason=f'数据校验: {task.result_summary}'
        )
        session.add(audit)
        
        session.commit()
        
        click.echo(f'\n校验完成！')
        click.echo(f'  有效记录: {valid_count}')
        click.echo(f'  无效记录: {invalid_count}')
        
        if errors_summary:
            click.echo(f'\n错误统计:')
            for err, cnt in sorted(errors_summary.items(), key=lambda x: -x[1]):
                click.echo(f'  {err}: {cnt}条')
        
    except Exception as e:
        if 'task' in locals():
            task.status = TaskStatus.PERMANENT_FAILED
            task.error_message = str(e)
            session.commit()
        session.rollback()
        raise click.ClickException(f'校验失败: {str(e)}')
    finally:
        session.close()

@click.command('tasks')
@click.option('--status', help='按状态筛选')
def list_tasks(status):
    """查看任务列表"""
    session = get_session()
    
    try:
        query = session.query(InspectionTask).order_by(InspectionTask.created_at.desc())
        if status:
            query = query.filter_by(status=TaskStatus(status))
        
        tasks = query.limit(20).all()
        
        if not tasks:
            click.echo('没有任务记录')
            return
        
        click.echo(f'{"ID":<6} {"类型":<15} {"状态":<18} {"进度":<10} {"操作人":<10} {"创建时间"}')
        click.echo('-' * 80)
        for task in tasks:
            progress = f'{task.progress}/{task.total}' if task.total > 0 else '-'
            click.echo(f'{task.id:<6} {task.task_type:<15} {task.status.value:<18} {progress:<10} {task.operator or "-":<10} {task.created_at.strftime("%m-%d %H:%M")}')
        
    finally:
        session.close()

@click.command('retry-task')
@click.argument('task_id', type=int)
@click.option('--operator', required=True, help='操作人')
def retry_task(task_id, operator):
    """重试失败的任务"""
    session = get_session()
    
    try:
        task = session.query(InspectionTask).get(task_id)
        if not task:
            raise click.ClickException(f'任务不存在: {task_id}')
        
        if task.status not in [TaskStatus.WAITING_RETRY, TaskStatus.WAITING_MANUAL, TaskStatus.PERMANENT_FAILED]:
            raise click.ClickException(f'任务状态不支持重试: {task.status.value}')
        
        task.status = TaskStatus.PENDING
        task.retry_count = 0
        task.error_message = None
        session.commit()
        
        click.echo(f'任务 {task_id} 已重置为待处理状态')
        click.echo('运行 pharmacy-inspect check 执行校验')
        
    finally:
        session.close()
