from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, Dict, Any
from app.models import OperationHistory, OperationType
from app.services.base_service import BaseService


class HistoryService(BaseService[OperationHistory]):
    def __init__(self):
        super().__init__(OperationHistory)
    
    def record_operation(
        self,
        db: Session,
        approval_id: int,
        operation_type: OperationType,
        operator: str,
        operator_role: Optional[str] = None,
        old_status: Optional[str] = None,
        new_status: Optional[str] = None,
        description: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> OperationHistory:
        history = OperationHistory(
            approval_id=approval_id,
            operation_type=operation_type,
            operator=operator,
            operator_role=operator_role,
            old_status=old_status,
            new_status=new_status,
            description=description,
            details=details
        )
        db.add(history)
        db.commit()
        db.refresh(history)
        return history
    
    def get_approval_history(self, db: Session, approval_id: int) -> list:
        return (
            db.query(OperationHistory)
            .filter(OperationHistory.approval_id == approval_id)
            .order_by(OperationHistory.created_at.desc())
            .all()
        )
    
    def get_by_operator(self, db: Session, operator: str) -> list:
        return (
            db.query(OperationHistory)
            .filter(OperationHistory.operator == operator)
            .order_by(OperationHistory.created_at.desc())
            .all()
        )


history_service = HistoryService()
