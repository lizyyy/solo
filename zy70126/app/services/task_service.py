from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Callable, List
from uuid import uuid4
import traceback
from app.models import BackgroundTask, TaskStatus, OutboundApproval, OperationType
from app.services.base_service import BaseService
from app.services.history_service import history_service
from app.config import settings


class TaskService(BaseService[BackgroundTask]):
    def __init__(self):
        super().__init__(BackgroundTask)
        self._task_handlers: Dict[str, Callable] = {}
    
    def _generate_task_id(self) -> str:
        return f"TASK-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid4().hex[:8].upper()}"
    
    def register_handler(self, task_type: str, handler: Callable):
        self._task_handlers[task_type] = handler
    
    def create_task(
        self, 
        db: Session, 
        task_type: str, 
        payload: Optional[Dict[str, Any]] = None,
        approval_id: Optional[int] = None,
        max_attempts: Optional[int] = None
    ) -> BackgroundTask:
        task = BackgroundTask(
            task_id=self._generate_task_id(),
            task_type=task_type,
            approval_id=approval_id,
            status=TaskStatus.PENDING,
            attempts=0,
            max_attempts=max_attempts or settings.RETRY_MAX_ATTEMPTS,
            payload=payload
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return task
    
    def execute_task(self, db: Session, task: BackgroundTask) -> bool:
        if task.status not in [TaskStatus.PENDING, TaskStatus.FAILED, TaskStatus.RETRYING]:
            return False
        
        handler = self._task_handlers.get(task.task_type)
        if not handler:
            self._mark_task_failed(
                db, task, 
                error_message=f"未找到任务类型 {task.task_type} 的处理器",
                error_trace=""
            )
            return False
        
        task.status = TaskStatus.RUNNING
        task.started_at = datetime.now()
        task.attempts += 1
        task.last_attempt_at = datetime.now()
        db.commit()
        
        try:
            result = handler(db, task.payload, task.approval_id)
            self._mark_task_success(db, task, result)
            return True
        except Exception as e:
            error_trace = traceback.format_exc()
            self._handle_task_failure(db, task, str(e), error_trace)
            return False
    
    def _mark_task_success(self, db: Session, task: BackgroundTask, result: Any):
        task.status = TaskStatus.SUCCESS
        task.completed_at = datetime.now()
        task.result = {'success': True, 'data': result}
        task.next_retry_at = None
        db.commit()
        
        if task.approval_id:
            history_service.record_operation(
                db=db,
                approval_id=task.approval_id,
                operation_type=OperationType.RETRY,
                operator='系统',
                operator_role='后台任务',
                description=f'后台任务执行成功: {task.task_type}',
                details={
                    'task_id': task.task_id,
                    'attempts': task.attempts
                }
            )
    
    def _handle_task_failure(self, db: Session, task: BackgroundTask, error_message: str, error_trace: str):
        can_retry = task.attempts < task.max_attempts
        
        if can_retry:
            task.status = TaskStatus.RETRYING
            task.next_retry_at = datetime.now() + timedelta(seconds=settings.RETRY_DELAY_SECONDS)
            task.error_message = error_message
            task.error_trace = error_trace
            db.commit()
            
            if task.approval_id:
                history_service.record_operation(
                    db=db,
                    approval_id=task.approval_id,
                    operation_type=OperationType.RETRY,
                    operator='系统',
                    operator_role='后台任务',
                    description=f'后台任务失败，准备第 {task.attempts + 1} 次重试',
                    details={
                        'task_id': task.task_id,
                        'attempt': task.attempts,
                        'error_message': error_message,
                        'next_retry_at': task.next_retry_at.isoformat() if task.next_retry_at else None
                    }
                )
        else:
            self._mark_task_failed(db, task, error_message, error_trace)
    
    def _mark_task_failed(self, db: Session, task: BackgroundTask, error_message: str, error_trace: str):
        task.status = TaskStatus.FAILED
        task.completed_at = datetime.now()
        task.error_message = error_message
        task.error_trace = error_trace
        task.next_retry_at = None
        db.commit()
        
        if task.approval_id:
            history_service.record_operation(
                db=db,
                approval_id=task.approval_id,
                operation_type=OperationType.ROLLBACK,
                operator='系统',
                operator_role='后台任务',
                description=f'后台任务执行失败: {task.task_type}',
                details={
                    'task_id': task.task_id,
                    'attempts': task.attempts,
                    'error_message': error_message
                }
            )
    
    def retry_task(self, db: Session, task_id: str, operator: str, force: bool = False) -> BackgroundTask:
        task = self.get_by_field(db, 'task_id', task_id)
        if not task:
            raise ValueError(f"任务 {task_id} 不存在")
        
        if task.status == TaskStatus.SUCCESS and not force:
            raise ValueError("成功的任务不需要重试，使用 force=True 强制重试")
        
        if task.status == TaskStatus.RUNNING:
            raise ValueError("任务正在运行中，请稍后再试")
        
        task.status = TaskStatus.PENDING
        task.attempts = 0
        task.next_retry_at = None
        task.error_message = None
        task.error_trace = None
        task.started_at = None
        task.completed_at = None
        db.commit()
        db.refresh(task)
        
        if task.approval_id:
            history_service.record_operation(
                db=db,
                approval_id=task.approval_id,
                operation_type=OperationType.RETRY,
                operator=operator,
                operator_role='管理员',
                description=f'手动触发任务重试: {task.task_type}',
                details={
                    'task_id': task.task_id,
                    'force': force,
                    'manual': True
                }
            )
        
        return task
    
    def get_pending_tasks(self, db: Session) -> List[BackgroundTask]:
        now = datetime.now()
        return (
            db.query(BackgroundTask)
            .filter(
                (BackgroundTask.status == TaskStatus.PENDING) |
                (
                    (BackgroundTask.status == TaskStatus.RETRYING) &
                    (BackgroundTask.next_retry_at <= now)
                )
            )
            .order_by(BackgroundTask.created_at)
            .all()
        )
    
    def get_failed_tasks(self, db: Session, approval_id: Optional[int] = None) -> List[BackgroundTask]:
        query = db.query(BackgroundTask).filter(
            BackgroundTask.status == TaskStatus.FAILED
        )
        if approval_id:
            query = query.filter(BackgroundTask.approval_id == approval_id)
        return query.order_by(BackgroundTask.created_at.desc()).all()
    
    def get_all_tasks(self, db: Session, approval_id: Optional[int] = None, skip: int = 0, limit: int = 100) -> List[BackgroundTask]:
        query = db.query(BackgroundTask)
        if approval_id:
            query = query.filter(BackgroundTask.approval_id == approval_id)
        return query.order_by(BackgroundTask.created_at.desc()).offset(skip).limit(limit).all()
    
    def get_task_by_id(self, db: Session, task_id: str) -> Optional[BackgroundTask]:
        return self.get_by_field(db, 'task_id', task_id)


def init_default_handlers(task_service: TaskService):
    def handle_notify_insurance(db: Session, payload: Optional[Dict], approval_id: Optional[int]):
        if not approval_id:
            raise ValueError("缺少审批申请 ID")
        
        approval = db.query(OutboundApproval).filter(OutboundApproval.id == approval_id).first()
        if not approval:
            raise ValueError(f"审批申请 {approval_id} 不存在")
        
        if not approval.insurance:
            raise ValueError("审批申请没有保险单")
        
        return {
            'action': 'notify_insurance',
            'policy_no': approval.insurance.policy_no,
            'approval_no': approval.approval_no,
            'status': 'notified'
        }
    
    def handle_sync_transport(db: Session, payload: Optional[Dict], approval_id: Optional[int]):
        if not approval_id:
            raise ValueError("缺少审批申请 ID")
        
        approval = db.query(OutboundApproval).filter(OutboundApproval.id == approval_id).first()
        if not approval:
            raise ValueError(f"审批申请 {approval_id} 不存在")
        
        transport_count = len(approval.transport_records)
        
        return {
            'action': 'sync_transport',
            'approval_no': approval.approval_no,
            'transport_nodes': transport_count,
            'status': 'synced'
        }
    
    def handle_generate_report(db: Session, payload: Optional[Dict], approval_id: Optional[int]):
        if not approval_id:
            raise ValueError("缺少审批申请 ID")
        
        approval = db.query(OutboundApproval).filter(OutboundApproval.id == approval_id).first()
        if not approval:
            raise ValueError(f"审批申请 {approval_id} 不存在")
        
        if approval.status != 'completed':
            raise ValueError("只有已完成的审批才能生成报告")
        
        return {
            'action': 'generate_report',
            'approval_no': approval.approval_no,
            'status': 'generated',
            'report_url': f'/reports/{approval.approval_no}.pdf'
        }
    
    task_service.register_handler('notify_insurance', handle_notify_insurance)
    task_service.register_handler('sync_transport', handle_sync_transport)
    task_service.register_handler('generate_report', handle_generate_report)


task_service = TaskService()
init_default_handlers(task_service)
