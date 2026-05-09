import pytest
from datetime import datetime, timedelta
from queue_inspector.core.models import (
    CompensationMessage, MessageStatus, ErrorCategory, RetryRecord,
    CleanupSuggestion, InspectionReport
)


class TestCompensationMessage:
    def test_create_default_message(self):
        msg = CompensationMessage(
            id="test-001",
            topic="order.payment",
            payload={"order_id": "ORD-001"},
        )
        assert msg.id == "test-001"
        assert msg.topic == "order.payment"
        assert msg.status == MessageStatus.PENDING
        assert msg.retry_count == 0
        assert msg.max_retries == 3
        assert msg.idempotent_key is None
    
    def test_can_retry(self):
        msg = CompensationMessage(
            id="test-002",
            topic="test",
            payload={},
            retry_count=2,
            max_retries=3,
        )
        assert msg.can_retry() is True
        
        msg.retry_count = 3
        assert msg.can_retry() is False
    
    def test_is_permanently_failed(self):
        msg = CompensationMessage(
            id="test-003",
            topic="test",
            payload={},
            retry_count=3,
            max_retries=3,
            status=MessageStatus.DEAD_LETTER,
        )
        assert msg.is_permanently_failed() is True
        
        msg.status = MessageStatus.PENDING
        assert msg.is_permanently_failed() is False
    
    def test_increment_retry(self):
        msg = CompensationMessage(
            id="test-004",
            topic="test",
            payload={},
        )
        msg.increment_retry(
            error_message="Connection timeout",
            error_category=ErrorCategory.TIMEOUT,
        )
        assert msg.retry_count == 1
        assert msg.last_error_message == "Connection timeout"
        assert msg.error_category == ErrorCategory.TIMEOUT
        assert msg.first_failed_at is not None
        assert msg.last_failed_at is not None


class TestErrorCategory:
    def test_error_categories(self):
        categories = list(ErrorCategory)
        assert ErrorCategory.NETWORK_ERROR in categories
        assert ErrorCategory.TIMEOUT in categories
        assert ErrorCategory.BUSINESS_ERROR in categories
        assert ErrorCategory.UNKNOWN in categories


class TestMessageStatus:
    def test_status_flow(self):
        assert MessageStatus.PENDING.value == "pending"
        assert MessageStatus.RETRYING.value == "retrying"
        assert MessageStatus.SUCCESS.value == "success"
        assert MessageStatus.DEAD_LETTER.value == "dead_letter"
        assert MessageStatus.ARCHIVED.value == "archived"
