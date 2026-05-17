import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta

from main import app
from database import Base, get_db, Employee, DoorArea, AccessLog, Whitelist
import services
import schemas

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    return TestClient(app)


@pytest.fixture
def db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_detection_task(client):
    response = client.post(
        "/api/detection/tasks",
        json={"name": "Test Task", "time_window_minutes": 60}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Task"
    assert data["time_window_minutes"] == 60
    assert data["status"] == "pending"


def test_detect_anomalies(db):
    door1 = DoorArea(name="Door 1", building="A", floor="1")
    door2 = DoorArea(name="Door 2", building="B", floor="1")
    db.add(door1)
    db.add(door2)
    db.commit()

    emp = Employee(
        employee_id="EMP001",
        name="Test User",
        department="IT",
        position="Dev",
        card_number="CARD001"
    )
    db.add(emp)
    db.commit()

    base_time = datetime(2024, 1, 1, 10, 0, 0)
    log1 = AccessLog(
        card_number="CARD001",
        door_area_id=door1.id,
        swipe_time=base_time,
        access_type="entry"
    )
    log2 = AccessLog(
        card_number="CARD001",
        door_area_id=door2.id,
        swipe_time=base_time + timedelta(minutes=5),
        access_type="entry"
    )
    db.add(log1)
    db.add(log2)
    db.commit()

    task = services.create_detection_task(
        db,
        schemas.DetectionTaskCreate(name="Test", time_window_minutes=60)
    )

    anomaly_count = services.detect_anomalies(db, task.id, 60)
    assert anomaly_count == 1

    db.refresh(task)
    assert task.total_anomalies == 1
    assert task.status == "completed"


def test_whitelist_filtering(db):
    door1 = DoorArea(name="Door 1", building="A", floor="1")
    door2 = DoorArea(name="Door 2", building="B", floor="1")
    db.add(door1)
    db.add(door2)
    db.commit()

    whitelist = Whitelist(
        card_number="CARD_WHITELIST",
        reason="Security",
        created_by="admin",
        is_active=True
    )
    db.add(whitelist)
    db.commit()

    base_time = datetime(2024, 1, 1, 10, 0, 0)
    log1 = AccessLog(
        card_number="CARD_WHITELIST",
        door_area_id=door1.id,
        swipe_time=base_time,
        access_type="entry"
    )
    log2 = AccessLog(
        card_number="CARD_WHITELIST",
        door_area_id=door2.id,
        swipe_time=base_time + timedelta(minutes=5),
        access_type="entry"
    )
    db.add(log1)
    db.add(log2)
    db.commit()

    task = services.create_detection_task(
        db,
        schemas.DetectionTaskCreate(name="Test", time_window_minutes=60)
    )

    anomaly_count = services.detect_anomalies(db, task.id, 60)
    assert anomaly_count == 0


def test_update_anomaly_status(db):
    door1 = DoorArea(name="Door 1", building="A", floor="1")
    door2 = DoorArea(name="Door 2", building="B", floor="1")
    db.add(door1)
    db.add(door2)
    db.commit()

    from database import AnomalyRecord
    anomaly = AnomalyRecord(
        task_id=1,
        card_number="CARD001",
        first_door_area="Door 1",
        second_door_area="Door 2",
        first_swipe_time=datetime.now(),
        second_swipe_time=datetime.now(),
        time_diff_minutes=5,
        status="pending"
    )
    db.add(anomaly)
    db.commit()

    updated = services.update_anomaly_status(
        db, anomaly.id, "processing", "handler1"
    )
    assert updated.status == "processing"
    assert updated.current_handler == "handler1"


def test_status_conflict_different_handler(db):
    door1 = DoorArea(name="Door 1", building="A", floor="1")
    door2 = DoorArea(name="Door 2", building="B", floor="1")
    db.add(door1)
    db.add(door2)
    db.commit()

    from database import AnomalyRecord
    anomaly = AnomalyRecord(
        task_id=1,
        card_number="CARD001",
        first_door_area="Door 1",
        second_door_area="Door 2",
        first_swipe_time=datetime.now(),
        second_swipe_time=datetime.now(),
        time_diff_minutes=5,
        status="processing",
        current_handler="handler1"
    )
    db.add(anomaly)
    db.commit()

    with pytest.raises(ValueError) as exc:
        services.update_anomaly_status(db, anomaly.id, "processing", "handler2")
    assert "being handled by handler1" in str(exc.value)


def test_correct_anomaly(db):
    door1 = DoorArea(name="Door 1", building="A", floor="1")
    door2 = DoorArea(name="Door 2", building="B", floor="1")
    db.add(door1)
    db.add(door2)
    db.commit()

    from database import AnomalyRecord
    anomaly = AnomalyRecord(
        task_id=1,
        card_number="CARD001",
        first_door_area="Door 1",
        second_door_area="Door 2",
        first_swipe_time=datetime.now(),
        second_swipe_time=datetime.now(),
        time_diff_minutes=5,
        status="pending"
    )
    db.add(anomaly)
    db.commit()

    result = services.correct_anomaly(
        db, anomaly.id, "确认为异常", True, "handler1"
    )
    assert result.status == "corrected"
    assert result.final_conclusion == "确认为异常"
    assert result.is_confirmed_anomaly is True


def test_close_anomaly(db):
    door1 = DoorArea(name="Door 1", building="A", floor="1")
    door2 = DoorArea(name="Door 2", building="B", floor="1")
    db.add(door1)
    db.add(door2)
    db.commit()

    from database import AnomalyRecord
    anomaly = AnomalyRecord(
        task_id=1,
        card_number="CARD001",
        first_door_area="Door 1",
        second_door_area="Door 2",
        first_swipe_time=datetime.now(),
        second_swipe_time=datetime.now(),
        time_diff_minutes=5,
        status="pending"
    )
    db.add(anomaly)
    db.commit()

    result = services.close_anomaly(
        db, anomaly.id, "系统时间同步问题", "admin"
    )
    assert result.status == "closed"
    assert result.close_reason == "系统时间同步问题"
    assert result.closed_by == "admin"


def test_close_closed_anomaly(db):
    door1 = DoorArea(name="Door 1", building="A", floor="1")
    door2 = DoorArea(name="Door 2", building="B", floor="1")
    db.add(door1)
    db.add(door2)
    db.commit()

    from database import AnomalyRecord
    anomaly = AnomalyRecord(
        task_id=1,
        card_number="CARD001",
        first_door_area="Door 1",
        second_door_area="Door 2",
        first_swipe_time=datetime.now(),
        second_swipe_time=datetime.now(),
        time_diff_minutes=5,
        status="closed"
    )
    db.add(anomaly)
    db.commit()

    with pytest.raises(ValueError) as exc:
        services.close_anomaly(db, anomaly.id, "reason", "handler")
    assert "already closed" in str(exc.value)


def test_export_anomalies(db):
    door1 = DoorArea(name="Door 1", building="A", floor="1")
    door2 = DoorArea(name="Door 2", building="B", floor="1")
    db.add(door1)
    db.add(door2)
    db.commit()

    from database import AnomalyRecord
    anomaly = AnomalyRecord(
        task_id=1,
        card_number="CARD001",
        employee_id="EMP001",
        employee_name="张三",
        first_door_area="Door 1",
        second_door_area="Door 2",
        first_swipe_time=datetime(2024, 1, 1, 10, 0, 0),
        second_swipe_time=datetime(2024, 1, 1, 10, 5, 0),
        time_diff_minutes=5,
        status="pending"
    )
    db.add(anomaly)
    db.commit()

    csv_content = services.export_anomalies_to_csv(db)
    assert "CARD001" in csv_content
    assert "张三" in csv_content
    assert "Door 1" in csv_content


def test_list_anomalies_api(client):
    response = client.get("/api/anomalies")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "items" in data


def test_correct_anomaly_api(client):
    response = client.post(
        "/api/anomalies/999/correct",
        json={"conclusion": "Test", "is_anomaly": True, "handler": "test"}
    )
    assert response.status_code == 404


def test_close_anomaly_api(client):
    response = client.post(
        "/api/anomalies/999/close",
        json={"reason": "Test", "handler": "test"}
    )
    assert response.status_code == 404


def test_get_task_api(client):
    response = client.get("/api/detection/tasks/999")
    assert response.status_code == 404
