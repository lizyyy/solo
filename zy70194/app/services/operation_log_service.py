from datetime import datetime
import uuid
from typing import Dict, Any, Optional

from app import db
from app.models import (
    OperationLog, OperationType,
    Inquiry, Quote, QuoteItem, QuoteVersion,
    BackgroundJob, ComparisonResult
)

class OperationLogService:
    @staticmethod
    def create_log(
        operation_type: OperationType,
        operation_by: str,
        inquiry_id: Optional[int] = None,
        quote_id: Optional[int] = None,
        before_snapshot: Optional[Dict[str, Any]] = None,
        after_snapshot: Optional[Dict[str, Any]] = None,
        change_fields: Optional[Dict[str, Any]] = None,
        change_reason: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        success: bool = True,
        error_message: Optional[str] = None
    ) -> OperationLog:
        log = OperationLog(
            log_id=str(uuid.uuid4()),
            inquiry_id=inquiry_id,
            quote_id=quote_id,
            operation_type=operation_type,
            operation_by=operation_by,
            operation_at=datetime.utcnow(),
            before_snapshot=before_snapshot,
            after_snapshot=after_snapshot,
            change_fields=change_fields or {},
            change_reason=change_reason,
            ip_address=ip_address,
            user_agent=user_agent,
            success=success,
            error_message=error_message
        )
        db.session.add(log)
        db.session.flush()
        return log
    
    @staticmethod
    def log_inquiry_operation(
        inquiry: Inquiry,
        operation_type: OperationType,
        operation_by: str,
        before_snapshot: Optional[Dict[str, Any]] = None,
        change_reason: Optional[str] = None,
        success: bool = True,
        error_message: Optional[str] = None
    ) -> OperationLog:
        after_snapshot = inquiry.to_dict() if success else None
        change_fields = OperationLogService._calculate_change_fields(before_snapshot, after_snapshot)
        
        return OperationLogService.create_log(
            operation_type=operation_type,
            operation_by=operation_by,
            inquiry_id=inquiry.id,
            before_snapshot=before_snapshot,
            after_snapshot=after_snapshot,
            change_fields=change_fields,
            change_reason=change_reason,
            success=success,
            error_message=error_message
        )
    
    @staticmethod
    def log_quote_operation(
        quote: Quote,
        operation_type: OperationType,
        operation_by: str,
        before_snapshot: Optional[Dict[str, Any]] = None,
        change_reason: Optional[str] = None,
        success: bool = True,
        error_message: Optional[str] = None
    ) -> OperationLog:
        after_snapshot = quote.to_dict(include_items=True) if success else None
        change_fields = OperationLogService._calculate_change_fields(before_snapshot, after_snapshot)
        
        return OperationLogService.create_log(
            operation_type=operation_type,
            operation_by=operation_by,
            inquiry_id=quote.inquiry_id,
            quote_id=quote.id,
            before_snapshot=before_snapshot,
            after_snapshot=after_snapshot,
            change_fields=change_fields,
            change_reason=change_reason,
            success=success,
            error_message=error_message
        )
    
    @staticmethod
    def _calculate_change_fields(
        before: Optional[Dict[str, Any]],
        after: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        if not before or not after:
            return {}
        
        changes = {}
        all_keys = set(before.keys()) | set(after.keys())
        
        for key in all_keys:
            if key in ['updated_at', 'created_at', 'items']:
                continue
            
            before_val = before.get(key)
            after_val = after.get(key)
            
            if before_val != after_val:
                changes[key] = {
                    'before': before_val,
                    'after': after_val
                }
        
        return changes
    
    @staticmethod
    def get_inquiry_logs(inquiry_id: int, limit: int = 100) -> list:
        logs = OperationLog.query.filter_by(
            inquiry_id=inquiry_id
        ).order_by(OperationLog.operation_at.desc()).limit(limit).all()
        return [log.to_dict() for log in logs]
    
    @staticmethod
    def get_quote_logs(quote_id: int, limit: int = 100) -> list:
        logs = OperationLog.query.filter_by(
            quote_id=quote_id
        ).order_by(OperationLog.operation_at.desc()).limit(limit).all()
        return [log.to_dict() for log in logs]
    
    @staticmethod
    def get_user_logs(operation_by: str, limit: int = 100) -> list:
        logs = OperationLog.query.filter_by(
            operation_by=operation_by
        ).order_by(OperationLog.operation_at.desc()).limit(limit).all()
        return [log.to_dict() for log in logs]
    
    @staticmethod
    def get_failed_operations(start_time: Optional[datetime] = None) -> list:
        query = OperationLog.query.filter_by(success=False)
        if start_time:
            query = query.filter(OperationLog.operation_at >= start_time)
        logs = query.order_by(OperationLog.operation_at.desc()).all()
        return [log.to_dict() for log in logs]
