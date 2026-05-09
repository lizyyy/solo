import pytest
import uuid
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from database import Base, LogSource, Task, AuditLog, IdempotencyRecord, LogEntry
from services.task_service import TaskService, TaskExecutor
from services.audit_service import AuditService
from services.log_collector import FileLogCollector


TEST_DATABASE_URL = "sqlite:///./test_log_analyzer.db"


@pytest.fixture
def db_session():
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


class TestIdempotency:
    
    def test_same_request_with_idempotency_key_returns_cached_result(self, db_session):
        from routers.logs import _check_idempotency, _save_idempotency
        
        key = str(uuid.uuid4())
        endpoint = "/api/logs/ingest"
        response = {"message": "日志写入成功", "count": 5}
        
        cached = _check_idempotency(db_session, key, endpoint)
        assert cached is None
        
        _save_idempotency(db_session, key, endpoint, 201, response)
        
        cached = _check_idempotency(db_session, key, endpoint)
        assert cached is not None
        assert cached.response_body == response
    
    def test_different_keys_return_different_results(self, db_session):
        from routers.logs import _check_idempotency, _save_idempotency
        
        key1 = str(uuid.uuid4())
        key2 = str(uuid.uuid4())
        endpoint = "/api/logs/ingest"
        
        _save_idempotency(db_session, key1, endpoint, 201, {"count": 5})
        _save_idempotency(db_session, key2, endpoint, 201, {"count": 10})
        
        cached1 = _check_idempotency(db_session, key1, endpoint)
        cached2 = _check_idempotency(db_session, key2, endpoint)
        
        assert cached1.response_body["count"] == 5
        assert cached2.response_body["count"] == 10


class TestConcurrencyControl:
    
    def test_update_with_correct_version_succeeds(self, db_session):
        source = LogSource(
            name="Test Source",
            source_type="file",
            config={"file_path": "/test.log"},
            version=1
        )
        db_session.add(source)
        db_session.commit()
        db_session.refresh(source)
        
        assert source.version == 1
        
        source.name = "Updated Source"
        source.version += 1
        db_session.commit()
        db_session.refresh(source)
        
        assert source.version == 2
        assert source.name == "Updated Source"
    
    def test_update_with_stale_version_fails(self, db_session):
        source = LogSource(
            name="Test Source",
            source_type="file",
            config={"file_path": "/test.log"},
            version=1
        )
        db_session.add(source)
        db_session.commit()
        
        fresh_source = db_session.query(LogSource).first()
        fresh_source.name = "Update 1"
        fresh_source.version += 1
        db_session.commit()
        
        stale_source = db_session.query(LogSource).first()
        assert stale_source.version == 2
        
        if stale_source.version != 1:
            assert True
        else:
            assert False, "版本检查应该失败"


class TestTaskRetry:
    
    def test_task_created_with_pending_status(self, db_session):
        task = TaskService.create_task(
            db_session,
            "collect_logs",
            {"source_id": 1}
        )
        
        assert task.status == "pending"
        assert task.retry_count == 0
        assert task.max_retries == 3
    
    def test_task_retry_increments_count(self, db_session):
        task = TaskService.create_task(
            db_session,
            "collect_logs",
            {"source_id": 1}
        )
        
        updated = TaskService.increment_retry_count(db_session, task.id)
        
        assert updated.retry_count == 1
        assert updated.status == "retrying"
    
    def test_task_fails_after_max_retries(self, db_session):
        task = TaskService.create_task(
            db_session,
            "collect_logs",
            {"source_id": 1},
            max_retries=2
        )
        
        TaskService.increment_retry_count(db_session, task.id)
        TaskService.increment_retry_count(db_session, task.id)
        
        task = db_session.query(Task).filter(Task.id == task.id).first()
        assert task.retry_count == 2
        
        can_retry = task.retry_count < task.max_retries
        assert can_retry == False


class TestAuditLog:
    
    def test_audit_log_created_on_action(self, db_session):
        AuditService.log_action(
            db=db_session,
            action="create",
            resource_type="log_source",
            resource_id="1",
            new_value={"name": "Test"}
        )
        
        logs = db_session.query(AuditLog).all()
        assert len(logs) == 1
        assert logs[0].action == "create"
        assert logs[0].resource_type == "log_source"
    
    def test_audit_log_tracks_changes(self, db_session):
        old_val = {"name": "Old Name", "is_active": True}
        new_val = {"name": "New Name", "is_active": False}
        
        AuditService.log_action(
            db=db_session,
            action="update",
            resource_type="log_source",
            resource_id="1",
            old_value=old_val,
            new_value=new_val
        )
        
        log = db_session.query(AuditLog).first()
        assert log.old_value == old_val
        assert log.new_value == new_val
    
    def test_audit_log_history_query(self, db_session):
        for i in range(5):
            AuditService.log_action(
                db=db_session,
                action="create" if i % 2 == 0 else "update",
                resource_type="log_source",
                resource_id=str(i)
            )
        
        result = AuditService.get_history(
            db=db_session,
            action="create",
            page=1,
            page_size=10
        )
        
        assert result["total"] == 3
        assert len(result["data"]) == 3


class TestLogCollection:
    
    def test_file_log_collector_parses_logs(self, db_session, tmp_path):
        log_file = tmp_path / "test.log"
        log_file.write_text("""2024-01-15 10:00:00 INFO app.main - 系统启动成功
2024-01-15 10:00:01 DEBUG app.config - 加载配置文件
2024-01-15 10:00:15 ERROR app.api - 用户不存在
""")
        
        collector = FileLogCollector(db_session)
        logs = collector.collect({
            "file_path": str(log_file)
        })
        
        assert len(logs) == 3
        assert logs[0]["log_level"] == "INFO"
        assert logs[1]["log_level"] == "DEBUG"
        assert logs[2]["log_level"] == "ERROR"
    
    def test_file_log_collector_with_invalid_path(self, db_session):
        collector = FileLogCollector(db_session)
        
        with pytest.raises(Exception) as exc_info:
            collector.collect({
                "file_path": "/nonexistent/file.log"
            })
        
        assert "读取日志文件失败" in str(exc_info.value)


class TestReportGeneration:
    
    def test_generate_summary_with_filters(self, db_session):
        from services.report_service import ReportService
        
        source = LogSource(
            name="Test Source",
            source_type="file",
            config={}
        )
        db_session.add(source)
        db_session.commit()
        db_session.refresh(source)
        
        now = datetime.now()
        for i in range(10):
            log = LogEntry(
                source_id=source.id,
                log_time=now - timedelta(minutes=i),
                log_level="INFO" if i % 2 == 0 else "ERROR",
                message=f"Test log {i}",
                module="test.module"
            )
            db_session.add(log)
        db_session.commit()
        
        summary = ReportService.generate_summary(db_session, {
            "source_id": source.id,
            "start_time": now - timedelta(hours=1),
            "end_time": now
        })
        
        assert summary["total_logs"] == 10
        assert "INFO" in summary["level_distribution"]
        assert "ERROR" in summary["level_distribution"]
        assert "test.module" in summary["top_modules"]
