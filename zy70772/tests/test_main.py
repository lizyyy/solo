import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import FlagStatus, ExperimentStatus

SQLALCHEMY_DATABASE_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
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


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def test_create_flag():
    response = client.post(
        "/api/flags/",
        json={
            "name": "test_flag_01",
            "description": "Test feature flag",
            "default_value": False,
            "owner": "developer@example.com",
            "experiment_status": "completed"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "test_flag_01"
    assert data["default_value"] is False
    assert data["status"] == "pending"


def test_create_flag_with_references():
    response = client.post(
        "/api/flags/",
        json={
            "name": "test_flag_02",
            "default_value": True,
            "owner": "dev@example.com",
            "code_references": [
                {
                    "file_path": "src/main.py",
                    "line_number": 42,
                    "code_snippet": "if flag.is_enabled():",
                    "language": "python"
                }
            ]
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert len(data["code_references"]) == 1
    assert data["code_references"][0]["file_path"] == "src/main.py"


def test_get_flag():
    create_response = client.post(
        "/api/flags/",
        json={"name": "test_get", "default_value": False}
    )
    flag_id = create_response.json()["id"]
    
    response = client.get(f"/api/flags/{flag_id}/")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == flag_id
    assert data["name"] == "test_get"


def test_get_flag_not_found():
    response = client.get("/api/flags/999/")
    assert response.status_code == 404


def test_list_flags():
    for i in range(3):
        client.post(
            "/api/flags/",
            json={"name": f"flag_{i}", "default_value": False}
        )
    
    response = client.get("/api/flags/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 3


def test_update_flag():
    create_response = client.post(
        "/api/flags/",
        json={"name": "update_test", "default_value": False}
    )
    flag_id = create_response.json()["id"]
    
    response = client.put(
        f"/api/flags/{flag_id}/",
        params={"processed_by": "admin"},
        json={"description": "Updated description", "owner": "new_owner"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["description"] == "Updated description"
    assert data["owner"] == "new_owner"


def test_update_status():
    create_response = client.post(
        "/api/flags/",
        json={"name": "status_test", "default_value": False}
    )
    flag_id = create_response.json()["id"]
    
    response = client.post(
        f"/api/flags/{flag_id}/status/",
        json={
            "new_status": "reviewing",
            "processed_by": "admin",
            "conclusion": "Ready for review"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "reviewing"


def test_scan_and_analyze():
    create_response = client.post(
        "/api/flags/",
        json={
            "name": "scan_test",
            "default_value": False,
            "experiment_status": "completed",
            "code_references": [
                {"file_path": "a.py", "line_number": 1},
                {"file_path": "b.py", "line_number": 2}
            ]
        }
    )
    flag_id = create_response.json()["id"]
    
    response = client.post(f"/api/flags/{flag_id}/scan/")
    assert response.status_code == 200
    data = response.json()
    assert data["reference_count"] == 2
    assert "risk_level" in data
    assert "deletion_suggestion" in data


def test_manual_correction():
    create_response = client.post(
        "/api/flags/",
        json={"name": "correct_test", "default_value": False}
    )
    flag_id = create_response.json()["id"]
    
    response = client.post(
        f"/api/flags/{flag_id}/correct/",
        json={
            "risk_level": "safe",
            "deletion_suggestion": "safe_to_delete",
            "processed_by": "admin",
            "notes": "Manually verified safe to delete"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["risk_level"] == "safe"
    assert data["deletion_suggestion"] == "safe_to_delete"


def test_cancel_flag():
    create_response = client.post(
        "/api/flags/",
        json={"name": "cancel_test", "default_value": False}
    )
    flag_id = create_response.json()["id"]
    
    response = client.post(
        f"/api/flags/{flag_id}/cancel/",
        params={
            "processed_by": "admin",
            "reason": "No longer needed"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "cancelled"


def test_add_code_reference():
    create_response = client.post(
        "/api/flags/",
        json={"name": "ref_test", "default_value": False}
    )
    flag_id = create_response.json()["id"]
    
    response = client.post(
        f"/api/flags/{flag_id}/references/",
        json={
            "file_path": "src/service.js",
            "line_number": 123,
            "language": "javascript"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["file_path"] == "src/service.js"


def test_generate_report():
    for i in range(2):
        client.post(
            "/api/flags/",
            json={"name": f"report_{i}", "default_value": False}
        )
    
    response = client.post("/api/reports/")
    assert response.status_code == 201
    data = response.json()
    assert data["total_flags"] >= 2


def test_get_audit_logs():
    create_response = client.post(
        "/api/flags/",
        json={"name": "audit_test", "default_value": False, "owner": "tester"}
    )
    flag_id = create_response.json()["id"]
    
    response = client.get(f"/api/flags/{flag_id}/audit/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["action"] == "CREATE"


def test_export_flags():
    for i in range(3):
        client.post(
            "/api/flags/",
            json={"name": f"export_{i}", "default_value": False}
        )
    
    response = client.get("/api/export/flags/")
    assert response.status_code == 200
    assert "application/vnd.openxmlformats" in response.headers["content-type"]


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_conflict_scenario_manual_override():
    create_response = client.post(
        "/api/flags/",
        json={
            "name": "conflict_flag",
            "default_value": False,
            "experiment_status": "active"
        }
    )
    flag_id = create_response.json()["id"]
    
    client.post(f"/api/flags/{flag_id}/scan/")
    
    after_scan = client.get(f"/api/flags/{flag_id}/").json()
    assert after_scan["deletion_suggestion"] == "do_not_delete"
    
    response = client.post(
        f"/api/flags/{flag_id}/correct/",
        json={
            "risk_level": "low",
            "deletion_suggestion": "safe_to_delete",
            "processed_by": "senior_admin",
            "notes": "Flag is actually safe, experiment is marked wrong"
        }
    )
    assert response.status_code == 200
    final_data = response.json()
    assert final_data["deletion_suggestion"] == "safe_to_delete"
