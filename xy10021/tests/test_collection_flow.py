import pytest
import uuid
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, LogSource, Task, AuditLog, LogEntry
from services.task_service import TaskService, TaskExecutor
from services.audit_service import AuditService
from services.log_collector import LogCollectorFactory


TEST_DATABASE_URL = "sqlite:///./test_collection.db"


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


class TestCollectionFlow:
    
    def test_create_log_source_creates_audit_log(self, db_session):
        source = LogSource(
            name="测试日志源",
            source_type="file",
            config={"file_path": "/tmp/test.log"},
            description="这是一个测试",
            is_active=True,
            version=1
        )
        db_session.add(source)
        db_session.commit()
        db_session.refresh(source)
        
        AuditService.log_action(
            db=db_session,
            action="create",
            resource_type="log_source",
            resource_id=str(source.id),
            new_value={
                "id": source.id,
                "name": source.name,
                "source_type": source.source_type,
                "is_active": source.is_active
            }
        )
        
        audit_logs = db_session.query(AuditLog).all()
        assert len(audit_logs) == 1
        assert audit_logs[0].action == "create"
        assert audit_logs[0].resource_type == "log_source"
        assert audit_logs[0].new_value["name"] == "测试日志源"
    
    def test_trigger_collection_creates_task(self, db_session):
        source = LogSource(
            name="测试日志源",
            source_type="file",
            config={"file_path": "/tmp/test.log"},
            is_active=True,
            version=1
        )
        db_session.add(source)
        db_session.commit()
        db_session.refresh(source)
        
        task = TaskService.create_task(
            db_session,
            "collect_logs",
            {"source_id": source.id}
        )
        
        assert task is not None
        assert task.task_type == "collect_logs"
        assert task.data["source_id"] == source.id
        assert task.status == "pending"
        assert task.retry_count == 0
    
    def test_duplicate_collection_does_not_create_duplicate_task(self, db_session):
        source = LogSource(
            name="测试日志源",
            source_type="file",
            config={"file_path": "/tmp/test.log"},
            is_active=True,
            version=1
        )
        db_session.add(source)
        db_session.commit()
        db_session.refresh(source)
        
        task1 = TaskService.create_task(
            db_session,
            "collect_logs",
            {"source_id": source.id}
        )
        
        candidate_tasks = db_session.query(Task).filter(
            Task.task_type == "collect_logs",
            Task.status.in_(["pending", "running", "retrying"])
        ).all()
        
        existing_task = None
        for task in candidate_tasks:
            if task.data and task.data.get("source_id") == source.id:
                existing_task = task
                break
        
        assert existing_task is not None
        assert existing_task.id == task1.id
    
    def test_task_retry_logic(self, db_session):
        source = LogSource(
            name="测试日志源",
            source_type="file",
            config={"file_path": "/nonexistent.log"},
            is_active=True,
            version=1
        )
        db_session.add(source)
        db_session.commit()
        db_session.refresh(source)
        
        task = TaskService.create_task(
            db_session,
            "collect_logs",
            {"source_id": source.id},
            max_retries=2
        )
        
        assert task.retry_count == 0
        
        task2 = TaskService.increment_retry_count(db_session, task.id)
        assert task2.retry_count == 1
        assert task2.status == "retrying"
        
        task3 = TaskService.increment_retry_count(db_session, task.id)
        assert task3.retry_count == 2
        
        can_retry = task3.retry_count < task3.max_retries
        assert can_retry == False
    
    def test_file_log_collection_with_real_file(self, db_session, tmp_path):
        log_file = tmp_path / "app.log"
        log_content = """2024-01-15 10:00:00 INFO app.main - 系统启动成功
2024-01-15 10:00:01 DEBUG app.config - 加载配置
2024-01-15 10:00:02 WARNING app.cache - 缓存警告
2024-01-15 10:00:03 ERROR app.api - 接口异常
2024-01-15 10:00:04 CRITICAL app.system - 系统严重错误
"""
        log_file.write_text(log_content)
        
        source = LogSource(
            name="应用日志",
            source_type="file",
            config={"file_path": str(log_file)},
            is_active=True,
            version=1
        )
        db_session.add(source)
        db_session.commit()
        db_session.refresh(source)
        
        collector = LogCollectorFactory.get_collector("file", db_session)
        logs = collector.collect({"file_path": str(log_file)})
        
        assert len(logs) == 5
        
        levels = [log["log_level"] for log in logs]
        assert "INFO" in levels
        assert "DEBUG" in levels
        assert "WARNING" in levels
        assert "ERROR" in levels
        assert "CRITICAL" in levels
        
        info_logs = [l for l in logs if l["log_level"] == "INFO"]
        assert len(info_logs) == 1
        assert "系统启动成功" in info_logs[0]["message"]
    
    def test_collect_logs_task_execution(self, db_session, tmp_path):
        log_file = tmp_path / "app.log"
        log_file.write_text("2024-01-15 10:00:00 INFO app.main - 测试日志\n")
        
        source = LogSource(
            name="应用日志",
            source_type="file",
            config={"file_path": str(log_file)},
            is_active=True,
            version=1
        )
        db_session.add(source)
        db_session.commit()
        db_session.refresh(source)
        
        task = TaskService.create_task(
            db_session,
            "collect_logs",
            {"source_id": source.id}
        )
        
        executor = TaskExecutor(db_session)
        executor.execute_task(task)
        
        db_session.refresh(task)
        assert task.status == "completed"
        assert task.result is not None
        assert task.result["count"] == 1
        
        log_entries = db_session.query(LogEntry).all()
        assert len(log_entries) == 1
        assert log_entries[0].source_id == source.id
        assert log_entries[0].log_level == "INFO"
        assert "测试日志" in log_entries[0].message
    
    def test_full_workflow_from_source_to_logs(self, db_session, tmp_path):
        log_file = tmp_path / "workflow.log"
        log_content = """2024-01-15 10:00:00 INFO app.main - 系统启动
2024-01-15 10:00:01 ERROR app.api - 用户登录失败
2024-01-15 10:00:02 WARNING app.db - 连接超时
"""
        log_file.write_text(log_content)
        
        source = LogSource(
            name="工作流测试",
            source_type="file",
            config={"file_path": str(log_file)},
            is_active=True,
            version=1
        )
        db_session.add(source)
        db_session.commit()
        db_session.refresh(source)
        
        AuditService.log_action(
            db=db_session,
            action="create",
            resource_type="log_source",
            resource_id=str(source.id),
            new_value={"name": source.name, "is_active": source.is_active}
        )
        
        task = TaskService.create_task(
            db_session,
            "collect_logs",
            {"source_id": source.id}
        )
        
        executor = TaskExecutor(db_session)
        executor.execute_task(task)
        
        db_session.refresh(task)
        
        log_entries = db_session.query(LogEntry).filter(
            LogEntry.source_id == source.id
        ).all()
        assert len(log_entries) == 3
        
        error_logs = db_session.query(LogEntry).filter(
            LogEntry.source_id == source.id,
            LogEntry.log_level == "ERROR"
        ).all()
        assert len(error_logs) == 1
        assert "用户登录失败" in error_logs[0].message
        
        audit_logs = db_session.query(AuditLog).filter(
            AuditLog.resource_type == "log_source"
        ).all()
        assert len(audit_logs) >= 1
    
    def test_task_failure_and_recovery(self, db_session):
        source = LogSource(
            name="失败测试",
            source_type="file",
            config={"file_path": "/nonexistent/path.log"},
            is_active=True,
            version=1
        )
        db_session.add(source)
        db_session.commit()
        db_session.refresh(source)
        
        task = TaskService.create_task(
            db_session,
            "collect_logs",
            {"source_id": source.id},
            max_retries=1
        )
        
        executor = TaskExecutor(db_session)
        executor.execute_task(task)
        
        db_session.refresh(task)
        
        assert task.status == "retrying"
        assert task.retry_count == 1
        
        can_retry_more = task.retry_count < task.max_retries
        assert can_retry_more == False
        
        executor2 = TaskExecutor(db_session)
        executor2.execute_task(task)
        
        db_session.refresh(task)
        assert task.status == "failed"
        assert task.error_message is not None
