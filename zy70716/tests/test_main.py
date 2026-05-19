import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import Base, get_db
import models


@pytest.fixture(scope="function")
def db_session():
    db_file = f"./test_{os.getpid()}.db"
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{db_file}"
    
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)
    
    if os.path.exists(db_file):
        os.remove(db_file)


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    from main import app
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    del app.dependency_overrides[get_db]


class TestFailureCase:
    def test_create_failure_case(self, client):
        response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/page",
                "browser_matrix": {"chrome": "<90", "ie": "11"},
                "failure_cases": [
                    {"case_id": "TEST-001", "description": "测试失败", "browser": "ie", "browser_version": "11"}
                ],
                "reporter": "qa001"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["page_path"] == "/test/page"
        assert data["conclusion"] == "pending"
        assert data["exemption_status"] == "none"
    
    def test_list_failure_cases(self, client):
        for i in range(3):
            client.post(
                "/api/v1/failures",
                json={
                    "page_path": f"/test/page{i}",
                    "browser_matrix": {"chrome": "<90"},
                    "failure_cases": [{"case_id": f"TEST-{i:03d}", "description": "测试失败"}],
                    "reporter": "qa001"
                }
            )
        
        response = client.get("/api/v1/failures")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 3
    
    def test_get_failure_case(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/single",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001", "description": "测试失败"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        get_response = client.get(f"/api/v1/failures/{failure_id}")
        assert get_response.status_code == 200
        data = get_response.json()
        assert data["page_path"] == "/test/single"
    
    def test_get_nonexistent_failure_case(self, client):
        response = client.get("/api/v1/failures/99999")
        assert response.status_code == 404
    
    def test_update_conclusion(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/conclusion",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        update_response = client.put(
            f"/api/v1/failures/{failure_id}/conclusion",
            json={
                "conclusion": "fixed",
                "conclusion_note": "已修复",
                "operator": "dev001"
            }
        )
        assert update_response.status_code == 200
        data = update_response.json()
        assert data["conclusion"] == "fixed"
        assert data["conclusion_note"] == "已修复"


class TestExemption:
    def test_create_exemption(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/exemption",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        exemption_response = client.post(
            "/api/v1/exemptions",
            json={
                "failure_id": failure_id,
                "exemption_reason": "测试豁免",
                "exempt_browsers": ["ie"],
                "expire_days": 30,
                "applicant": "dev001"
            }
        )
        assert exemption_response.status_code == 200
        data = exemption_response.json()
        assert data["status"] == "pending"
        assert data["is_expired"] == False
    
    def test_create_exemption_for_nonexistent_failure(self, client):
        response = client.post(
            "/api/v1/exemptions",
            json={
                "failure_id": 99999,
                "exemption_reason": "测试",
                "exempt_browsers": ["ie"],
                "expire_days": 30,
                "applicant": "dev001"
            }
        )
        assert response.status_code == 404
    
    def test_review_exemption_approved(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/review",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        exemption_response = client.post(
            "/api/v1/exemptions",
            json={
                "failure_id": failure_id,
                "exemption_reason": "测试",
                "exempt_browsers": ["ie"],
                "expire_days": 30,
                "applicant": "dev001"
            }
        )
        exemption_id = exemption_response.json()["id"]
        
        review_response = client.put(
            f"/api/v1/exemptions/{exemption_id}/review",
            json={
                "review_result": "approved",
                "review_comment": "同意",
                "reviewer": "leader001"
            }
        )
        assert review_response.status_code == 200
        data = review_response.json()
        assert data["status"] == "approved"
        
        failure_check = client.get(f"/api/v1/failures/{failure_id}")
        assert failure_check.json()["conclusion"] == "exempted"
    
    def test_review_exemption_rejected(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/reject",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        exemption_response = client.post(
            "/api/v1/exemptions",
            json={
                "failure_id": failure_id,
                "exemption_reason": "测试",
                "exempt_browsers": ["ie"],
                "expire_days": 30,
                "applicant": "dev001"
            }
        )
        exemption_id = exemption_response.json()["id"]
        
        review_response = client.put(
            f"/api/v1/exemptions/{exemption_id}/review",
            json={
                "review_result": "rejected",
                "review_comment": "驳回",
                "reviewer": "leader001"
            }
        )
        assert review_response.status_code == 200
        assert review_response.json()["status"] == "rejected"
        
        failure_check = client.get(f"/api/v1/failures/{failure_id}")
        assert failure_check.json()["conclusion"] == "pending"
    
    def test_withdraw_exemption(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/withdraw",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        exemption_response = client.post(
            "/api/v1/exemptions",
            json={
                "failure_id": failure_id,
                "exemption_reason": "测试",
                "exempt_browsers": ["ie"],
                "expire_days": 30,
                "applicant": "dev001"
            }
        )
        exemption_id = exemption_response.json()["id"]
        
        withdraw_response = client.delete(
            f"/api/v1/exemptions/{exemption_id}?operator=dev001"
        )
        assert withdraw_response.status_code == 200
        assert withdraw_response.json()["status"] == "withdrawn"
    
    def test_list_exemptions(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/list",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        for i in range(2):
            client.post(
                "/api/v1/exemptions",
                json={
                    "failure_id": failure_id,
                    "exemption_reason": f"测试{i}",
                    "exempt_browsers": ["ie"],
                    "expire_days": 30,
                    "applicant": "dev001"
                }
            )
        
        response = client.get("/api/v1/exemptions")
        assert response.status_code == 200
        assert len(response.json()) >= 2


class TestConflictPaths:
    def test_duplicate_exemption_creation(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/duplicate",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        client.post(
            "/api/v1/exemptions",
            json={
                "failure_id": failure_id,
                "exemption_reason": "第一个",
                "exempt_browsers": ["ie"],
                "expire_days": 30,
                "applicant": "dev001"
            }
        )
        
        first_exemption = client.get(f"/api/v1/exemptions?failure_id={failure_id}").json()[0]
        
        client.put(
            f"/api/v1/exemptions/{first_exemption['id']}/review",
            json={
                "review_result": "approved",
                "review_comment": "同意",
                "reviewer": "leader001"
            }
        )
        
        duplicate_response = client.post(
            "/api/v1/exemptions",
            json={
                "failure_id": failure_id,
                "exemption_reason": "第二个",
                "exempt_browsers": ["ie"],
                "expire_days": 30,
                "applicant": "dev001"
            }
        )
        assert duplicate_response.status_code == 409
    
    def test_double_review_exemption(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/double",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        exemption_response = client.post(
            "/api/v1/exemptions",
            json={
                "failure_id": failure_id,
                "exemption_reason": "测试",
                "exempt_browsers": ["ie"],
                "expire_days": 30,
                "applicant": "dev001"
            }
        )
        exemption_id = exemption_response.json()["id"]
        
        client.put(
            f"/api/v1/exemptions/{exemption_id}/review",
            json={
                "review_result": "approved",
                "review_comment": "同意",
                "reviewer": "leader001"
            }
        )
        
        second_review = client.put(
            f"/api/v1/exemptions/{exemption_id}/review",
            json={
                "review_result": "rejected",
                "review_comment": "驳回",
                "reviewer": "leader002"
            }
        )
        assert second_review.status_code == 409
    
    def test_double_withdraw_exemption(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/double_withdraw",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        exemption_response = client.post(
            "/api/v1/exemptions",
            json={
                "failure_id": failure_id,
                "exemption_reason": "测试",
                "exempt_browsers": ["ie"],
                "expire_days": 30,
                "applicant": "dev001"
            }
        )
        exemption_id = exemption_response.json()["id"]
        
        client.delete(f"/api/v1/exemptions/{exemption_id}?operator=dev001")
        
        second_withdraw = client.delete(f"/api/v1/exemptions/{exemption_id}?operator=dev001")
        assert second_withdraw.status_code == 409


class TestBrowserMatrix:
    def test_validate_browser_matrix_compatible(self, client):
        response = client.post(
            "/api/v1/matrix/validate?browser=chrome&version=91",
            json={"chrome": "<90", "ie": "11"}
        )
        assert response.status_code == 200
        assert response.json()["is_compatible"] == False
    
    def test_validate_browser_matrix_incompatible(self, client):
        response = client.post(
            "/api/v1/matrix/validate?browser=ie&version=11",
            json={"chrome": "<90", "ie": "11"}
        )
        assert response.status_code == 200
        assert response.json()["is_compatible"] == True
    
    def test_validate_browser_not_in_matrix(self, client):
        response = client.post(
            "/api/v1/matrix/validate?browser=unknown&version=1",
            json={"chrome": "<90"}
        )
        assert response.status_code == 200
        assert response.json()["is_compatible"] == True


class TestAuditLog:
    def test_audit_log_created_on_failure_creation(self, client):
        client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/audit",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        
        log_response = client.get("/api/v1/audit-logs?resource_type=failure_case")
        assert log_response.status_code == 200
        logs = log_response.json()
        assert len(logs) >= 1
        assert logs[0]["operation_type"] == "create"
    
    def test_audit_log_created_on_conclusion_update(self, client):
        create_response = client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/audit_conclusion",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        failure_id = create_response.json()["id"]
        
        client.put(
            f"/api/v1/failures/{failure_id}/conclusion",
            json={
                "conclusion": "fixed",
                "conclusion_note": "已修复",
                "operator": "dev001"
            }
        )
        
        log_response = client.get("/api/v1/audit-logs")
        logs = log_response.json()
        assert any(log["operation_type"] == "update_conclusion" for log in logs)


class TestExport:
    def test_export_report(self, client):
        client.post(
            "/api/v1/failures",
            json={
                "page_path": "/test/export",
                "browser_matrix": {"ie": "11"},
                "failure_cases": [{"case_id": "TEST-001"}],
                "reporter": "qa001"
            }
        )
        
        response = client.get("/api/v1/export")
        assert response.status_code == 200
        assert "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" in response.headers["content-type"]
