from typing import Callable, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type, before_sleep_log

from ..config import config
from ..models import FailedOperation, User
from ..logger import log_error, log_action
from ..exceptions import EventManagerException

class RetryService:
    def __init__(self, db: Session, current_user: User = None):
        self.db = db
        self.current_user = current_user

    def record_failure(self, operation_type: str, error_message: str, resource_type: str = None, resource_id: int = None, input_data: dict = None):
        failed_op = FailedOperation(
            operation_type=operation_type,
            resource_type=resource_type,
            resource_id=resource_id,
            input_data=input_data,
            error_message=error_message,
            retry_count=0
        )
        self.db.add(failed_op)
        self.db.commit()
        self.db.refresh(failed_op)
        
        log_error('operation_failed', {
            'operation_type': operation_type,
            'resource_type': resource_type,
            'resource_id': resource_id,
            'error': error_message
        }, user_id=self.current_user.id if self.current_user else None, resource_type=resource_type, resource_id=resource_id)
        
        return failed_op

    def get_failed_operations(self, operation_type: str = None, unresolved_only: bool = True, limit: int = 100) -> list:
        query = self.db.query(FailedOperation)
        if operation_type:
            query = query.filter(FailedOperation.operation_type == operation_type)
        if unresolved_only:
            query = query.filter(FailedOperation.resolved == False)
        return query.order_by(FailedOperation.created_at.desc()).limit(limit).all()

    def mark_resolved(self, failed_op_id: int) -> FailedOperation:
        failed_op = self.db.query(FailedOperation).filter(FailedOperation.id == failed_op_id).first()
        if not failed_op:
            return None
        
        failed_op.resolved = True
        failed_op.resolved_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(failed_op)
        
        log_action('resolve_failed_operation', {
            'failed_op_id': failed_op_id,
            'operation_type': failed_op.operation_type
        }, user_id=self.current_user.id if self.current_user else None)
        
        return failed_op

def with_retry(
    operation_type: str,
    max_attempts: int = None,
    retry_exceptions: tuple = (EventManagerException,),
    resource_type: str = None,
    record_failure: bool = True
):
    max_attempts = max_attempts or config.MAX_RETRIES
    
    def decorator(func: Callable) -> Callable:
        @retry(
            stop=stop_after_attempt(max_attempts),
            wait=wait_exponential(multiplier=1, min=1, max=10),
            retry=retry_if_exception_type(retry_exceptions)
        )
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                if record_failure:
                    db_session = None
                    current_user = None
                    
                    if args:
                        first_arg = args[0]
                        if hasattr(first_arg, 'db'):
                            db_session = first_arg.db
                        if hasattr(first_arg, 'current_user'):
                            current_user = first_arg.current_user
                    
                    if db_session:
                        retry_service = RetryService(db_session, current_user)
                        retry_service.record_failure(
                            operation_type=operation_type,
                            error_message=str(e),
                            resource_type=resource_type,
                            input_data={'args': str(args), 'kwargs': str(kwargs)}
                        )
                raise
        
        return wrapper
    return decorator
