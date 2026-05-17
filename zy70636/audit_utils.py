from sqlalchemy.orm import Session
from datetime import datetime
import json
from models import AuditLog as AuditModel, OperationType


def create_audit_log(db: Session, operation_type: str, 
                     original_data: dict = None, new_data: dict = None, 
                     operator: str = None, conclusion: str = None,
                     weighing_id: int = None, is_success: bool = True,
                     error_message: str = None):
    audit = AuditModel(
        weighing_id=weighing_id,
        operation_type=operation_type,
        original_data=json.dumps(original_data) if original_data else None,
        new_data=json.dumps(new_data) if new_data else None,
        operator=operator,
        conclusion=conclusion,
        is_success=1 if is_success else 0,
        error_message=error_message,
        created_at=datetime.utcnow()
    )
    db.add(audit)
    db.commit()
    return audit


def log_failed_operation(db: Session, operation_type: str, input_data: dict,
                         operator: str, error_message: str, weighing_id: int = None):
    create_audit_log(
        db=db,
        operation_type=operation_type,
        original_data=input_data,
        new_data=None,
        operator=operator,
        conclusion=f"操作失败: {error_message}",
        weighing_id=weighing_id,
        is_success=False,
        error_message=error_message
    )
