import pytest
from app.services import IndexRebuildService, TaskStatus, RollbackStatus
from app.schemas import (
    RebuildIndexRequest, DocumentVersionCreate,
    RecallSampleCreate, RollbackRequest
)
from app.models import IndexTask, DocumentVersion, ShardValidation


def test_validate_request_fields_missing_task_id(db):
    service = IndexRebuildService(db)
    
    request = RebuildIndexRequest(
        task_id="   ",
        document_versions=[
            DocumentVersionCreate(
                document_id="doc_001",
                version=1,
                content_hash="abc123"
            )
        ]
    )
    
    result = service.validate_request_fields(request)
    assert result["valid"] == False
    assert len(result["errors"]) > 0
    assert "task_id 不能为空" in result["errors"]


def test_validate_request_fields_missing_document_id_in_list(db):
    service = IndexRebuildService(db)
    
    request = RebuildIndexRequest(
        task_id="task_001",
        document_versions=[
            DocumentVersionCreate(
                document_id="   ",
                version=1,
                content_hash="hash_001"
            )
        ]
    )
    
    result = service.validate_request_fields(request)
    assert result["valid"] == False
    assert len(result["errors"]) > 0
    assert "document_id 不能为空" in result["errors"][0]


def test_validate_request_fields_multiple_errors(db):
    service = IndexRebuildService(db)
    
    request = RebuildIndexRequest(
        task_id="   ",
        document_versions=[
            DocumentVersionCreate(
                document_id="   ",
                version=1,
                content_hash="   "
            )
        ]
    )
    
    result = service.validate_request_fields(request)
    assert result["valid"] == False
    assert len(result["errors"]) >= 3


def test_validate_request_fields_valid_request(db):
    service = IndexRebuildService(db)
    
    request = RebuildIndexRequest(
        task_id="task_001",
        document_versions=[
            DocumentVersionCreate(
                document_id="doc_001",
                version=1,
                content_hash="abc123"
            )
        ]
    )
    
    result = service.validate_request_fields(request)
    assert result["valid"] == True
    assert len(result["errors"]) == 0


def test_check_duplicate_task(db):
    service = IndexRebuildService(db)
    
    existing_task = IndexTask(
        task_id="duplicate_task",
        status=TaskStatus.COMPLETED,
        target_document_count=5
    )
    db.add(existing_task)
    db.commit()
    
    assert service.check_duplicate_task("duplicate_task") == True
    assert service.check_duplicate_task("new_task") == False


def test_check_running_task(db):
    service = IndexRebuildService(db)
    
    pending_task = IndexTask(
        task_id="pending_task",
        status=TaskStatus.PENDING,
        target_document_count=5
    )
    db.add(pending_task)
    db.commit()
    
    running_task = service.check_running_task()
    assert running_task is not None
    assert running_task.task_id == "pending_task"


def test_create_index_task(db):
    service = IndexRebuildService(db)
    
    task = service.create_index_task("new_task_001", 10)
    
    assert task.task_id == "new_task_001"
    assert task.status == TaskStatus.PENDING
    assert task.target_document_count == 10
    assert task.processed_document_count == 0


def test_start_task(db):
    service = IndexRebuildService(db)
    
    task = IndexTask(
        task_id="test_task",
        status=TaskStatus.PENDING,
        target_document_count=5
    )
    db.add(task)
    db.commit()
    
    service.start_task(task)
    
    assert task.status == TaskStatus.RUNNING
    assert task.started_at is not None


def test_process_document_versions_success(db):
    service = IndexRebuildService(db)
    
    task = IndexTask(
        task_id="test_task",
        status=TaskStatus.RUNNING,
        target_document_count=2
    )
    db.add(task)
    db.commit()
    
    document_versions = [
        DocumentVersionCreate(
            document_id="doc_001",
            version=1,
            content_hash="hash_001",
            title="测试文档1"
        ),
        DocumentVersionCreate(
            document_id="doc_002",
            version=1,
            content_hash="hash_002",
            title="测试文档2"
        )
    ]
    
    results = service.process_document_versions(task, document_versions)
    
    assert results["processed"] == 2
    assert results["success"] == 2
    assert results["failed"] == 0
    
    assert task.processed_document_count == 2
    assert task.success_document_count == 2
    assert task.failed_document_count == 0
    
    validations = db.query(ShardValidation).filter(
        ShardValidation.index_task_id == task.id
    ).all()
    assert len(validations) == 2
    assert all(v.is_valid for v in validations)


