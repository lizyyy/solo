from datetime import datetime
from typing import Dict, Any, Optional

from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import IdempotencyRecord, IdempotencyStatus, MessageMetadata
from ..exceptions import IdempotencyConflictError
from ..utils import generate_idempotency_key


class IdempotencyService:
    def __init__(self, db: Optional[Session] = None):
        self.db = db or SessionLocal()

    def close(self):
        if self.db:
            self.db.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def check_or_create(
        self,
        message: MessageMetadata,
        request_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not message.idempotency_key:
            idempotency_key = generate_idempotency_key(
                message.business_type or "unknown",
                message.business_id or message.message_id,
                message.message_id,
            )
        else:
            idempotency_key = message.idempotency_key

        existing = (
            self.db.query(IdempotencyRecord)
            .filter(IdempotencyRecord.idempotency_key == idempotency_key)
            .first()
        )

        if existing:
            if existing.status == IdempotencyStatus.SUCCESS:
                return {
                    "should_skip": True,
                    "reason": f"幂等键已存在且状态为【成功】，为保证幂等性跳过重放",
                    "existing_record": existing,
                }
            elif existing.status == IdempotencyStatus.PROCESSING:
                return {
                    "should_skip": True,
                    "reason": f"幂等键正在处理中，为避免重复操作跳过重放",
                    "existing_record": existing,
                }
            elif existing.status == IdempotencyStatus.FAILED:
                existing.status = IdempotencyStatus.PROCESSING
                existing.request_id = request_id
                existing.updated_at = datetime.utcnow()
                self.db.commit()
                self.db.refresh(existing)
                return {
                    "should_skip": False,
                    "reason": f"幂等键之前失败，准备重试",
                    "record": existing,
                    "is_retry": True,
                }

        record = IdempotencyRecord(
            idempotency_key=idempotency_key,
            business_type=message.business_type,
            business_id=message.business_id,
            message_id=message.message_id,
            request_id=request_id,
            status=IdempotencyStatus.PROCESSING,
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)

        return {
            "should_skip": False,
            "reason": "新幂等记录，允许重放",
            "record": record,
            "is_retry": False,
        }

    def mark_success(
        self,
        idempotency_key: str,
        result_data: Optional[Dict[str, Any]] = None,
    ) -> IdempotencyRecord:
        record = (
            self.db.query(IdempotencyRecord)
            .filter(IdempotencyRecord.idempotency_key == idempotency_key)
            .first()
        )
        if record:
            record.status = IdempotencyStatus.SUCCESS
            record.result_data = result_data
            record.processed_at = datetime.utcnow()
            record.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(record)
        return record

    def mark_failed(
        self,
        idempotency_key: str,
        error_message: str,
    ) -> IdempotencyRecord:
        record = (
            self.db.query(IdempotencyRecord)
            .filter(IdempotencyRecord.idempotency_key == idempotency_key)
            .first()
        )
        if record:
            record.status = IdempotencyStatus.FAILED
            record.error_message = error_message
            record.processed_at = datetime.utcnow()
            record.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(record)
        return record

    def get_status(self, idempotency_key: str) -> Optional[Dict[str, Any]]:
        record = (
            self.db.query(IdempotencyRecord)
            .filter(IdempotencyRecord.idempotency_key == idempotency_key)
            .first()
        )
        if not record:
            return None
        return {
            "idempotency_key": record.idempotency_key,
            "status": record.status,
            "message_id": record.message_id,
            "business_type": record.business_type,
            "business_id": record.business_id,
            "result_data": record.result_data,
            "error_message": record.error_message,
            "processed_at": record.processed_at,
        }

    def get_by_message_id(self, message_id: str) -> Optional[Dict[str, Any]]:
        record = (
            self.db.query(IdempotencyRecord)
            .filter(IdempotencyRecord.message_id == message_id)
            .first()
        )
        if not record:
            return None
        return {
            "idempotency_key": record.idempotency_key,
            "status": record.status,
            "message_id": record.message_id,
            "business_type": record.business_type,
            "business_id": record.business_id,
            "result_data": record.result_data,
            "error_message": record.error_message,
            "processed_at": record.processed_at,
        }
