import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base, get_db
from main import app
from schemas import IncidentStatus

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


@pytest.fixture(scope="function")
def client():
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)


def create_test_incident_data(overrides=None):
    now = datetime.utcnow()
    base = {
        "tenant_id": "test-tenant-001",
        "tenant_name": "测试租户",
        "metric_name": "API调用次数",
        "metric_value": 2500000,
        "baseline_value": 1000000,
        "deviation_ratio": 2.5,
        "start_time": (now - timedelta(hours=2)).isoformat(),
        "end_time": (now - timedelta(hours=1)).isoformat(),
        "title": "测试租户 - API调用次数异常暴涨",
        "created_by": "test_operator",
        "raw_input": '{"source": "test"}'
    }
    if overrides:
        base.update(overrides)
    return base


class TestIncidentCreation:
    def test_create_incident_success(self, client):
        data = create_test_incident_data()
        response = client.post("/api/v1/incidents", json=data)
        assert response.status_code == 201
        result = response.json()
        assert result["tenant_id"] == data["tenant_id"]
        assert result["status"] == IncidentStatus.CREATED
        assert "id" in result

    def test_create_incident_idempotent(self, client):
        data = create_test_incident_data({"id": "inc-test-001"})
        response1 = client.post("/api/v1/incidents", json=data)
        assert response1.status_code == 201

        response2 = client.post("/api/v1/incidents", json=data)
        assert response2.status_code == 409
        assert response2.json()["detail"]["conflict"] is True
        assert "existing_incident_id" in response2.json()["detail"]

    def test_create_incident_overlapping_window(self, client):
        now = datetime.utcnow()
        data1 = create_test_incident_data({
            "start_time": (now - timedelta(hours=3)).isoformat(),
            "end_time": (now - timedelta(hours=1)).isoformat()
        })
        response1 = client.post("/api/v1/incidents", json=data1)
        assert response1.status_code == 201

        data2 = create_test_incident_data({
            "start_time": (now - timedelta(hours=2)).isoformat(),
            "end_time": now.isoformat()
        })
        response2 = client.post("/api/v1/incidents", json=data2)
        assert response2.status_code == 409


class TestIncidentQuery:
    def test_get_incident_success(self, client):
        data = create_test_incident_data()
        create_response = client.post("/api/v1/incidents", json=data)
        incident_id = create_response.json()["id"]

        get_response = client.get(f"/api/v1/incidents/{incident_id}")
        assert get_response.status_code == 200
        assert get_response.json()["id"] == incident_id

    def test_get_incident_not_found(self, client):
        response = client.get("/api/v1/incidents/nonexistent")
        assert response.status_code == 404

    def test_list_incidents(self, client):
        for i in range(3):
            data = create_test_incident_data({
                "tenant_id": f"test-tenant-{i:03d}",
                "tenant_name": f"测试租户{i}"
            })
            client.post("/api/v1/incidents", json=data)

        response = client.get("/api/v1/incidents")
        assert response.status_code == 200
        assert len(response.json()) >= 3


class TestStatusTransition:
    def test_transition_to_investigating(self, client):
        data = create_test_incident_data()
        create_response = client.post("/api/v1/incidents", json=data)
        incident_id = create_response.json()["id"]

        transition_data = {
            "target_status": IncidentStatus.INVESTIGATING,
            "operator": "ops_test",
            "conclusion": "开始调查"
        }
        response = client.post(
            f"/api/v1/incidents/{incident_id}/status",
            json=transition_data
        )
        assert response.status_code == 200
        assert response.json()["status"] == IncidentStatus.INVESTIGATING

    def test_invalid_transition_created_to_resolved(self, client):
        data = create_test_incident_data()
        create_response = client.post("/api/v1/incidents", json=data)
        incident_id = create_response.json()["id"]

        transition_data = {
            "target_status": IncidentStatus.RESOLVED,
            "operator": "ops_test",
            "conclusion": "试图直接从 created 跳到 resolved"
        }
        response = client.post(
            f"/api/v1/incidents/{incident_id}/status",
            json=transition_data
        )
        assert response.status_code == 400
        assert "状态流转无效" in response.json()["detail"]
        incident_response = client.get(f"/api/v1/incidents/{incident_id}")
        assert incident_response.json()["status"] == IncidentStatus.CREATED

    def test_valid_full_workflow(self, client):
        data = create_test_incident_data()
        create_response = client.post("/api/v1/incidents", json=data)
        incident_id = create_response.json()["id"]

        transition_data = {
            "target_status": IncidentStatus.INVESTIGATING,
            "operator": "ops_test",
            "conclusion": "开始调查"
        }
        response = client.post(f"/api/v1/incidents/{incident_id}/status", json=transition_data)
        assert response.status_code == 200

        transition_data["target_status"] = IncidentStatus.ATTRIBUTED
        response = client.post(f"/api/v1/incidents/{incident_id}/status", json=transition_data)
        assert response.status_code == 200

        transition_data["target_status"] = IncidentStatus.RESOLVED
        response = client.post(f"/api/v1/incidents/{incident_id}/status", json=transition_data)
        assert response.status_code == 200

        response = client.post(
            f"/api/v1/incidents/{incident_id}/close",
            params={"operator": "manager_test", "conclusion": "事故已解决"}
        )
        assert response.status_code == 200
        assert response.json()["status"] == IncidentStatus.CLOSED

    def test_full_status_not_found(self, client):
        transition_data = {
            "target_status": IncidentStatus.INVESTIGATING,
            "operator": "ops_test",
            "conclusion": "开始调查"
        }
        response = client.post(
            "/api/v1/incidents/nonexistent/status",
            json=transition_data
        )
        assert response.status_code == 404


