import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import json

from database import Base, get_db
from main import app

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

@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert "message" in response.json()

def test_create_batch():
    response = client.post(
        "/api/batches",
        json={
            "batch_no": "TEST-001",
            "dish_name": "测试菜品",
            "production_date": datetime.now().isoformat(),
            "quantity": 100,
            "operator": "测试员",
        }
    )
    assert response.status_code == 200
    assert response.json()["code"] == 200

def test_create_duplicate_batch():
    data = {
        "batch_no": "TEST-001",
        "dish_name": "测试菜品",
        "production_date": datetime.now().isoformat(),
        "quantity": 100,
        "operator": "测试员",
    }
    client.post("/api/batches", json=data)
    response = client.post("/api/batches", json=data)
    assert response.status_code == 400

def test_list_batches():
    for i in range(3):
        client.post(
            "/api/batches",
            json={
                "batch_no": f"TEST-00{i}",
                "dish_name": f"测试菜品{i}",
                "production_date": datetime.now().isoformat(),
                "quantity": 100,
                "operator": "测试员",
            }
        )
    response = client.get("/api/batches")
    assert response.status_code == 200
    assert len(response.json()) == 3

def test_create_storage_location():
    response = client.post(
        "/api/storage-locations",
        json={
            "location_code": "LOC-001",
            "location_name": "测试位置",
            "refrigerator_no": "A01",
            "shelf_no": "1层",
            "temperature": -18,
        }
    )
    assert response.status_code == 200

def test_sample_box_workflow():
    client.post(
        "/api/batches",
        json={
            "batch_no": "TEST-001",
            "dish_name": "测试菜品",
            "production_date": datetime.now().isoformat(),
            "quantity": 100,
            "operator": "测试员",
        }
    )
    client.post(
        "/api/storage-locations",
        json={
            "location_code": "LOC-001",
            "location_name": "测试位置",
            "refrigerator_no": "A01",
            "shelf_no": "1层",
            "temperature": -18,
        }
    )
    response = client.post(
        "/api/sample-boxes",
        json={
            "box_no": "BOX-001",
            "batch_id": 1,
            "storage_location_id": 1,
            "sample_date": datetime.now().isoformat(),
            "retention_days": 48,
            "operator": "测试员",
        }
    )
    assert response.status_code == 200

def test_sample_box_invalid_location():
    client.post(
        "/api/batches",
        json={
            "batch_no": "TEST-001",
            "dish_name": "测试菜品",
            "production_date": datetime.now().isoformat(),
            "quantity": 100,
            "operator": "测试员",
        }
    )
    response = client.post(
        "/api/sample-boxes",
        json={
            "box_no": "BOX-001",
            "batch_id": 1,
            "storage_location_id": 999,
            "sample_date": datetime.now().isoformat(),
            "retention_days": 48,
            "operator": "测试员",
        }
    )
    assert response.status_code == 400

def test_inspection_workflow():
    client.post(
        "/api/batches",
        json={
            "batch_no": "TEST-001",
            "dish_name": "测试菜品",
            "production_date": datetime.now().isoformat(),
            "quantity": 100,
            "operator": "测试员",
        }
    )
    client.post(
        "/api/storage-locations",
        json={
            "location_code": "LOC-001",
            "location_name": "测试位置",
            "refrigerator_no": "A01",
            "shelf_no": "1层",
            "temperature": -18,
        }
    )
    client.post(
        "/api/sample-boxes",
        json={
            "box_no": "BOX-001",
            "batch_id": 1,
            "storage_location_id": 1,
            "sample_date": datetime.now().isoformat(),
            "retention_days": 48,
            "operator": "测试员",
        }
    )
    response = client.post(
        "/api/inspections",
        json={
            "inspection_no": "INS-001",
            "batch_id": 1,
            "sample_box_id": 1,
            "inspection_date": datetime.now().isoformat(),
            "inspector": "测试员",
            "result": "合格",
            "conclusion": "正常",
        }
    )
    assert response.status_code == 200

