import pytest
from datetime import datetime

from event_manager.services.retry_service import RetryService, with_retry
from event_manager.models import FailedOperation, UserRole
from event_manager.exceptions import EventManagerException


class TestRetryService:
    
    def test_record_failure(self, temp_db, test_admin):
        service = RetryService(temp_db, current_user=test_admin)
        
        failed_op = service.record_failure(
            operation_type='import_registrations',
            error_message='网络超时',
            resource_type='registration',
            resource_id=123,
            input_data={'event_id': 1, 'count': 10}
        )
        
        assert failed_op is not None
        assert failed_op.operation_type == 'import_registrations'
        assert failed_op.error_message == '网络超时'
        assert failed_op.retry_count == 0
        assert failed_op.resolved == False
        
        db_failed_op = temp_db.query(FailedOperation).filter(
            FailedOperation.id == failed_op.id
        ).first()
        assert db_failed_op is not None

    def test_get_failed_operations(self, temp_db, test_admin):
        service = RetryService(temp_db, current_user=test_admin)
        
        for i in range(3):
            service.record_failure(
                operation_type=f'test_op_{i}',
                error_message=f'错误{i}'
            )
        
        unresolved = service.get_failed_operations(unresolved_only=True)
        assert len(unresolved) == 3
        
        all_ops = service.get_failed_operations(unresolved_only=False)
        assert len(all_ops) == 3

    def test_mark_resolved(self, temp_db, test_admin):
        service = RetryService(temp_db, current_user=test_admin)
        
        failed_op = service.record_failure(
            operation_type='test_op',
            error_message='测试错误'
        )
        
        resolved = service.mark_resolved(failed_op.id)
        
        assert resolved is not None
        assert resolved.resolved == True
        assert resolved.resolved_at is not None

    def test_mark_resolved_nonexistent(self, temp_db, test_admin):
        service = RetryService(temp_db, current_user=test_admin)
        
        result = service.mark_resolved(99999)
        assert result is None

    def test_filter_by_operation_type(self, temp_db, test_admin):
        service = RetryService(temp_db, current_user=test_admin)
        
        service.record_failure(operation_type='import', error_message='err1')
        service.record_failure(operation_type='import', error_message='err2')
        service.record_failure(operation_type='export', error_message='err3')
        
        import_ops = service.get_failed_operations(operation_type='import')
        assert len(import_ops) == 2
        
        export_ops = service.get_failed_operations(operation_type='export')
        assert len(export_ops) == 1


class TestWithRetryDecorator:
    
    def test_with_retry_success(self, temp_db):
        call_count = [0]
        
        class TestService:
            def __init__(self, db):
                self.db = db
                self.current_user = None
            
            @with_retry(operation_type='test', max_attempts=3, record_failure=False)
            def method(self):
                call_count[0] += 1
                if call_count[0] < 2:
                    raise EventManagerException('暂时失败')
                return 'success'
        
        service = TestService(temp_db)
        result = service.method()
        
        assert result == 'success'
        assert call_count[0] == 2

    def test_with_retry_failure(self, temp_db):
        call_count = [0]
        
        class TestService:
            def __init__(self, db):
                self.db = db
                self.current_user = None
            
            @with_retry(operation_type='test', max_attempts=2, record_failure=False)
            def method(self):
                call_count[0] += 1
                raise EventManagerException('一直失败')
        
        service = TestService(temp_db)
        
        from tenacity import RetryError
        with pytest.raises((EventManagerException, RetryError)):
            service.method()
        
        assert call_count[0] == 2

    def test_with_retry_records_failure(self, temp_db, test_admin):
        call_count = [0]
        
        class TestService:
            def __init__(self, db, user):
                self.db = db
                self.current_user = user
            
            @with_retry(operation_type='test_op', max_attempts=2, record_failure=True)
            def method(self):
                call_count[0] += 1
                raise EventManagerException('测试错误')
        
        service = TestService(temp_db, test_admin)
        
        from tenacity import RetryError
        with pytest.raises((EventManagerException, RetryError)):
            service.method()
        
        assert call_count[0] == 2