class TestClueManagement:
    def test_add_clue_success(self, client):
        data = create_test_incident_data()
        create_response = client.post("/api/v1/incidents", json=data)
        incident_id = create_response.json()["id"]

        clue_data = {
            "source_system": "test_system",
            "clue_type": "log_anomaly",
            "description": "发现异常日志",
            "confidence": 0.85,
            "is_primary": True,
            "created_by": "dev_test"
        }
        response = client.post(
            f"/api/v1/incidents/{incident_id}/clues",
            json=clue_data
        )
        assert response.status_code == 201
        assert response.json()["description"] == "发现异常日志"

    def test_add_duplicate_clue_idempotent(self, client):
        data = create_test_incident_data()
        create_response = client.post("/api/v1/incidents", json=data)
        incident_id = create_response.json()["id"]

        clue_data = {
            "source_system": "test_system",
            "clue_type": "log_anomaly",
            "description": "发现异常日志",
            "confidence": 0.85,
            "is_primary": True,
            "created_by": "dev_test"
        }
        response1 = client.post(f"/api/v1/incidents/{incident_id}/clues", json=clue_data)
        assert response1.status_code == 201
        clue_id_1 = response1.json()["id"]

        response2 = client.post(f"/api/v1/incidents/{incident_id}/clues", json=clue_data)
        assert response2.status_code == 201
        clue_id_2 = response2.json()["id"]

        assert clue_id_1 == clue_id_2

        response = client.get(f"/api/v1/incidents/{incident_id}/clues")
        assert response.status_code == 200
        assert len(response.json()) == 1

    def test_get_clues(self, client):
        data = create_test_incident_data()
        create_response = client.post("/api/v1/incidents", json=data)
        incident_id = create_response.json()["id"]

        clue_data = {
            "source_system": "test_system",
            "clue_type": "log_anomaly",
            "description": "发现异常日志",
            "confidence": 0.85,
            "is_primary": True,
            "created_by": "dev_test"
        }
        client.post(f"/api/v1/incidents/{incident_id}/clues", json=clue_data)

        response = client.get(f"/api/v1/incidents/{incident_id}/clues")
        assert response.status_code == 200
        assert len(response.json()) == 1


def _transition_to_status(client, incident_id: str, target_status: str):
    transition_data = {
        "target_status": target_status,
        "operator": "ops_test",
        "conclusion": f"流转到 {target_status}"
    }
    return client.post(f"/api/v1/incidents/{incident_id}/status", json=transition_data)


