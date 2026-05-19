import json
import logging
from typing import Optional, Any
from sqlalchemy.orm import Session
from app.models import AuditLog
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DataMasker:
    SENSITIVE_FIELDS = {
        "phone": {"mask": lambda x: x[:3] + "****" + x[-2:] if len(x) > 5 else "****"},
        "contact_phone": {"mask": lambda x: x[:3] + "****" + x[-2:] if len(x) > 5 else "****"},
        "email": {"mask": lambda x: x[:2] + "****" + x[x.index("@"):] if "@" in x else "****"},
        "hashed_password": {"mask": lambda x: "***"},
        "password": {"mask": lambda x: "***"},
    }

    @classmethod
    def mask_value(cls, field: str, value: Any) -> Any:
        if value is None:
            return value
        if field in cls.SENSITIVE_FIELDS:
            return cls.SENSITIVE_FIELDS[field]["mask"](str(value))
        return value

    @classmethod
    def mask_dict(cls, data: dict) -> dict:
        if not isinstance(data, dict):
            return data
        masked = {}
        for key, value in data.items():
            if isinstance(value, dict):
                masked[key] = cls.mask_dict(value)
            elif isinstance(value, list):
                masked[key] = [cls.mask_dict(item) if isinstance(item, dict) else item for item in value]
            else:
                masked[key] = cls.mask_value(key, value)
        return masked

    @classmethod
    def mask_object(cls, obj: Any) -> Any:
        if hasattr(obj, '__dict__'):
            data = obj.__dict__.copy()
            return cls.mask_dict(data)
        return obj


class AuditLogger:
    def __init__(self, db: Session):
        self.db = db
        self.masker = DataMasker()

    def log_action(
        self,
        user_id: Optional[int],
        action: str,
        resource_type: str,
        resource_id: Optional[int],
        status: str,
        reason: str,
        request_data: Optional[dict] = None,
        response_data: Optional[dict] = None,
        ip_address: Optional[str] = None
    ) -> AuditLog:
        masked_request = self.masker.mask_dict(request_data) if request_data else None
        masked_response = self.masker.mask_dict(response_data) if response_data else None

        audit_log = AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            status=status,
            reason=reason,
            request_data=json.dumps(masked_request, ensure_ascii=False) if masked_request else None,
            response_data=json.dumps(masked_response, ensure_ascii=False) if masked_response else None,
            ip_address=ip_address
        )
        
        self.db.add(audit_log)
        self.db.flush()

        log_message = f"AUDIT [{status}] User={user_id}, Action={action}, Resource={resource_type}/{resource_id}, Reason={reason}"
        if status == "blocked":
            logger.warning(log_message)
        else:
            logger.info(log_message)

        return audit_log

    def log_rental_create(
        self,
        user_id: int,
        rental_id: int,
        passed: bool,
        reason: str,
        request_data: dict,
        ip_address: Optional[str] = None
    ) -> AuditLog:
        return self.log_action(
            user_id=user_id,
            action="create_rental",
            resource_type="rental",
            resource_id=rental_id,
            status="allowed" if passed else "blocked",
            reason=reason,
            request_data=request_data,
            ip_address=ip_address
        )

    def log_return_create(
        self,
        user_id: int,
        return_id: int,
        passed: bool,
        reason: str,
        request_data: dict,
        ip_address: Optional[str] = None
    ) -> AuditLog:
        return self.log_action(
            user_id=user_id,
            action="create_return",
            resource_type="return",
            resource_id=return_id,
            status="allowed" if passed else "blocked",
            reason=reason,
            request_data=request_data,
            ip_address=ip_address
        )

    def log_rollback(
        self,
        user_id: int,
        resource_type: str,
        resource_id: int,
        reason: str,
        request_data: Optional[dict] = None,
        ip_address: Optional[str] = None
    ) -> AuditLog:
        return self.log_action(
            user_id=user_id,
            action="rollback",
            resource_type=resource_type,
            resource_id=resource_id,
            status="allowed",
            reason=reason,
            request_data=request_data,
            ip_address=ip_address
        )