def test_destruction_workflow():
    client.post(
        "/api/batches",
        json={
            "batch_no": "TEST-001",
            "dish_name": "测试菜品",
            "production_date": datetime.now().isoformat(),
            "quantity": 100,
            "operator": "测试员",
        }
    )
    client.post(
        "/api/storage-locations",
        json={
            "location_code": "LOC-001",
            "location_name": "测试位置",
            "refrigerator_no": "A01",
            "shelf_no": "1层",
            "temperature": -18,
        }
    )
    client.post(
        "/api/sample-boxes",
        json={
            "box_no": "BOX-001",
            "batch_id": 1,
            "storage_location_id": 1,
            "sample_date": datetime.now().isoformat(),
            "retention_days": 48,
            "operator": "测试员",
        }
    )

    apply_response = client.post(
        "/api/destructions",
        json={
            "destruction_no": "DEST-001",
            "sample_box_id": 1,
            "application_date": datetime.now().isoformat(),
            "applicant": "测试员",
            "reason": "留样到期",
        }
    )
    assert apply_response.status_code == 200

    review_response = client.post(
        "/api/destructions/1/review",
        json={
            "reviewer": "审核员",
            "review_result": "approved",
        }
    )
    assert review_response.status_code == 200

    execute_response = client.post(
        "/api/destructions/1/execute",
        json={
            "destructor": "销毁人",
            "destruction_method": "高温销毁",
            "witness": "见证人",
        }
    )
    assert execute_response.status_code == 200

def test_cancel_destruction():
    client.post(
        "/api/batches",
        json={
            "batch_no": "TEST-001",
            "dish_name": "测试菜品",
            "production_date": datetime.now().isoformat(),
            "quantity": 100,
            "operator": "测试员",
        }
    )
    client.post(
        "/api/storage-locations",
        json={
            "location_code": "LOC-001",
            "location_name": "测试位置",
            "refrigerator_no": "A01",
            "shelf_no": "1层",
            "temperature": -18,
        }
    )
    client.post(
        "/api/sample-boxes",
        json={
            "box_no": "BOX-001",
            "batch_id": 1,
            "storage_location_id": 1,
            "sample_date": datetime.now().isoformat(),
            "retention_days": 48,
            "operator": "测试员",
        }
    )
    client.post(
        "/api/destructions",
        json={
            "destruction_no": "DEST-001",
            "sample_box_id": 1,
            "application_date": datetime.now().isoformat(),
            "applicant": "测试员",
            "reason": "留样到期",
        }
    )
    response = client.post("/api/destructions/1/cancel?operator=测试员")
    assert response.status_code == 200

def test_exception_recording():
    client.post(
        "/api/sample-boxes",
        json={
            "box_no": "BOX-001",
            "batch_id": 999,
            "storage_location_id": 999,
            "sample_date": datetime.now().isoformat(),
            "retention_days": 48,
            "operator": "测试员",
        }
    )
    response = client.get("/api/exceptions")
    assert response.status_code == 200
    assert len(response.json()) > 0

def test_trace_report():
    client.post(
        "/api/batches",
        json={
            "batch_no": "TEST-001",
            "dish_name": "测试菜品",
            "production_date": datetime.now().isoformat(),
            "quantity": 100,
            "operator": "测试员",
        }
    )
    client.post(
        "/api/storage-locations",
        json={
            "location_code": "LOC-001",
            "location_name": "测试位置",
            "refrigerator_no": "A01",
            "shelf_no": "1层",
            "temperature": -18,
        }
    )
    client.post(
        "/api/sample-boxes",
        json={
            "box_no": "BOX-001",
            "batch_id": 1,
            "storage_location_id": 1,
            "sample_date": datetime.now().isoformat(),
            "retention_days": 48,
            "operator": "测试员",
        }
    )
    response = client.post("/api/reports/trace", json={})
    assert response.status_code == 200
    assert response.json()["code"] == 200
    assert len(response.json()["data"]) > 0
