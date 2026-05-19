import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import pytest

from app.main import app
from app.database import Base, get_db
from app.models import GPUModel

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

client = TestClient(app)


@pytest.fixture(scope="function")
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def test_create_gpu_resource(setup_db):
    response = client.post(
        "/gpu-resources/",
        json={"gpu_model": "A100", "total": 8, "available": 8},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["gpu_model"] == "A100"


def test_create_job(setup_db):
    client.post(
        "/gpu-resources/",
        json={"gpu_model": "A100", "total": 8, "available": 8},
    )
    
    response = client.post(
        "/jobs/",
        json={
            "job_id": "TEST-001",
            "gpu_model": "A100",
            "gpu_count": 2,
            "estimated_duration": 60,
            "priority": 10,
            "user": "test_user",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["job_id"] == "TEST-001"
    assert data["status"] == "pending"


def test_duplicate_job_idempotent(setup_db):
    client.post(
        "/gpu-resources/",
        json={"gpu_model": "A100", "total": 8, "available": 8},
    )
    
    job_data = {
        "job_id": "TEST-001",
        "gpu_model": "A100",
        "gpu_count": 2,
        "estimated_duration": 60,
        "priority": 10,
        "user": "test_user",
    }
    
    response1 = client.post("/jobs/", json=job_data)
    response2 = client.post("/jobs/", json=job_data)
    
    assert response1.status_code == 201
    assert response2.status_code == 200 or response2.status_code == 201
    assert response1.json()["id"] == response2.json()["id"]


def test_read_job(setup_db):
    client.post(
        "/gpu-resources/",
        json={"gpu_model": "A100", "total": 8, "available": 8},
    )
    
    client.post(
        "/jobs/",
        json={
            "job_id": "TEST-001",
            "gpu_model": "A100",
            "gpu_count": 2,
            "estimated_duration": 60,
            "priority": 10,
            "user": "test_user",
        },
    )
    
    response = client.get("/jobs/TEST-001")
    assert response.status_code == 200
    data = response.json()
    assert data["job_id"] == "TEST-001"


def test_advance_queue(setup_db):
    client.post(
        "/gpu-resources/",
        json={"gpu_model": "A100", "total": 8, "available": 8},
    )
    
    client.post(
        "/jobs/",
        json={
            "job_id": "TEST-001",
            "gpu_model": "A100",
            "gpu_count": 2,
            "estimated_duration": 60,
            "priority": 10,
            "user": "test_user",
        },
    )
    
    response = client.post("/jobs/advance/A100")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    assert data[0]["status"] == "running"


def test_release_job(setup_db):
    client.post(
        "/gpu-resources/",
        json={"gpu_model": "A100", "total": 8, "available": 8},
    )
    
    client.post(
        "/jobs/",
        json={
            "job_id": "TEST-001",
            "gpu_model": "A100",
            "gpu_count": 2,
            "estimated_duration": 60,
            "priority": 10,
            "user": "test_user",
        },
    )
    
    client.post("/jobs/advance/A100")
    
    response = client.post("/jobs/TEST-001/release?released_by=admin")
    assert response.status_code == 200
    data = response.json()
    assert data["job_id"] == "TEST-001"


def test_release_pending_job_fails(setup_db):
    client.post(
        "/gpu-resources/",
        json={"gpu_model": "A100", "total": 8, "available": 8},
    )
    
    client.post(
        "/jobs/",
        json={
            "job_id": "TEST-001",
            "gpu_model": "A100",
            "gpu_count": 2,
            "estimated_duration": 60,
            "priority": 10,
            "user": "test_user",
        },
    )
    
    response = client.post("/jobs/TEST-001/release?released_by=admin")
    assert response.status_code == 400
    assert "not running" in response.json()["detail"]


def test_cancel_running_job_returns_gpu(setup_db):
    client.post(
        "/gpu-resources/",
        json={"gpu_model": "A100", "total": 8, "available": 8},
    )
    
    client.post(
        "/jobs/",
        json={
            "job_id": "TEST-001",
            "gpu_model": "A100",
            "gpu_count": 2,
            "estimated_duration": 60,
            "priority": 10,
            "user": "test_user",
        },
    )
    
    client.post("/jobs/advance/A100")
    
    resources_before = client.get("/gpu-resources/").json()
    available_before = next(r["available"] for r in resources_before if r["gpu_model"] == "A100")
    assert available_before == 6
    
    response = client.delete("/jobs/TEST-001")
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"
    
    resources_after = client.get("/gpu-resources/").json()
    available_after = next(r["available"] for r in resources_after if r["gpu_model"] == "A100")
    assert available_after == 8


def test_cancel_job(setup_db):
    client.post(
        "/gpu-resources/",
        json={"gpu_model": "A100", "total": 8, "available": 8},
    )
    
    client.post(
        "/jobs/",
        json={
            "job_id": "TEST-001",
            "gpu_model": "A100",
            "gpu_count": 2,
            "estimated_duration": 60,
            "priority": 10,
            "user": "test_user",
        },
    )
    
    response = client.delete("/jobs/TEST-001")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "cancelled"


def test_queue_summary(setup_db):
    client.post(
        "/gpu-resources/",
        json={"gpu_model": "A100", "total": 8, "available": 8},
    )
    
    client.post(
        "/jobs/",
        json={
            "job_id": "TEST-001",
            "gpu_model": "A100",
            "gpu_count": 2,
            "estimated_duration": 60,
            "priority": 10,
            "user": "test_user",
        },
    )
    
    response = client.get("/queue/summary/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0


def test_export_queue(setup_db):
    client.post(
        "/gpu-resources/",
        json={"gpu_model": "A100", "total": 8, "available": 8},
    )
    
    client.post(
        "/jobs/",
        json={
            "job_id": "TEST-001",
            "gpu_model": "A100",
            "gpu_count": 2,
            "estimated_duration": 60,
            "priority": 10,
            "user": "test_user",
        },
    )
    
    response = client.get("/queue/export/")
    assert response.status_code == 200
    data = response.json()
    assert "jobs" in data
    assert "summary" in data
    assert "generated_at" in data


def test_job_not_found(setup_db):
    response = client.get("/jobs/NONEXISTENT")
    assert response.status_code == 404


def test_create_job_without_gpu_resource(setup_db):
    response = client.post(
        "/jobs/",
        json={
            "job_id": "TEST-001",
            "gpu_model": "A100",
            "gpu_count": 2,
            "estimated_duration": 60,
            "priority": 10,
            "user": "test_user",
        },
    )
    assert response.status_code == 400


def test_priority_order(setup_db):
    client.post(
        "/gpu-resources/",
        json={"gpu_model": "A100", "total": 2, "available": 2},
    )
    
    client.post(
        "/jobs/",
        json={
            "job_id": "LOW-PRIO",
            "gpu_model": "A100",
            "gpu_count": 2,
            "estimated_duration": 60,
            "priority": 1,
            "user": "test_user",
        },
    )
    
    client.post(
        "/jobs/",
        json={
            "job_id": "HIGH-PRIO",
            "gpu_model": "A100",
            "gpu_count": 2,
            "estimated_duration": 60,
            "priority": 10,
            "user": "test_user",
        },
    )
    
    response = client.post("/jobs/advance/A100")
    data = response.json()
    
    assert len(data) == 1
    assert data[0]["job_id"] == "HIGH-PRIO"


def test_create_exception_record(setup_db):
    response = client.post(
        "/exceptions/",
        json={
            "original_input": '{"job_id": "TEST"}',
            "handler": "admin",
            "conclusion": "Invalid request",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["handler"] == "admin"