class TestManualCorrectAndClose:
    def test_manual_correct(self, client):
        data = create_test_incident_data()
        create_response = client.post("/api/v1/incidents", json=data)
        incident_id = create_response.json()["id"]

        update_data = {
            "summary": "这是人工修正的摘要",
            "metric_value": 3000000
        }
        response = client.patch(
            f"/api/v1/incidents/{incident_id}",
            params={"operator": "manager_test"},
            json=update_data
        )
        assert response.status_code == 200
        assert response.json()["summary"] == "这是人工修正的摘要"
        assert response.json()["metric_value"] == 3000000

    def test_close_incident_invalid_from_created(self, client):
        data = create_test_incident_data()
        create_response = client.post("/api/v1/incidents", json=data)
        incident_id = create_response.json()["id"]

        response = client.post(
            f"/api/v1/incidents/{incident_id}/close",
            params={
                "operator": "manager_test",
                "conclusion": "事故已解决，用户已进行了限流措施"
            }
        )
        assert response.status_code == 400
        assert "状态流转无效" in response.json()["detail"]

    def test_close_incident_valid_from_resolved(self, client):
        data = create_test_incident_data()
        create_response = client.post("/api/v1/incidents", json=data)
        incident_id = create_response.json()["id"]

        _transition_to_status(client, incident_id, IncidentStatus.INVESTIGATING)
        _transition_to_status(client, incident_id, IncidentStatus.ATTRIBUTED)
        _transition_to_status(client, incident_id, IncidentStatus.RESOLVED)

        response = client.post(
            f"/api/v1/incidents/{incident_id}/close",
            params={
                "operator": "manager_test",
                "conclusion": "事故已解决，用户已进行了限流措施"
            }
        )
        assert response.status_code == 200
        assert response.json()["status"] == IncidentStatus.CLOSED

    def test_withdraw_incident_valid_from_created(self, client):
        data = create_test_incident_data()
        create_response = client.post("/api/v1/incidents", json=data)
        incident_id = create_response.json()["id"]

        response = client.post(
            f"/api/v1/incidents/{incident_id}/withdraw",
            params={
                "operator": "manager_test",
                "reason": "误报，指标恢复正常"
            }
        )
        assert response.status_code == 200
        assert response.json()["status"] == IncidentStatus.WITHDRAWN

    def test_withdraw_incident_valid_from_investigating(self, client):
        data = create_test_incident_data()
        create_response = client.post("/api/v1/incidents", json=data)
        incident_id = create_response.json()["id"]

        _transition_to_status(client, incident_id, IncidentStatus.INVESTIGATING)

        response = client.post(
            f"/api/v1/incidents/{incident_id}/withdraw",
            params={
                "operator": "manager_test",
                "reason": "误报，指标恢复正常"
            }
        )
        assert response.status_code == 200
        assert response.json()["status"] == IncidentStatus.WITHDRAWN

    def test_withdraw_incident_invalid_from_closed(self, client):
        data = create_test_incident_data()
        create_response = client.post("/api/v1/incidents", json=data)
        incident_id = create_response.json()["id"]

        _transition_to_status(client, incident_id, IncidentStatus.INVESTIGATING)
        _transition_to_status(client, incident_id, IncidentStatus.ATTRIBUTED)
        _transition_to_status(client, incident_id, IncidentStatus.RESOLVED)
        client.post(
            f"/api/v1/incidents/{incident_id}/close",
            params={"operator": "manager_test", "conclusion": "已关闭"}
        )

        response = client.post(
            f"/api/v1/incidents/{incident_id}/withdraw",
            params={
                "operator": "manager_test",
                "reason": "试图从已关闭状态撤回"
            }
        )
        assert response.status_code == 400
        assert "状态流转无效" in response.json()["detail"]


class TestExportAndActions:
    def test_export_incident(self, client):
        data = create_test_incident_data()
        create_response = client.post("/api/v1/incidents", json=data)
        incident_id = create_response.json()["id"]

        clue_data = {
            "source_system": "test_system",
            "clue_type": "log_anomaly",
            "description": "主要原因：客户端批量任务",
            "confidence": 0.95,
            "is_primary": True,
            "created_by": "dev_test"
        }
        client.post(f"/api/v1/incidents/{incident_id}/clues", json=clue_data)

        _transition_to_status(client, incident_id, IncidentStatus.INVESTIGATING)
        _transition_to_status(client, incident_id, IncidentStatus.ATTRIBUTED)
        _transition_to_status(client, incident_id, IncidentStatus.RESOLVED)

        client.post(
            f"/api/v1/incidents/{incident_id}/close",
            params={
                "operator": "manager_test",
                "conclusion": "事故已解决"
            }
        )

        response = client.get(f"/api/v1/incidents/{incident_id}/export")
        assert response.status_code == 200
        export_data = response.json()
        assert export_data["incident_id"] == incident_id
        assert "primary_clue" in export_data
        assert "final_conclusion" in export_data
        assert export_data["clue_count"] == 1

    def test_get_actions(self, client):
        data = create_test_incident_data()
        create_response = client.post("/api/v1/incidents", json=data)
        incident_id = create_response.json()["id"]

        transition_data = {
            "target_status": IncidentStatus.INVESTIGATING,
            "operator": "ops_test",
            "conclusion": "开始调查"
        }
        client.post(f"/api/v1/incidents/{incident_id}/status", json=transition_data)

        response = client.get(f"/api/v1/incidents/{incident_id}/actions")
        assert response.status_code == 200
        assert len(response.json()) >= 1


class TestHealthCheck:
    def test_health_check(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
