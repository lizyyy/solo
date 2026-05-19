import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
from main import app, Base, engine, get_db
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
test_engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

Base.metadata.create_all(bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_test_db():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)

def test_create_customer():
    response = client.post("/customers/", json={"id": "C001", "name": "测试客户"})
    assert response.status_code == 200
    data = response.json()
    assert data["code"] == 0
    assert data["data"]["id"] == "C001"

def test_create_package():
    client.post("/customers/", json={"id": "C001", "name": "测试客户"})
    now = datetime.utcnow().isoformat()
    end = (datetime.utcnow() + timedelta(days=365)).isoformat()
    response = client.post("/packages/", json={
        "id": "P001",
        "customer_id": "C001",
        "package_type": "API套餐",
        "total_quota": 10000.0,
        "start_time": now,
        "end_time": end
    })
    assert response.status_code == 200
    assert response.json()["code"] == 0

def test_create_event_idempotent():
    client.post("/customers/", json={"id": "C001", "name": "测试客户"})
    response1 = client.post("/events/", json={
        "id": "E001",
        "event_idempotent_key": "unique_key_001",
        "customer_id": "C001",
        "api_name": "测试接口"
    })
    assert response1.status_code == 200
    
    response2 = client.post("/events/", json={
        "id": "E002",
        "event_idempotent_key": "unique_key_001",
        "customer_id": "C001",
        "api_name": "测试接口"
    })
    assert response2.status_code == 200
    assert "事件已存在" in response2.json()["message"]

def test_deduction_workflow():
    client.post("/customers/", json={"id": "C001", "name": "测试客户"})
    now = datetime.utcnow().isoformat()
    end = (datetime.utcnow() + timedelta(days=365)).isoformat()
    client.post("/packages/", json={
        "id": "P001", "customer_id": "C001", "package_type": "API套餐",
        "total_quota": 1000.0, "start_time": now, "end_time": end
    })
    client.post("/events/", json={
        "id": "E001", "event_idempotent_key": "key_001",
        "customer_id": "C001", "api_name": "测试接口"
    })
    
    response = client.post("/events/deduct", json={
        "id": "D001", "event_id": "E001", "package_id": "P001",
        "customer_id": "C001", "deduct_amount": 100.0,
        "deduct_reason": "测试扣减"
    })
    assert response.status_code == 200
    assert response.json()["data"]["remaining_quota"] == 900.0

def test_deduction_insufficient_balance():
    client.post("/customers/", json={"id": "C001", "name": "测试客户"})
    now = datetime.utcnow().isoformat()
    end = (datetime.utcnow() + timedelta(days=365)).isoformat()
    client.post("/packages/", json={
        "id": "P001", "customer_id": "C001", "package_type": "API套餐",
        "total_quota": 50.0, "start_time": now, "end_time": end
    })
    client.post("/events/", json={
        "id": "E001", "event_idempotent_key": "key_001",
        "customer_id": "C001", "api_name": "测试接口"
    })
    
    response = client.post("/events/deduct", json={
        "id": "D001", "event_id": "E001", "package_id": "P001",
        "customer_id": "C001", "deduct_amount": 100.0,
        "deduct_reason": "测试扣减"
    })
    assert response.status_code == 400
    assert "余额不足" in response.json()["detail"]

def test_correction_approval_workflow():
    client.post("/customers/", json={"id": "C001", "name": "测试客户"})
    now = datetime.utcnow().isoformat()
    end = (datetime.utcnow() + timedelta(days=365)).isoformat()
    client.post("/packages/", json={
        "id": "P001", "customer_id": "C001", "package_type": "API套餐",
        "total_quota": 1000.0, "start_time": now, "end_time": end
    })
    client.post("/events/", json={
        "id": "E001", "event_idempotent_key": "key_001",
        "customer_id": "C001", "api_name": "测试接口"
    })
    client.post("/events/deduct", json={
        "id": "D001", "event_id": "E001", "package_id": "P001",
        "customer_id": "C001", "deduct_amount": 100.0,
        "deduct_reason": "测试扣减"
    })
    
    corr_response = client.post("/corrections/", json={
        "id": "CORR001", "customer_id": "C001", "deduction_id": "D001",
        "applicant": "客服小王", "apply_reason": "客户反馈扣错了",
        "correction_amount": 100.0
    })
    assert corr_response.status_code == 200
    assert corr_response.json()["data"]["status"] == "pending"
    
    approve_response = client.post("/corrections/approve", json={
        "application_id": "CORR001", "approver": "审批人老李",
        "action": "approve", "comment": "情况属实，予以冲正"
    })
    assert approve_response.status_code == 200
    assert approve_response.json()["data"]["status"] == "approved"
    
    pkg_response = client.get("/packages/P001")
    assert pkg_response.json()["data"]["remaining_quota"] == 1000.0

