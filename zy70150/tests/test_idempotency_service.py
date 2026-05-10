import pytest

from mrs.services import IdempotencyService
from mrs.models import IdempotencyStatus


class TestIdempotencyService:
    def test_check_or_create_new_record(self, db_session, sample_messages):
        with IdempotencyService(db_session) as service:
            result = service.check_or_create(sample_messages[0], "REQ-TEST")
            
            assert not result["should_skip"]
            assert result["is_retry"] is False
            assert result["record"] is not None
            assert result["record"].status == IdempotencyStatus.PROCESSING

    def test_check_or_create_existing_success(self, db_session, sample_messages):
        with IdempotencyService(db_session) as service:
            result1 = service.check_or_create(sample_messages[0], "REQ-TEST")
            service.mark_success(result1["record"].idempotency_key, {"status": "ok"})
            
            result2 = service.check_or_create(sample_messages[0], "REQ-TEST-2")
            
            assert result2["should_skip"] is True
            assert "成功" in result2["reason"]

    def test_check_or_create_existing_failed(self, db_session, sample_messages):
        with IdempotencyService(db_session) as service:
            result1 = service.check_or_create(sample_messages[0], "REQ-TEST")
            service.mark_failed(result1["record"].idempotency_key, "error")
            
            result2 = service.check_or_create(sample_messages[0], "REQ-TEST-2")
            
            assert result2["should_skip"] is False
            assert result2["is_retry"] is True

    def test_mark_success(self, db_session, sample_messages):
        with IdempotencyService(db_session) as service:
            result = service.check_or_create(sample_messages[0], "REQ-TEST")
            record = service.mark_success(result["record"].idempotency_key, {"status": "ok"})
            
            assert record.status == IdempotencyStatus.SUCCESS
            assert record.result_data == {"status": "ok"}
            assert record.processed_at is not None

    def test_mark_failed(self, db_session, sample_messages):
        with IdempotencyService(db_session) as service:
            result = service.check_or_create(sample_messages[0], "REQ-TEST")
            record = service.mark_failed(result["record"].idempotency_key, "test error")
            
            assert record.status == IdempotencyStatus.FAILED
            assert record.error_message == "test error"

    def test_get_status(self, db_session, sample_messages):
        with IdempotencyService(db_session) as service:
            result = service.check_or_create(sample_messages[0], "REQ-TEST")
            service.mark_success(result["record"].idempotency_key, {"status": "ok"})
            
            status = service.get_status(result["record"].idempotency_key)
            
            assert status is not None
            assert status["status"] == IdempotencyStatus.SUCCESS
            assert status["message_id"] == sample_messages[0].message_id

    def test_get_by_message_id(self, db_session, sample_messages):
        with IdempotencyService(db_session) as service:
            service.check_or_create(sample_messages[0], "REQ-TEST")
            
            status = service.get_by_message_id(sample_messages[0].message_id)
            
            assert status is not None
            assert status["message_id"] == sample_messages[0].message_id
