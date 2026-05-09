import pytest
import tempfile
import os
from datetime import datetime, timedelta

from queue_inspector.core.database import QueueDatabase
from queue_inspector.core.models import (
    CompensationMessage, MessageStatus, ErrorCategory, RetryStrategy
)
from queue_inspector.core.state_machine import RetryStateMachine


@pytest.fixture
def db_path(tmp_path):
    return str(tmp_path / "test.db")


@pytest.fixture
def db(db_path):
    return QueueDatabase(db_path)


@pytest.fixture
def state_machine(db):
    return RetryStateMachine(db)


class TestRetryStateMachine:
    def test_calculate_next_retry_time_exponential(self, state_machine):
        msg = CompensationMessage(
            id="test-001",
            topic="test",
            payload={},
            retry_count=0,
        )
        next_time = state_machine.calculate_next_retry_time(
            msg, 
            strategy=RetryStrategy.EXPONENTIAL_BACKOFF,
            base_interval=60,
        )
        assert next_time > datetime.now()
        assert (next_time - datetime.now()).total_seconds() <= 120
        
        msg.retry_count = 2
        next_time = state_machine.calculate_next_retry_time(
            msg,
            strategy=RetryStrategy.EXPONENTIAL_BACKOFF,
            base_interval=60,
        )
        expected_delay = 60 * (2 ** 2)
        actual_delay = (next_time - datetime.now()).total_seconds()
        assert actual_delay <= expected_delay + 5
    
    def test_calculate_next_retry_time_immediate(self, state_machine):
        msg = CompensationMessage(id="test-002", topic="test", payload={})
        next_time = state_machine.calculate_next_retry_time(
            msg,
            strategy=RetryStrategy.IMMEDIATE,
        )
        assert (next_time - datetime.now()).total_seconds() < 5
    
    def test_classify_error(self, state_machine):
        assert state_machine._classify_error("Connection refused") == ErrorCategory.NETWORK_ERROR
        assert state_machine._classify_error("Request timeout") == ErrorCategory.TIMEOUT
        assert state_machine._classify_error("订单已存在") == ErrorCategory.BUSINESS_ERROR
        assert state_machine._classify_error("403 Forbidden") == ErrorCategory.PERMISSION_ERROR
        assert state_machine._classify_error("JSON parse error") == ErrorCategory.DATA_ERROR
        assert state_machine._classify_error("Internal server error") == ErrorCategory.SYSTEM_ERROR
        assert state_machine._classify_error("Some random error") == ErrorCategory.UNKNOWN
    
    def test_force_retry(self, db, state_machine):
        msg = CompensationMessage(
            id="retry-test-001",
            topic="test",
            payload={},
            status=MessageStatus.DEAD_LETTER,
            retry_count=3,
            max_retries=3,
        )
        db.insert_message(msg)
        
        result = state_machine.force_retry("retry-test-001")
        assert result is True
        
        updated = db.get_message("retry-test-001")
        assert updated.status == MessageStatus.PENDING
    
    def test_force_retry_with_reset(self, db, state_machine):
        msg = CompensationMessage(
            id="retry-test-002",
            topic="test",
            payload={},
            status=MessageStatus.DEAD_LETTER,
            retry_count=3,
            max_retries=3,
        )
        db.insert_message(msg)
        
        result = state_machine.force_retry("retry-test-002", reset_retry_count=True)
        assert result is True
        
        updated = db.get_message("retry-test-002")
        assert updated.status == MessageStatus.PENDING
        assert updated.retry_count == 0
    
    def test_attempt_retry_success(self, db, state_machine):
        msg = CompensationMessage(
            id="success-test-001",
            topic="test",
            payload={},
            retry_count=0,
            max_retries=3,
        )
        db.insert_message(msg)
        
        def success_handler(message):
            pass
        
        result, error = state_machine.attempt_retry(msg, success_handler)
        assert result is True
        assert error is None
        
        updated = db.get_message("success-test-001")
        assert updated.status == MessageStatus.SUCCESS
        assert updated.processed_at is not None
    
    def test_attempt_retry_failure(self, db, state_machine):
        msg = CompensationMessage(
            id="fail-test-001",
            topic="test",
            payload={},
            retry_count=0,
            max_retries=3,
        )
        db.insert_message(msg)
        
        def fail_handler(message):
            raise Exception("Connection timeout to service")
        
        result, error = state_machine.attempt_retry(msg, fail_handler)
        assert result is False
        assert "timeout" in error.lower()
        
        updated = db.get_message("fail-test-001")
        assert updated.retry_count == 1
        assert updated.status == MessageStatus.PENDING
        assert updated.error_category == ErrorCategory.TIMEOUT
    
    def test_attempt_retry_permanent_failure(self, db, state_machine):
        msg = CompensationMessage(
            id="perm-fail-001",
            topic="test",
            payload={},
            retry_count=2,
            max_retries=3,
        )
        db.insert_message(msg)
        
        def fail_handler(message):
            raise Exception("Business error: order not found")
        
        for _ in range(2):
            result, error = state_machine.attempt_retry(msg, fail_handler)
            msg = db.get_message("perm-fail-001")
        
        updated = db.get_message("perm-fail-001")
        assert updated.status == MessageStatus.DEAD_LETTER
        assert updated.retry_count == 3
    
    def test_mark_as_dead_letter(self, db, state_machine):
        msg = CompensationMessage(id="dlq-001", topic="test", payload={})
        db.insert_message(msg)
        
        result = state_machine.mark_as_dead_letter("dlq-001", "手动标记")
        assert result is True
        
        updated = db.get_message("dlq-001")
        assert updated.status == MessageStatus.DEAD_LETTER
        assert updated.last_error_message == "手动标记"
    
    def test_mark_as_archived(self, db, state_machine):
        msg = CompensationMessage(
            id="archive-001",
            topic="test",
            payload={},
            status=MessageStatus.SUCCESS,
        )
        db.insert_message(msg)
        
        result = state_machine.mark_as_archived("archive-001")
        assert result is True
        
        updated = db.get_message("archive-001")
        assert updated.status == MessageStatus.ARCHIVED
