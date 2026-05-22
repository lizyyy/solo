import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.enums import TaskSource, TaskStatus, RetryCategory
from app.services.task_service import (
    create_task,
    handle_processing_failure,
    get_task_by_id,
    retry_task,
    compensate_task,
    close_task,
    mark_permanent_failed,
)
from app.schemas.task import (
    CompensationTaskCreate,
    RetryTaskRequest,
    CompensateRequest,
    CloseTaskRequest,
)


class TestStatusTransitions:
    def test_task_starts_in_pending_status(self, client: TestClient, db_session: Session):
        task_data = CompensationTaskCreate(
            idempotency_key="status-test-001",
            source=TaskSource.DRIVER_PHOTO,
            box_no="BOX001",
        )
        task = create_task(db_session, task_data)
        assert task.status == TaskStatus.PENDING

    def test_processing_failure_sets_waiting_retry(self, db_session: Session):
        task_data = CompensationTaskCreate(
            idempotency_key="status-test-002",
            source=TaskSource.DRIVER_PHOTO,
            box_no="BOX002",
            max_retry_count=3,
        )
        task = create_task(db_session, task_data)

        task = handle_processing_failure(db_session, task, "网络超时", RetryCategory.NETWORK_ERROR)

        assert task.status == TaskStatus.WAITING_RETRY
        assert task.retry_count == 1
        assert task.retry_category == RetryCategory.NETWORK_ERROR
        assert task.next_retry_at is not None

    def test_multiple_failures_reach_manual(self, db_session: Session):
        task_data = CompensationTaskCreate(
            idempotency_key="status-test-003",
            source=TaskSource.DRIVER_PHOTO,
            box_no="BOX003",
            max_retry_count=2,
        )
        task = create_task(db_session, task_data)

        task = handle_processing_failure(db_session, task, "第一次失败", RetryCategory.NETWORK_ERROR)
        assert task.status == TaskStatus.WAITING_RETRY
        assert task.retry_count == 1

        task = handle_processing_failure(db_session, task, "第二次失败", RetryCategory.NETWORK_ERROR)
        assert task.status == TaskStatus.WAITING_MANUAL
        assert task.retry_count == 2

    def test_retry_from_waiting_retry(self, db_session: Session):
        task_data = CompensationTaskCreate(
            idempotency_key="status-test-004",
            source=TaskSource.DRIVER_PHOTO,
            box_no="BOX004",
        )
        task = create_task(db_session, task_data)
        task = handle_processing_failure(db_session, task, "网络超时", RetryCategory.NETWORK_ERROR)
        assert task.status == TaskStatus.WAITING_RETRY

        task = retry_task(db_session, task, RetryTaskRequest(operator="admin", remark="手动重试"))
        assert task.status == TaskStatus.PROCESSING

    def test_compensate_task(self, db_session: Session):
        task_data = CompensationTaskCreate(
            idempotency_key="status-test-005",
            source=TaskSource.DRIVER_PHOTO,
            box_no="BOX005",
        )
        task = create_task(db_session, task_data)
        task = handle_processing_failure(db_session, task, "数据不完整", RetryCategory.DATA_INCOMPLETE)
        task = handle_processing_failure(db_session, task, "数据不完整", RetryCategory.DATA_INCOMPLETE)
        task = handle_processing_failure(db_session, task, "数据不完整", RetryCategory.DATA_INCOMPLETE)
        assert task.status == TaskStatus.WAITING_MANUAL

        task = compensate_task(
            db_session,
            task,
            CompensateRequest(operator="finance", compensation_amount=150.0, remark="审核通过"),
        )
        assert task.status == TaskStatus.COMPENSATED
        assert task.compensation_amount == 150.0

    def test_close_task(self, db_session: Session):
        task_data = CompensationTaskCreate(
            idempotency_key="status-test-006",
            source=TaskSource.DRIVER_PHOTO,
            box_no="BOX006",
        )
        task = create_task(db_session, task_data)

        task = close_task(
            db_session,
            task,
            CloseTaskRequest(operator="admin", remark="任务完成关闭"),
        )
        assert task.status == TaskStatus.CLOSED
        assert task.closed_at is not None

    def test_mark_permanent_failed(self, db_session: Session):
        task_data = CompensationTaskCreate(
            idempotency_key="status-test-007",
            source=TaskSource.DRIVER_PHOTO,
            box_no="BOX007",
        )
        task = create_task(db_session, task_data)

        task = mark_permanent_failed(db_session, task, "admin", "无法恢复，标记为死信")
        assert task.status == TaskStatus.PERMANENT_FAILED

    def test_status_logs_recorded(self, db_session: Session):
        task_data = CompensationTaskCreate(
            idempotency_key="status-test-008",
            source=TaskSource.DRIVER_PHOTO,
            box_no="BOX008",
        )
        task = create_task(db_session, task_data)
        task = handle_processing_failure(db_session, task, "网络超时", RetryCategory.NETWORK_ERROR)
        task = retry_task(db_session, task, RetryTaskRequest(operator="admin"))

        db_session.refresh(task)
        assert len(task.status_logs) >= 3

        statuses = [log.to_status for log in task.status_logs]
        assert TaskStatus.PENDING in statuses
        assert TaskStatus.WAITING_RETRY in statuses
        assert TaskStatus.PROCESSING in statuses

    def test_original_evidence_preserved(self, db_session: Session):
        task_data = CompensationTaskCreate(
            idempotency_key="evidence-test-001",
            source=TaskSource.DRIVER_PHOTO,
            box_no="BOX009",
            evidences=[
                {
                    "source_file": "driver_photo.xlsx",
                    "source_row_no": 5,
                    "original_value": "原始箱号: OLD-BOX-001",
                    "parsed_value": "BOX009",
                    "field_name": "box_no",
                }
            ],
        )
        task = create_task(db_session, task_data)

        db_session.refresh(task)
        assert len(task.evidences) == 1
        evidence = task.evidences[0]
        assert evidence.source_file == "driver_photo.xlsx"
        assert evidence.source_row_no == 5
        assert evidence.original_value == "原始箱号: OLD-BOX-001"
        assert evidence.parsed_value == "BOX009"
