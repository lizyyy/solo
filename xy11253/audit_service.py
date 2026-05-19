import json
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from models import AuditLog
from schemas import OperatorContext
from data_masking import DataMasking


class AuditService:
    def __init__(self, db: Session):
        self.db = db

    def log_operation(
        self,
        operation_type: str,
        operator_context: OperatorContext,
        result: str,
        reason: str = "",
        reference_type: Optional[str] = None,
        reference_id: Optional[str] = None,
        request_data: Optional[Dict[str, Any]] = None,
        response_data: Optional[Dict[str, Any]] = None
    ) -> AuditLog:
        request_str = json.dumps(request_data) if request_data else None
        response_str = json.dumps(response_data) if response_data else None

        if request_str:
            request_str = DataMasking.mask_log(request_str)
        if response_str:
            response_str = DataMasking.mask_log(response_str)

        audit_log = AuditLog(
            operation_type=operation_type,
            reference_type=reference_type,
            reference_id=reference_id,
            operator_role=operator_context.operator_role.value if operator_context.operator_role else None,
            operator_id=operator_context.operator_id,
            operator_name=operator_context.operator_name,
            result=result,
            reason=DataMasking.mask_log(reason),
            ip_address=operator_context.ip_address,
            user_agent=operator_context.user_agent,
            request_data=request_str,
            response_data=response_str,
            created_at=datetime.utcnow()
        )

        self.db.add(audit_log)
        self.db.commit()
        self.db.refresh(audit_log)
        return audit_log

    def query_logs(
        self,
        operation_type: Optional[str] = None,
        operator_id: Optional[str] = None,
        reference_id: Optional[str] = None,
        result: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 100
    ):
        query = self.db.query(AuditLog)

        if operation_type:
            query = query.filter(AuditLog.operation_type == operation_type)
        if operator_id:
            query = query.filter(AuditLog.operator_id == operator_id)
        if reference_id:
            query = query.filter(AuditLog.reference_id == reference_id)
        if result:
            query = query.filter(AuditLog.result == result)
        if start_time:
            query = query.filter(AuditLog.created_at >= start_time)
        if end_time:
            query = query.filter(AuditLog.created_at <= end_time)

        return query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
