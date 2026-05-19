import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import app
from database import Base, get_db
from models import SwitchStatus, HealthStatus

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
def cleanup():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def test_create_domain():
    response = client.post(
        "/domains/",
        json={
            "domain_name": "test.example.com",
            "primary_origin": "origin1.example.com",
            "backup_origin": "origin2.example.com"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["domain_name"] == "test.example.com"


def test_create_domain_duplicate():
    client.post(
        "/domains/",
        json={
            "domain_name": "test.example.com",
            "primary_origin": "origin1.example.com",
            "backup_origin": "origin2.example.com"
        }
    )
    response = client.post(
        "/domains/",
        json={
            "domain_name": "test.example.com",
            "primary_origin": "origin1.example.com",
            "backup_origin": "origin2.example.com"
        }
    )
    assert response.status_code == 409


def test_happy_path_full_flow():
    domain_response = client.post(
        "/domains/",
        json={
            "domain_name": "cdn.example.com",
            "primary_origin": "primary.example.com",
            "backup_origin": "backup.example.com",
            "success_threshold": 2
        }
    )
    domain_id = domain_response.json()["id"]

    switch_response = client.post(
        "/switches/",
        json={
            "domain_id": domain_id,
            "switch_reason": "Primary origin outage",
            "restore_condition": "Primary healthy for 2 checks",
            "created_by": "admin"
        }
    )
    assert switch_response.status_code == 201
    switch_id = switch_response.json()["id"]
    assert switch_response.json()["status"] == SwitchStatus.PENDING

    execute_response = client.post(
        f"/switches/{switch_id}/execute?operator=admin"
    )
    assert execute_response.status_code == 200
    assert execute_response.json()["status"] == SwitchStatus.SWITCHED

    health_start_response = client.post(
        f"/switches/{switch_id}/start-health-check?operator=system"
    )
    assert health_start_response.status_code == 200
    assert health_start_response.json()["status"] == SwitchStatus.HEALTH_CHECKING

    client.post(
        f"/switches/{switch_id}/health-checks",
        json={
            "target_origin": "primary.example.com",
            "status": HealthStatus.HEALTHY,
            "response_time": 100,
            "status_code": 200
        }
    )

    health2_response = client.post(
        f"/switches/{switch_id}/health-checks",
        json={
            "target_origin": "primary.example.com",
            "status": HealthStatus.HEALTHY,
            "response_time": 95,
            "status_code": 200
        }
    )
    assert health2_response.status_code == 201

    switch_detail = client.get(f"/switches/{switch_id}")
    assert switch_detail.json()["status"] == SwitchStatus.READY_TO_RESTORE

    restore_response = client.post(
        f"/switches/{switch_id}/restore?operator=admin"
    )
    assert restore_response.status_code == 200
    assert restore_response.json()["status"] == SwitchStatus.RESTORED

    close_response = client.post(
        f"/switches/{switch_id}/close?operator=admin&reason=Switch completed"
    )
    assert close_response.status_code == 200
    assert close_response.json()["status"] == SwitchStatus.CLOSED


def test_idempotency_same_switch():
    domain_response = client.post(
        "/domains/",
        json={
            "domain_name": "cdn.example.com",
            "primary_origin": "primary.example.com",
            "backup_origin": "backup.example.com"
        }
    )
    domain_id = domain_response.json()["id"]

    switch_data = {
        "domain_id": domain_id,
        "switch_reason": "Same reason",
        "restore_condition": "Healthy",
        "created_by": "admin"
    }

    response1 = client.post("/switches/", json=switch_data)
    response2 = client.post("/switches/", json=switch_data)

    assert response1.json()["id"] == response2.json()["id"]


def test_concurrent_switch_conflict():
    domain_response = client.post(
        "/domains/",
        json={
            "domain_name": "cdn.example.com",
            "primary_origin": "primary.example.com",
            "backup_origin": "backup.example.com"
        }
    )
    domain_id = domain_response.json()["id"]

    client.post(
        "/switches/",
        json={
            "domain_id": domain_id,
            "switch_reason": "First reason",
            "restore_condition": "Healthy",
            "created_by": "admin"
        }
    )

    response2 = client.post(
        "/switches/",
        json={
            "domain_id": domain_id,
            "switch_reason": "Second reason",
            "restore_condition": "Healthy",
            "created_by": "admin"
        }
    )
    assert response2.status_code == 409


def test_invalid_status_transition():
    domain_response = client.post(
        "/domains/",
        json={
            "domain_name": "cdn.example.com",
            "primary_origin": "primary.example.com",
            "backup_origin": "backup.example.com"
        }
    )
    domain_id = domain_response.json()["id"]

    switch_response = client.post(
        "/switches/",
        json={
            "domain_id": domain_id,
            "switch_reason": "Test",
            "created_by": "admin"
        }
    )
    switch_id = switch_response.json()["id"]

    restore_response = client.post(
        f"/switches/{switch_id}/restore?operator=admin"
    )
    assert restore_response.status_code == 400


def test_cancel_switch():
    domain_response = client.post(
        "/domains/",
        json={
            "domain_name": "cdn.example.com",
            "primary_origin": "primary.example.com",
            "backup_origin": "backup.example.com"
        }
    )
    domain_id = domain_response.json()["id"]

    switch_response = client.post(
        "/switches/",
        json={
            "domain_id": domain_id,
            "switch_reason": "Test",
            "created_by": "admin"
        }
    )
    switch_id = switch_response.json()["id"]

    cancel_response = client.post(
        f"/switches/{switch_id}/cancel?operator=admin&reason=No longer needed"
    )
    assert cancel_response.status_code == 200
    assert cancel_response.json()["status"] == SwitchStatus.CANCELLED


def test_manual_correction_bypass_state_machine():
    domain_response = client.post(
        "/domains/",
        json={
            "domain_name": "cdn.example.com",
            "primary_origin": "primary.example.com",
            "backup_origin": "backup.example.com"
        }
    )
    domain_id = domain_response.json()["id"]

    switch_response = client.post(
        "/switches/",
        json={
            "domain_id": domain_id,
            "switch_reason": "Test",
            "created_by": "admin"
        }
    )
    switch_id = switch_response.json()["id"]
    assert switch_response.json()["status"] == SwitchStatus.PENDING

    correct_response = client.post(
        f"/switches/{switch_id}/correct",
        json={
            "target_status": SwitchStatus.CLOSED,
            "operator": "superadmin",
            "reason": "Manual override - bypass state machine",
            "original_input": "Emergency fix"
        }
    )
    assert correct_response.status_code == 200
    assert correct_response.json()["status"] == SwitchStatus.CLOSED


def test_manual_correction_any_transition():
    domain_response = client.post(
        "/domains/",
        json={
            "domain_name": "cdn.example.com",
            "primary_origin": "primary.example.com",
            "backup_origin": "backup.example.com"
        }
    )
    domain_id = domain_response.json()["id"]

    switch_response = client.post(
        "/switches/",
        json={
            "domain_id": domain_id,
            "switch_reason": "Test",
            "created_by": "admin"
        }
    )
    switch_id = switch_response.json()["id"]

    correct_response = client.post(
        f"/switches/{switch_id}/correct",
        json={
            "target_status": SwitchStatus.RESTORED,
            "operator": "superadmin",
            "reason": "Direct PENDING -> RESTORED transition via manual correct"
        }
    )
    assert correct_response.status_code == 200
    assert correct_response.json()["status"] == SwitchStatus.RESTORED


def test_report_export():
    domain_response = client.post(
        "/domains/",
        json={
            "domain_name": "cdn.example.com",
            "primary_origin": "primary.example.com",
            "backup_origin": "backup.example.com"
        }
    )
    domain_id = domain_response.json()["id"]

    switch_response = client.post(
        "/switches/",
        json={
            "domain_id": domain_id,
            "switch_reason": "Test reason",
            "restore_condition": "Test condition",
            "created_by": "admin"
        }
    )
    switch_id = switch_response.json()["id"]

    report_response = client.get(f"/switches/{switch_id}/report")
    assert report_response.status_code == 200
    assert report_response.json()["switch_reason"] == "Test reason"

    export_response = client.get(f"/switches/{switch_id}/report/export")
    assert export_response.status_code == 200
    assert "text/csv" in export_response.headers["content-type"]


def test_restore_reminders():
    response = client.get("/reminders/restore")
    assert response.status_code == 200
    assert "count" in response.json()


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_get_non_existent_switch():
    response = client.get("/switches/99999")
    assert response.status_code == 404