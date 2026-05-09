import uuid
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, Optional, Tuple
from contextlib import contextmanager

from .models import (
    CompensationMessage, MessageStatus, ErrorCategory, 
    RetryRecord, RetryStrategy
)
from .database import QueueDatabase


class RetryStateMachine:
    def __init__(self, db: QueueDatabase):
        self.db = db
    
    def calculate_next_retry_time(self, 
                                   message: CompensationMessage, 
                                   strategy: RetryStrategy = RetryStrategy.EXPONENTIAL_BACKOFF,
                                   base_interval: int = 60) -> datetime:
        if strategy == RetryStrategy.IMMEDIATE:
            return datetime.now()
        elif strategy == RetryStrategy.FIXED_INTERVAL:
            return datetime.now() + timedelta(seconds=base_interval)
        else:
            delay = base_interval * (2 ** message.retry_count)
            return datetime.now() + timedelta(seconds=min(delay, 3600))
    
    @contextmanager
    def _retry_context(self, message: CompensationMessage):
        record = RetryRecord(
            id=str(uuid.uuid4()),
            message_id=message.id,
            attempt_number=message.retry_count + 1,
            status="started",
        )
        self.db.insert_retry_record(record)
        start_time = datetime.now()
        
        try:
            yield record
            duration = int((datetime.now() - start_time).total_seconds() * 1000)
            record.status = "success"
            record.finished_at = datetime.now()
            record.duration_ms = duration
            self._update_retry_record(record)
        except Exception as e:
            duration = int((datetime.now() - start_time).total_seconds() * 1000)
            record.status = "failed"
            record.error_message = str(e)
            record.finished_at = datetime.now()
            record.duration_ms = duration
            self._update_retry_record(record)
            raise
    
    def _update_retry_record(self, record: RetryRecord) -> None:
        with self.db._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE retry_records SET
                    status = ?,
                    error_message = ?,
                    error_stack = ?,
                    finished_at = ?,
                    duration_ms = ?
                WHERE id = ?
            """, (
                record.status,
                record.error_message,
                record.error_stack,
                record.finished_at.isoformat() if record.finished_at else None,
                record.duration_ms,
                record.id,
            ))
    
    def attempt_retry(self, 
                      message: CompensationMessage,
                      handler: Callable[[CompensationMessage], None],
                      strategy: RetryStrategy = RetryStrategy.EXPONENTIAL_BACKOFF) -> Tuple[bool, Optional[str]]:
        if not message.can_retry():
            message.status = MessageStatus.DEAD_LETTER
            self.db.update_message(message)
            return False, "已达最大重试次数，标记为死信"
        
        message.status = MessageStatus.RETRYING
        self.db.update_message(message)
        
        try:
            with self._retry_context(message):
                handler(message)
            
            message.status = MessageStatus.SUCCESS
            message.processed_at = datetime.now()
            self.db.update_message(message)
            
            return True, None
            
        except Exception as e:
            error_category = self._classify_error(str(e))
            message.increment_retry(
                error_message=str(e),
                error_stack=None,
                error_category=error_category
            )
            
            if message.can_retry():
                message.status = MessageStatus.PENDING
                message.next_retry_at = self.calculate_next_retry_time(message, strategy)
            else:
                message.status = MessageStatus.DEAD_LETTER
            
            self.db.update_message(message)
            return False, str(e)
    
    def _classify_error(self, error_msg: str) -> ErrorCategory:
        error_lower = error_msg.lower()
        
        network_keywords = ["connection", "network", "timeout", "socket", "dns", "refused"]
        if any(k in error_lower for k in network_keywords):
            if "timeout" in error_lower:
                return ErrorCategory.TIMEOUT
            return ErrorCategory.NETWORK_ERROR
        
        business_keywords = ["business", "validation", "invalid", "not found", "not exist", "already", "订单", "已存在", "不存在", "验证", "业务"]
        if any(k in error_lower for k in business_keywords):
            return ErrorCategory.BUSINESS_ERROR
        
        permission_keywords = ["permission", "unauthorized", "forbidden", "access denied"]
        if any(k in error_lower for k in permission_keywords):
            return ErrorCategory.PERMISSION_ERROR
        
        data_keywords = ["data", "parse", "format", "decode", "encode", "json"]
        if any(k in error_lower for k in data_keywords):
            return ErrorCategory.DATA_ERROR
        
        system_keywords = ["system", "internal", "server", "500", "exception", "panic"]
        if any(k in error_lower for k in system_keywords):
            return ErrorCategory.SYSTEM_ERROR
        
        return ErrorCategory.UNKNOWN
    
    def force_retry(self, message_id: str, reset_retry_count: bool = False) -> bool:
        message = self.db.get_message(message_id)
        if not message:
            return False
        
        if reset_retry_count:
            message.retry_count = 0
            message.first_failed_at = None
        
        message.status = MessageStatus.PENDING
        message.next_retry_at = datetime.now()
        self.db.update_message(message)
        return True
    
    def mark_as_dead_letter(self, message_id: str, reason: str) -> bool:
        message = self.db.get_message(message_id)
        if not message:
            return False
        
        message.status = MessageStatus.DEAD_LETTER
        message.last_error_message = reason
        message.updated_at = datetime.now()
        self.db.update_message(message)
        return True
    
    def mark_as_archived(self, message_id: str) -> bool:
        message = self.db.get_message(message_id)
        if not message:
            return False
        
        message.status = MessageStatus.ARCHIVED
        message.updated_at = datetime.now()
        self.db.update_message(message)
        return True
