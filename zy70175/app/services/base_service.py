from datetime import datetime
from sqlalchemy.orm import Session
from app.models import OperationLog


class BaseService:
    def log_operation(
        self,
        db: Session,
        target_type: str,
        target_id: int,
        action: str,
        operator: str = None,
        reason: str = None,
        from_status: str = None,
        to_status: str = None,
    ):
        log = OperationLog(
            target_type=target_type,
            target_id=target_id,
            action=action,
            from_status=from_status,
            to_status=to_status,
            operator=operator,
            reason=reason,
        )
        db.add(log)
