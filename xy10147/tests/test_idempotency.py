import pytest
from datetime import date
from task_compensation.models import Task, TaskStatus
from task_compensation.core.idempotency_checker import (
    FileSystemIdempotencyStore, IdempotencyChecker
)


class TestFileSystemIdempotencyStore:
    def test_save_and_get(self, tmp_path):
        store = FileSystemIdempotencyStore(str(tmp_path))
        
        from task_compensation.models import IdempotencyRecord
        record = IdempotencyRecord(
            idempotency_hash="test_hash_123",
            task_id="test_task",
            execution_date=date(2024, 1, 15),
            status=TaskStatus.SUCCESS
        )
        
        store.save(record)
        
        loaded = store.get("test_hash_123")
        assert loaded is not None
        assert loaded.task_id == "test_task"
        assert loaded.status == TaskStatus.SUCCESS
    
    def test_get_by_task_and_date(self, tmp_path):
        store = FileSystemIdempotencyStore(str(tmp_path))
        
        from task_compensation.models import IdempotencyRecord
        record = IdempotencyRecord(
            idempotency_hash="hash_20240115",
            task_id="test_task",
            execution_date=date(2024, 1, 15),
            status=TaskStatus.SUCCESS
        )
        
        store.save(record)
        
        loaded = store.get_by_task_and_date("test_task", date(2024, 1, 15))
        assert loaded is not None
        assert loaded.idempotency_hash == "hash_20240115"
    
    def test_update_status(self, tmp_path):
        store = FileSystemIdempotencyStore(str(tmp_path))
        
        from task_compensation.models import IdempotencyRecord
        record = IdempotencyRecord(
            idempotency_hash="test_hash",
            task_id="test_task",
            execution_date=date(2024, 1, 15),
            status=TaskStatus.RUNNING
        )
        
        store.save(record)
        
        store.update_status(
            idempotency_hash="test_hash",
            status=TaskStatus.SUCCESS,
            execution_record_id="rec_123",
            output={"result": "ok"}
        )
        
        loaded = store.get("test_hash")
        assert loaded.status == TaskStatus.SUCCESS
        assert loaded.execution_record_id == "rec_123"
        assert loaded.output == {"result": "ok"}


class TestIdempotencyChecker:
    def test_generate_hash(self):
        task = Task(
            task_id="test",
            task_name="测试",
            cron_expression="0 2 * * *",
            idempotency_key="key_{date}"
        )
        
        d1 = date(2024, 1, 15)
        d2 = date(2024, 1, 16)
        
        h1 = task.generate_idempotency_hash(d1)
        h2 = task.generate_idempotency_hash(d2)
        h1_again = task.generate_idempotency_hash(d1)
        
        assert h1 != h2
        assert h1 == h1_again
    
    def test_check_nonexistent(self, tmp_path):
        store = FileSystemIdempotencyStore(str(tmp_path))
        checker = IdempotencyChecker(store)
        
        task = Task(
            task_id="test",
            task_name="测试",
            cron_expression="0 2 * * *"
        )
        
        result = checker.check("test", date(2024, 1, 15), task)
        
        assert result is None
    
    def test_can_execute_success(self, tmp_path):
        store = FileSystemIdempotencyStore(str(tmp_path))
        checker = IdempotencyChecker(store)
        
        from task_compensation.models import IdempotencyRecord
        task = Task(
            task_id="test",
            task_name="测试",
            cron_expression="0 2 * * *"
        )
        d = date(2024, 1, 15)
        
        record = IdempotencyRecord(
            idempotency_hash=task.generate_idempotency_hash(d),
            task_id="test",
            execution_date=d,
            status=TaskStatus.SUCCESS
        )
        store.save(record)
        
        can_execute = checker.can_execute("test", d, task)
        
        assert can_execute == False
    
    def test_can_execute_failed(self, tmp_path):
        store = FileSystemIdempotencyStore(str(tmp_path))
        checker = IdempotencyChecker(store)
        
        from task_compensation.models import IdempotencyRecord
        task = Task(
            task_id="test",
            task_name="测试",
            cron_expression="0 2 * * *"
        )
        d = date(2024, 1, 15)
        
        record = IdempotencyRecord(
            idempotency_hash=task.generate_idempotency_hash(d),
            task_id="test",
            execution_date=d,
            status=TaskStatus.FAILED
        )
        store.save(record)
        
        can_execute = checker.can_execute("test", d, task)
        
        assert can_execute == True
    
    def test_register_execution(self, tmp_path):
        store = FileSystemIdempotencyStore(str(tmp_path))
        checker = IdempotencyChecker(store)
        
        task = Task(
            task_id="test",
            task_name="测试",
            cron_expression="0 2 * * *"
        )
        d = date(2024, 1, 15)
        
        record = checker.register_execution(task, d)
        
        assert record.status == TaskStatus.RUNNING
        
        loaded = checker.check("test", d, task)
        assert loaded is not None
        assert loaded.status == TaskStatus.RUNNING
    
    def test_register_duplicate_execution(self, tmp_path):
        store = FileSystemIdempotencyStore(str(tmp_path))
        checker = IdempotencyChecker(store)
        
        task = Task(
            task_id="test",
            task_name="测试",
            cron_expression="0 2 * * *"
        )
        d = date(2024, 1, 15)
        
        checker.register_execution(task, d)
        
        with pytest.raises(RuntimeError, match="正在执行中"):
            checker.register_execution(task, d)
    
    def test_clear_lock(self, tmp_path):
        store = FileSystemIdempotencyStore(str(tmp_path))
        checker = IdempotencyChecker(store)
        
        task = Task(
            task_id="test",
            task_name="测试",
            cron_expression="0 2 * * *"
        )
        d = date(2024, 1, 15)
        hash_val = task.generate_idempotency_hash(d)
        
        checker.register_execution(task, d)
        
        checker.clear_lock(hash_val)
        
        loaded = checker.check("test", d, task)
        assert loaded.status == TaskStatus.PENDING