def test_process_document_versions_duplicate_same_hash(db):
    service = IndexRebuildService(db)
    
    task = IndexTask(
        task_id="test_task",
        status=TaskStatus.RUNNING,
        target_document_count=1
    )
    db.add(task)
    db.commit()
    
    existing_doc = DocumentVersion(
        document_id="doc_001",
        version=1,
        content_hash="same_hash",
        title="已存在的文档"
    )
    db.add(existing_doc)
    db.commit()
    
    document_versions = [
        DocumentVersionCreate(
            document_id="doc_001",
            version=1,
            content_hash="same_hash",
            title="相同哈希的文档"
        )
    ]
    
    results = service.process_document_versions(task, document_versions)
    
    assert results["processed"] == 1
    assert results["success"] == 1
    assert results["failed"] == 0


def test_process_document_versions_duplicate_different_hash(db):
    service = IndexRebuildService(db)
    
    task = IndexTask(
        task_id="test_task",
        status=TaskStatus.RUNNING,
        target_document_count=1
    )
    db.add(task)
    db.commit()
    
    existing_doc = DocumentVersion(
        document_id="doc_001",
        version=1,
        content_hash="original_hash",
        title="已存在的文档"
    )
    db.add(existing_doc)
    db.commit()
    
    document_versions = [
        DocumentVersionCreate(
            document_id="doc_001",
            version=1,
            content_hash="different_hash",
            title="不同哈希的文档"
        )
    ]
    
    results = service.process_document_versions(task, document_versions)
    
    assert results["processed"] == 0
    assert results["success"] == 0
    assert results["failed"] == 1
    assert len(results["errors"]) == 1
    assert "内容不一致" in results["errors"][0]


def test_rollback_task_completed(db):
    service = IndexRebuildService(db)
    
    task = IndexTask(
        task_id="rollback_test",
        status=TaskStatus.COMPLETED,
        target_document_count=1
    )
    db.add(task)
    db.commit()
    
    doc = DocumentVersion(
        document_id="doc_001",
        version=1,
        content_hash="hash_001"
    )
    db.add(doc)
    db.commit()
    
    validation = ShardValidation(
        shard_id="shard_01",
        document_version_id=doc.id,
        index_task_id=task.id,
        expected_hash="hash_001",
        actual_hash="hash_001",
        is_valid=True
    )
    db.add(validation)
    db.commit()
    
    result = service.rollback_task(task, "测试回滚")
    
    assert result["success"] == True
    assert task.status == TaskStatus.ROLLED_BACK
    assert task.rollback_status == RollbackStatus.COMPLETED


def test_rollback_task_already_rolled_back(db):
    service = IndexRebuildService(db)
    
    task = IndexTask(
        task_id="already_rolled_back",
        status=TaskStatus.ROLLED_BACK,
        rollback_status=RollbackStatus.COMPLETED,
        target_document_count=1
    )
    db.add(task)
    db.commit()
    
    result = service.rollback_task(task, "再次回滚")
    
    assert result["success"] == True
    assert "已经回滚过了" in result["message"]


def test_get_task_status(db):
    service = IndexRebuildService(db)
    
    task = IndexTask(
        task_id="status_test",
        status=TaskStatus.COMPLETED,
        target_document_count=1
    )
    db.add(task)
    db.commit()
    
    doc = DocumentVersion(
        document_id="doc_001",
        version=1,
        content_hash="hash_001"
    )
    db.add(doc)
    db.commit()
    
    validation = ShardValidation(
        shard_id="shard_01",
        document_version_id=doc.id,
        index_task_id=task.id,
        expected_hash="hash_001",
        actual_hash="hash_001",
        is_valid=True
    )
    db.add(validation)
    db.commit()
    
    result = service.get_task_status("status_test")
    
    assert result["task"].task_id == "status_test"
    assert len(result["validations"]) == 1
    assert result["validations"][0].is_valid == True


def test_calculate_shard_id_consistency(db):
    service = IndexRebuildService(db)
    
    shard_id_1 = service._calculate_shard_id("doc_001")
    shard_id_2 = service._calculate_shard_id("doc_001")
    
    assert shard_id_1 == shard_id_2
    assert shard_id_1.startswith("shard_")
