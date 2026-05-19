import os
import json
import tempfile
import shutil
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import pytest

from app.main import app
from app.database import Base, get_db
from app.models import TaskStatus

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


@pytest.fixture
def temp_artifact_dir():
    base_dir = tempfile.mkdtemp()
    
    beijing_dir = os.path.join(base_dir, "beijing")
    shanghai_dir = os.path.join(base_dir, "shanghai")
    guangzhou_dir = os.path.join(base_dir, "guangzhou")
    
    os.makedirs(beijing_dir)
    os.makedirs(shanghai_dir)
    os.makedirs(guangzhou_dir)
    
    with open(os.path.join(beijing_dir, "app.exe"), "w") as f:
        f.write("content123")
    with open(os.path.join(beijing_dir, "config.ini"), "w") as f:
        f.write("config")
    
    with open(os.path.join(shanghai_dir, "app.exe"), "w") as f:
        f.write("content123")
    with open(os.path.join(shanghai_dir, "config.ini"), "w") as f:
        f.write("config")
    
    with open(os.path.join(guangzhou_dir, "app.exe"), "w") as f:
        f.write("DIFFERENT")
    with open(os.path.join(guangzhou_dir, "extra.txt"), "w") as f:
        f.write("extra file")
    
    yield base_dir
    
    shutil.rmtree(base_dir)


def test_create_task():
    response = client.post(
        "/tasks/",
        json={
            "task_name": "test_task",
            "artifact_dir": "/tmp/artifacts",
            "regions": "beijing, shanghai"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["task_name"] == "test_task"
    assert data["status"] == "pending"
    assert data["id"] > 0


def test_read_tasks():
    response = client.get("/tasks/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_read_task():
    create_response = client.post(
        "/tasks/",
        json={
            "task_name": "read_test",
            "artifact_dir": "/tmp/artifacts",
            "regions": "beijing"
        }
    )
    task_id = create_response.json()["id"]
    
    response = client.get(f"/tasks/{task_id}")
    assert response.status_code == 200
    assert response.json()["id"] == task_id


def test_read_task_not_found():
    response = client.get("/tasks/99999")
    assert response.status_code == 404


def test_full_workflow(temp_artifact_dir):
    create_response = client.post(
        "/tasks/",
        json={
            "task_name": "full_test",
            "artifact_dir": temp_artifact_dir,
            "regions": "beijing, shanghai, guangzhou"
        }
    )
    task_id = create_response.json()["id"]
    
    scan_response = client.post(f"/tasks/{task_id}/scan")
    assert scan_response.status_code == 200
    assert scan_response.json()["status"] == TaskStatus.SCAN_COMPLETED.value
    
    compare_response = client.post(f"/tasks/{task_id}/compare")
    assert compare_response.status_code == 200
    assert compare_response.json()["status"] == TaskStatus.CONFLICT.value
    
    report = json.loads(compare_response.json()["report"])
    assert report["has_conflict"] is True
    assert len(report["hash_conflicts"]) > 0
    
    correct_response = client.post(
        f"/tasks/{task_id}/correct",
        json={
            "handler": "admin",
            "conclusion": "已确认广州区域为新版本，允许通过",
            "original_input": json.dumps(report),
            "new_status": "resolved"
        }
    )
    assert correct_response.status_code == 200
    
    export_response = client.get(f"/tasks/{task_id}/export")
    assert export_response.status_code == 200
    export_data = export_response.json()
    assert "task" in export_data
    assert "report" in export_data
    assert "files" in export_data
    assert "exceptions" in export_data


def test_advance_task(temp_artifact_dir):
    create_response = client.post(
        "/tasks/",
        json={
            "task_name": "advance_test",
            "artifact_dir": temp_artifact_dir,
            "regions": "beijing, shanghai"
        }
    )
    task_id = create_response.json()["id"]
    
    advance1 = client.post(f"/tasks/{task_id}/advance")
    assert advance1.status_code == 200
    assert advance1.json()["status"] == TaskStatus.SCAN_COMPLETED.value
    
    advance2 = client.post(f"/tasks/{task_id}/advance")
    assert advance2.status_code == 200
    assert advance2.json()["status"] == TaskStatus.CONFLICT.value


def test_cancel_task():
    create_response = client.post(
        "/tasks/",
        json={
            "task_name": "cancel_test",
            "artifact_dir": "/tmp/artifacts",
            "regions": "beijing"
        }
    )
    task_id = create_response.json()["id"]
    
    cancel_response = client.post(f"/tasks/{task_id}/cancel")
    assert cancel_response.status_code == 200
    assert cancel_response.json()["status"] == TaskStatus.CANCELLED.value


def test_close_task():
    create_response = client.post(
        "/tasks/",
        json={
            "task_name": "close_test",
            "artifact_dir": "/tmp/artifacts",
            "regions": "beijing"
        }
    )
    task_id = create_response.json()["id"]
    
    close_response = client.post(f"/tasks/{task_id}/close")
    assert close_response.status_code == 200
    assert close_response.json()["status"] == TaskStatus.CLOSED.value


def teardown_module():
    if os.path.exists("./test.db"):
        os.remove("./test.db")