def test_correction_reject():
    client.post("/customers/", json={"id": "C001", "name": "测试客户"})
    now = datetime.utcnow().isoformat()
    end = (datetime.utcnow() + timedelta(days=365)).isoformat()
    client.post("/packages/", json={
        "id": "P001", "customer_id": "C001", "package_type": "API套餐",
        "total_quota": 1000.0, "start_time": now, "end_time": end
    })
    client.post("/events/", json={
        "id": "E001", "event_idempotent_key": "key_001",
        "customer_id": "C001", "api_name": "测试接口"
    })
    client.post("/events/deduct", json={
        "id": "D001", "event_id": "E001", "package_id": "P001",
        "customer_id": "C001", "deduct_amount": 100.0,
        "deduct_reason": "测试扣减"
    })
    
    client.post("/corrections/", json={
        "id": "CORR001", "customer_id": "C001", "deduction_id": "D001",
        "applicant": "客服小王", "apply_reason": "客户反馈扣错了",
        "correction_amount": 100.0
    })
    
    reject_response = client.post("/corrections/approve", json={
        "application_id": "CORR001", "approver": "审批人老李",
        "action": "reject", "comment": "扣减正常，不予冲正"
    })
    assert reject_response.status_code == 200
    assert reject_response.json()["data"]["status"] == "rejected"

def test_reconciliation():
    client.post("/customers/", json={"id": "C001", "name": "测试客户"})
    now = datetime.utcnow().isoformat()
    end = (datetime.utcnow() + timedelta(days=365)).isoformat()
    client.post("/packages/", json={
        "id": "P001", "customer_id": "C001", "package_type": "API套餐",
        "total_quota": 1000.0, "start_time": now, "end_time": end
    })
    client.post("/events/", json={
        "id": "E001", "event_idempotent_key": "key_001",
        "customer_id": "C001", "api_name": "测试接口"
    })
    client.post("/events/deduct", json={
        "id": "D001", "event_id": "E001", "package_id": "P001",
        "customer_id": "C001", "deduct_amount": 100.0,
        "deduct_reason": "测试扣减"
    })
    
    response = client.post("/reconciliations/", params={
        "customer_id": "C001", "package_id": "P001", "created_by": "对账员小张"
    })
    assert response.status_code == 200
    assert response.json()["data"]["difference"] == 0

def test_export_deductions():
    client.post("/customers/", json={"id": "C001", "name": "测试客户"})
    now = datetime.utcnow().isoformat()
    end = (datetime.utcnow() + timedelta(days=365)).isoformat()
    client.post("/packages/", json={
        "id": "P001", "customer_id": "C001", "package_type": "API套餐",
        "total_quota": 1000.0, "start_time": now, "end_time": end
    })
    client.post("/events/", json={
        "id": "E001", "event_idempotent_key": "key_001",
        "customer_id": "C001", "api_name": "测试接口"
    })
    client.post("/events/deduct", json={
        "id": "D001", "event_id": "E001", "package_id": "P001",
        "customer_id": "C001", "deduct_amount": 100.0,
        "deduct_reason": "测试扣减"
    })
    
    response = client.get("/export/deductions/C001")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]

def test_list_deductions():
    client.post("/customers/", json={"id": "C001", "name": "测试客户"})
    now = datetime.utcnow().isoformat()
    end = (datetime.utcnow() + timedelta(days=365)).isoformat()
    client.post("/packages/", json={
        "id": "P001", "customer_id": "C001", "package_type": "API套餐",
        "total_quota": 1000.0, "start_time": now, "end_time": end
    })
    client.post("/events/", json={
        "id": "E001", "event_idempotent_key": "key_001",
        "customer_id": "C001", "api_name": "测试接口"
    })
    client.post("/events/deduct", json={
        "id": "D001", "event_id": "E001", "package_id": "P001",
        "customer_id": "C001", "deduct_amount": 100.0,
        "deduct_reason": "测试扣减"
    })
    
    response = client.get("/deductions/", params={"customer_id": "C001"})
    assert response.status_code == 200
    assert len(response.json()["data"]) == 1
