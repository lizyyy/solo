from datetime import datetime, timedelta
import json
from app import db
from app.models import ExceptionRecord, PendingTask, Account, InstallmentPlan
from config import Config


class ExceptionService:
    
    @staticmethod
    def create_exception(
        exception_type,
        severity,
        title,
        description=None,
        source_data=None,
        account_id=None,
        plan_id=None
    ):
        if severity not in [
            ExceptionRecord.SEVERITY_CRITICAL,
            ExceptionRecord.SEVERITY_HIGH,
            ExceptionRecord.SEVERITY_MEDIUM,
            ExceptionRecord.SEVERITY_LOW
        ]:
            raise ValueError(f"Invalid severity: {severity}")
        
        exception = ExceptionRecord(
            account_id=account_id,
            plan_id=plan_id,
            exception_type=exception_type,
            severity=severity,
            title=title,
            description=description,
            source_data=json.dumps(source_data, ensure_ascii=False, default=str) if source_data else None
        )
        db.session.add(exception)
        db.session.commit()
        
        if severity in [ExceptionRecord.SEVERITY_CRITICAL, ExceptionRecord.SEVERITY_HIGH]:
            task = PendingTask(
                task_type=PendingTask.TYPE_MANUAL_REVIEW,
                account_id=account_id,
                plan_id=plan_id,
                title=f"异常调查: {title}",
                description=f"严重级别{severity}异常需要人工调查。详情: {description or '无描述'}",
                task_data=json.dumps({
                    'exception_id': exception.id,
                    'exception_type': exception_type,
                    'severity': severity
                })
            )
            db.session.add(task)
            db.session.commit()
        
        return exception
    
    @staticmethod
    def get_exceptions(
        account_id=None,
        plan_id=None,
        severity=None,
        status=None,
        exception_type=None,
        limit=100,
        offset=0
    ):
        query = ExceptionRecord.query
        
        if account_id:
            query = query.filter_by(account_id=account_id)
        if plan_id:
            query = query.filter_by(plan_id=plan_id)
        if severity:
            query = query.filter_by(severity=severity)
        if status:
            query = query.filter_by(status=status)
        if exception_type:
            query = query.filter_by(exception_type=exception_type)
        
        total = query.count()
        exceptions = query.order_by(
            ExceptionRecord.detected_at.desc()
        ).offset(offset).limit(limit).all()
        
        return {
            'total': total,
            'items': [e.to_dict() for e in exceptions]
        }
    
    @staticmethod
    def update_exception_status(exception_id, status, notes=None, investigation_notes=None):
        exception = ExceptionRecord.query.get(exception_id)
        if not exception:
            raise ValueError(f"Exception {exception_id} not found")
        
        if status not in [
            ExceptionRecord.STATUS_OPEN,
            ExceptionRecord.STATUS_INVESTIGATING,
            ExceptionRecord.STATUS_RESOLVED,
            ExceptionRecord.STATUS_IGNORED
        ]:
            raise ValueError(f"Invalid status: {status}")
        
        exception.status = status
        if notes:
            exception.resolution_notes = notes
        if investigation_notes:
            exception.investigation_notes = investigation_notes
        if status in [ExceptionRecord.STATUS_RESOLVED, ExceptionRecord.STATUS_IGNORED]:
            exception.resolved_at = datetime.utcnow()
        
        db.session.commit()
        return exception.to_dict()
    
    @staticmethod
    def get_exception_statistics():
        stats = {
            'total': ExceptionRecord.query.count(),
            'by_severity': {},
            'by_status': {},
            'unresolved_count': 0,
            'critical_count': 0,
            'high_count': 0
        }
        
        for severity in [
            ExceptionRecord.SEVERITY_CRITICAL,
            ExceptionRecord.SEVERITY_HIGH,
            ExceptionRecord.SEVERITY_MEDIUM,
            ExceptionRecord.SEVERITY_LOW
        ]:
            stats['by_severity'][severity] = ExceptionRecord.query.filter_by(
                severity=severity
            ).count()
        
        for status in [
            ExceptionRecord.STATUS_OPEN,
            ExceptionRecord.STATUS_INVESTIGATING,
            ExceptionRecord.STATUS_RESOLVED,
            ExceptionRecord.STATUS_IGNORED
        ]:
            stats['by_status'][status] = ExceptionRecord.query.filter_by(
                status=status
            ).count()
        
        stats['unresolved_count'] = stats['by_status'].get(ExceptionRecord.STATUS_OPEN, 0) + \
                                   stats['by_status'].get(ExceptionRecord.STATUS_INVESTIGATING, 0)
        stats['critical_count'] = stats['by_severity'].get(ExceptionRecord.SEVERITY_CRITICAL, 0)
        stats['high_count'] = stats['by_severity'].get(ExceptionRecord.SEVERITY_HIGH, 0)
        
        return stats
    
    @staticmethod
    def create_pending_task(
        task_type,
        title,
        description=None,
        task_data=None,
        account_id=None,
        plan_id=None,
        transaction_id=None,
        max_retries=3
    ):
        if task_type not in [
            PendingTask.TYPE_CREDIT_RESTORE,
            PendingTask.TYPE_REFUND_PROCESS,
            PendingTask.TYPE_FEE_ADJUSTMENT,
            PendingTask.TYPE_BILL_CORRECTION,
            PendingTask.TYPE_MANUAL_REVIEW
        ]:
            raise ValueError(f"Invalid task type: {task_type}")
        
        task = PendingTask(
            task_type=task_type,
            account_id=account_id,
            plan_id=plan_id,
            transaction_id=transaction_id,
            title=title,
            description=description,
            task_data=json.dumps(task_data, ensure_ascii=False, default=str) if task_data else None,
            max_retries=max_retries
        )
        db.session.add(task)
        db.session.commit()
        return task
    
    @staticmethod
    def get_pending_tasks(
        account_id=None,
        plan_id=None,
        task_type=None,
        status=None,
        limit=100,
        offset=0
    ):
        query = PendingTask.query
        
        if account_id:
            query = query.filter_by(account_id=account_id)
        if plan_id:
            query = query.filter_by(plan_id=plan_id)
        if task_type:
            query = query.filter_by(task_type=task_type)
        if status:
            query = query.filter_by(status=status)
        
        total = query.count()
        tasks = query.order_by(
            PendingTask.scheduled_at.asc(),
            PendingTask.created_at.desc()
        ).offset(offset).limit(limit).all()
        
        return {
            'total': total,
            'items': [t.to_dict() for t in tasks]
        }
    
    @staticmethod
    def update_task_status(task_id, status, error_message=None):
        task = PendingTask.query.get(task_id)
        if not task:
            raise ValueError(f"Pending task {task_id} not found")
        
        if status not in [
            PendingTask.STATUS_PENDING,
            PendingTask.STATUS_PROCESSING,
            PendingTask.STATUS_COMPLETED,
            PendingTask.STATUS_FAILED,
            PendingTask.STATUS_CANCELLED
        ]:
            raise ValueError(f"Invalid status: {status}")
        
        task.status = status
        if error_message:
            task.last_error = error_message
        
        if status == PendingTask.STATUS_PROCESSING:
            task.started_at = datetime.utcnow()
        elif status in [PendingTask.STATUS_COMPLETED, PendingTask.STATUS_CANCELLED]:
            task.completed_at = datetime.utcnow()
        elif status == PendingTask.STATUS_FAILED:
            task.retry_count += 1
        
        db.session.commit()
        return task.to_dict()
    
    @staticmethod
    def get_pending_task_statistics():
        stats = {
            'total': PendingTask.query.count(),
            'by_type': {},
            'by_status': {},
            'pending_count': 0,
            'failed_count': 0,
            'processing_count': 0
        }
        
        for task_type in [
            PendingTask.TYPE_CREDIT_RESTORE,
            PendingTask.TYPE_REFUND_PROCESS,
            PendingTask.TYPE_FEE_ADJUSTMENT,
            PendingTask.TYPE_BILL_CORRECTION,
            PendingTask.TYPE_MANUAL_REVIEW
        ]:
            stats['by_type'][task_type] = PendingTask.query.filter_by(
                task_type=task_type
            ).count()
        
        for status in [
            PendingTask.STATUS_PENDING,
            PendingTask.STATUS_PROCESSING,
            PendingTask.STATUS_COMPLETED,
            PendingTask.STATUS_FAILED,
            PendingTask.STATUS_CANCELLED
        ]:
            stats['by_status'][status] = PendingTask.query.filter_by(
                status=status
            ).count()
        
        stats['pending_count'] = stats['by_status'].get(PendingTask.STATUS_PENDING, 0)
        stats['processing_count'] = stats['by_status'].get(PendingTask.STATUS_PROCESSING, 0)
        stats['failed_count'] = stats['by_status'].get(PendingTask.STATUS_FAILED, 0)
        
        return stats
    
    @staticmethod
    def retry_failed_tasks(task_type=None):
        query = PendingTask.query.filter(
            PendingTask.status == PendingTask.STATUS_FAILED,
            PendingTask.retry_count < PendingTask.max_retries
        )
        
        if task_type:
            query = query.filter_by(task_type=task_type)
        
        tasks = query.all()
        retried_count = 0
        
        for task in tasks:
            task.status = PendingTask.STATUS_PENDING
            task.scheduled_at = datetime.utcnow()
            retried_count += 1
        
        db.session.commit()
        return {'retried_count': retried_count}
