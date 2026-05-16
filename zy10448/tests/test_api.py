import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
import json

from app.main import app
from app.database import Base, get_db
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="module")
def client():
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)

def test_root(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "version" in data

def create_test_incident_payload():
    window_start = datetime.utcnow() - timedelta(hours=6)
    window_end = datetime.utcnow() - timedelta(hours=4)
    
    return {
        "tenant": {
            "tenant_id": "test_tenant_001",
            "name": "测试租户",
            "email": "test@example.com"
        },
        "metric_name": "api_requests",
        "unit": "requests",
        "window_start": window_start.isoformat(),
        "window_end": window_end.isoformat(),
        "threshold_percent": 50.0,
        "title": "测试异常事故",
        "description": "这是一个测试用的异常事故",
        "attribution_clues": [
            {
                "clue_key": "test_clue_001",
                "source": "monitoring",
                "title": "测试线索",
                "description": "测试线索描述",
                "confidence": 0.8
            }
        ]
    }

def test_create_incident_normal_flow(client):
    payload = create_test_incident_payload()
    response = client.post("/api/incidents", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["incident_key"] is not None
    assert data["status"] is not None
    assert data["tenant"]["tenant_id"] == "test_tenant_001"
    return data["id"]

def test_create_incident_duplicate_idempotent(client):
    payload = create_test_incident_payload()
    payload["tenant"]["tenant_id"] = "test_tenant_002"
    
    response1 = client.post("/api/incidents", json=payload)
    assert response1.status_code == 201
    data1 = response1.json()
    
    response2 = client.post("/api/incidents", json=payload)
    assert response2.status_code == 201
    data2 = response2.json()
    
    assert data1["incident_key"] == data2["incident_key"]
    assert data1["id"] == data2["id"]

def test_create_incident_invalid_data(client):
    invalid_payload = {
        "tenant": {
            "name": "缺少tenant_id"
        },
        "metric_name": "api_requests"
    }
    response = client.post("/api/incidents", json=invalid_payload)
    assert response.status_code in [400, 422]

def test_list_incidents(client):
    response = client.get("/api/incidents")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "items" in data
    assert isinstance(data["items"], list)

def test_get_incident(client):
    payload = create_test_incident_payload()
    payload["tenant"]["tenant_id"] = "test_tenant_003"
    create_response = client.post("/api/incidents", json=payload)
    incident_id = create_response.json()["id"]
    
    response = client.get(f"/api/incidents/{incident_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == incident_id

def test_get_incident_not_found(client):
    response = client.get("/api/incidents/99999")
    assert response.status_code == 404

def test_update_incident_status(client):
    payload = create_test_incident_payload()
    payload["tenant"]["tenant_id"] = "test_tenant_004"
    create_response = client.post("/api/incidents", json=payload)
    incident_id = create_response.json()["id"]
    
    status_payload = {
        "status": "confirmed",
        "comment": "已确认异常"
    }
    response = client.patch(f"/api/incidents/{incident_id}/status", json=status_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "confirmed"

def test_add_attribution_clue(client):
    payload = create_test_incident_payload()
    payload["tenant"]["tenant_id"] = "test_tenant_005"
    create_response = client.post("/api/incidents", json=payload)
    incident_id = create_response.json()["id"]
    
    clue_payload = {
        "clue_key": "new_clue_001",
        "source": "manual",
        "title": "新人工线索",
        "description": "运营添加的线索",
        "confidence": 0.9,
        "is_manual": True
    }
    response = client.post(f"/api/incidents/{incident_id}/clues", json=clue_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["clue_key"] == "new_clue_001"

def test_add_action_item(client):
    payload = create_test_incident_payload()
    payload["tenant"]["tenant_id"] = "test_tenant_006"
    create_response = client.post("/api/incidents", json=payload)
    incident_id = create_response.json()["id"]
    
    action_payload = {
        "action_type": "investigation",
        "description": "调查异常原因",
        "owner": "张三",
        "status": "pending"
    }
    response = client.post(f"/api/incidents/{incident_id}/actions", json=action_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["description"] == "调查异常原因"
    assert data["owner"] == "张三"

def test_manual_correction(client):
    payload = create_test_incident_payload()
    payload["tenant"]["tenant_id"] = "test_tenant_007"
    create_response = client.post("/api/incidents", json=payload)
    incident_id = create_response.json()["id"]
    
    correction_payload = {
        "severity": "critical",
        "title": "修正后的标题",
        "baseline_adjustment": 30.0,
        "comment": "人工调整严重程度和基线",
        "reclaculate": True
    }
    response = client.post(f"/api/incidents/{incident_id}/correct", json=correction_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["severity"] == "critical"
    assert data["title"] == "修正后的标题"

def test_update_summary(client):
    payload = create_test_incident_payload()
    payload["tenant"]["tenant_id"] = "test_tenant_008"
    create_response = client.post("/api/incidents", json=payload)
    incident_id = create_response.json()["id"]
    
    summary_payload = {
        "root_cause": "营销活动导致流量激增",
        "impact_assessment": "影响约10万用户，API响应时间增加200ms",
        "resolution_summary": "扩容服务节点，限流策略调整",
        "lessons_learned": "需要建立大促前的容量评估机制"
    }
    response = client.put(f"/api/incidents/{incident_id}/summary", json=summary_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["root_cause"] == "营销活动导致流量激增"
    assert data["impact_assessment"] is not None

def test_export_incident(client):
    payload = create_test_incident_payload()
    payload["tenant"]["tenant_id"] = "test_tenant_009"
    create_response = client.post("/api/incidents", json=payload)
    incident_id = create_response.json()["id"]
    
    response = client.get(f"/api/incidents/{incident_id}/export")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "data" in data
    assert "original_input" in data["data"]
    assert "processing_result" in data["data"]

def test_export_incident_not_found(client):
    response = client.get("/api/incidents/99999/export")
    assert response.status_code == 404

def test_list_tenants(client):
    response = client.get("/api/tenants")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
