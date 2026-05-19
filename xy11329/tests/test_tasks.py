import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import TaskStatus, TaskPriority
from app.services import TaskService, EscortService


@pytest.fixture
def db():
    engine = create_engine("sqlite:///:memory:")
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_create_task(db):
    service = TaskService(db)
    task, status = service.create_task(
        request_id="TEST001",
        patient_name="测试患者",
        patient_medical_record_no="MR001",
        patient_phone="13800000000",
        patient_department="内科",
        service_type="检查",
        from_location="住院部3楼",
        to_location="CT室",
        priority=TaskPriority.NORMAL,
        operator_role="dispatcher",
        operator_name="测试员",
    )
    assert status == "created"
    assert task.request_id == "TEST001"
    assert task.status == TaskStatus.PENDING
    assert task.patient.name == "测试患者"


def test_create_task_duplicate(db):
    service = TaskService(db)
    task1, status1 = service.create_task(
        request_id="TEST001",
        patient_name="测试患者",
        patient_medical_record_no="MR001",
    )
    assert status1 == "created"

    task2, status2 = service.create_task(
        request_id="TEST001",
        patient_name="测试患者2",
        patient_medical_record_no="MR002",
    )
    assert status2 == "duplicate"
    assert task2.id == task1.id


def test_assign_task(db):
    task_service = TaskService(db)
    escort_service = EscortService(db)

    escort, _ = escort_service.create_escort(
        name="测试陪检员",
        phone="13900000000",
        employee_id="E001",
    )

    task, _ = task_service.create_task(
        request_id="TEST001",
        patient_name="测试患者",
    )

    task, status = task_service.assign_task(
        task_id=task.id,
        escort_id=escort.id,
        operator_role="dispatcher",
        operator_name="测试员",
    )
    assert status == "assigned"
    assert task.status == TaskStatus.ASSIGNED
    assert task.assigned_escort_id == escort.id


def test_accept_task(db):
    task_service = TaskService(db)
    escort_service = EscortService(db)

    escort, _ = escort_service.create_escort(
        name="测试陪检员",
        phone="13900000000",
        employee_id="E001",
    )

    task, _ = task_service.create_task(
        request_id="TEST001",
        patient_name="测试患者",
    )

    task_service.assign_task(
        task_id=task.id,
        escort_id=escort.id,
        operator_role="dispatcher",
        operator_name="测试员",
    )

    task, status = task_service.accept_task(
        task_id=task.id,
        operator_role="escort",
        operator_name="测试陪检员",
    )
    assert status == "accepted"
    assert task.status == TaskStatus.ACCEPTED


def test_complete_task(db):
    task_service = TaskService(db)
    escort_service = EscortService(db)

    escort, _ = escort_service.create_escort(
        name="测试陪检员",
        phone="13900000000",
        employee_id="E001",
    )

    task, _ = task_service.create_task(
        request_id="TEST001",
        patient_name="测试患者",
    )

    task_service.assign_task(
        task_id=task.id,
        escort_id=escort.id,
        operator_role="dispatcher",
        operator_name="测试员",
    )

    task_service.accept_task(
        task_id=task.id,
        operator_role="escort",
        operator_name="测试陪检员",
    )

    task, status = task_service.complete_task(
        task_id=task.id,
        operator_role="escort",
        operator_name="测试陪检员",
        completion_note="完成检查",
    )
    assert status == "completed"
    assert task.status == TaskStatus.COMPLETED


def test_cancel_task(db):
    task_service = TaskService(db)

    task, _ = task_service.create_task(
        request_id="TEST001",
        patient_name="测试患者",
    )

    task, status = task_service.cancel_task(
        task_id=task.id,
        operator_role="dispatcher",
        operator_name="测试员",
        cancel_reason="患者取消",
    )
    assert status == "cancelled"
    assert task.status == TaskStatus.CANCELLED
    assert task.has_exception == True


def test_update_priority(db):
    task_service = TaskService(db)

    task, _ = task_service.create_task(
        request_id="TEST001",
        patient_name="测试患者",
        priority=TaskPriority.NORMAL,
    )

    task, status = task_service.update_priority(
        task_id=task.id,
        new_priority=TaskPriority.URGENT,
        operator_role="dispatcher",
        operator_name="测试员",
    )
    assert status == "priority_updated"
    assert task.priority == TaskPriority.URGENT


def test_list_tasks(db):
    task_service = TaskService(db)

    for i in range(5):
        task_service.create_task(
            request_id=f"TEST{i:03d}",
            patient_name=f"患者{i}",
        )

    tasks = task_service.list_tasks(limit=10)
    assert len(tasks) == 5


def test_audit_logs(db):
    task_service = TaskService(db)

    task, _ = task_service.create_task(
        request_id="TEST001",
        patient_name="测试患者",
    )

    logs = task_service.get_audit_logs(task_id=task.id)
    assert len(logs) >= 1
    assert logs[0].operation_type == "create"
